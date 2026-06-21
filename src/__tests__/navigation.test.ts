import { describe, it, expect } from "vitest";
import {
  getParentPath,
  buildBreadcrumb,
  toImageEntries,
  nextIndex,
  prevIndex,
} from "../utils/navigation";
import type { DirEntry } from "../utils/navigation";

// ── helpers ──────────────────────────────────────────────────────────────────

function makeEntry(name: string, is_dir: boolean, is_video = false): DirEntry {
  return { name, path: `C:\\photos\\${name}`, is_dir, is_video, preview_path: null };
}

// ── getParentPath ─────────────────────────────────────────────────────────────

describe("getParentPath", () => {
  it.each([
    { input: "C:\\photos\\vacation", expected: "C:\\photos", label: "shouldNavigateUpOnBackspaceInGrid" },
    { input: "C:\\photos",           expected: "C:\\",        label: "shouldReturnDriveRootForTopLevelFolder" },
    { input: "C:\\",                 expected: null,          label: "shouldReturnNullAtDriveRoot — trailing slash" },
    { input: "C:",                   expected: null,          label: "shouldReturnNullAtDriveRoot — no slash" },
  ])("$label", ({ input, expected }) => {
    // Given: a Windows path
    // When: parent is requested
    // Then: last segment stripped, or null at root
    expect(getParentPath(input)).toBe(expected);
  });
});

// ── buildBreadcrumb ───────────────────────────────────────────────────────────

describe("buildBreadcrumb", () => {
  it("shouldUpdateBreadcrumbOnFolderNavigation", () => {
    // Given: a three-level path
    // When: breadcrumb is built
    // Then: each segment has the correct cumulative path
    const crumbs = buildBreadcrumb("C:\\photos\\vacation");
    expect(crumbs).toEqual([
      { label: "C:", path: "C:\\" },
      { label: "photos", path: "C:\\photos" },
      { label: "vacation", path: "C:\\photos\\vacation" },
    ]);
  });

  it("shouldBuildSingleSegmentBreadcrumbAtDriveRoot", () => {
    // Given: the drive root
    // When: breadcrumb is built
    // Then: only the drive label is returned
    const crumbs = buildBreadcrumb("C:\\");
    expect(crumbs).toHaveLength(1);
    expect(crumbs[0].label).toBe("C:");
  });
});

// ── toImageEntries ────────────────────────────────────────────────────────────

describe("toImageEntries", () => {
  it("shouldExcludeFoldersFromImageNavigation", () => {
    // Given: a mixed list of files and directories
    // When: image entries are extracted
    // Then: only non-directory entries are returned, preserving order
    const entries: DirEntry[] = [
      makeEntry("folder1", true),
      makeEntry("img1.jpg", false),
      makeEntry("folder2", true),
      makeEntry("img2.png", false),
    ];
    const images = toImageEntries(entries);
    expect(images).toHaveLength(2);
    expect(images[0].name).toBe("img1.jpg");
    expect(images[1].name).toBe("img2.png");
  });

  it("shouldReturnEmptyListWhenOnlyFoldersPresent", () => {
    // Given: a list with only directories
    // When: image entries are extracted
    // Then: empty array
    const entries = [makeEntry("a", true), makeEntry("b", true)];
    expect(toImageEntries(entries)).toHaveLength(0);
  });
});

// ── viewer index lookup ───────────────────────────────────────────────────────

describe("viewer index lookup", () => {
  it("shouldOpenViewerAtCorrectIndexWhenTileClicked", () => {
    // Given: mixed entries where the target image sits after a folder
    // When: its position is looked up in the image-only list (as the tile click does)
    // Then: indexOf returns 1, not the index it held in the full entry list
    const entries: DirEntry[] = [
      makeEntry("folder1", true),
      makeEntry("img1.jpg", false),
      makeEntry("img2.png", false),
    ];
    const images = toImageEntries(entries);
    const target = entries[2]; // img2.png — index 2 in the full list
    expect(images.indexOf(target)).toBe(1); // index 1 in image-only list
  });
});

// ── circular navigation ───────────────────────────────────────────────────────

describe("circular navigation", () => {
  it.each([
    { fn: nextIndex, current: 0, total: 3, expected: 1, label: "shouldCycleToNextImageOnRightArrow" },
    { fn: nextIndex, current: 2, total: 3, expected: 0, label: "shouldWrapAroundAtEndOfImageList" },
    { fn: prevIndex, current: 1, total: 3, expected: 0, label: "shouldCycleToPrevImageOnLeftArrow" },
    { fn: prevIndex, current: 0, total: 3, expected: 2, label: "shouldWrapAroundAtStartOfImageList" },
  ])("$label", ({ fn, current, total, expected }) => {
    // Given: a list of `total` images and a current position
    // When: the navigation function is applied
    // Then: index advances or wraps as expected
    expect(fn(current, total)).toBe(expected);
  });
});
