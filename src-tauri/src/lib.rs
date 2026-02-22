use futures_util::StreamExt;
use once_cell::sync::Lazy;
use reqwest::Client;
use serde::Serialize;
use tauri_plugin_shell::ShellExt;
use std::collections::HashMap;
use std::fs::{create_dir_all, remove_file, File};
use std::io::{BufWriter, Write};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::RwLock;
use std::time::Instant;
use tauri::Emitter;
use tauri::Manager;
use tauri::{menu::{Menu, MenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
};
use tauri_plugin_deep_link::DeepLinkExt;
mod wallpaper_manager;
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
                println!("Could not remove empty directory {:?}: {}", parent_dir, e);
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
            println!("Cleaning up file before extraction: {}", file_name);
            if let Err(e) = std::fs::remove_file(&file_path) {
                println!("Failed to remove file {}: {}", file_name, e);
            }
        } else if file_path.is_dir() {
            let dir_name = file_path.file_name().and_then(|n| n.to_str()).unwrap_or("");

            // Delete all directories
            println!("Cleaning up directory before extraction: {}", dir_name);
            if let Err(e) = std::fs::remove_dir_all(&file_path) {
                println!("Failed to remove directory {}: {}", dir_name, e);
            }
        }
    }

    Ok(())
}

static SESSION_ID: AtomicU64 = AtomicU64::new(0);
static DOWNLOAD_COUNTS: Lazy<RwLock<HashMap<String, u64>>> = Lazy::new(|| RwLock::new(HashMap::new()));
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
async fn decompress_file(app_handle: tauri::AppHandle, file_path: &str, save_path: &str) -> Result<(), String> {
   let program_path = app_handle
    .path()
    .resolve("ext/7z.exe", tauri::path::BaseDirectory::Resource)
    .map_err(|e| e.to_string())?;

let output = app_handle
    .shell()
    .command(program_path.to_str().unwrap())
    .args([
        "x", 
        file_path, 
        &format!("-o{}", save_path),
        "-y"
    ])
    .output()
    .await
    .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(())
    } else {
        let err = String::from_utf8_lossy(&output.stderr);
        Err(if err.is_empty() { 
            String::from_utf8_lossy(&output.stdout).to_string() 
        } else { 
            err.to_string() 
        })
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
    del: bool,
) -> Result<(), String> {
    let file_path = Path::new(&file_path);
    let save_path = save_path.as_str();
    let file_name = file_name.as_str();
    // Clean folder before extraction
    println!("Cleaning folder before extracting archive");
    clean_folder_before_extraction(Path::new(&save_path), &file_name)?;
    println!("Starting extraction");
    let before = Instant::now();
    let res = decompress_file(app_handle.clone(), file_path.to_str().unwrap(), &save_path);
    let duration = before.elapsed();
    println!("extraction completed in: {:.2?}", duration);
    if let Err(e) = res.await {
        println!("extraction error: {}", e);
    } else {
        if del {
            safe_remove_file(&file_path)?;
        }
        println!("Archive file removed after extraction");
    }
    
    if !del {
        app_handle
            .emit("fin", serde_json::json!({ "key": key, "type": "manual" }))
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    if emit {
        // let global_sid = SESSION_ID.load(Ordering::SeqCst);
        let mut valid = false;
        let mut counts = DOWNLOAD_COUNTS.write().unwrap();
        let count_info = if let Some(&count) = counts.get(&key) {
            if count >= 1 {
                valid = true;
                *counts.get_mut(&key).unwrap() -= 1;
                Some(*counts.get(&key).unwrap())
            } else {
                None
            }
        } else {
            None
        };
        drop(counts);
        
        if let Some(new_count) = count_info {
            println!(
                "Decreased download count for key '{}': {}",
                key,
                new_count
            );
        }
        println!(
            "Emitting completion event for: {}",
            file_name
        );
        if !valid {
            println!(
                "Session {} invalid after extraction for key '{}'",
                valid, key
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
    // Increment download count for this key
    println!(
        "Starting download for: {}, URL: {}, Save Path: {}, Key: {}, Emit: {}",
        file_name, download_url, save_path, key, emit
    );
    if emit {
        let mut counts = DOWNLOAD_COUNTS.write().unwrap();
        if let Some(&count) = counts.get(&key) {
            if count >= 1 {
                drop(counts);
                println!("Download already in progress for key '{}', skipping", key);
                return Ok(());
            }
        }
        *counts.entry(key.clone()).or_insert(0) = 1;
        drop(counts);
        println!(
            "Download count for key '{}': 1",
            key
        );
    }
    println!(
        "Initiating download of: {} from URL: {}",
        file_name, download_url
    );
    let client = Client::new();
    // let save_path2 = save_path.to_owned();

    let response = client
        .get(&download_url)
        .send()
        .await
        .map_err(|e| e.to_string())?;

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

    let total_size = response
        .content_length()
        .ok_or("Failed to get content length")?;
    println!(
        "Total size of {}: {}",
        file_name,
        format_bytes(total_size)
    );
    // Override save_path with cwd/downloads/key
    let cwd = get_cwd();
    let new_save_path = if cwd.is_empty() {
        format!("{}/downloads/{}", save_path, key)
    } else {
        format!("{}/downloads/{}", cwd, key)
    };
    println!(
        "Saving {} to: {}",
        file_name, new_save_path
    );
    // Create the directory if it doesn't exist
    create_dir_all(&new_save_path).map_err(|e| format!("Failed to create directory: {}", e))?;
    
    let file_path = Path::new(&new_save_path).join(&file_name);

    let file = File::create(&file_path).map_err(|e| e.to_string())?;
    let mut writer = BufWriter::with_capacity(BUFFER_SIZE, file);

    let mut stream = response.bytes_stream();
    let mut downloaded: u64 = 0;
    let mut last_progress_update: u64 = 0;

    // Variables for speed calculation
    let start_time = Instant::now();

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| e.to_string())?;
        writer.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;

        if emit && (downloaded - last_progress_update) >= PROGRESS_UPDATE_THRESHOLD {
            // Check if download was cancelled
            let counts = DOWNLOAD_COUNTS.read().unwrap();
            let count = counts.get(&key).copied().unwrap_or(0);
            drop(counts);

            if count == 0 {
                println!(
                    "Download cancelled for key '{}', aborting download of: {}",
                    key,
                    file_name
                );
            
                drop(writer);
                let _ = remove_file(&file_path);
                 app_handle
                    .emit(
                        "can",
                        DownloadProgress {
                    downloaded: downloaded as f64,
                    total: total_size as f64,
                    speed: format_speed(0.0),
                    eta: "0s".to_string(),
                    key: key.clone()
                        }
                    )
                    .map_err(|e| e.to_string())?;
                return Err(format!(
                    "Download cancelled (file: {})",
                    file_name
                ));
            }

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

    // let global_sid = SESSION_ID.load(Ordering::SeqCst);
    // if global_sid != current_sid {
    //     println!("Session changed after download completed (was: {}, now: {}), aborting processing of: {}", current_sid, global_sid, file_name);

    //     drop(writer);
    //     let _ = remove_file(&file_path);
    //     return Err(format!(
    //         "Download cancelled due to session change after completion (file: {})",
    //         file_name
    //     ));
    // }

    writer.flush().map_err(|e| e.to_string())?;

    drop(writer);

    // Log final download statistics
    let total_elapsed = start_time.elapsed().as_secs_f64();
    let avg_speed = if total_elapsed > 0.0 {
        downloaded as f64 / total_elapsed
    } else {
        0.0
    };

    println!(
        "Download completed for '{}': {} in {:.2}s (Avg Speed: {})",
        file_name,
        format_bytes(downloaded),
        total_elapsed,
        format_speed(avg_speed)
    );

    println!(
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
            new_save_path,
            file_name.clone(),
            emit,
            key,
            true,
        )
        .await?;
    }
    println!(
        "Download and extraction completed successfully for: {}",
        file_name
    );

    Ok(())
}

#[tauri::command]
fn cancel_install(key: String) -> Result<(), String> {
    let mut counts = DOWNLOAD_COUNTS.write().unwrap();
    if let Some(count) = counts.get_mut(&key) {
        if *count > 0 {
            *count -= 1;
            println!("Decreased download count for key '{}': {}", key, *count);

            // Remove key if count reaches 0
            if *count == 0 {
                counts.remove(&key);
                println!("Removed key '{}' from download counts", key);
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
    println!("Session changed, new session ID: {}", new_sid);

    let username = std::env::var("USERNAME").unwrap_or_else(|_| "Unknown".to_string());
    println!("Username: {}, Session ID: {}", username, new_sid);
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

#[tauri::command]
fn set_cwd() -> Result<String, String> {
    let current_dir = std::env::current_dir()
        .map_err(|e| format!("Failed to get current directory: {}", e))?;
    
    let path_str = current_dir
        .to_string_lossy()
        .to_string();
    
    let mut cwd = CURRENT_WORKING_DIR.write().unwrap();
    *cwd = path_str.clone();
    drop(cwd);
    
    println!("Current working directory set to: {}", path_str);
    Ok(path_str)
}

#[tauri::command]
fn get_cwd() -> String {
    let cwd = CURRENT_WORKING_DIR.read().unwrap();
    cwd.clone()
}


use tauri_plugin_window_state::{Builder, StateFlags};
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(
            Builder::default()
                // sets the flags to only track and restore size
                .with_state_flags(StateFlags::SIZE)
                .build(),
        )
        .plugin(tauri_plugin_single_instance::init(|_app, argv, _cwd| {
            println!("a new app instance was opened with {argv:?} and the deep link event was already triggered");
            // when defining deep link schemes at runtime, you must also check `argv` here
        }))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            set_cwd().unwrap();
            #[cfg(desktop)]
            app.deep_link().register_all()?;
            wallpaper_manager::init_wallpaper()?;
            #[cfg(target_os = "windows")]
            if let Ok(icon) = tauri::image::Image::from_bytes(include_bytes!("../icons/imi.png")) { let _ = app.get_webview_window("main").unwrap().set_icon(icon); }
            let tray_icon = if cfg!(target_os = "windows") { tauri::image::Image::from_bytes(include_bytes!("../icons/imi.png"))? } else { app.default_window_icon().unwrap().clone() };
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Open", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[ &show_i,&quit_i])?;

            TrayIconBuilder::new()
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
            wallpaper_manager::get_wallpaper
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
