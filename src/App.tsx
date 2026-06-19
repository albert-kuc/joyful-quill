import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

// POC: hardcoded path — replace with a folder that has images on your machine
const HARDCODED_PATH = "D:\\MEGA drw\\era_of_meat";

interface DirEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

function App() {
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);

  useEffect(() => {
    invoke<DirEntry[]>("list_directory", { path: HARDCODED_PATH }).then(setEntries);
  }, []);

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

      {entries.length === 0 && <p>No images or folders found.</p>}

      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {entries.map((entry) => (
          <li key={entry.path} style={{ marginBottom: "0.25rem" }}>
            {entry.is_dir ? (
              <span>📁 {entry.name}</span>
            ) : (
              <button
                onClick={() => openImage(entry.path)}
                style={{ cursor: "pointer", background: "none", border: "none", padding: 0, color: "inherit", fontSize: "inherit" }}
              >
                🖼 {entry.name}
              </button>
            )}
          </li>
        ))}
      </ul>

      {viewerSrc && (
        <div
          onClick={() => setViewerSrc(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "black",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            cursor: "pointer",
          }}
        >
          <img
            src={viewerSrc}
            style={{ maxWidth: "100vw", maxHeight: "100vh", objectFit: "contain" }}
            alt=""
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

export default App;
