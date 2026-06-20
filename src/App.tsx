import { useState, useEffect, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
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
      !e.is_dir ? [e.path] : e.preview_path ? [e.preview_path] : []
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
        const p = queue.shift()!;
        active++;
        invoke<string>("get_thumbnail", { path: p, size: THUMB_SIZE, generation })
          .then(src => { if (!cancelled) setThumbs(prev => ({ ...prev, [p]: src })); })
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
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {timerSeconds !== null && (
            <span style={{
              fontFamily: "monospace",
              fontSize: "0.85rem",
              color: thumbsLoading ? "#c0692a" : "#888",
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
            onClick={() =>
              entry.is_dir
                ? navigateTo(entry.path)
                : setViewerIndex(imageEntries.indexOf(entry))
            }
            className={entry.is_dir ? "tile tile--folder" : "tile"}
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
