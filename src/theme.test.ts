import { describe, expect, it } from "vitest";
import { DEFAULT_ACCENT_COLOR, normalizeAccentColor } from "./theme";

describe("normalizeAccentColor", () => {
  it("keeps valid hex colors and normalizes casing", () => {
    expect(normalizeAccentColor("#0F766E")).toBe("#0f766e");
  });

  it("falls back to the default accent color for missing or invalid values", () => {
    expect(normalizeAccentColor(undefined)).toBe(DEFAULT_ACCENT_COLOR);
    expect(normalizeAccentColor("blue")).toBe(DEFAULT_ACCENT_COLOR);
  });
});
