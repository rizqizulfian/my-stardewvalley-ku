// Shared, non-saved UI state that both scenes read: whether a menu has the
// game paused, and which screen rectangles belong to the HUD (so clicks there
// do not swing a tool in the world).

export const uiState = {
  /** The title prompt has been dismissed. */
  started: false,
  menuOpen: false,
  hudRects: [] as Array<{ x: number; y: number; w: number; h: number }>,
};

export function overHud(px: number, py: number): boolean {
  return uiState.hudRects.some((r) => px >= r.x && py >= r.y && px < r.x + r.w && py < r.y + r.h);
}
