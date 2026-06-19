import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import Masonry from "react-masonry-css";
import { useTileSize } from "./hooks/useTileSize";
import "./App.css";

const HARDCODED_PATH = "D:\\MEGA drw\\era_of_meat";
const THUMB_SIZE = 600;

interface DirEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

function App() {
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const cols = useTileSize();
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);

  useEffect(() => {
    invoke<DirEntry[]>("list_directory", { path: HARDCODED_PATH }).then(setEntries);
  }, []);

  useEffect(() => {
    const imageEntries = entries.filter(e => !e.is_dir);
    Promise.all(
      imageEntries.map(e =>
        invoke<string>("get_thumbnail", { path: e.path, size: THUMB_SIZE })
          .then(src => ({ path: e.path, src }))
          .catch(() => null)
      )
    ).then(results => {
      const map: Record<string, string> = {};
      results.forEach(r => { if (r) map[r.path] = r.src; });
      setThumbs(map);
    });
  }, [entries]);

  async function openImage(path: string) {
    try {
      const src = await invoke<string>("read_image_base64", { path });
      setViewerSrc(src);
    } catch (err) {
      console.error("Failed to load image:", err);
    }
  }

  return (
    <div style={{ padding: "1rem", fontFamily: "sans-serif" }}>
      <h2 style={{ marginBottom: "1rem" }}>{HARDCODED_PATH}</h2>

      <Masonry
        breakpointCols={cols}
        className="masonry-grid"
        columnClassName="masonry-grid-column"
      >
        {entries.map(entry => (
          <div
            key={entry.path}
            onClick={() => !entry.is_dir && openImage(entry.path)}
            style={{
              cursor: entry.is_dir ? "default" : "pointer",
              background: "#222",
            }}
          >
            {entry.is_dir ? (
              <div style={{ aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: "3rem" }}>📁</span>
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
