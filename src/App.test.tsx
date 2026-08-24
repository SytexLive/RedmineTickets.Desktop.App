import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const invokeMock = vi.hoisted(() => vi.fn());
const checkAndInstallUpdateMock = vi.hoisted(() => vi.fn());

function settingsFixture() {
  return {
    baseUrl: "https://redmine.example.com",
    apiKey: "secret",
    monitorIndex: 0,
    dockSide: "right" as "left" | "right",
    refreshIntervalSeconds: 15,
    language: "de" as "de" | "en",
    autostartEnabled: false,
    ticketNotificationsEnabled: true,
    ticketNotificationVolume: 0.35,
    ticketNotificationSound: "default.mp3"
  };
}

function ticketFixture(id: number, subject: string) {
  return {
    id,
    subject,
    status: "Neu",
    priority: "Normal",
    project: "Desktop",
    projectId: 12,
    tracker: "Bug",
    assignee: "Max Mustermann",
    assigneeId: 7,
    updatedAt: "2026-08-10T08:00:00Z",
    url: `https://redmine.example.com/issues/${id}`
  };
}

function installAudioMock() {
  const playMock = vi.fn(() => Promise.resolve());
  const constructorMock = vi.fn(function AudioMock(this: HTMLAudioElement, src: string) {
    this.src = src;
    this.volume = 0;
    this.play = playMock as HTMLAudioElement["play"];
    return this;
  });
  vi.stubGlobal("Audio", constructorMock);
  return { constructorMock, playMock };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

function mockTicketApp({
  settings = settingsFixture(),
  ticketState = { knownTicketIds: [], unreadTicketIds: [] },
  ticketBatches
}: {
  settings?: ReturnType<typeof settingsFixture>;
  ticketState?: { knownTicketIds: number[]; unreadTicketIds: number[] };
  ticketBatches: ReturnType<typeof ticketFixture>[][];
}) {
  let fetchCount = 0;
  invokeMock.mockImplementation((command: string, args?: unknown) => {
    if (command === "dock_window") return Promise.resolve();
    if (command === "list_monitors") return Promise.resolve([]);
    if (command === "load_ticket_state") return Promise.resolve(ticketState);
    if (command === "save_ticket_state") return Promise.resolve();
    if (command === "load_settings") return Promise.resolve(settings);
    if (command === "fetch_issue_statuses") return Promise.resolve([]);
    if (command === "fetch_projects") return Promise.resolve([]);
    if (command === "fetch_trackers") return Promise.resolve([]);
    if (command === "fetch_issue_priorities") return Promise.resolve([]);
    if (command === "fetch_tickets") {
      const batch = ticketBatches[Math.min(fetchCount, ticketBatches.length - 1)];
      fetchCount += 1;
      return Promise.resolve(batch);
    }
    return Promise.resolve(args);
  });
}

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock
}));

vi.mock("./appUpdates", () => ({
  checkAndInstallUpdate: checkAndInstallUpdateMock
}));

