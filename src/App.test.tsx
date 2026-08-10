import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock
}));

describe("App", () => {
  afterEach(() => {
    invokeMock.mockReset();
  });

  it("loads saved settings only once when the initial ticket refresh fails", async () => {
    invokeMock.mockImplementation((command: string) => {
      if (command === "dock_window") {
        return Promise.resolve();
      }

      if (command === "list_monitors") {
        return Promise.resolve([{ index: 0, label: "Monitor 1", isPrimary: true }]);
      }

      if (command === "load_settings") {
        return Promise.resolve({
          baseUrl: "https://redmine.example.com",
          apiKey: "secret",
          monitorIndex: 0,
          dockSide: "right",
          refreshIntervalSeconds: 60
        });
      }

      if (command === "fetch_tickets") {
        return Promise.reject("Redmine returned HTTP 502 Bad Gateway");
      }

      return Promise.resolve();
    });

    render(<App />);

    await screen.findByText("Redmine returned HTTP 502 Bad Gateway");

    await waitFor(() => {
      const loadSettingsCalls = invokeMock.mock.calls.filter(
        ([command]) => command === "load_settings"
      );
      expect(loadSettingsCalls).toHaveLength(1);
    });
  });
});
