import { describe, it, expect } from "vitest";
import { clampCols, MIN_COLS, MAX_COLS } from "../hooks/useTileSize";

describe("useTileSize", () => {
  it.each([
    { current: 4,        deltaY:  1, expected: 5,        label: "shouldDecreaseTileSizeOnScrollDown" },
    { current: 4,        deltaY: -1, expected: 3,        label: "shouldIncreaseTileSizeOnScrollUp" },
    { current: MAX_COLS, deltaY:  1, expected: MAX_COLS, label: "shouldClampColumnsAtMaximum" },
    { current: MIN_COLS, deltaY: -1, expected: MIN_COLS, label: "shouldClampColumnsAtMinimum" },
  ])("$label", ({ current, deltaY, expected }) => {
    expect(clampCols(current, deltaY)).toBe(expected);
  });
});
