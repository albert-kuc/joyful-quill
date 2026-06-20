use base64::{engine::general_purpose, Engine};
use serde::Serialize;
use sha2::{Digest, Sha256};
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

fn cache_dir() -> std::path::PathBuf {
    std::env::var("LOCALAPPDATA")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::path::PathBuf::from("."))
        .join("JoyfulQuill")
        .join("thumbs")
}

fn thumb_cache_key(path: &str, mtime_secs: u64) -> String {
    let mut h = Sha256::new();
    h.update(format!("{}|{}", path, mtime_secs).as_bytes());
    format!("{:x}", h.finalize())
}

fn generate_thumbnail_bytes(path: &str, size: u32) -> Result<Vec<u8>, String> {
    let file = std::fs::File::open(path).map_err(|e| e.to_string())?;
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
    Ok(buf)
}

fn get_or_create_thumbnail_in(
    path: &str,
    size: u32,
    thumbs_dir: &std::path::Path,
) -> Result<Vec<u8>, String> {
    let mtime = std::fs::metadata(path)
        .and_then(|m| m.modified())
        .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs())
        .unwrap_or(0);

    let cache_file = thumbs_dir.join(format!("{}.jpg", thumb_cache_key(path, mtime)));

    if cache_file.exists() {
        return std::fs::read(&cache_file).map_err(|e| e.to_string());
    }

    let bytes = generate_thumbnail_bytes(path, size)?;
    let _ = std::fs::create_dir_all(thumbs_dir);
    let _ = std::fs::write(&cache_file, &bytes);
    Ok(bytes)
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
    let thumbs_dir = cache_dir();
    tauri::async_runtime::spawn_blocking(move || {
        let bytes = get_or_create_thumbnail_in(&path, size, &thumbs_dir)?;
        let encoded = general_purpose::STANDARD.encode(&bytes);
        Ok(format!("data:image/jpeg;base64,{}", encoded))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_test_png(path: &std::path::Path) {
        use image::{ImageBuffer, Rgb};
        let img: ImageBuffer<Rgb<u8>, _> =
            ImageBuffer::from_fn(16, 16, |x, y| Rgb([(x * 16) as u8, (y * 16) as u8, 128u8]));
        img.save(path).unwrap();
    }

    fn unique_tmp(suffix: &str) -> std::path::PathBuf {
        std::env::temp_dir().join(format!(
            "jq_test_{}_{}",
            std::process::id(),
            suffix
        ))
    }

    #[test]
    fn should_use_cached_thumbnail_when_mtime_unchanged() {
        let base = unique_tmp("cache_hit");
        std::fs::create_dir_all(&base).unwrap();
        let img_path = base.join("test.png");
        write_test_png(&img_path);

        let mtime = std::fs::metadata(&img_path)
            .and_then(|m| m.modified())
            .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs())
            .unwrap_or(0);

        let cache_d = base.join("thumbs");
        std::fs::create_dir_all(&cache_d).unwrap();
        let key = thumb_cache_key(&img_path.to_string_lossy(), mtime);
        let cache_file = cache_d.join(format!("{}.jpg", key));
        let sentinel = b"SENTINEL_BYTES";
        std::fs::write(&cache_file, sentinel).unwrap();

        let result = get_or_create_thumbnail_in(&img_path.to_string_lossy(), 64, &cache_d).unwrap();
        assert_eq!(result, sentinel, "cache hit should return stored bytes without re-decoding");

        std::fs::remove_dir_all(&base).ok();
    }

    #[test]
    fn should_regenerate_thumbnail_when_mtime_changed() {
        let base = unique_tmp("cache_miss");
        std::fs::create_dir_all(&base).unwrap();
        let img_path = base.join("test.png");
        write_test_png(&img_path);

        let stale_mtime = 0u64;
        let cache_d = base.join("thumbs");
        std::fs::create_dir_all(&cache_d).unwrap();

        // Place stale entry under the old mtime key
        let stale_key = thumb_cache_key(&img_path.to_string_lossy(), stale_mtime);
        let stale_file = cache_d.join(format!("{}.jpg", stale_key));
        std::fs::write(&stale_file, b"STALE").unwrap();

        // get_or_create_thumbnail_in uses the real mtime, which differs from stale_mtime=0
        let result = get_or_create_thumbnail_in(&img_path.to_string_lossy(), 64, &cache_d).unwrap();
        assert_ne!(result, b"STALE", "changed mtime should produce a fresh decode, not stale cache");
        assert!(!result.is_empty(), "fresh thumbnail bytes should be non-empty");

        std::fs::remove_dir_all(&base).ok();
    }
}

#[tauri::command]
fn clear_cache() -> Result<(), String> {
    let dir = std::env::var("LOCALAPPDATA")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::path::PathBuf::from("."))
        .join("JoyfulQuill");
    if dir.exists() {
        std::fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    Ok(())
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
        .invoke_handler(tauri::generate_handler![list_directory, read_image_base64, get_thumbnail, next_generation, clear_cache])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
