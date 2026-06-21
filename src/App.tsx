import { useState, useEffect, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import Masonry from "react-masonry-css";
import { useTileSize } from "./hooks/useTileSize";
import {
  buildBreadcrumb,
  getParentPath,
  toImageEntries,
  nextIndex,
  prevIndex,
} from "./utils/navigation";
import type { DirEntry } from "./utils/navigation";
import "./App.css";

const THUMB_SIZE = 600;
const CONCURRENT_THUMBS = 8;

function App() {
  const [currentPath, setCurrentPath] = useState<string | null>(
    localStorage.getItem("lastPath")
  );
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const cols = useTileSize();
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [thumbsLoading, setThumbsLoading] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const imageEntries = useMemo(() => toImageEntries(entries), [entries]);

  function navigateTo(path: string) {
    localStorage.setItem("lastPath", path);
    setCurrentPath(path);
    setEntries([]);
    setThumbs({});
    setViewerIndex(null);
    setViewerSrc(null);
  }

  async function pickFolder() {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") navigateTo(selected);
  }

  async function clearCache() {
    await invoke("clear_cache");
    setShowClearConfirm(false);
  }

  function closeViewer() {
    setViewerIndex(null);
    setViewerSrc(null);
  }

  useEffect(() => {
    if (!currentPath) return;
    invoke<DirEntry[]>("list_directory", { path: currentPath }).then(setEntries);
  }, [currentPath]);

  useEffect(() => {
    const pathsToLoad = entries.flatMap(e =>
      e.is_dir ? (e.preview_path ? [{ path: e.preview_path, video: false }] : [])
      : e.is_video ? [{ path: e.path, video: true }]
      : [{ path: e.path, video: false }]
    );
    if (pathsToLoad.length === 0) {
      setTimerSeconds(null);
      return;
    }
    let cancelled = false;
    let pending = pathsToLoad.length;
    const queue = [...pathsToLoad];
    let active = 0;

    setTimerSeconds(0);
    setThumbsLoading(true);
    timerRef.current = setInterval(() => {
      setTimerSeconds(prev => (prev ?? 0) + 1);
    }, 1000);

    function loadNext(generation: number) {
      while (!cancelled && active < CONCURRENT_THUMBS && queue.length > 0) {
        const item = queue.shift()!;
        active++;
        const cmd = item.video ? "get_video_thumbnail" : "get_thumbnail";
        invoke<string>(cmd, { path: item.path, size: THUMB_SIZE, generation })
          .then(src => { if (!cancelled) setThumbs(prev => ({ ...prev, [item.path]: src })); })
          .catch(() => {})
          .finally(() => {
            active--;
            if (!cancelled) {
              if (--pending === 0) {
                setThumbsLoading(false);
                clearInterval(timerRef.current!);
              } else {
                loadNext(generation);
              }
            }
          });
      }
    }

    (async () => {
      const generation = await invoke<number>("next_generation");
      if (!cancelled) loadNext(generation);
    })();

    return () => {
      cancelled = true;
      queue.length = 0;
      setThumbsLoading(false);
      clearInterval(timerRef.current!);
    };
  }, [entries]);

  useEffect(() => {
    if (viewerIndex === null) {
      setViewerSrc(null);
      return;
    }
    const entry = imageEntries[viewerIndex];
    if (!entry) return;
    setViewerSrc(null);
    invoke<string>("read_image_base64", { path: entry.path })
      .then(setViewerSrc)
      .catch(err => console.error("Failed to load image:", err));
  }, [viewerIndex, imageEntries]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (viewerIndex !== null) {
        if (e.key === "ArrowRight") {
          setViewerIndex(nextIndex(viewerIndex, imageEntries.length));
        } else if (e.key === "ArrowLeft") {
          setViewerIndex(prevIndex(viewerIndex, imageEntries.length));
        } else if (e.key === "Escape" || e.key === "Backspace") {
          closeViewer();
        }
        return;
      }
      if (e.key === "Backspace" && currentPath) {
        const parent = getParentPath(currentPath);
        if (parent) navigateTo(parent);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [viewerIndex, currentPath, imageEntries]);

  const breadcrumb = currentPath ? buildBreadcrumb(currentPath) : [];

  if (!currentPath) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "sans-serif" }}>
        <button
          onClick={pickFolder}
          style={{ padding: "0.75rem 1.5rem", fontSize: "1rem", cursor: "pointer" }}
        >
          Open Folder
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "1rem", fontFamily: "sans-serif" }}>
      <div style={{ marginBottom: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: "0.25rem", alignItems: "center", flexWrap: "wrap" }}>
          {breadcrumb.map((seg, i) => {
            const isLast = i === breadcrumb.length - 1;
            return (
              <span key={seg.path} style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                {i > 0 && <span style={{ color: "#aaa" }}>›</span>}
                {isLast ? (
                  <span style={{ color: "#1e3347", padding: "2px 4px", fontSize: "0.9rem", fontWeight: 500 }}>
                    {seg.label}
                  </span>
                ) : (
                  <button
                    onClick={() => navigateTo(seg.path)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#4a6d8e",
                      cursor: "pointer",
                      padding: "2px 4px",
                      fontSize: "0.9rem",
                    }}
                  >
                    {seg.label}
                  </button>
                )}
              </span>
            );
          })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {timerSeconds !== null && (
            <span style={{
              fontFamily: "monospace",
              fontSize: "0.85rem",
              color: thumbsLoading ? "#c0692a" : "#888",
              marginRight: "0.25rem",
            }}>
              {timerSeconds}s
            </span>
          )}
          <button
            onClick={pickFolder}
            style={{
              background: "none",
              border: "1px solid #ccc",
              borderRadius: "4px",
              padding: "2px 8px",
              fontSize: "0.85rem",
              cursor: "pointer",
              color: "#4a6d8e",
            }}
          >
            Open…
          </button>
          <span style={{ color: "#aaa" }}>|</span>
          <button
            onClick={() => openPath(currentPath)}
            style={{
              background: "none",
              border: "1px solid #ccc",
              borderRadius: "4px",
              padding: "2px 8px",
              fontSize: "0.85rem",
              cursor: "pointer",
              color: "#4a6d8e",
            }}
          >
            Open in explorer
          </button>
          <span style={{ color: "#aaa" }}>|</span>
          {showClearConfirm ? (
            <>
              <span style={{ fontSize: "0.85rem", color: "#666" }}>Purge cache?</span>
              <button
                onClick={clearCache}
                style={{
                  background: "none",
                  border: "1px solid #c0692a",
                  borderRadius: "4px",
                  padding: "2px 8px",
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  color: "#c0692a",
                }}
              >
                Yes
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                style={{
                  background: "none",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  padding: "2px 8px",
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  color: "#666",
                }}
              >
                No
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowClearConfirm(true)}
              style={{
                background: "none",
                border: "1px solid #ccc",
                borderRadius: "4px",
                padding: "2px 8px",
                fontSize: "0.85rem",
                cursor: "pointer",
                color: "#4a6d8e",
              }}
            >
              Clear cache
            </button>
          )}
        </div>
      </div>

      <Masonry
        breakpointCols={cols}
        className="masonry-grid"
        columnClassName="masonry-grid-column"
      >
        {entries.map(entry => (
          <div
            key={entry.path}
            onClick={() => {
              if (entry.is_dir) navigateTo(entry.path);
              else if (entry.is_video) openPath(entry.path).catch(err => console.error("openPath failed:", err));
              else setViewerIndex(imageEntries.indexOf(entry));
            }}
            className={entry.is_dir ? "tile tile--folder" : entry.is_video ? "tile tile--video" : "tile"}
          >
            {entry.is_dir ? (
              <div className="folder-tile">
                {entry.preview_path && thumbs[entry.preview_path] && (
                  <img
                    src={thumbs[entry.preview_path]}
                    alt=""
                    className="folder-tile__preview"
                  />
                )}
                <div className="folder-tile__overlay">
                  <span className="folder-tile__icon">📁</span>
                  <span className="folder-tile__name">{entry.name}</span>
                </div>
              </div>
            ) : entry.is_video ? (
              thumbs[entry.path] ? (
                <img
                  src={thumbs[entry.path]}
                  alt={entry.name}
                  style={{ width: "100%", height: "auto", display: "block" }}
                />
              ) : (
                <div style={{ aspectRatio: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.25rem" }}>
                  <span style={{ fontSize: "2rem" }}>🎬</span>
                  <span style={{ color: "#888", fontSize: "0.7rem", textAlign: "center", padding: "0 0.25rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{entry.name}</span>
                </div>
              )
            ) : thumbs[entry.path] ? (
              <img
                src={thumbs[entry.path]}
                alt={entry.name}
                style={{ width: "100%", height: "auto", display: "block" }}
              />
            ) : (
              <div style={{ aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#555", fontSize: "0.75rem" }}>…</span>
              </div>
            )}
          </div>
        ))}
      </Masonry>

      {viewerIndex !== null && (
        <div
          onClick={closeViewer}
          style={{
            position: "fixed", inset: 0, background: "black",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 100, cursor: "pointer",
          }}
        >
          {viewerSrc ? (
            <img
              src={viewerSrc}
              style={{ maxWidth: "100vw", maxHeight: "100vh", objectFit: "contain" }}
              alt=""
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <div style={{ color: "#555", fontSize: "2rem" }}>…</div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
