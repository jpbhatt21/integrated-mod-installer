use std::sync::{LazyLock, Mutex};
use std::path::Path;
use base64::{Engine as _, engine::general_purpose};

// Global variable to store wallpaper as base64
static WALLPAPER_BASE64: LazyLock<Mutex<String>> = LazyLock::new(|| Mutex::new(String::new()));

// Update wallpaper in global storage
pub fn update_wallpaper() -> Result<(), String> {
    match wallpaper::get() {
        Ok(path) => {
            // Read the image file
            match std::fs::read(&path) {
                Ok(image_bytes) => {
                    // Convert to base64
                    let base64_string = general_purpose::STANDARD.encode(&image_bytes);
                    
                    // Get file extension to determine mime type
                    let extension = Path::new(&path)
                        .extension()
                        .and_then(|ext| ext.to_str())
                        .unwrap_or("jpg")
                        .to_lowercase();
                    
                    let mime_type = match extension.as_str() {
                        "png" => "image/png",
                        "jpg" | "jpeg" => "image/jpeg",
                        "gif" => "image/gif",
                        "bmp" => "image/bmp",
                        "webp" => "image/webp",
                        _ => "image/jpeg",
                    };
                    
                    // Create data URL
                    let data_url = format!("data:{};base64,{}", mime_type, base64_string);
                    
                    // Store in global variable
                    if let Ok(mut wallpaper) = WALLPAPER_BASE64.lock() {
                        *wallpaper = data_url;
                        log::info!("Wallpaper updated successfully from: {:?}", path);
                        Ok(())
                    } else {
                        Err("Failed to acquire lock on wallpaper storage".to_string())
                    }
                }
                Err(e) => {
                    log::error!("Failed to read wallpaper file: {}", e);
                    Err(format!("Failed to read wallpaper file: {}", e))
                }
            }
        }
        Err(e) => {
            log::error!("Failed to get wallpaper path: {:?}", e);
            Err(format!("Failed to get wallpaper path: {:?}", e))
        }
    }
}

// Tauri command to get wallpaper base64
#[tauri::command]
pub fn get_wallpaper() -> Result<String, String> {
    if let Ok(wallpaper) = WALLPAPER_BASE64.lock() {
        if wallpaper.is_empty() {
            // If wallpaper hasn't been loaded yet, load it now
            drop(wallpaper);
            update_wallpaper()?;
            
            // Try again after updating
            if let Ok(wallpaper) = WALLPAPER_BASE64.lock() {
                Ok(wallpaper.clone())
            } else {
                Err("Failed to acquire lock on wallpaper storage".to_string())
            }
        } else {
            Ok(wallpaper.clone())
        }
    } else {
        Err("Failed to acquire lock on wallpaper storage".to_string())
    }
}

// Initialize wallpaper on app startup
pub fn init_wallpaper() -> Result<(), String> {
    log::info!("Initializing wallpaper...");
    update_wallpaper()
}
