use base64::{engine::general_purpose, Engine};
use serde::Serialize;
use std::fs;

const SUPPORTED_EXTENSIONS: &[&str] = &[
    "jpg", "jpeg", "png", "gif", "webp", "bmp", "tiff", "tif", "heic",
];

#[derive(Serialize)]
struct DirEntry {
    name: String,
    path: String,
    is_dir: bool,
}

#[tauri::command]
fn list_directory(path: String) -> Vec<DirEntry> {
    let Ok(read_dir) = fs::read_dir(&path) else {
        return vec![];
    };

    let mut entries: Vec<DirEntry> = read_dir
        .filter_map(|e| e.ok())
        .filter_map(|e| {
            let p = e.path();
            let name = e.file_name().to_string_lossy().into_owned();

            if p.is_dir() {
                return Some(DirEntry {
                    name,
                    path: p.to_string_lossy().into_owned(),
                    is_dir: true,
                });
            }

            let ext = p
                .extension()
                .and_then(|s| s.to_str())
                .map(|s| s.to_lowercase())
                .unwrap_or_default();

            if SUPPORTED_EXTENSIONS.contains(&ext.as_str()) {
                Some(DirEntry {
                    name,
                    path: p.to_string_lossy().into_owned(),
                    is_dir: false,
                })
            } else {
                None
            }
        })
        .collect();

    entries.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    entries
}

#[tauri::command]
fn get_thumbnail(path: String, size: u32) -> Result<String, String> {
    let img = image::open(&path).map_err(|e| e.to_string())?;
    let thumb = img.thumbnail(size, size);
    let mut buf = Vec::new();
    thumb
        .write_to(&mut std::io::Cursor::new(&mut buf), image::ImageFormat::Jpeg)
        .map_err(|e| e.to_string())?;
    let encoded = general_purpose::STANDARD.encode(&buf);
    Ok(format!("data:image/jpeg;base64,{}", encoded))
}

#[tauri::command]
fn read_image_base64(path: String) -> Result<String, String> {
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    let ext = std::path::Path::new(&path)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("jpg")
        .to_lowercase();
    let mime = match ext.as_str() {
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        _ => "image/jpeg",
    };
    let encoded = general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", mime, encoded))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![list_directory, read_image_base64, get_thumbnail])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
