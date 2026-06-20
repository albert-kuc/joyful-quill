use base64::{engine::general_purpose, Engine};
use serde::Serialize;
use std::fs;
use std::sync::atomic::{AtomicU64, Ordering};

const SUPPORTED_EXTENSIONS: &[&str] = &[
    "jpg", "jpeg", "png", "gif", "webp", "bmp", "tiff", "tif", "heic",
];

#[derive(Serialize)]
struct DirEntry {
    name: String,
    path: String,
    is_dir: bool,
    preview_path: Option<String>,
}

fn find_first_image(dir: &str) -> Option<String> {
    let Ok(read_dir) = fs::read_dir(dir) else {
        return None;
    };
    read_dir
        .filter_map(|e| e.ok())
        .filter_map(|e| {
            let p = e.path();
            if !p.is_file() {
                return None;
            }
            let ext = p.extension()?.to_str()?.to_lowercase();
            if SUPPORTED_EXTENSIONS.contains(&ext.as_str()) {
                Some(p.to_string_lossy().into_owned())
            } else {
                None
            }
        })
        .next()
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
                let preview_path = find_first_image(&p.to_string_lossy());
                return Some(DirEntry {
                    name,
                    path: p.to_string_lossy().into_owned(),
                    is_dir: true,
                    preview_path,
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
                    preview_path: None,
                })
            } else {
                None
            }
        })
        .collect();

    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    entries
}

#[tauri::command]
fn next_generation(gen: tauri::State<AtomicU64>) -> u64 {
    gen.fetch_add(1, Ordering::Relaxed) + 1
}

#[tauri::command]
async fn get_thumbnail(
    path: String,
    size: u32,
    generation: u64,
    gen: tauri::State<'_, AtomicU64>,
) -> Result<String, String> {
    if gen.load(Ordering::Relaxed) != generation {
        return Err("cancelled".to_string());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let file = std::fs::File::open(&path).map_err(|e| e.to_string())?;
        let reader = std::io::BufReader::new(file);
        let img = image::ImageReader::new(reader)
            .with_guessed_format()
            .map_err(|e| e.to_string())?
            .decode()
            .map_err(|e| e.to_string())?;
        let thumb = img.thumbnail(size, size);
        let mut buf = Vec::new();
        thumb
            .write_to(&mut std::io::Cursor::new(&mut buf), image::ImageFormat::Jpeg)
            .map_err(|e| e.to_string())?;
        let encoded = general_purpose::STANDARD.encode(&buf);
        Ok(format!("data:image/jpeg;base64,{}", encoded))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn read_image_base64(path: String) -> Result<String, String> {
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    // Detect actual format from magic bytes, ignoring the file extension.
    let mime = image::guess_format(&bytes)
        .map(|f| f.to_mime_type())
        .unwrap_or("image/jpeg");
    let encoded = general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", mime, encoded))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AtomicU64::new(0))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![list_directory, read_image_base64, get_thumbnail, next_generation])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
