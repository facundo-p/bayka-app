export const KB = 1024;
export const MB = 1024 * KB;
export const GB = 1024 * MB;

/** "850 KB", "4.2 MB", "74 MB", "1.3 GB". */
export function formatearPeso(bytes: number): string {
  if (bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`;
  if (bytes >= 10 * MB) return `${Math.round(bytes / MB)} MB`;
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  // Un archivo chico no se redondea a "0 KB", que se lee como vacío.
  const kb = Math.round(bytes / KB);
  return `${bytes > 0 ? Math.max(1, kb) : 0} KB`;
}
