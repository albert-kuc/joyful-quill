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

## Building a distributable installer

Run on the development machine (requires Rust + Node installed, same as dev setup):

```bash
npm run tauri build
```

This compiles the Rust backend in release mode, bundles the React frontend into the
binary, and produces Windows installers in `src-tauri/target/release/bundle/`:

| File | Format | Notes |
|------|--------|-------|
| `msi/joyful-quill_*.msi` | Windows Installer | Standard MSI; preferred for enterprise / group policy |
| `nsis/joyful-quill_*_x64-setup.exe` | NSIS installer | Smaller download; simpler for personal use |

Copy either file to any Windows 10/11 machine and double-click — no Rust, no Node, no
terminal required on the target.

### What gets installed

After running the installer the target machine has:

- **`joyful-quill.exe`** — a single self-contained binary. The entire React frontend
  (HTML, CSS, JS) is embedded inside the `.exe`; there are no loose web files next to it.
- **Start Menu shortcut** and optionally a desktop shortcut.
- **Uninstaller** registered in Add/Remove Programs.

The app is installed to `%LOCALAPPDATA%\joyful-quill\` (NSIS) or
`C:\Program Files\joyful-quill\` (MSI) depending on the installer type.

The thumbnail cache (`%LOCALAPPDATA%\JoyfulQuill\thumbs\`) is created separately on
first use and is not touched by the uninstaller — delete it manually if needed.

WebView2 (the rendering engine) is not bundled; it is already part of Windows 10
(updated builds) and Windows 11. If the target is an older Windows 10 that lacks it,
Tauri's build config can include a WebView2 bootstrapper.

### SmartScreen warning

The first time someone runs the installer on a new machine, Windows SmartScreen will
show "Windows protected your PC" because the binary is unsigned. Click **More info →
Run anyway** to proceed. This warning disappears if the `.exe` is signed with a code
signing certificate (not required for personal use).

---

See [PLAN.md](PLAN.md) for the full implementation plan and milestone breakdown.
