/**
 * Avatar paths can be either a local media path (`avatars/<id>.webp`) or a full URL
 * (a Google profile picture for linked accounts). Resolve to a usable src.
 */
export function avatarUrl(path: string | null): string | null {
  if (!path) return null;
  return path.startsWith("http") ? path : `/media/${path}`;
}
