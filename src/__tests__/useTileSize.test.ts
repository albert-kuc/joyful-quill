import { describe, it, expect } from "vitest";
import { clampCols, MIN_COLS, MAX_COLS } from "../hooks/useTileSize";

describe("useTileSize", () => {
  it("shouldIncreaseTileSizeOnScrollDown", () => {
    // Given: 4 columns
    // When: scroll down (deltaY > 0)
    // Then: column count decreases — tiles get bigger
    expect(clampCols(4, 1)).toBe(3);
  });

  it("shouldDecreaseTileSizeOnScrollUp", () => {
    // Given: 4 columns
    // When: scroll up (deltaY < 0)
    // Then: column count increases — tiles get smaller
    expect(clampCols(4, -1)).toBe(5);
  });

  it("shouldClampColumnsAtMinimum", () => {
    // Given: already at minimum columns
    // When: scroll down
    // Then: stays at MIN_COLS, does not go below 1
    expect(clampCols(MIN_COLS, 1)).toBe(MIN_COLS);
  });

  it("shouldClampColumnsAtMaximum", () => {
    // Given: already at maximum columns
    // When: scroll up
    // Then: stays at MAX_COLS, does not exceed 12
    expect(clampCols(MAX_COLS, -1)).toBe(MAX_COLS);
  });
});
