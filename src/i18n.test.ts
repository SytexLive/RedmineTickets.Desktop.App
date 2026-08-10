import { describe, expect, it } from "vitest";
import { formatError } from "./i18n";

describe("formatError", () => {
  it("translates known backend errors for German output", () => {
    expect(formatError("Network failure while contacting Redmine", "de")).toBe(
      "Redmine-Fehler: Netzwerkfehler beim Kontaktieren von Redmine"
    );
  });

  it("keeps backend errors readable for English output", () => {
    expect(formatError("Missing API key", "en")).toBe("Redmine error: Missing API key");
  });
});
