import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
          refreshIntervalSeconds: 60,
          language: "de"
        });
      }

      if (command === "fetch_tickets") {
        return Promise.reject("Redmine returned HTTP 502 Bad Gateway");
      }

      return Promise.resolve();
    });

    render(<App />);

    await screen.findByText("Redmine-Fehler: Redmine returned HTTP 502 Bad Gateway");

    await waitFor(() => {
      const loadSettingsCalls = invokeMock.mock.calls.filter(
        ([command]) => command === "load_settings"
      );
      expect(loadSettingsCalls).toHaveLength(1);
    });
  });

  it("adds a comment and assigns the ticket from the comment dialog", async () => {
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
          refreshIntervalSeconds: 60,
          language: "de"
        });
      }

      if (command === "fetch_issue_statuses") {
        return Promise.resolve([]);
      }

      if (command === "fetch_assignable_users") {
        return Promise.resolve([
          { id: 7, name: "Max Mustermann" }
        ]);
      }

      if (command === "fetch_tickets") {
        return Promise.resolve([
          {
            id: 42,
            subject: "Login reparieren",
            status: "Neu",
            priority: "Hoch",
            project: "Desktop",
            projectId: 12,
            tracker: "Bug",
            updatedAt: "2026-08-10T08:00:00Z",
            url: "https://redmine.example.com/issues/42"
          }
        ]);
      }

      if (command === "assign_ticket") {
        return Promise.resolve();
      }

      return Promise.resolve();
    });

    render(<App />);

    const ticket = await screen.findByText("Login reparieren");
    fireEvent.contextMenu(ticket, { clientX: 20, clientY: 20 });
    fireEvent.click(await screen.findByRole("button", { name: "Kommentar hinzufügen" }));
    await screen.findByRole("option", { name: "Max Mustermann" });
    fireEvent.change(screen.getByPlaceholderText("Kommentar"), {
      target: { value: "Bitte übernehmen." }
    });
    fireEvent.change(screen.getByLabelText("Zuweisen an"), {
      target: { value: "7" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Änderungen speichern" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("add_ticket_comment", {
        settings: {
          baseUrl: "https://redmine.example.com",
          apiKey: "secret",
          monitorIndex: 0,
          dockSide: "right",
          refreshIntervalSeconds: 60,
          language: "de"
        },
        ticketId: 42,
        comment: "Bitte übernehmen."
      });
      expect(invokeMock).toHaveBeenCalledWith("assign_ticket", {
        settings: {
          baseUrl: "https://redmine.example.com",
          apiKey: "secret",
          monitorIndex: 0,
          dockSide: "right",
          refreshIntervalSeconds: 60,
          language: "de"
        },
        ticketId: 42,
        userId: 7
      });
      expect(invokeMock).toHaveBeenCalledWith("fetch_assignable_users", {
        settings: {
          baseUrl: "https://redmine.example.com",
          apiKey: "secret",
          monitorIndex: 0,
          dockSide: "right",
          refreshIntervalSeconds: 60,
          language: "de"
        },
        projectId: 12
      });
    });
  });
});
