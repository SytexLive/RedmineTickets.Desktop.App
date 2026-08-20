import { describe, expect, it } from "vitest";
import { buildTicketUrl, buildUserOpenTicketsUrl } from "./ticket";

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

  it("rejects invalid ticket IDs", () => {
    expect(() => buildTicketUrl("https://redmine.example.com", Number.NaN)).toThrow(
      "Ticket ID must be positive"
    );
  });
});

describe("buildUserOpenTicketsUrl", () => {
  it("builds a Redmine issue list filtered to open tickets assigned to a user", () => {
    expect(buildUserOpenTicketsUrl("https://redmine.example.com/", 7)).toBe(
      "https://redmine.example.com/issues?status_id=open&assigned_to_id=7"
    );
  });

  it("rejects non-positive user IDs", () => {
    expect(() => buildUserOpenTicketsUrl("https://redmine.example.com", 0)).toThrow(
      "User ID must be positive"
    );
  });
});
