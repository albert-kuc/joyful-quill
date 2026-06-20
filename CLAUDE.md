# Joyful Quill — Claude Instructions

## Plan

`PLAN.md` in this repo root is the single source of truth for the project plan.
Do not maintain any separate plan file elsewhere. Update `PLAN.md` directly when
the plan changes.

## Project

Windows desktop image viewer built with Tauri 2.0 (Rust backend + React/TypeScript
frontend). The Rust backend handles all file system access and image processing;
React renders the UI via WebView2.

## Git

All commits are made by the user manually. Never stage, commit, amend, or otherwise
touch git history. Read-only git commands (status, diff, log) are fine.

## Scope

Never start implementing a milestone unless the user names it explicitly in their message.
When the request is ambiguous, ask before touching any file.

## Commands

```
npm run tauri dev     # start the app in dev mode (compiles Rust + starts Vite)
npm run test          # run Vitest unit tests
cargo test            # run Rust unit tests (from src-tauri/)
```

## Toolchain paths (non-default locations on this machine)

- Rust: `D:\Rust`
- VS Build Tools 2026: `D:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools`

## Key decisions

- Thumbnails returned as `data:image/jpeg;base64,...` strings over Tauri IPC
- Image format detected from magic bytes, not file extension (handles misnamed files)
- Masonry layout via `react-masonry-css` (round-robin columns, acceptable for a viewer)
- Dirs sorted before files within each group, both groups sorted by name
- `INITIAL_PATH` in `src/App.tsx` is hardcoded for development; replaced by an open
  folder dialog in Milestone 5
