// "Online" = active in the last 5 minutes (last-seen based) — port of src/lib/presence.js
export function isOnline(lastSeen?: string | null): boolean {
  if (!lastSeen) return false;
  const diffMs = Date.now() - new Date(lastSeen).getTime();
  return diffMs < 5 * 60 * 1000;
}
