export const DEFAULT_ACCENT_COLOR = "#1457a8";

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export function normalizeAccentColor(accentColor?: string | null): string {
  const trimmedColor = accentColor?.trim();
  if (!trimmedColor || !HEX_COLOR_PATTERN.test(trimmedColor)) {
    return DEFAULT_ACCENT_COLOR;
  }

  return trimmedColor.toLowerCase();
}
