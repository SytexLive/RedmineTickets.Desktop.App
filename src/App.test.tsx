import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const invokeMock = vi.hoisted(() => vi.fn());

function settingsFixture() {
  return {
    baseUrl: "https://redmine.example.com",
    apiKey: "secret",
    monitorIndex: 0,
    dockSide: "right" as const,
    refreshIntervalSeconds: 15,
    language: "de" as const,
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

describe("App", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
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
    fireEvent.click(screen.getByRole("button", { name: "Änderungen speichern" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("add_ticket_comment", {
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
        comment: "Bitte übernehmen."
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

  it("creates a ticket from the new-ticket dialog", async () => {
    mockTicketApp({
      ticketBatches: [[ticketFixture(42, "Existing ticket")]]
    });

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Ticket erstellen" }));
    const dialog = screen.getByRole("dialog", { name: "Ticket erstellen" });
    fireEvent.change(within(dialog).getByLabelText("Titel"), {
      target: { value: "Neues Seitenpanel bauen" }
    });
    fireEvent.change(within(dialog).getByLabelText("Projekt-ID"), {
      target: { value: "12" }
    });
    fireEvent.change(within(dialog).getByLabelText("Tracker-ID"), {
      target: { value: "2" }
    });
    fireEvent.change(within(dialog).getByLabelText("Priorit\u00e4t-ID"), {
      target: { value: "4" }
    });
    fireEvent.change(within(dialog).getByLabelText("Status-ID"), {
      target: { value: "1" }
    });
    fireEvent.change(within(dialog).getByLabelText("Zuweisung-ID"), {
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
      expect(screen.queryByRole("dialog", { name: "Ticket erstellen" })).toBeNull();
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
});
