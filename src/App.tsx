import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
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

const INITIAL_PATH = "D:\\MEGA drw\\admapss";
const THUMB_SIZE = 600;

function App() {
  const [currentPath, setCurrentPath] = useState(INITIAL_PATH);
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const cols = useTileSize();
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);

  const imageEntries = useMemo(() => toImageEntries(entries), [entries]);

  function navigateTo(path: string) {
    setCurrentPath(path);
    setEntries([]);
    setThumbs({});
    setViewerIndex(null);
    setViewerSrc(null);
  }

  function closeViewer() {
    setViewerIndex(null);
    setViewerSrc(null);
  }

  useEffect(() => {
    invoke<DirEntry[]>("list_directory", { path: currentPath }).then(setEntries);
  }, [currentPath]);

  useEffect(() => {
    const pathsToLoad = entries.flatMap(e =>
      !e.is_dir ? [e.path] : e.preview_path ? [e.preview_path] : []
    );
    if (pathsToLoad.length === 0) return;
    Promise.all(
      pathsToLoad.map(p =>
        invoke<string>("get_thumbnail", { path: p, size: THUMB_SIZE })
          .then(src => ({ path: p, src }))
          .catch(() => null)
      )
    ).then(results => {
      const map: Record<string, string> = {};
      results.forEach(r => { if (r) map[r.path] = r.src; });
      setThumbs(map);
    });
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
      if (e.key === "Backspace") {
        const parent = getParentPath(currentPath);
        if (parent) navigateTo(parent);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [viewerIndex, currentPath, imageEntries]);

  const breadcrumb = buildBreadcrumb(currentPath);

  return (
    <div style={{ padding: "1rem", fontFamily: "sans-serif" }}>
      <div style={{ marginBottom: "1rem", display: "flex", gap: "0.25rem", alignItems: "center", flexWrap: "wrap" }}>
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
