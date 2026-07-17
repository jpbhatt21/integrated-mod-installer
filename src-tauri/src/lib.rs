use futures_util::StreamExt;
use once_cell::sync::Lazy;
use reqwest::Client;
use serde::Serialize;
use std::collections::HashMap;
use std::fs::{create_dir_all, remove_file, File};
use std::io::{BufWriter, Write};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, RwLock};
use std::time::Instant;
use tauri::Emitter;
use tauri::Manager;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_shell::ShellExt;
const PROGRESS_UPDATE_THRESHOLD: u64 = 1024;
const BUFFER_SIZE: usize = 8192;

#[derive(Serialize, Clone)]
struct DownloadProgress {
    downloaded: f64,
    total: f64,
    speed: String,
    eta: String,
    key: String,
}

#[derive(Serialize, Clone)]
struct DownloadError {
    key: String,
    stage: String,
    message: String,
}

fn emit_download_error(app_handle: &tauri::AppHandle, key: &str, stage: &str, message: &str) {
    let _ = app_handle.emit(
        "download-error",
        DownloadError {
            key: key.to_string(),
            stage: stage.to_string(),
            message: message.to_string(),
        },
    );
}

fn decrement_download_count(key: &str) {
    let mut counts = DOWNLOAD_COUNTS.lock().unwrap();
    if let Some(count) = counts.get_mut(key) {
        *count = count.saturating_sub(1);
        if *count == 0 {
            counts.remove(key);
        }
    }
}

/// Format bytes into human-readable format (KB, MB, GB)
fn format_bytes(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;

    if bytes >= GB {
        format!("{:.2} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.2} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.2} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}

/// Format speed in bytes per second
fn format_speed(bytes_per_sec: f64) -> String {
    const KB: f64 = 1024.0;
    const MB: f64 = KB * 1024.0;
    const GB: f64 = MB * 1024.0;

    if bytes_per_sec >= GB {
        format!("{:.2} GB/s", bytes_per_sec / GB)
    } else if bytes_per_sec >= MB {
        format!("{:.2} MB/s", bytes_per_sec / MB)
    } else if bytes_per_sec >= KB {
        format!("{:.2} KB/s", bytes_per_sec / KB)
    } else {
        format!("{:.2} B/s", bytes_per_sec)
    }
}

/// Format time duration into human-readable format
fn format_duration(seconds: u64) -> String {
    let hours = seconds / 3600;
    let minutes = (seconds % 3600) / 60;
    let secs = seconds % 60;

    if hours > 0 {
        format!("{}h {}m {}s", hours, minutes, secs)
    } else if minutes > 0 {
        format!("{}m {}s", minutes, secs)
    } else {
        format!("{}s", secs)
    }
}

/// Check if a directory is empty
fn is_directory_empty(path: &Path) -> Result<bool, std::io::Error> {
    if !path.exists() || !path.is_dir() {
        return Ok(true); // Consider non-existent or non-directory as "empty"
    }

    let mut entries = std::fs::read_dir(path)?;
    Ok(entries.next().is_none())
}

/// Safely remove a file, only if the parent directory would become empty
fn safe_remove_file(file_path: &Path) -> Result<(), String> {
    if !file_path.exists() {
        return Ok(());
    }

    // Get the parent directory
    if let Some(parent_dir) = file_path.parent() {
        // First remove the file
        remove_file(file_path).map_err(|e| e.to_string())?;

        // Then check if the parent directory is empty and remove it if so
        if is_directory_empty(parent_dir).map_err(|e| e.to_string())? {
            if let Err(e) = std::fs::remove_dir(parent_dir) {
                tracing::warn!("Could not remove empty directory {:?}: {}", parent_dir, e);
                // Don't return error here, as the main file removal succeeded
            }
        }
    } else {
        // No parent directory, just remove the file
        remove_file(file_path).map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Clean folder before extraction, keeping only preview files and the target archive
fn clean_folder_before_extraction(
    folder_path: &Path,
    archive_file_name: &str,
) -> Result<(), String> {
    let entries = std::fs::read_dir(folder_path).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_path = entry.path();

        if file_path.is_file() {
            let file_name = file_path.file_name().and_then(|n| n.to_str()).unwrap_or("");

            // Keep the archive file itself
            if file_name == archive_file_name {
                continue;
            }

            // Keep preview files (preview.* with any extension)
            if file_name.starts_with("preview.") {
                continue;
            }

            // Delete everything else
            tracing::info!("Cleaning up file before extraction: {}", file_name);
            if let Err(e) = std::fs::remove_file(&file_path) {
                tracing::warn!("Failed to remove file {}: {}", file_name, e);
            }
        } else if file_path.is_dir() {
            let dir_name = file_path.file_name().and_then(|n| n.to_str()).unwrap_or("");

            if dir_name == "DISABLED_IMM_INI_BACKUP" {
                continue;
            }

            // Delete all directories
            tracing::info!("Cleaning up directory before extraction: {}", dir_name);
            if let Err(e) = std::fs::remove_dir_all(&file_path) {
                tracing::warn!("Failed to remove directory {}: {}", dir_name, e);
            }
        }
    }

    Ok(())
}

static SESSION_ID: AtomicU64 = AtomicU64::new(0);
static DOWNLOAD_COUNTS: Lazy<Mutex<HashMap<String, u64>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));
static CURRENT_WORKING_DIR: Lazy<RwLock<String>> = Lazy::new(|| RwLock::new(String::new()));

const MIME_EXTENSIONS: &[(&str, &str)] = &[
    ("image/jpeg", "jpg"),
    ("image/jpg", "jpg"),
    ("image/png", "png"),
    ("image/gif", "gif"),
    ("application/pdf", "pdf"),
    ("text/plain", "txt"),
    ("text/html", "html"),
    ("application/json", "json"),
    ("application/zip", "zip"),
    ("application/x-tar", "tar"),
    ("application/gzip", "gz"),
    ("application/x-bzip2", "bz2"),
    ("application/x-xz", "xz"),
    ("text/csv", "csv"),
    ("application/vnd.ms-excel", "xls"),
    (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "xlsx",
    ),
    ("application/vnd.ms-powerpoint", "ppt"),
    (
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "pptx",
    ),
    ("application/msword", "doc"),
    (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "docx",
    ),
];

fn mime_to_extension(mime_type: &str) -> Option<&'static str> {
    let clean_mime = mime_type.split(';').next().unwrap_or("").trim();
    MIME_EXTENSIONS
        .iter()
        .find(|(mime, _)| *mime == clean_mime)
        .map(|(_, ext)| *ext)
}
fn seven_zip_program_name() -> Option<&'static str> {
    #[cfg(target_os = "windows")]
    {
        Some("ext/7z.exe")
    }
    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    {
        Some("ext/7zz")
    }
    #[cfg(all(target_os = "linux", target_arch = "aarch64"))]
    {
        Some("ext/7zz-aarch64")
    }
    #[cfg(not(any(
        target_os = "windows",
        all(target_os = "linux", target_arch = "x86_64"),
        all(target_os = "linux", target_arch = "aarch64")
    )))]
    {
        None
    }
}

