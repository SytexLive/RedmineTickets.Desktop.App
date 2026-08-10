import { describe, expect, it } from "vitest";
import { buildTicketUrl } from "./ticket";

describe("buildTicketUrl", () => {
  it("builds a Redmine issue URL without duplicate slashes", () => {
    expect(buildTicketUrl("https://redmine.example.com/", 123)).toBe(
      "https://redmine.example.com/issues/123"
    );
  });

  it("rejects non-positive ticket IDs", () => {
    expect(() => buildTicketUrl("https://redmine.example.com", 0)).toThrow(
      "Ticket ID must be positive"
    );
  });
});
