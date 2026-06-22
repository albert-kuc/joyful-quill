# Joyful Quill

A fast, keyboard-driven image viewer for Windows.

![Demo](https://github.com/albert-kuc/joyful-quill/releases/download/v0.1.0/demo.gif)

![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-blue)
![Tauri](https://img.shields.io/badge/Tauri-2.0-orange)
![Rust](https://img.shields.io/badge/backend-Rust-brown)
![React](https://img.shields.io/badge/UI-React%2018-61DAFB)

## Features

- Browse folders as a responsive image grid; scroll wheel adjusts tile size (1–12 columns)
- Subdirectory tiles preview their first image with a folder badge — click to navigate in
- Full-screen viewer with keyboard navigation (`←` / `→`, `Escape`, `Backspace`)
- Video tiles show a system thumbnail with a distinct border; click to open in your default media player
- Breadcrumb bar shows the current path; click any segment to jump to that level
- Last opened folder remembered across launches
- Disk-cached thumbnails in `%LOCALAPPDATA%\JoyfulQuill\thumbs\` — large folders reopen instantly; toolbar "Clear cache" button
- Format detection from file content, not extension — handles misnamed files correctly
- EXIF orientation applied at thumbnail generation time
- Sorted by name (directories first, then files — Windows Explorer order)
- Clean uninstall — removes app data automatically

## Technical highlights

- **Rust backend for all I/O and image processing** — thumbnails are generated in Rust
  and sent to React as base64 data URIs over Tauri's IPC bridge, keeping the UI thread
  free of blocking work
- **Magic-byte format detection** instead of trusting file extensions — correctly handles
  misnamed or extensionless image files
- **Disk thumbnail cache** persisted to `%LOCALAPPDATA%` — avoids re-decoding large
  images on every visit
- **EXIF orientation** applied at thumbnail generation time so images always appear
  upright regardless of camera rotation metadata

## Built with Claude Code

This project was developed using [Claude Code](https://claude.ai/code) as an AI
development partner. I defined the product requirements, feature roadmap, and UX
decisions; Claude Code proposed the tech stack and architecture, and implemented the
code under my direction.

The milestone-by-milestone development process is documented in [PLAN.md](PLAN.md).

## Tech stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Tauri 2.0 |
| Backend — file I/O, thumbnails, format detection | Rust |
| UI | React 18 + TypeScript |
| State | Zustand |
| Tile layout | `react-masonry-css` |
| Build tool | Vite |

## Development setup

Prerequisites:
- [Rust](https://rustup.rs)
- [Node.js LTS](https://nodejs.org)
- Visual Studio C++ Build Tools (Desktop development with C++ workload)

```bash
npm install
npm run tauri dev     # hot-reload dev mode
```

Tests:

```bash
cargo test --manifest-path src-tauri/Cargo.toml   # Rust backend
npm run test                                        # React components
```

## Project structure

```
├── src/                  React frontend
│   ├── App.tsx           Main component: tile grid, viewer, toolbar
│   ├── App.css           Tile and layout styles
│   ├── hooks/
│   │   └── useTileSize.ts  Ctrl+scroll → column count
│   └── utils/
│       └── navigation.ts   Path helpers, DirEntry type, breadcrumb builder
└── src-tauri/            Rust backend
    └── src/lib.rs        list_directory, get_thumbnail, get_video_thumbnail, clear_cache
```

## Installing

Download the latest installer from [Releases](https://github.com/albert-kuc/joyful-quill/releases):

| File | Notes |
|------|-------|
| `Joyful.Quill_*_x64-setup.exe` | Windows installer — double-click to install, no terminal needed |

No Rust or Node required on the target machine. Requires Windows 10 (updated) or
Windows 11 with WebView2, which ships with the OS.

After installation:

- **`joyful-quill.exe`** is a single self-contained binary — the entire React frontend
  is embedded; no loose web files alongside it
- **Start Menu shortcut** and optionally a desktop shortcut
- **Uninstaller** registered in Add/Remove Programs — removes app data automatically

> **SmartScreen warning:** the binary is unsigned, so Windows will show "Windows
> protected your PC" on first run. Click **More info → Run anyway** to proceed.

## Building from source

```bash
npm run tauri build
```

Produces installers in `src-tauri/target/release/bundle/`.
