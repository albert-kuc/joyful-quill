import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import Masonry from "react-masonry-css";
import { useTileSize } from "./hooks/useTileSize";
import "./App.css";

const INITIAL_PATH = "D:\\MEGA drw\\admapss";
const THUMB_SIZE = 600;

interface DirEntry {
  name: string;
  path: string;
  is_dir: boolean;
  preview_path: string | null;
}

function getParentPath(p: string): string | null {
  if (/^[A-Za-z]:\\?$/.test(p)) return null;
  const last = p.lastIndexOf("\\");
  if (last < 0) return null;
  if (last <= 2) return p.slice(0, 3);
  return p.slice(0, last);
}

function buildBreadcrumb(p: string): { label: string; path: string }[] {
  const parts = p.replace(/\\+$/, "").split("\\");
  return parts.map((part, i) => ({
    label: part,
    path: i === 0 ? part + "\\" : parts.slice(0, i + 1).join("\\"),
  }));
}

function App() {
  const [currentPath, setCurrentPath] = useState(INITIAL_PATH);
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const cols = useTileSize();
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);

  function navigateTo(path: string) {
    setCurrentPath(path);
    setEntries([]);
    setThumbs({});
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
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== "Backspace") return;
      if (viewerSrc) {
        setViewerSrc(null);
        return;
      }
      const parent = getParentPath(currentPath);
      if (parent) navigateTo(parent);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [viewerSrc, currentPath]);

  async function openImage(path: string) {
    try {
      const src = await invoke<string>("read_image_base64", { path });
      setViewerSrc(src);
    } catch (err) {
      console.error("Failed to load image:", err);
    }
  }

  const breadcrumb = buildBreadcrumb(currentPath);

  return (
    <div style={{ padding: "1rem", fontFamily: "sans-serif" }}>
      <div style={{ marginBottom: "1rem", display: "flex", gap: "0.25rem", alignItems: "center", flexWrap: "wrap" }}>
        {breadcrumb.map((seg, i) => (
          <span key={seg.path} style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
            {i > 0 && <span style={{ color: "#555" }}>›</span>}
            <button
              onClick={() => navigateTo(seg.path)}
              style={{
                background: "none",
                border: "none",
                color: i === breadcrumb.length - 1 ? "#fff" : "#888",
                cursor: "pointer",
                padding: "2px 4px",
                fontSize: "0.9rem",
              }}
            >
              {seg.label}
            </button>
          </span>
        ))}
      </div>

      <Masonry
        breakpointCols={cols}
        className="masonry-grid"
        columnClassName="masonry-grid-column"
      >
        {entries.map(entry => (
          <div
            key={entry.path}
            onClick={() => entry.is_dir ? navigateTo(entry.path) : openImage(entry.path)}
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

      {viewerSrc && (
        <div
          onClick={() => setViewerSrc(null)}
          style={{
            position: "fixed", inset: 0, background: "black",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 100, cursor: "pointer",
          }}
        >
          <img
            src={viewerSrc}
            style={{ maxWidth: "100vw", maxHeight: "100vh", objectFit: "contain" }}
            alt=""
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

export default App;
