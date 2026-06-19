import { useState, useEffect } from "react";

export const MIN_COLS = 1;
export const MAX_COLS = 12;

export function clampCols(current: number, deltaY: number): number {
  if (deltaY > 0) return Math.max(MIN_COLS, current - 1);
  return Math.min(MAX_COLS, current + 1);
}

export function useTileSize(initial = 4): number {
  const [cols, setCols] = useState(initial);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setCols(c => clampCols(c, e.deltaY));
    };
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, []);

  return cols;
}
