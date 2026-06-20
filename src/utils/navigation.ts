export interface DirEntry {
  name: string;
  path: string;
  is_dir: boolean;
  preview_path: string | null;
}

export function getParentPath(p: string): string | null {
  if (/^[A-Za-z]:\\?$/.test(p)) return null;
  const last = p.lastIndexOf("\\");
  if (last < 0) return null;
  if (last <= 2) return p.slice(0, 3);
  return p.slice(0, last);
}

export function buildBreadcrumb(p: string): { label: string; path: string }[] {
  const parts = p.replace(/\\+$/, "").split("\\");
  return parts.map((part, i) => ({
    label: part,
    path: i === 0 ? part + "\\" : parts.slice(0, i + 1).join("\\"),
  }));
}

export function toImageEntries(entries: DirEntry[]): DirEntry[] {
  return entries.filter(e => !e.is_dir);
}

export function nextIndex(current: number, total: number): number {
  return (current + 1) % total;
}

export function prevIndex(current: number, total: number): number {
  return (current - 1 + total) % total;
}
