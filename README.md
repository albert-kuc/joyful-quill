# Joyful Quill

A Windows desktop image viewer built with Tauri 2.0, React, and TypeScript.

## What it does

- Opens a directory and displays all images as a tile grid
- Scroll wheel resizes tiles (more or fewer columns)
- Subdirectories appear as tiles showing their first image, with a folder icon
- Click an image to open it full-screen; navigate with `←` / `→`; close with `Escape`
- Click a folder tile to navigate into it; `Backspace` goes back up
- Sorted by name (Windows Explorer order)

## Tech stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Tauri 2.0 |
| Backend (file I/O, thumbnails) | Rust |
| UI | React 18 + TypeScript |
| State | Zustand |
| Build tool | Vite |

## Development setup

Prerequisites (installed once globally):
- [Rust](https://rustup.rs)
- [Node.js LTS](https://nodejs.org)
- Visual Studio C++ Build Tools (Desktop development with C++ workload)

Install dependencies:

```bash
npm install
```

Run in development mode (hot-reload):

```bash
npm run tauri dev
```

Run tests:

```bash
cargo test --manifest-path src-tauri/Cargo.toml   # Rust backend tests
npm run test                                        # React component tests
```

## Project structure

```
├── src/                  React frontend
│   ├── components/       TileGrid, Tile, Viewer, Breadcrumb
│   ├── hooks/            useDirectory, useTileSize
│   └── store/            Zustand state slices
└── src-tauri/            Rust backend
    └── src/commands/     list_directory, get_thumbnail
```

See [PLAN.md](PLAN.md) for the full implementation plan and milestone breakdown.
