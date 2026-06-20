# Joyful Quill — Windows Image Viewer

## Context

Build a Windows desktop replacement for the default photo viewer. The app opens a directory,
displays images (and subdirectories with previews) in a resizable tile grid, and opens a
selected image in full-screen. Subdirectory tiles look visually distinct from plain image tiles.

## Technology Rationale

**Why Tauri instead of Electron?**
Both let you build desktop apps using web technologies (HTML/CSS/JavaScript). Electron bundles
a full Chromium browser inside the installer (~150 MB, ~200 MB RAM at idle) — used by VS Code,
Slack, Discord. Tauri instead uses WebView2, the Chromium engine already built into Windows
10/11, so the installer is ~10 MB and memory usage is minimal.

**Why Rust for the backend?**
The backend needs to read large directories, decode images, and generate thumbnail caches —
I/O and CPU-heavy work. Rust runs at native speed with a ~5–20 MB memory footprint vs a JVM
app which starts at ~100–300 MB idle. Rust is also memory-safe without a garbage collector.

**Is this a website?**
The UI is built with HTML + CSS + React, but it never runs in a browser and has no network
connection. The React layer is just the rendering engine (like Swing is for Java). Tauri wraps
it in a native Windows window. The Rust backend handles all file system access — the React UI
cannot touch files directly; it asks Rust via Tauri commands.

```
┌─────────────────────────────────────┐
│  Native Windows window (Tauri)      │
│  ┌───────────────────────────────┐  │
│  │  React UI (HTML + CSS)        │  │
│  │  renders tiles, handles input │  │
│  └──────────────┬────────────────┘  │
│                 │  Tauri commands    │
│  ┌──────────────▼────────────────┐  │
│  │  Rust backend                 │  │
│  │  reads files, makes thumbs    │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

---

## Recommended Technology Stack

### Framework: Tauri 2.0 + React + TypeScript

| Layer | Library | Purpose |
|-------|---------|---------|
| Backend | `image` crate (Rust) | Decode images, generate thumbnails |
| Backend | `walkdir` / `std::fs` | Directory enumeration |
| Frontend | React 18 + TypeScript | UI |
| Frontend | Zustand | App state (current path, tile size, open image) |
| Frontend | `@tauri-apps/plugin-dialog` | Native "Open Folder" dialog |
| Frontend | `react-virtuoso` | Virtualise the grid for large folders |

---

## Project Structure

```
joyful-quill/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   └── commands/
│   │       ├── fs.rs        ← list_directory, entry metadata
│   │       └── thumbs.rs    ← generate_thumbnail (Rust image crate)
│   └── tauri.conf.json
└── src/
    ├── components/
    │   ├── TileGrid/         ← resizable grid, scroll-to-resize logic
    │   ├── Tile/             ← image tile + folder tile variants
    │   ├── Viewer/           ← full-screen overlay
    │   └── Breadcrumb/       ← directory path navigation
    ├── store/                ← Zustand slices
    └── hooks/
        ├── useDirectory.ts   ← calls Tauri commands, normalises entries
        └── useTileSize.ts    ← wheel event → column count
```

---

## Build Strategy — Milestones

| # | Status | Milestone | Deliverable |
|---|--------|-----------|-------------|
| 1 | ✅ done | **POC** | Window opens; Rust reads a hardcoded folder; React lists filenames; click opens image fullscreen. Proves the full Tauri → Rust → React pipeline works. |
| 2 | ✅ done | **Tile grid** | Real thumbnails in a CSS grid; scroll wheel resizes tiles |
| 3 | ✅ done | **Navigation** | Folder tiles with preview + icon; click in; Backspace out; breadcrumb |
| 4 | ✅ done | **Full-screen viewer** | `←` / `→` navigation; `Escape` / `Backspace` to close |
| 5 | ✅ done | **Fix the freeze** | Async `get_thumbnail` via `spawn_blocking`; progressive per-result state updates; generation counter to cancel stale Rust tasks on navigation; frontend concurrency limiter (K=8) to cap in-flight IPC calls |
| 6 | ✅ done | **Open folder dialog** | Replace hardcoded `INITIAL_PATH` with `tauri-plugin-dialog`; persist last path in `localStorage`; "Open…" button in toolbar |
| 7 | 🔲 next | **Disk cache** | Cache decoded thumbnails to `%LOCALAPPDATA%\JoyfulQuill\thumbs\` (SHA256+mtime key); re-entering a directory reads cached JPEGs from disk, no decode; rayon not needed — concurrent `spawn_blocking` already parallelises across cores |
| 8 | 🔲 | **Scale & integration** | Virtualisation for large folders; Windows "Open with" shell registration |

---

## Feature Implementation Plan

### 1. Directory reading (Rust command)

`list_directory(path: String) -> Vec<DirEntry>`

Each `DirEntry` carries:
- `name`, `path`, `is_dir`
- `preview_path` (for folders: first image found one level down, or `null`)
- `modified` timestamp (for future sort modes)

Sort: natural sort by name (same algorithm as Windows Explorer so `img2 < img10`).

### 2. Thumbnail generation (Rust command)

`get_thumbnail(path: String, size: u32) -> String` (returns base64-encoded JPEG)

- Detect image format from magic bytes, not file extension (handles misnamed files)
- Resize with `image::imageops::thumbnail`

**Disk cache** — avoids re-decoding on every folder visit:
- Location: `%LOCALAPPDATA%\JoyfulQuill\thumbs\`
- Cache key: `<hex(sha256(absolute_path + "|" + mtime_unix_secs))>.jpg`
- On hit: read the cached JPEG bytes directly — no image decode
- On miss: decode → resize → write to cache → return
- Invalidation: mtime change produces a new cache key; orphaned files cleaned on startup

**Progressive loading** on the React side:
- Fire thumbnail requests individually so each tile appears as soon as its thumbnail is ready
- Update state per-result: `setThumbs(prev => ({ ...prev, [path]: src }))`
- Tiles show a grey placeholder while loading, then appear when the thumbnail arrives

### 3. Tile grid

- CSS Grid with `grid-template-columns: repeat(<cols>, 1fr)`
- `cols` starts at 4, ranges 1–12
- Scroll wheel on grid adjusts `cols`

### 4. Tile variants

**Image tile:** thumbnail as background, filename on hover.

**Folder tile:**
- Preview image as background (first image inside, dimmed)
- Folder icon (SVG) in bottom-left corner
- Teal border (`2px solid #3b82f6`) to distinguish from images
- Fallback: gradient background if folder has no images