async fn decompress_file(
    app_handle: tauri::AppHandle,
    file_path: &str,
    save_path: &str,
) -> Result<(), String> {
    let program_name = seven_zip_program_name().ok_or_else(|| {
        "No bundled 7-Zip binary for this platform/architecture; archive extraction is unsupported"
            .to_string()
    })?;
    let program_path = app_handle
        .path()
        .resolve(program_name, tauri::path::BaseDirectory::Resource)
        .map_err(|e| e.to_string())?;

    let output = app_handle
        .shell()
        .command(program_path.to_str().ok_or("Invalid 7-Zip resource path")?)
        .args(["x", file_path, &format!("-o{}", save_path), "-y", "-p-"])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let details = format!("{}\n{}", stderr, stdout).to_lowercase();
        if details.contains("password") || details.contains("encrypted") {
            Err("Failure: Password protected archive".to_string())
        } else if stderr.trim().is_empty() {
            Err(stdout.to_string())
        } else {
            Err(stderr.to_string())
        }
    }
}
/// Extract archive file (zip, rar, or 7z) to the specified path
#[tauri::command]
async fn extract_archive(
    app_handle: tauri::AppHandle,
    file_path: String,
    save_path: String,
    file_name: String,
    emit: bool,
    key: String,
    current_sid: u64,
    del: bool,
) -> Result<(), String> {
    let file_path = Path::new(&file_path);
    let save_path = save_path.as_str();
    let file_name = file_name.as_str();
    // Clean folder before extraction
    tracing::info!("Cleaning folder before extracting archive");
    if let Err(error) = clean_folder_before_extraction(Path::new(&save_path), &file_name) {
        if emit {
            decrement_download_count(&key);
        }
        emit_download_error(&app_handle, &key, "extract", &error);
        return Err(error);
    }
    tracing::info!("Starting extraction for '{}'", file_name);
    let before = Instant::now();
    let res = decompress_file(app_handle.clone(), file_path.to_str().unwrap(), &save_path);
    let duration = before.elapsed();
    tracing::info!("Extraction completed in: {:.2?}", duration);
    if let Err(e) = res.await {
        tracing::error!("Extraction error for '{}': {}", file_name, e);
        if emit {
            decrement_download_count(&key);
        }
        emit_download_error(&app_handle, &key, "extract", &e);
        return Err(e);
    } else {
        if del {
            if let Err(error) = safe_remove_file(&file_path) {
                if emit {
                    decrement_download_count(&key);
                }
                emit_download_error(&app_handle, &key, "cleanup", &error);
                return Err(error);
            }
        }
        tracing::info!("Archive file removed after extraction");
    }

    if !del {
        app_handle
            .emit("fin", serde_json::json!({ "key": key, "type": "manual" }))
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    if emit {
        let mut valid = false;
        let mut counts = DOWNLOAD_COUNTS.lock().unwrap();
        if let Some(&count) = counts.get(&key) {
            if count >= 1 {
                valid = true;
                *counts.get_mut(&key).unwrap() -= 1;
                if counts.get(&key) == Some(&0) {
                    counts.remove(&key);
                }
            }
        }
        drop(counts);
        tracing::info!(
            "Emitting completion event for session {}: {}",
            current_sid,
            file_name
        );
        if !valid {
            tracing::warn!(
                "Session {} invalid after extraction for key '{}'",
                valid,
                key
            );
            return Err(format!(
                "Session changed during processing, operation cancelled (file: {})",
                file_name
            ));
        }
        app_handle
            .emit("fin", serde_json::json!({ "key": key , "type": "auto" }))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
#[tauri::command]
async fn download_and_unzip(
    app_handle: tauri::AppHandle,
    file_name: String,
    download_url: String,
    save_path: String,
    key: String,
    emit: bool,
) -> Result<(), String> {
    tracing::info!(
        "Starting download for: {}, URL: {}, Save Path: {}, Key: {}, Emit: {}",
        file_name,
        download_url,
        save_path,
        key,
        emit
    );
    if emit {
        let mut counts = DOWNLOAD_COUNTS.lock().unwrap();
        *counts.entry(key.clone()).or_insert(0) += 1;
    }
    let current_sid = SESSION_ID.load(Ordering::SeqCst);
    tracing::info!(
        "Initiating download for session {}: {} from URL: {}",
        current_sid,
        file_name,
        download_url
    );
    create_dir_all(&save_path).map_err(|e| {
        let message = format!("Failed to create download directory: {}", e);
        if emit {
            decrement_download_count(&key);
            emit_download_error(&app_handle, &key, "download", &message);
        }
        message
    })?;

    let response = Client::new()
        .get(&download_url)
        .send()
        .await
        .and_then(reqwest::Response::error_for_status)
        .map_err(|e| {
            let message = e.to_string();
            if emit {
                decrement_download_count(&key);
                emit_download_error(&app_handle, &key, "download", &message);
            }
            message
        })?;

    let ext = response
        .url()
        .path_segments()
        .and_then(|segments| segments.last())
        .and_then(|name| std::path::Path::new(name).extension())
        .and_then(|ext| ext.to_str())
        .or_else(|| {
            response
                .headers()
                .get("content-type")
                .and_then(|ct| ct.to_str().ok())
                .and_then(|ct| mime_to_extension(ct))
        })
        .unwrap_or("")
        .to_owned();

    let file_name = if !ext.is_empty() {
        format!("{}.{}", file_name, ext)
    } else {
        file_name
    };

    let total_size = response.content_length().unwrap_or(0);
    tracing::info!("Total size of {}: {}", file_name, format_bytes(total_size));
    tracing::info!("Saving {} to: {}", file_name, save_path);
    let file_path = Path::new(&save_path).join(&file_name);

    let file = File::create(&file_path).map_err(|e| {
        let message = e.to_string();
        if emit {
            decrement_download_count(&key);
            emit_download_error(&app_handle, &key, "download", &message);
        }
        message
    })?;
    let mut writer = BufWriter::with_capacity(BUFFER_SIZE, file);

    let mut stream = response.bytes_stream();
    let mut downloaded: u64 = 0;
    let mut last_progress_update: u64 = 0;

    // Variables for speed calculation
    let start_time = Instant::now();

    while let Some(item) = stream.next().await {
        if SESSION_ID.load(Ordering::SeqCst) != current_sid {
            drop(writer);
            if emit {
                decrement_download_count(&key);
            }
            let _ = remove_file(&file_path);
            return Err(format!(
                "Download cancelled due to session change (file: {})",
                file_name
            ));
        }
        if emit {
            let counts = DOWNLOAD_COUNTS.lock().unwrap();
            let count = counts.get(&key).copied().unwrap_or(0);
            drop(counts);
            if count == 0 {
                tracing::info!(
                    "Download cancelled for key '{}', aborting download of: {}",
                    key,
                    file_name
                );
                drop(writer);
                let _ = remove_file(&file_path);
                return Err(format!("Download cancelled (file: {})", file_name));
            }
        }

        let chunk = item.map_err(|e| {
            let message = e.to_string();
            if emit {
                decrement_download_count(&key);
                emit_download_error(&app_handle, &key, "download", &message);
            }
            message
        })?;
        writer.write_all(&chunk).map_err(|e| {
            let message = e.to_string();
            if emit {
                decrement_download_count(&key);
                emit_download_error(&app_handle, &key, "download", &message);
            }
            message
        })?;
        downloaded += chunk.len() as u64;

        if emit && (downloaded - last_progress_update) >= PROGRESS_UPDATE_THRESHOLD {
            // Calculate speed and ETA asynchronously to avoid blocking download
            let total_elapsed = start_time.elapsed().as_secs_f64();
            let avg_speed = if total_elapsed > 0.0 {
                downloaded as f64 / total_elapsed
            } else {
                0.0
            };

            let remaining_bytes = total_size.saturating_sub(downloaded);
            let eta_secs = if avg_speed > 0.0 {
                (remaining_bytes as f64 / avg_speed) as u64
            } else {
                0
            };

            let progress_data = DownloadProgress {
                downloaded: downloaded as f64,
                total: total_size as f64,
                speed: format_speed(avg_speed),
                eta: format_duration(eta_secs),
                key: key.clone(),
            };

            // Emit asynchronously to not block download
            let app_handle_clone = app_handle.clone();
            tauri::async_runtime::spawn(async move {
                let _ = app_handle_clone.emit("download-progress", progress_data);
            });

            last_progress_update = downloaded;
        }
    }

    if SESSION_ID.load(Ordering::SeqCst) != current_sid {
        drop(writer);
        if emit {
            decrement_download_count(&key);
        }
        let _ = remove_file(&file_path);
        return Err(format!(
            "Download cancelled due to session change after completion (file: {})",
            file_name
        ));
    }

    writer.flush().map_err(|e| {
        let message = e.to_string();
        if emit {
            decrement_download_count(&key);
            emit_download_error(&app_handle, &key, "download", &message);
        }
        message
    })?;

    drop(writer);

    // Log final download statistics
    let total_elapsed = start_time.elapsed().as_secs_f64();
    let avg_speed = if total_elapsed > 0.0 {
        downloaded as f64 / total_elapsed
    } else {
        0.0
    };

    tracing::info!(
        "Download completed for '{}': {} in {:.2}s (Avg Speed: {})",
        file_name,
        format_bytes(downloaded),
        total_elapsed,
        format_speed(avg_speed)
    );

    tracing::info!(
        "Download completed successfully for: {}",
        // current_sid,
        file_name
    );

    // Emit final progress update showing download complete
    if emit {
        let final_speed = format_speed(avg_speed);
        app_handle
            .emit(
                "ext",
                DownloadProgress {
                    downloaded: total_size as f64,
                    total: total_size as f64,
                    speed: final_speed,
                    eta: "0s".to_string(),
                    key: key.clone(),
                },
            )
            .map_err(|e| e.to_string())?;

        // Extract archive if it's a supported format
        extract_archive(
            app_handle.clone(),
            file_path.to_string_lossy().to_string(),
            save_path.clone(),
            file_name.clone(),
            emit,
            key,
            current_sid,
            true,
        )
        .await?;
    }
    tracing::info!(
        "Download and extraction completed successfully for: {}",
        file_name
    );

    Ok(())
}

#[tauri::command]
fn cancel_install(key: String) -> Result<(), String> {
    let mut counts = DOWNLOAD_COUNTS.lock().unwrap();
    if let Some(count) = counts.get_mut(&key) {
        if *count > 0 {
            *count -= 1;
            tracing::info!("Decreased download count for key '{}': {}", key, *count);

            // Remove key if count reaches 0
            if *count == 0 {
                counts.remove(&key);
                tracing::info!("Removed key '{}' from download counts", key);
            }
            Ok(())
        } else {
            Err(format!("Key '{}' already has count of 0", key))
        }
    } else {
        Err(format!("Key '{}' not found in download counts", key))
    }
}

#[tauri::command]
fn get_username() -> String {
    let new_sid = SESSION_ID.fetch_add(1, Ordering::SeqCst) + 1;
    tracing::info!("Session changed, new session ID: {}", new_sid);

    let username = std::env::var("USERNAME").unwrap_or_else(|_| "Unknown".to_string());
    tracing::info!("Username: {}, Session ID: {}", username, new_sid);
    username
}
#[tauri::command]
fn exit_app() {
    std::process::exit(0x0);
}

#[tauri::command]
fn get_session_id() -> u64 {
    SESSION_ID.load(Ordering::SeqCst)
}
#[cfg(target_os = "windows")]
use window_vibrancy::apply_acrylic;
#[tauri::command]
fn set_cwd() -> Result<String, String> {
    let current_dir =
        std::env::current_dir().map_err(|e| format!("Failed to get current directory: {}", e))?;

    let path_str = current_dir.to_string_lossy().to_string();

    let mut cwd = CURRENT_WORKING_DIR.write().unwrap();
    *cwd = path_str.clone();
    drop(cwd);

    tracing::info!("Current working directory set to: {}", path_str);
    Ok(path_str)
}

#[tauri::command]
fn get_cwd() -> String {
    let cwd = CURRENT_WORKING_DIR.read().unwrap();
    cwd.clone()
}

use tauri_plugin_tracing::{
    tracing, Builder as Tracing, LevelFilter, MaxFileSize, Rotation, RotationStrategy,
};
use tauri_plugin_window_state::{Builder, StateFlags};
mod image_server;
const IMAGE_SERVER_PORT: u16 = 4469;

#[tauri::command]
fn get_image_server_url() -> String {
    format!("http://127.0.0.1:{}", IMAGE_SERVER_PORT)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(
        
            Builder::default()
                .with_state_flags(StateFlags::all().difference(StateFlags::DECORATIONS))
                .build(),
        )
        .plugin(
            Tracing::new()
                .with_max_level(
                    if cfg!(debug_assertions) {
                        LevelFilter::DEBUG
                    } else {
                        LevelFilter::INFO
                    }
                )
                .with_file_logging()
                .with_rotation(Rotation::Daily)
                .with_rotation_strategy(RotationStrategy::KeepSome(10))
                .with_max_file_size(MaxFileSize::mb(25))
                .with_default_subscriber()
                .build()
        )
        .plugin(tauri_plugin_single_instance::init(|_app, argv, _cwd| {
            tracing::info!("a new app instance was opened with {argv:?} and the deep link event was already triggered");
        }))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            set_cwd().unwrap();
            #[cfg(desktop)]
            app.deep_link().register_all()?;
            let window = app.get_webview_window("main").unwrap();
             #[cfg(target_os = "windows")]
            apply_acrylic(&window, Some((1, 1, 1, 200))).expect("Unsupported platform!");
            #[cfg(target_os = "windows")]
            if let Ok(icon) = tauri::image::Image::from_bytes(include_bytes!("../icons/imi.png")) { let _ = app.get_webview_window("main").unwrap().set_icon(icon); }
            let tray_icon = if cfg!(target_os = "windows") { tauri::image::Image::from_bytes(include_bytes!("../icons/imi.png"))? } else { app.default_window_icon().unwrap().clone() };
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Open", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[ &show_i,&quit_i])?;

            TrayIconBuilder::new()
                .icon(tray_icon)
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.emit("window-visible", ());
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| match event {
                    TrayIconEvent::Click {
                        button: MouseButton::Left,
                        ..
                    } => {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.emit("window-visible", ());
                        }
                    }
                    _ => {}
                })
                .build(app)?;
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = image_server::start_image_server(IMAGE_SERVER_PORT).await {
                    tracing::error!("Failed to start image server: {}", e);

                    if let Err(emit_err) = app_handle.emit(
                        "image-server-error",
                        format!("Failed to start image server: {}", e),
                    ) {
                        tracing::error!("Failed to emit image server error: {}", emit_err);
                    }
                } else {
                    tracing::info!(
                        "Image server started successfully on port {}",
                        IMAGE_SERVER_PORT
                    );

                    if let Err(emit_err) =
                        app_handle.emit("image-server-ready", get_image_server_url())
                    {
                        tracing::error!("Failed to emit image server ready event: {}", emit_err);
                    }
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            exit_app,
            get_username,
            download_and_unzip,
            cancel_install,
            get_session_id,
            get_cwd,
            set_cwd,
            extract_archive,
        ]).on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                let _ = window.emit("window-hidden", ());
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