describe("App", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
    window.localStorage.clear();
    invokeMock.mockReset();
    checkAndInstallUpdateMock.mockReset();
  });

  beforeEach(() => {
    checkAndInstallUpdateMock.mockResolvedValue({ status: "current" });
  });

  it("does not dock with default settings before saved settings are loaded", async () => {
    const settingsLoad = deferred<ReturnType<typeof settingsFixture>>();
    invokeMock.mockImplementation((command: string) => {
      if (command === "dock_window") return Promise.resolve();
      if (command === "list_monitors") return Promise.resolve([]);
      if (command === "load_ticket_state") {
        return Promise.resolve({ knownTicketIds: [], unreadTicketIds: [] });
      }
      if (command === "save_ticket_state") return Promise.resolve();
      if (command === "load_settings") return settingsLoad.promise;
      if (command === "fetch_issue_statuses") return Promise.resolve([]);
      if (command === "fetch_projects") return Promise.resolve([]);
      if (command === "fetch_trackers") return Promise.resolve([]);
      if (command === "fetch_issue_priorities") return Promise.resolve([]);
      if (command === "fetch_tickets") {
        return Promise.resolve([ticketFixture(42, "Loaded ticket")]);
      }
      return Promise.resolve();
    });

    render(<App />);

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("load_settings");
    });
    expect(invokeMock.mock.calls.some(([command]) => command === "dock_window")).toBe(false);

    await act(async () => {
      settingsLoad.resolve(settingsFixture());
    });

    await screen.findByText("Loaded ticket");

    expect(invokeMock).toHaveBeenCalledWith("dock_window", {
      settings: {
        monitorIndex: 0,
        dockSide: "right"
      }
    });
  });

  it("checks for updates from the header action", async () => {
    checkAndInstallUpdateMock.mockResolvedValue({
      status: "installed",
      version: "0.3.8"
    });
    mockTicketApp({
      ticketBatches: [[ticketFixture(42, "Update action ticket")]]
    });

    render(<App />);

    expect(await screen.findByText("Update action ticket")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Nach Updates suchen" }));

    expect(await screen.findByText("Update 0.3.8 installiert")).toBeInTheDocument();
    expect(checkAndInstallUpdateMock).toHaveBeenCalled();
  });

  it("hides the current update status after a short delay", async () => {
    checkAndInstallUpdateMock.mockResolvedValue({ status: "current" });
    mockTicketApp({
      ticketBatches: [[ticketFixture(42, "Current update ticket")]]
    });

    render(<App />);

    await screen.findByText("Current update ticket");
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Nach Updates suchen" }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("App ist aktuell")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    expect(screen.queryByText("App ist aktuell")).toBeNull();
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
          language: "de",
          ticketNotificationsEnabled: true,
          ticketNotificationVolume: 0.35,
          ticketNotificationSound: "default.mp3"
        });
      }

      if (command === "load_ticket_state") {
        return Promise.resolve({ knownTicketIds: [], unreadTicketIds: [] });
      }

      if (command === "save_ticket_state") {
        return Promise.resolve();
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

  it("adds a comment and updates assignee and status from the comment dialog", async () => {
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
          language: "de",
          ticketNotificationsEnabled: true,
          ticketNotificationVolume: 0.35,
          ticketNotificationSound: "default.mp3"
        });
      }

      if (command === "load_ticket_state") {
        return Promise.resolve({ knownTicketIds: [], unreadTicketIds: [] });
      }

      if (command === "save_ticket_state") {
        return Promise.resolve();
      }

      if (command === "fetch_issue_statuses") {
        return Promise.resolve([
          { id: 1, name: "Neu" },
          { id: 2, name: "In Bearbeitung" }
        ]);
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

      if (command === "update_ticket_status") {
        return Promise.resolve();
      }

      return Promise.resolve();
    });

    render(<App />);

    const ticket = await screen.findByText("Login reparieren");
    fireEvent.contextMenu(ticket, { clientX: 20, clientY: 20 });
    fireEvent.click(await screen.findByRole("button", { name: "Kommentar hinzufügen" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Titel")).toBeInTheDocument();
    expect(within(dialog).getByText("Login reparieren")).toBeInTheDocument();
    expect(within(dialog).getByText("Projekt")).toBeInTheDocument();
    expect(within(dialog).getByText("Desktop")).toBeInTheDocument();
    await screen.findByRole("option", { name: "Max Mustermann" });
    fireEvent.change(screen.getByPlaceholderText("Kommentar"), {
      target: { value: "Bitte übernehmen." }
    });
    fireEvent.change(screen.getByLabelText("Zuweisen an"), {
      target: { value: "7" }
    });
    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "2" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Änderungen speichern" }));

    await waitFor(() => {
      const expectedSettings = {
        baseUrl: "https://redmine.example.com",
        apiKey: "secret",
        monitorIndex: 0,
        dockSide: "right",
        refreshIntervalSeconds: 60,
        language: "de",
        ticketNotificationsEnabled: true,
        ticketNotificationVolume: 0.35,
        ticketNotificationSound: "default.mp3"
      };

      expect(invokeMock).toHaveBeenCalledWith("add_ticket_comment", {
        settings: expectedSettings,
        ticketId: 42,
        comment: "Bitte übernehmen."
      });
      expect(invokeMock).toHaveBeenCalledWith("assign_ticket", {
        settings: expectedSettings,
        ticketId: 42,
        userId: 7
      });
      expect(invokeMock).toHaveBeenCalledWith("update_ticket_status", {
        settings: expectedSettings,
        ticketId: 42,
        statusId: 2
      });
      expect(invokeMock).toHaveBeenCalledWith("fetch_assignable_users", {
        settings: expectedSettings,
        projectId: 12
      });
    });
  });

  it("puts add comment first in the ticket context menu and assigns from a submenu", async () => {
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
          language: "de",
          ticketNotificationsEnabled: true,
          ticketNotificationVolume: 0.35,
          ticketNotificationSound: "default.mp3"
        });
      }

      if (command === "load_ticket_state") {
        return Promise.resolve({ knownTicketIds: [], unreadTicketIds: [] });
      }

      if (command === "save_ticket_state") {
        return Promise.resolve();
      }

      if (command === "fetch_issue_statuses") {
        return Promise.resolve([
          { id: 1, name: "Neu" },
          { id: 2, name: "In Bearbeitung" }
        ]);
      }

      if (command === "fetch_assignable_users") {
        return Promise.resolve([
          { id: 7, name: "Max Mustermann" },
          { id: 8, name: "Mina Meyer" }
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

      if (command === "update_ticket_status") {
        return Promise.resolve();
      }

      return Promise.resolve();
    });

    render(<App />);

    const ticket = await screen.findByText("Login reparieren");
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 520 });
    fireEvent.contextMenu(ticket, { clientX: 20, clientY: 20 });

    const menuButtons = await screen.findAllByRole("button");
    const addCommentIndex = menuButtons.findIndex((button) =>
      button.textContent?.includes("Kommentar hinzufügen")
    );
    const openInBrowserIndex = menuButtons.findIndex((button) =>
      button.textContent?.includes("Im Browser öffnen")
    );
    expect(addCommentIndex).toBeGreaterThanOrEqual(0);
    expect(openInBrowserIndex).toBeGreaterThan(addCommentIndex);

    const statusSubmenuButton = screen.getByRole("button", { name: /Status/ });
    const statusSubmenu = statusSubmenuButton.closest(".context-menu-submenu");
    fireEvent.mouseEnter(statusSubmenu!);
    expect(screen.queryByRole("button", { name: "In Bearbeitung" })).toBeNull();
    fireEvent.click(statusSubmenuButton);
    const statusOption = await screen.findByRole("button", { name: "In Bearbeitung" });
    const statusFlyout = statusOption.closest(".context-menu-flyout");
    expect(statusFlyout).toBeTruthy();
    expect(statusFlyout).not.toHaveClass("open-left");
    fireEvent.click(statusSubmenuButton);
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "In Bearbeitung" })).toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: /Zuweisen an/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Max Mustermann" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("fetch_assignable_users", {
        settings: {
          baseUrl: "https://redmine.example.com",
          apiKey: "secret",
          monitorIndex: 0,
          dockSide: "right",
          refreshIntervalSeconds: 60,
          language: "de",
          ticketNotificationsEnabled: true,
          ticketNotificationVolume: 0.35,
          ticketNotificationSound: "default.mp3"
        },
        projectId: 12
      });
      expect(invokeMock).toHaveBeenCalledWith("assign_ticket", {
        settings: {
          baseUrl: "https://redmine.example.com",
          apiKey: "secret",
          monitorIndex: 0,
          dockSide: "right",
          refreshIntervalSeconds: 60,
          language: "de",
          ticketNotificationsEnabled: true,
          ticketNotificationVolume: 0.35,
          ticketNotificationSound: "default.mp3"
        },
        ticketId: 42,
        userId: 7
      });
    });
  });

  it("opens a ticket number from the header with enter", async () => {
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
          language: "de",
          ticketNotificationsEnabled: true,
          ticketNotificationVolume: 0.35,
          ticketNotificationSound: "default.mp3"
        });
      }

      if (command === "load_ticket_state") {
        return Promise.resolve({ knownTicketIds: [12345], unreadTicketIds: [12345] });
      }

      if (command === "save_ticket_state") {
        return Promise.resolve();
      }

      if (command === "fetch_issue_statuses") {
        return Promise.resolve([]);
      }

      if (command === "fetch_tickets") {
        return Promise.resolve([ticketFixture(12345, "Quick open ticket")]);
      }

      if (command === "open_ticket_url") {
        return Promise.resolve();
      }

      return Promise.resolve();
    });

    render(<App />);

    const ticketNumberInput = await screen.findByLabelText("Ticketnummer");
    fireEvent.change(ticketNumberInput, { target: { value: "12345" } });
    fireEvent.keyDown(ticketNumberInput, { key: "Enter" });

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("save_ticket_state", {
        state: { knownTicketIds: [12345], unreadTicketIds: [] }
      });
      expect(invokeMock).toHaveBeenCalledWith("open_ticket_url", {
        url: "https://redmine.example.com/issues/12345"
      });
    });
  });

  it("switches between bottom ticket tabs and loads the selected Redmine ticket view", async () => {
    invokeMock.mockImplementation((command: string) => {
      if (command === "dock_window") return Promise.resolve();
      if (command === "list_monitors") return Promise.resolve([]);
      if (command === "load_ticket_state") {
        return Promise.resolve({ knownTicketIds: [], unreadTicketIds: [] });
      }
      if (command === "save_ticket_state") return Promise.resolve();
      if (command === "load_settings") return Promise.resolve(settingsFixture());
      if (command === "fetch_issue_statuses") return Promise.resolve([]);
      if (command === "fetch_projects") return Promise.resolve([]);
      if (command === "fetch_trackers") return Promise.resolve([]);
      if (command === "fetch_issue_priorities") return Promise.resolve([]);
      if (command === "fetch_tickets") {
        return Promise.resolve([ticketFixture(41, "Assigned ticket")]);
      }
      if (command === "fetch_watched_open_tickets") {
        return Promise.resolve([ticketFixture(42, "Watched ticket")]);
      }
      if (command === "fetch_created_open_tickets") {
        return Promise.resolve([ticketFixture(43, "Created ticket")]);
      }
      return Promise.resolve();
    });

    render(<App />);

    expect(await screen.findByText("Assigned ticket")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Meine offenen Tickets" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    fireEvent.click(screen.getByRole("button", { name: "Beobachtete Tickets" }));

    expect(await screen.findByText("Watched ticket")).toBeInTheDocument();
    expect(invokeMock).toHaveBeenCalledWith("fetch_watched_open_tickets", {
      settings: settingsFixture()
    });

    fireEvent.click(screen.getByRole("button", { name: "Erstellte Tickets" }));

    expect(await screen.findByText("Created ticket")).toBeInTheDocument();
    expect(invokeMock).toHaveBeenCalledWith("fetch_created_open_tickets", {
      settings: settingsFixture()
    });
  });

  it("does not show loading or refetch when selecting an already cached ticket tab", async () => {
    const watchedRefresh = deferred<ReturnType<typeof ticketFixture>[]>();
    let watchedFetchCount = 0;
    invokeMock.mockImplementation((command: string) => {
      if (command === "dock_window") return Promise.resolve();
      if (command === "list_monitors") return Promise.resolve([]);
      if (command === "load_ticket_state") {
        return Promise.resolve({ knownTicketIds: [], unreadTicketIds: [] });
      }
      if (command === "save_ticket_state") return Promise.resolve();
      if (command === "load_settings") return Promise.resolve(settingsFixture());
      if (command === "fetch_issue_statuses") return Promise.resolve([]);
      if (command === "fetch_projects") return Promise.resolve([]);
      if (command === "fetch_trackers") return Promise.resolve([]);
      if (command === "fetch_issue_priorities") return Promise.resolve([]);
      if (command === "fetch_tickets") {
        return Promise.resolve([ticketFixture(41, "Assigned ticket")]);
      }
      if (command === "fetch_watched_open_tickets") {
        watchedFetchCount += 1;
        return watchedFetchCount === 1
          ? Promise.resolve([ticketFixture(42, "Watched ticket")])
          : watchedRefresh.promise;
      }
      return Promise.resolve();
    });

    render(<App />);

    await screen.findByText("Assigned ticket");
    fireEvent.click(screen.getByRole("button", { name: "Beobachtete Tickets" }));
    await screen.findByText("Watched ticket");
    fireEvent.click(screen.getByRole("button", { name: "Meine offenen Tickets" }));
    await screen.findByText("Assigned ticket");

    fireEvent.click(screen.getByRole("button", { name: "Beobachtete Tickets" }));

    expect(screen.getByText("Watched ticket")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar", { name: "Lädt" })).toBeNull();
    expect(watchedFetchCount).toBe(2);

    await act(async () => {
      watchedRefresh.resolve([ticketFixture(43, "Updated watched ticket")]);
    });

    expect(await screen.findByText("Updated watched ticket")).toBeInTheDocument();
  });

  it("shows users sorted by their number of open tickets in the bottom users tab", async () => {
    invokeMock.mockImplementation((command: string) => {
      if (command === "dock_window") return Promise.resolve();
      if (command === "list_monitors") return Promise.resolve([]);
      if (command === "load_ticket_state") {
        return Promise.resolve({ knownTicketIds: [], unreadTicketIds: [] });
      }
      if (command === "save_ticket_state") return Promise.resolve();
      if (command === "load_settings") return Promise.resolve(settingsFixture());
      if (command === "fetch_issue_statuses") return Promise.resolve([]);
      if (command === "fetch_projects") return Promise.resolve([]);
      if (command === "fetch_trackers") return Promise.resolve([]);
      if (command === "fetch_issue_priorities") return Promise.resolve([]);
      if (command === "fetch_tickets") {
        return Promise.resolve([ticketFixture(41, "Assigned ticket")]);
      }
      if (command === "fetch_open_tickets") {
        return Promise.resolve([
          ticketFixture(1, "First Mina ticket"),
          ticketFixture(2, "Alex ticket"),
          ticketFixture(3, "Second Mina ticket"),
          { ...ticketFixture(4, "Unassigned ticket"), assignee: undefined, assigneeId: undefined }
        ].map((ticket) =>
          ticket.id === 2
            ? { ...ticket, assignee: "Alex Adler", assigneeId: 4 }
            : ticket.id === 4
              ? ticket
              : { ...ticket, assignee: "Mina Meyer", assigneeId: 7 }
        ));
      }
      return Promise.resolve();
    });

    render(<App />);

    await screen.findByText("Assigned ticket");
    fireEvent.click(screen.getByRole("button", { name: "Benutzer" }));

    await waitFor(() => {
      expect(screen.getAllByRole("listitem").map((row) => row.textContent)).toEqual([
        "Mina Meyer2",
        "Alex Adler1",
        "Nicht zugewiesen1"
      ]);
    });
    expect(invokeMock).toHaveBeenCalledWith("fetch_open_tickets", {
      settings: settingsFixture()
    });
  });

  it("shows a loading progress bar while the selected ticket tab is loading", async () => {
    const usersTicketsLoad = deferred<ReturnType<typeof ticketFixture>[]>();
    invokeMock.mockImplementation((command: string) => {
      if (command === "dock_window") return Promise.resolve();
      if (command === "list_monitors") return Promise.resolve([]);
      if (command === "load_ticket_state") {
        return Promise.resolve({ knownTicketIds: [], unreadTicketIds: [] });
      }
      if (command === "save_ticket_state") return Promise.resolve();
      if (command === "load_settings") return Promise.resolve(settingsFixture());
      if (command === "fetch_issue_statuses") return Promise.resolve([]);
      if (command === "fetch_projects") return Promise.resolve([]);
      if (command === "fetch_trackers") return Promise.resolve([]);
      if (command === "fetch_issue_priorities") return Promise.resolve([]);
      if (command === "fetch_tickets") {
        return Promise.resolve([ticketFixture(41, "Assigned ticket")]);
      }
      if (command === "fetch_open_tickets") {
        return usersTicketsLoad.promise;
      }
      return Promise.resolve();
    });

    render(<App />);

    await screen.findByText("Assigned ticket");
    fireEvent.click(screen.getByRole("button", { name: "Benutzer" }));

    expect(screen.getByRole("progressbar", { name: "Lädt" })).toBeInTheDocument();
    expect(screen.getByText("Tickets werden geladen")).toBeInTheDocument();
    expect(screen.queryByText("Keine offenen Tickets für Benutzer")).toBeNull();

    await act(async () => {
      usersTicketsLoad.resolve([
        { ...ticketFixture(42, "Mina ticket"), assignee: "Mina Meyer", assigneeId: 7 }
      ]);
    });

    expect(await screen.findByText("Mina Meyer")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar", { name: "Lädt" })).toBeNull();
  });

  it("opens the Redmine open-ticket list for a clicked assignee summary row", async () => {
    invokeMock.mockImplementation((command: string, args?: unknown) => {
      if (command === "dock_window") return Promise.resolve();
      if (command === "list_monitors") return Promise.resolve([]);
      if (command === "load_ticket_state") {
        return Promise.resolve({ knownTicketIds: [], unreadTicketIds: [] });
      }
      if (command === "save_ticket_state") return Promise.resolve();
      if (command === "load_settings") return Promise.resolve(settingsFixture());
      if (command === "fetch_issue_statuses") return Promise.resolve([]);
      if (command === "fetch_projects") return Promise.resolve([]);
      if (command === "fetch_trackers") return Promise.resolve([]);
      if (command === "fetch_issue_priorities") return Promise.resolve([]);
      if (command === "fetch_tickets") {
        return Promise.resolve([ticketFixture(41, "Assigned ticket")]);
      }
      if (command === "fetch_open_tickets") {
        return Promise.resolve([
          { ...ticketFixture(1, "Mina ticket"), assignee: "Mina Meyer", assigneeId: 7 },
          { ...ticketFixture(2, "Alex ticket"), assignee: "Alex Adler", assigneeId: 4 }
        ]);
      }
      return Promise.resolve(args);
    });

    render(<App />);

    await screen.findByText("Assigned ticket");
    fireEvent.click(screen.getByRole("button", { name: "Benutzer" }));
    fireEvent.click(await screen.findByRole("button", { name: "Alex Adler 1 offene Tickets" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("open_ticket_url", {
        url: "https://redmine.example.com/issues?set_filter=1&f%5B%5D=status_id&op%5Bstatus_id%5D=o&f%5B%5D=assigned_to_id&op%5Bassigned_to_id%5D=%3D&v%5Bassigned_to_id%5D%5B%5D=4"
      });
    });
  });

  it("opens the Redmine open-ticket list for clicked unassigned summary rows", async () => {
    invokeMock.mockImplementation((command: string, args?: unknown) => {
      if (command === "dock_window") return Promise.resolve();
      if (command === "list_monitors") return Promise.resolve([]);
      if (command === "load_ticket_state") {
        return Promise.resolve({ knownTicketIds: [], unreadTicketIds: [] });
      }
      if (command === "save_ticket_state") return Promise.resolve();
      if (command === "load_settings") return Promise.resolve(settingsFixture());
      if (command === "fetch_issue_statuses") return Promise.resolve([]);
      if (command === "fetch_projects") return Promise.resolve([]);
      if (command === "fetch_trackers") return Promise.resolve([]);
      if (command === "fetch_issue_priorities") return Promise.resolve([]);
      if (command === "fetch_tickets") {
        return Promise.resolve([ticketFixture(41, "Assigned ticket")]);
      }
      if (command === "fetch_open_tickets") {
        return Promise.resolve([
          { ...ticketFixture(1, "Unassigned ticket"), assignee: undefined, assigneeId: undefined }
        ]);
      }
      return Promise.resolve(args);
    });

    render(<App />);

    await screen.findByText("Assigned ticket");
    fireEvent.click(screen.getByRole("button", { name: "Benutzer" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Nicht zugewiesen 1 offene Tickets" })
    );

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("open_ticket_url", {
        url: "https://redmine.example.com/issues?set_filter=1&f%5B%5D=status_id&op%5Bstatus_id%5D=o&f%5B%5D=assigned_to_id&op%5Bassigned_to_id%5D=%21*"
      });
    });
  });

  it("keeps settings open when a ticket refresh completes", async () => {
    invokeMock.mockImplementation((command: string) => {
      if (command === "dock_window") return Promise.resolve();
      if (command === "list_monitors") return Promise.resolve([]);
      if (command === "load_ticket_state") {
        return Promise.resolve({ knownTicketIds: [], unreadTicketIds: [] });
      }
      if (command === "save_ticket_state") return Promise.resolve();
      if (command === "load_settings") return Promise.resolve(settingsFixture());
      if (command === "fetch_issue_statuses") return Promise.resolve([]);
      if (command === "fetch_projects") return Promise.resolve([]);
      if (command === "fetch_trackers") return Promise.resolve([]);
      if (command === "fetch_issue_priorities") return Promise.resolve([]);
      if (command === "fetch_tickets") {
        return Promise.resolve([ticketFixture(41, "Assigned ticket")]);
      }
      if (command === "fetch_watched_open_tickets") return Promise.resolve([]);
      if (command === "fetch_created_open_tickets") return Promise.resolve([]);
      if (command === "fetch_open_tickets") return Promise.resolve([]);
      return Promise.resolve();
    });

    render(<App />);

    await screen.findByText("Assigned ticket");
    fireEvent.click(screen.getByRole("button", { name: "Einstellungen anzeigen" }));
    expect(screen.getByLabelText("Redmine URL")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tickets aktualisieren" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Redmine URL")).toBeInTheDocument();
    });
  });

  it("returns to tickets after saving settings", async () => {
    invokeMock.mockImplementation((command: string) => {
      if (command === "dock_window") return Promise.resolve();
      if (command === "list_monitors") return Promise.resolve([]);
      if (command === "load_ticket_state") {
        return Promise.resolve({ knownTicketIds: [], unreadTicketIds: [] });
      }
      if (command === "save_ticket_state") return Promise.resolve();
      if (command === "save_settings") return Promise.resolve();
      if (command === "load_settings") return Promise.resolve(settingsFixture());
      if (command === "fetch_issue_statuses") return Promise.resolve([]);
      if (command === "fetch_projects") return Promise.resolve([]);
      if (command === "fetch_trackers") return Promise.resolve([]);
      if (command === "fetch_issue_priorities") return Promise.resolve([]);
      if (command === "fetch_tickets") {
        return Promise.resolve([ticketFixture(41, "Assigned ticket")]);
      }
      return Promise.resolve();
    });

    render(<App />);

    await screen.findByText("Assigned ticket");
    fireEvent.click(screen.getByRole("button", { name: "Einstellungen anzeigen" }));
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() => {
      expect(screen.queryByLabelText("Redmine URL")).toBeNull();
    });
    expect(screen.getByText("Assigned ticket")).toBeInTheDocument();
  });

  it("keeps unsaved settings edits when the panel collapses and expands", async () => {
    invokeMock.mockImplementation((command: string) => {
      if (command === "dock_window") return Promise.resolve();
      if (command === "collapse_window") return Promise.resolve();
      if (command === "expand_window") return Promise.resolve();
      if (command === "list_monitors") return Promise.resolve([]);
      if (command === "load_ticket_state") {
        return Promise.resolve({ knownTicketIds: [], unreadTicketIds: [] });
      }
      if (command === "save_ticket_state") return Promise.resolve();
      if (command === "load_settings") return Promise.resolve(settingsFixture());
      if (command === "fetch_issue_statuses") return Promise.resolve([]);
      if (command === "fetch_projects") return Promise.resolve([]);
      if (command === "fetch_trackers") return Promise.resolve([]);
      if (command === "fetch_issue_priorities") return Promise.resolve([]);
      if (command === "fetch_tickets") {
        return Promise.resolve([ticketFixture(41, "Assigned ticket")]);
      }
      return Promise.resolve();
    });

    const { container } = render(<App />);

    await screen.findByText("Assigned ticket");
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Einstellungen anzeigen" }));
    fireEvent.change(screen.getByLabelText("Redmine URL"), {
      target: { value: "https://draft.example.com" }
    });

    const shell = container.querySelector(".app-shell");
    if (!shell) {
      throw new Error("App shell not found");
    }

    fireEvent.mouseLeave(shell);
    await act(async () => {
      vi.advanceTimersByTime(350);
    });
    fireEvent.mouseEnter(shell);

    expect(screen.getByLabelText("Redmine URL")).toHaveValue(
      "https://draft.example.com"
    );
  });

  it("keeps cached user counts visible while refreshing the users tab in the background", async () => {
    installAudioMock();
    const usersRefresh = deferred<ReturnType<typeof ticketFixture>[]>();
    let userFetchCount = 0;

    invokeMock.mockImplementation((command: string) => {
      if (command === "dock_window") return Promise.resolve();
      if (command === "list_monitors") return Promise.resolve([]);
      if (command === "load_ticket_state") {
        return Promise.resolve({ knownTicketIds: [], unreadTicketIds: [] });
      }
      if (command === "save_ticket_state") return Promise.resolve();
      if (command === "load_settings") return Promise.resolve(settingsFixture());
      if (command === "fetch_issue_statuses") return Promise.resolve([]);
      if (command === "fetch_projects") return Promise.resolve([]);
      if (command === "fetch_trackers") return Promise.resolve([]);
      if (command === "fetch_issue_priorities") return Promise.resolve([]);
      if (command === "fetch_tickets") {
        return Promise.resolve([ticketFixture(41, "Assigned ticket")]);
      }
      if (command === "fetch_watched_open_tickets") {
        return Promise.resolve([ticketFixture(42, "Watched ticket")]);
      }
      if (command === "fetch_open_tickets") {
        userFetchCount += 1;
        if (userFetchCount === 1) {
          return Promise.resolve([
            { ...ticketFixture(1, "First Mina ticket"), assignee: "Mina Meyer" },
            { ...ticketFixture(2, "Second Mina ticket"), assignee: "Mina Meyer" }
          ]);
        }

        return usersRefresh.promise;
      }
      return Promise.resolve();
    });

    render(<App />);

    await screen.findByText("Assigned ticket");
    fireEvent.click(screen.getByRole("button", { name: "Benutzer" }));

    await waitFor(() => {
      expect(screen.getAllByRole("listitem").map((row) => row.textContent)).toEqual([
        "Mina Meyer2"
      ]);
    });

    fireEvent.click(screen.getByRole("button", { name: "Beobachtete Tickets" }));
    expect(await screen.findByText("Watched ticket")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Benutzer" }));

    expect(screen.getAllByRole("listitem").map((row) => row.textContent)).toEqual([
      "Mina Meyer2"
    ]);
    expect(screen.queryByRole("progressbar", { name: "Lädt" })).toBeNull();
    expect(userFetchCount).toBe(2);

    await act(async () => {
      usersRefresh.resolve([
        { ...ticketFixture(3, "Alex ticket"), assignee: "Alex Adler" }
      ]);
    });

    await waitFor(() => {
      expect(screen.getAllByRole("listitem").map((row) => row.textContent)).toEqual([
        "Alex Adler1"
      ]);
    });
  });

  it("refreshes the active ticket tab on the interval without showing a loading bar", async () => {
    installAudioMock();
    vi.useFakeTimers();
    const ticketsRefresh = deferred<ReturnType<typeof ticketFixture>[]>();
    let ticketFetchCount = 0;

    invokeMock.mockImplementation((command: string) => {
      if (command === "dock_window") return Promise.resolve();
      if (command === "list_monitors") return Promise.resolve([]);
      if (command === "load_ticket_state") {
        return Promise.resolve({ knownTicketIds: [], unreadTicketIds: [] });
      }
      if (command === "save_ticket_state") return Promise.resolve();
      if (command === "load_settings") return Promise.resolve(settingsFixture());
      if (command === "fetch_issue_statuses") return Promise.resolve([]);
      if (command === "fetch_projects") return Promise.resolve([]);
      if (command === "fetch_trackers") return Promise.resolve([]);
      if (command === "fetch_issue_priorities") return Promise.resolve([]);
      if (command === "fetch_watched_open_tickets") return Promise.resolve([]);
      if (command === "fetch_created_open_tickets") return Promise.resolve([]);
      if (command === "fetch_open_tickets") return Promise.resolve([]);
      if (command === "fetch_tickets") {
        ticketFetchCount += 1;
        return ticketFetchCount === 1
          ? Promise.resolve([ticketFixture(41, "Assigned ticket")])
          : ticketsRefresh.promise;
      }
      return Promise.resolve();
    });

    render(<App />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText("Assigned ticket")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(15000);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(ticketFetchCount).toBe(2);
    expect(screen.getByText("Assigned ticket")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar", { name: "Lädt" })).toBeNull();

    await act(async () => {
      ticketsRefresh.resolve([ticketFixture(42, "Refreshed ticket")]);
      await Promise.resolve();
    });

    expect(screen.getByText("Refreshed ticket")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("creates a ticket from named options in the new-ticket dialog", async () => {
    invokeMock.mockImplementation((command: string, args?: unknown) => {
      if (command === "dock_window") return Promise.resolve();
      if (command === "list_monitors") return Promise.resolve([]);
      if (command === "load_ticket_state") {
        return Promise.resolve({ knownTicketIds: [], unreadTicketIds: [] });
      }
      if (command === "save_ticket_state") return Promise.resolve();
      if (command === "load_settings") return Promise.resolve(settingsFixture());
      if (command === "fetch_tickets") {
        return Promise.resolve([ticketFixture(42, "Existing ticket")]);
      }
      if (command === "fetch_projects") {
        return Promise.resolve([{ id: 12, name: "Desktop App" }]);
      }
      if (command === "fetch_trackers") {
        return Promise.resolve([{ id: 2, name: "Bug" }]);
      }
      if (command === "fetch_issue_priorities") {
        return Promise.resolve([{ id: 4, name: "Normal" }]);
      }
      if (command === "fetch_issue_statuses") {
        return Promise.resolve([{ id: 1, name: "Neu" }]);
      }
      if (command === "fetch_assignable_users") {
        return Promise.resolve([{ id: 7, name: "Max Mustermann" }]);
      }
      return Promise.resolve(args);
    });

    render(<App />);

    await screen.findByText("Existing ticket");
    fireEvent.click(await screen.findByRole("button", { name: "Ticket erstellen" }));
    const dialog = screen.getByRole("dialog", { name: "Ticket erstellen" });
    fireEvent.change(within(dialog).getByLabelText("Titel"), {
      target: { value: "Neues Seitenpanel bauen" }
    });
    fireEvent.focus(within(dialog).getByLabelText("Projekt"));
    fireEvent.click(await within(dialog).findByRole("option", { name: "Desktop App" }));
    await within(dialog).findByRole("option", { name: "Max Mustermann" });
    fireEvent.change(within(dialog).getByLabelText("Tracker"), {
      target: { value: "2" }
    });
    fireEvent.change(within(dialog).getByLabelText("Priorit\u00e4t"), {
      target: { value: "4" }
    });
    fireEvent.change(within(dialog).getByLabelText("Status"), {
      target: { value: "1" }
    });
    fireEvent.change(within(dialog).getByLabelText("Zuweisen an"), {
      target: { value: "7" }
    });
    fireEvent.change(within(dialog).getByLabelText("Beschreibung"), {
      target: { value: "Bitte als Docking-Feature umsetzen." }
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Ticket erstellen" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("create_ticket", {
        settings: settingsFixture(),
        ticket: {
          subject: "Neues Seitenpanel bauen",
          projectId: 12,
          trackerId: 2,
          priorityId: 4,
          statusId: 1,
          assignedToId: 7,
          description: "Bitte als Docking-Feature umsetzen."
        }
      });
      expect(invokeMock).toHaveBeenCalledWith("fetch_assignable_users", {
        settings: settingsFixture(),
        projectId: 12
      });
      expect(screen.queryByRole("dialog", { name: "Ticket erstellen" })).toBeNull();
    });
  });

  it("uses the Redmine status named Neu as the default create status", async () => {
    invokeMock.mockImplementation((command: string, args?: unknown) => {
      if (command === "dock_window") return Promise.resolve();
      if (command === "list_monitors") return Promise.resolve([]);
      if (command === "load_ticket_state") {
        return Promise.resolve({ knownTicketIds: [], unreadTicketIds: [] });
      }
      if (command === "save_ticket_state") return Promise.resolve();
      if (command === "load_settings") return Promise.resolve(settingsFixture());
      if (command === "fetch_tickets") {
        return Promise.resolve([ticketFixture(42, "Existing ticket")]);
      }
      if (command === "fetch_projects") {
        return Promise.resolve([{ id: 12, name: "Desktop App" }]);
      }
      if (command === "fetch_trackers") {
        return Promise.resolve([{ id: 2, name: "Bug" }]);
      }
      if (command === "fetch_issue_priorities") {
        return Promise.resolve([{ id: 4, name: "Normal" }]);
      }
      if (command === "fetch_issue_statuses") {
        return Promise.resolve([
          { id: 1, name: "Neu" },
          { id: 3, name: "In Arbeit" }
        ]);
      }
      if (command === "fetch_assignable_users") {
        return Promise.resolve([]);
      }
      return Promise.resolve(args);
    });

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Ticket erstellen" }));
    const dialog = screen.getByRole("dialog", { name: "Ticket erstellen" });
    fireEvent.change(within(dialog).getByLabelText("Titel"), {
      target: { value: "Standardstatus testen" }
    });
    fireEvent.focus(within(dialog).getByLabelText("Projekt"));
    fireEvent.click(await within(dialog).findByRole("option", { name: "Desktop App" }));
    fireEvent.change(within(dialog).getByLabelText("Tracker"), {
      target: { value: "2" }
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Ticket erstellen" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("create_ticket", {
        settings: settingsFixture(),
        ticket: expect.objectContaining({
          statusId: 1
        })
      });
    });
  });

  it("uses the Redmine priority named Normal as the default create priority", async () => {
    invokeMock.mockImplementation((command: string, args?: unknown) => {
      if (command === "dock_window") return Promise.resolve();
      if (command === "list_monitors") return Promise.resolve([]);
      if (command === "load_ticket_state") {
        return Promise.resolve({ knownTicketIds: [], unreadTicketIds: [] });
      }
      if (command === "save_ticket_state") return Promise.resolve();
      if (command === "load_settings") return Promise.resolve(settingsFixture());
      if (command === "fetch_tickets") {
        return Promise.resolve([ticketFixture(42, "Existing ticket")]);
      }
      if (command === "fetch_projects") {
        return Promise.resolve([{ id: 12, name: "Desktop App" }]);
      }
      if (command === "fetch_trackers") {
        return Promise.resolve([{ id: 2, name: "Bug" }]);
      }
      if (command === "fetch_issue_priorities") {
        return Promise.resolve([
          { id: 3, name: "Niedrig" },
          { id: 4, name: "Normal" }
        ]);
      }
      if (command === "fetch_issue_statuses") return Promise.resolve([]);
      if (command === "fetch_assignable_users") return Promise.resolve([]);
      return Promise.resolve(args);
    });

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Ticket erstellen" }));
    const dialog = screen.getByRole("dialog", { name: "Ticket erstellen" });
    fireEvent.change(within(dialog).getByLabelText("Titel"), {
      target: { value: "Standardpriorität testen" }
    });
    fireEvent.focus(within(dialog).getByLabelText("Projekt"));
    fireEvent.click(await within(dialog).findByRole("option", { name: "Desktop App" }));
    fireEvent.change(within(dialog).getByLabelText("Tracker"), {
      target: { value: "2" }
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Ticket erstellen" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("create_ticket", {
        settings: settingsFixture(),
        ticket: expect.objectContaining({
          priorityId: 4
        })
      });
    });
  });

  it("adds dropped and pasted image files to a newly created ticket", async () => {
    invokeMock.mockImplementation((command: string, args?: unknown) => {
      if (command === "dock_window") return Promise.resolve();
      if (command === "list_monitors") return Promise.resolve([]);
      if (command === "load_ticket_state") {
        return Promise.resolve({ knownTicketIds: [], unreadTicketIds: [] });
      }
      if (command === "save_ticket_state") return Promise.resolve();
      if (command === "load_settings") return Promise.resolve(settingsFixture());
      if (command === "fetch_tickets") {
        return Promise.resolve([ticketFixture(42, "Existing ticket")]);
      }
      if (command === "fetch_projects") {
        return Promise.resolve([{ id: 12, name: "Desktop App" }]);
      }
      if (command === "fetch_trackers") {
        return Promise.resolve([{ id: 2, name: "Bug" }]);
      }
      if (command === "fetch_issue_priorities") return Promise.resolve([]);
      if (command === "fetch_issue_statuses") return Promise.resolve([]);
      if (command === "fetch_assignable_users") return Promise.resolve([]);
      return Promise.resolve(args);
    });

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Ticket erstellen" }));
    const dialog = screen.getByRole("dialog", { name: "Ticket erstellen" });
    fireEvent.change(within(dialog).getByLabelText("Titel"), {
      target: { value: "Bilder anhängen" }
    });
    fireEvent.focus(within(dialog).getByLabelText("Projekt"));
    fireEvent.click(await within(dialog).findByRole("option", { name: "Desktop App" }));
    fireEvent.change(within(dialog).getByLabelText("Tracker"), {
      target: { value: "2" }
    });

    const description = within(dialog).getByLabelText("Beschreibung");
    const droppedFile = new File([new Uint8Array([1, 2, 3])], "drop.png", {
      type: "image/png"
    });
    const pastedFile = new File([new Uint8Array([4, 5])], "paste.jpg", {
      type: "image/jpeg"
    });

    fireEvent.drop(description, {
      dataTransfer: {
        files: [droppedFile]
      }
    });
    fireEvent.paste(description, {
      clipboardData: {
        files: [pastedFile],
        items: []
      }
    });

    expect(await within(dialog).findByText("drop.png")).toBeInTheDocument();
    expect(await within(dialog).findByText("paste.jpg")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Ticket erstellen" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("create_ticket", {
        settings: settingsFixture(),
        ticket: expect.objectContaining({
          attachments: [
            {
              filename: "drop.png",
              contentType: "image/png",
              content: [1, 2, 3]
            },
            {
              filename: "paste.jpg",
              contentType: "image/jpeg",
              content: [4, 5]
            }
          ]
        })
      });
    });
  });

  it("formats selected description text with the editor toolbar", async () => {
    mockTicketApp({
      ticketBatches: [[ticketFixture(42, "Existing ticket")]]
    });

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Ticket erstellen" }));
    const dialog = screen.getByRole("dialog", { name: "Ticket erstellen" });
    const description = within(dialog).getByLabelText("Beschreibung") as HTMLTextAreaElement;

    fireEvent.change(description, { target: { value: "wichtig" } });
    description.setSelectionRange(0, 7);
    fireEvent.click(within(dialog).getByRole("button", { name: "Fett" }));

    expect(description.value).toBe("*wichtig*");

    description.setSelectionRange(0, description.value.length);
    fireEvent.click(within(dialog).getByRole("button", { name: "Kursiv" }));

    expect(description.value).toBe("_*wichtig*_");
  });

  it("filters project options inside the project dropdown", async () => {
    invokeMock.mockImplementation((command: string, args?: unknown) => {
      if (command === "dock_window") return Promise.resolve();
      if (command === "list_monitors") return Promise.resolve([]);
      if (command === "load_ticket_state") {
        return Promise.resolve({ knownTicketIds: [], unreadTicketIds: [] });
      }
      if (command === "save_ticket_state") return Promise.resolve();
      if (command === "load_settings") return Promise.resolve(settingsFixture());
      if (command === "fetch_tickets") {
        return Promise.resolve([ticketFixture(42, "Existing ticket")]);
      }
      if (command === "fetch_projects") {
        return Promise.resolve([
          { id: 12, name: "Desktop App" },
          { id: 18, name: "Internal Tools" }
        ]);
      }
      if (command === "fetch_trackers") return Promise.resolve([]);
      if (command === "fetch_issue_priorities") return Promise.resolve([]);
      if (command === "fetch_issue_statuses") return Promise.resolve([]);
      return Promise.resolve(args);
    });

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Ticket erstellen" }));
    const dialog = screen.getByRole("dialog", { name: "Ticket erstellen" });
    expect(within(dialog).queryByLabelText("Projekt filtern")).toBeNull();
    fireEvent.focus(within(dialog).getByLabelText("Projekt"));
    expect(await within(dialog).findByRole("option", { name: "Desktop App" })).toBeTruthy();
    expect(within(dialog).getByRole("option", { name: "Internal Tools" })).toBeTruthy();

    fireEvent.change(within(dialog).getByLabelText("Projekt"), {
      target: { value: "desk" }
    });

    expect(within(dialog).getByRole("option", { name: "Desktop App" })).toBeTruthy();
    expect(within(dialog).queryByRole("option", { name: "Internal Tools" })).toBeNull();
  });

  it("closes the project options when clicking outside the project dropdown", async () => {
    invokeMock.mockImplementation((command: string, args?: unknown) => {
      if (command === "dock_window") return Promise.resolve();
      if (command === "list_monitors") return Promise.resolve([]);
      if (command === "load_ticket_state") {
        return Promise.resolve({ knownTicketIds: [], unreadTicketIds: [] });
      }
      if (command === "save_ticket_state") return Promise.resolve();
      if (command === "load_settings") return Promise.resolve(settingsFixture());
      if (command === "fetch_tickets") {
        return Promise.resolve([ticketFixture(42, "Existing ticket")]);
      }
      if (command === "fetch_projects") {
        return Promise.resolve([{ id: 12, name: "Desktop App" }]);
      }
      if (command === "fetch_trackers") return Promise.resolve([]);
      if (command === "fetch_issue_priorities") return Promise.resolve([]);
      if (command === "fetch_issue_statuses") return Promise.resolve([]);
      return Promise.resolve(args);
    });

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Ticket erstellen" }));
    const dialog = screen.getByRole("dialog", { name: "Ticket erstellen" });
    fireEvent.focus(within(dialog).getByLabelText("Projekt"));
    expect(await within(dialog).findByRole("option", { name: "Desktop App" })).toBeTruthy();

    fireEvent.mouseDown(within(dialog).getByLabelText("Titel"));

    await waitFor(() => {
      expect(within(dialog).queryByRole("option", { name: "Desktop App" })).toBeNull();
    });
  });

  it("closes the ticket context menu when clicking outside", async () => {
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
          language: "de",
          ticketNotificationsEnabled: true,
          ticketNotificationVolume: 0.35,
          ticketNotificationSound: "default.mp3"
        });
      }

      if (command === "load_ticket_state") {
        return Promise.resolve({ knownTicketIds: [], unreadTicketIds: [] });
      }

      if (command === "save_ticket_state") {
        return Promise.resolve();
      }

      if (command === "fetch_issue_statuses") {
        return Promise.resolve([]);
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

      return Promise.resolve();
    });

    render(<App />);

    const ticket = await screen.findByText("Login reparieren");
    fireEvent.contextMenu(ticket, { clientX: 20, clientY: 20 });

    expect(await screen.findByRole("button", { name: "Im Browser öffnen" })).toBeTruthy();

    fireEvent.mouseDown(document.body);

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Im Browser öffnen" })).toBeNull();
    });
  });

  it("does not mark initial tickets unread on the first successful fetch", async () => {
    const { constructorMock: audioMock } = installAudioMock();
    invokeMock.mockImplementation((command: string) => {
      if (command === "dock_window") return Promise.resolve();
      if (command === "list_monitors") return Promise.resolve([]);
      if (command === "load_ticket_state") {
        return Promise.resolve({ knownTicketIds: [], unreadTicketIds: [] });
      }
      if (command === "save_ticket_state") return Promise.resolve();
      if (command === "load_settings") return Promise.resolve(settingsFixture());
      if (command === "fetch_issue_statuses") return Promise.resolve([]);
      if (command === "fetch_tickets") {
        return Promise.resolve([
          {
            id: 42,
            subject: "Existing ticket",
            status: "Neu",
            priority: "Normal",
            project: "Desktop",
            projectId: 12,
            tracker: "Bug",
            updatedAt: "2026-08-10T08:00:00Z",
            url: "https://redmine.example.com/issues/42"
          }
        ]);
      }
      return Promise.resolve();
    });

    render(<App />);

    expect(
      await screen.findByRole("button", { name: /existing ticket/i })
    ).not.toHaveClass("ticket-row-unread");
    expect(audioMock).not.toHaveBeenCalled();
  });

  it("marks later unseen tickets unread and saves the state", async () => {
    vi.useFakeTimers();
    installAudioMock();
    let fetchCount = 0;
    invokeMock.mockImplementation((command: string, args?: unknown) => {
      if (command === "dock_window") return Promise.resolve();
      if (command === "list_monitors") return Promise.resolve([]);
      if (command === "load_ticket_state") {
        return Promise.resolve({ knownTicketIds: [], unreadTicketIds: [] });
      }
      if (command === "save_ticket_state") return Promise.resolve();
      if (command === "load_settings") return Promise.resolve(settingsFixture());
      if (command === "fetch_issue_statuses") return Promise.resolve([]);
      if (command === "fetch_tickets") {
        fetchCount += 1;
        return Promise.resolve(
          fetchCount === 1
            ? [
                {
                  id: 42,
                  subject: "Existing ticket",
                  status: "Neu",
                  priority: "Normal",
                  project: "Desktop",
                  projectId: 12,
                  tracker: "Bug",
                  updatedAt: "2026-08-10T08:00:00Z",
                  url: "https://redmine.example.com/issues/42"
                }
              ]
            : [
                {
                  id: 42,
                  subject: "Existing ticket",
                  status: "Neu",
                  priority: "Normal",
                  project: "Desktop",
                  projectId: 12,
                  tracker: "Bug",
                  updatedAt: "2026-08-10T08:00:00Z",
                  url: "https://redmine.example.com/issues/42"
                },
                {
                  id: 43,
                  subject: "Brand new ticket",
                  status: "Neu",
                  priority: "Normal",
                  project: "Desktop",
                  projectId: 12,
                  tracker: "Bug",
                  updatedAt: "2026-08-10T08:01:00Z",
                  url: "https://redmine.example.com/issues/43"
                }
              ]
        );
      }
      return Promise.resolve(args);
    });

    render(<App />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText("Existing ticket")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });

    expect(screen.getByRole("button", { name: /brand new ticket/i })).toHaveClass(
      "ticket-row-unread"
    );
    expect(invokeMock).toHaveBeenCalledWith("save_ticket_state", {
      state: { knownTicketIds: [42, 43], unreadTicketIds: [43] }
    });
    vi.useRealTimers();
  });

  it("plays one sound when one refresh contains multiple new tickets", async () => {
    vi.useFakeTimers();
    const { constructorMock: audioMock } = installAudioMock();
    mockTicketApp({
      ticketBatches: [
        [ticketFixture(42, "Existing ticket")],
        [
          ticketFixture(42, "Existing ticket"),
          ticketFixture(43, "First new ticket"),
          ticketFixture(44, "Second new ticket")
        ]
      ]
    });

    render(<App />);
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });

    expect(screen.getByRole("button", { name: /first new ticket/i })).toHaveClass(
      "ticket-row-unread"
    );
    expect(screen.getByRole("button", { name: /second new ticket/i })).toHaveClass(
      "ticket-row-unread"
    );
    expect(audioMock).toHaveBeenCalledTimes(1);
  });

  it("keeps new tickets unread without sound when ticket sound is disabled", async () => {
    vi.useFakeTimers();
    const { constructorMock: audioMock } = installAudioMock();
    mockTicketApp({
      settings: {
        ...settingsFixture(),
        ticketNotificationsEnabled: false
      },
      ticketBatches: [
        [ticketFixture(42, "Existing ticket")],
        [
          ticketFixture(42, "Existing ticket"),
          ticketFixture(43, "Silent new ticket")
        ]
      ]
    });

    render(<App />);
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });

    expect(screen.getByRole("button", { name: /silent new ticket/i })).toHaveClass(
      "ticket-row-unread"
    );
    expect(audioMock).not.toHaveBeenCalled();
  });

  it("previews the selected ticket notification sound from settings", async () => {
    const { constructorMock: audioMock, playMock } = installAudioMock();
    mockTicketApp({
      settings: {
        ...settingsFixture(),
        ticketNotificationsEnabled: false
      },
      ticketBatches: [[ticketFixture(42, "Existing ticket")]]
    });

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Einstellungen anzeigen" }));
    fireEvent.change(await screen.findByLabelText("Ticketton"), {
      target: { value: "ring.mp3" }
    });
    fireEvent.change(screen.getByLabelText("Ticketton Lautstärke"), {
      target: { value: "0.6" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Ticketton testen" }));

    expect(audioMock).toHaveBeenCalledWith(expect.stringContaining("ring.mp3"));
    expect(audioMock.mock.instances[0].volume).toBe(0.6);
    expect(playMock).toHaveBeenCalled();
  });

  it("persists a ticket as read when it is opened directly", async () => {
    const ticket = ticketFixture(42, "Direct open ticket");
    mockTicketApp({
      ticketState: { knownTicketIds: [42], unreadTicketIds: [42] },
      ticketBatches: [[ticket]]
    });

    render(<App />);

    fireEvent.click(
      await screen.findByRole("button", { name: /direct open ticket/i })
    );

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("save_ticket_state", {
        state: { knownTicketIds: [42], unreadTicketIds: [] }
      });
      expect(invokeMock).toHaveBeenCalledWith("open_ticket_url", {
        url: ticket.url
      });
    });
  });

  it("persists a ticket as read when it is opened from the context menu", async () => {
    const ticket = ticketFixture(42, "Context open ticket");
    mockTicketApp({
      ticketState: { knownTicketIds: [42], unreadTicketIds: [42] },
      ticketBatches: [[ticket]]
    });

    render(<App />);

    fireEvent.contextMenu(
      await screen.findByRole("button", { name: /context open ticket/i }),
      { clientX: 20, clientY: 20 }
    );
    fireEvent.click(await screen.findByRole("button", { name: "Im Browser öffnen" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("save_ticket_state", {
        state: { knownTicketIds: [42], unreadTicketIds: [] }
      });
      expect(invokeMock).toHaveBeenCalledWith("open_ticket_url", {
        url: ticket.url
      });
    });
  });

  it("auto-collapses when the pointer leaves and expands from the edge", async () => {
    mockTicketApp({
      ticketBatches: [[ticketFixture(42, "Existing ticket")]]
    });

    render(<App />);

    expect(await screen.findByText("Existing ticket")).toBeInTheDocument();

    vi.useFakeTimers();
    fireEvent.mouseLeave(screen.getByRole("main"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    expect(invokeMock).toHaveBeenCalledWith("collapse_window", {
      settings: {
        monitorIndex: 0,
        dockSide: "right"
      }
    });
    expect(screen.queryByRole("button", { name: "Redmine Tickets" })).toBeNull();
    expect(screen.getByRole("main")).toHaveClass("app-shell-collapsed");

    fireEvent.mouseEnter(screen.getByRole("main"));

    expect(invokeMock.mock.calls.filter(([command]) => command === "expand_window")).toHaveLength(0);

    fireEvent.mouseEnter(screen.getByLabelText("1 offen"));

    expect(invokeMock).toHaveBeenCalledWith("expand_window", {
      settings: {
        monitorIndex: 0,
        dockSide: "right"
      }
    });
  });

  it("keeps the panel open while pinned", async () => {
    mockTicketApp({
      ticketBatches: [[ticketFixture(42, "Pinned ticket")]]
    });

    render(<App />);

    expect(await screen.findByText("Pinned ticket")).toBeInTheDocument();

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Panel anheften" }));
    expect(screen.getByRole("button", { name: "Panel l\u00f6sen" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    fireEvent.mouseLeave(screen.getByRole("main"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(invokeMock.mock.calls.some(([command]) => command === "collapse_window")).toBe(false);
    expect(screen.getByText("Pinned ticket")).toBeInTheDocument();
  });

  it("restores the pinned panel state after reopening the app", async () => {
    window.localStorage.setItem("redmineTicketsPanelPinned", "true");
    mockTicketApp({
      ticketBatches: [[ticketFixture(42, "Restored pinned ticket")]]
    });

    render(<App />);

    expect(await screen.findByText("Restored pinned ticket")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Panel l\u00f6sen" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    vi.useFakeTimers();
    fireEvent.mouseLeave(screen.getByRole("main"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(invokeMock.mock.calls.some(([command]) => command === "collapse_window")).toBe(false);
    expect(screen.getByText("Restored pinned ticket")).toBeInTheDocument();
  });

  it("saves the pinned panel state when the pin button changes", async () => {
    mockTicketApp({
      ticketBatches: [[ticketFixture(42, "Save pinned ticket")]]
    });

    render(<App />);

    expect(await screen.findByText("Save pinned ticket")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Panel anheften" }));

    expect(window.localStorage.getItem("redmineTicketsPanelPinned")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Panel l\u00f6sen" }));

    expect(window.localStorage.getItem("redmineTicketsPanelPinned")).toBe("false");
  });

  it("does not show manual collapse or expand icon controls", async () => {
    mockTicketApp({
      ticketBatches: [[ticketFixture(42, "Persistent panel ticket")]]
    });

    render(<App />);

    expect(await screen.findByText("Persistent panel ticket")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Panel einklappen" })).toBeNull();

    vi.useFakeTimers();
    fireEvent.mouseLeave(screen.getByRole("main"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps the open ticket count available on the collapsed edge handle", async () => {
    mockTicketApp({
      ticketBatches: [[
        ticketFixture(42, "First open ticket"),
        ticketFixture(43, "Second open ticket")
      ]]
    });

    render(<App />);

    expect(await screen.findByText("First open ticket")).toBeInTheDocument();

    vi.useFakeTimers();
    fireEvent.mouseLeave(screen.getByRole("main"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    expect(screen.getByLabelText("2 offen")).toHaveClass("collapsed-panel-handle");
    expect(screen.getByLabelText("2 offen")).toHaveAttribute("title", "2 offen");
    expect(screen.queryByText("2")).toBeNull();
    expect(screen.queryByText("First open ticket")).toBeNull();
  });
});