### 5. Full-screen viewer

- Overlay (fixed, z-index 100, black background)
- Image centered, `object-fit: contain`
- `←` / `→` — previous / next image (wraps around)
- `Escape` or `Backspace` — close viewer, return to tile grid
- Click outside image — close viewer

### 6. Navigation

| Context | Key | Action |
|---------|-----|--------|
| Tile grid | `Backspace` | Go up one directory level |
| Full-screen viewer | `←` / `→` | Prev / next image |
| Full-screen viewer | `Escape` or `Backspace` | Close viewer → back to tile grid |

### 7. Launch scenarios

| How opened | Behaviour |
|-----------|-----------|
| Double-click exe | Show native "Open Folder" dialog; reopen last folder on subsequent launches |
| Right-click folder → "Open with" | Open directly into that folder's tile grid |
| Right-click image → "Open with" | Open parent folder's tile grid with that image in full-screen |

---

## Testing Strategy

### Rust unit tests (`cargo test`)

| Test | What it verifies |
|------|-----------------|
| `should_sort_entries_by_name_naturally` | `img2` sorts before `img10` |
| `should_filter_to_supported_extensions` | Only image extensions included |
| `should_return_first_image_as_folder_preview` | First image returned as preview path |
| `should_return_null_preview_for_empty_folder` | Empty folder returns `null` |
| `should_use_cached_thumbnail_when_mtime_unchanged` | Cache hit: reads cached JPEG, no decode |
| `should_regenerate_thumbnail_when_mtime_changed` | mtime change → new cache key → re-decode |
| `should_detect_format_from_magic_bytes` | JPEG file with `.png` extension decoded correctly |

### React tests — Vitest + React Testing Library (`npm run test`)

| Test | What it verifies |
|------|-----------------|
| `shouldIncreaseTileSizeOnScrollDown` | Column count decreases (tiles get bigger) |
| `shouldDecreaseTileSizeOnScrollUp` | Column count increases (tiles get smaller) |
| `shouldClampColumnsAtMinimum` | Cannot go below 1 column |
| `shouldClampColumnsAtMaximum` | Cannot exceed 12 columns |
| `shouldRenderFolderIconOnFolderTile` | Folder tile has icon, image tile does not |
| `shouldRenderDistinctBorderOnFolderTile` | Folder tile has coloured border class |
| `shouldUpdateBreadcrumbOnFolderNavigation` | Navigating into folder appends segment |
| `shouldNavigateUpOnBackspaceInGrid` | Backspace in grid calls navigate-up |
| `shouldCloseViewerOnBackspaceInViewer` | Backspace in viewer closes it |
| `shouldCycleToNextImageOnRightArrow` | `→` advances to next image |
| `shouldCycleToPrevImageOnLeftArrow` | `←` goes to previous image |
| `shouldWrapAroundAtEndOfImageList` | `→` on last image wraps to first |

## Manual Verification Checklist

- Open a folder with 200+ images → grid renders, no jank
- Scroll wheel changes tile size smoothly (1–12 cols)
- Folder tile shows first-image preview + folder icon + coloured border
- Click image → full-screen; `←` / `→` cycle; wrap-around at ends; `Escape` closes
- `Backspace` in viewer → back to grid; `Backspace` in grid → up one level
- Click folder tile → navigates in; breadcrumb updates
- Click breadcrumb segment → jumps to that level
- Thumbnails cached: second open of same folder is instant
- Right-click folder in Explorer → "Open with" → opens correctly
- Right-click image in Explorer → "Open with" → opens parent folder with image in viewer
