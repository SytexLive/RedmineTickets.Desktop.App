import { useCallback, useEffect, useState } from "react";
import {
  addTicketComment,
  collapseWindow,
  dockWindow,
  expandWindow,
  fetchIssueStatuses,
  fetchTickets,
  listMonitors,
  type IssueStatus,
  loadSettings,
  type MonitorInfo,
  openTicketUrl,
  saveSettings,
  type RedmineSettings,
  updateTicketStatus
} from "./api/redmine";
import { SettingsForm } from "./components/SettingsForm";
import { TicketList } from "./components/TicketList";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  RefreshIcon,
  SettingsIcon
} from "./components/icons";
import type { Ticket } from "./domain/ticket";

type ViewState = "loading" | "settings" | "tickets";

type TicketContextMenu = {
  ticket: Ticket;
  x: number;
  y: number;
};

export function App() {
  const [settings, setSettings] = useState<RedmineSettings | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [issueStatuses, setIssueStatuses] = useState<IssueStatus[]>([]);
  const [ticketContextMenu, setTicketContextMenu] =
    useState<TicketContextMenu | null>(null);
  const [commentTicket, setCommentTicket] = useState<Ticket | null>(null);
  const [comment, setComment] = useState("");

  const refreshTickets = useCallback(async (nextSettings: RedmineSettings) => {
    try {
      const loadedTickets = await fetchTickets(nextSettings);
      setTickets(loadedTickets);
      setError(null);
      setViewState("tickets");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setViewState("tickets");
    }
  }, []);

  const refreshIssueStatuses = useCallback(async (nextSettings: RedmineSettings) => {
    try {
      const loadedStatuses = await fetchIssueStatuses(nextSettings);
      setIssueStatuses(loadedStatuses);
    } catch {
      setIssueStatuses([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    dockWindow(null).catch(() => undefined);
    listMonitors()
      .then(setMonitors)
      .catch(() => setMonitors([]));
    loadSettings()
      .then((loadedSettings) => {
        if (cancelled) {
          return;
        }

        setSettings(loadedSettings);
        if (!loadedSettings) {
          setViewState("settings");
          return;
        }
        void dockWindow(loadedSettings);
        void refreshIssueStatuses(loadedSettings);
        void refreshTickets(loadedSettings);
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }

        setError(err instanceof Error ? err.message : String(err));
        setViewState("settings");
      });

    return () => {
      cancelled = true;
    };
  }, [refreshIssueStatuses, refreshTickets]);

  useEffect(() => {
    if (!settings) {
      return;
    }

    const intervalMs = Math.max(settings.refreshIntervalSeconds, 15) * 1000;
    const intervalId = window.setInterval(() => {
      void refreshTickets(settings);
    }, intervalMs);

    return () => window.clearInterval(intervalId);
  }, [refreshTickets, settings]);

  async function handleSave(nextSettings: RedmineSettings) {
    setSaving(true);
    setError(null);
    try {
      await saveSettings(nextSettings);
      setSettings(nextSettings);
      await dockWindow(nextSettings);
      await refreshIssueStatuses(nextSettings);
      await refreshTickets(nextSettings);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleOpenTicket(ticket: Ticket) {
    try {
      await openTicketUrl(ticket.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleChangeStatus(ticket: Ticket, status: IssueStatus) {
    if (!settings) {
      setViewState("settings");
      return;
    }

    setTicketContextMenu(null);
    try {
      await updateTicketStatus(settings, ticket.id, status.id);
      await refreshTickets(settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleSubmitComment() {
    if (!settings || !commentTicket) {
      return;
    }

    try {
      await addTicketComment(settings, commentTicket.id, comment);
      setComment("");
      setCommentTicket(null);
      await refreshTickets(settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function handleCollapse() {
    setCollapsed(true);
    void collapseWindow(settings);
  }

  function handleExpand() {
    setCollapsed(false);
    void expandWindow(settings);
  }

  const showingSettings = viewState === "settings";
  const dockSide = settings?.dockSide ?? "right";

  return (
    <main
      className={`app-shell app-shell-${dockSide}${collapsed ? " app-shell-collapsed" : ""}`}
    >
      {collapsed ? (
        <button
          aria-label="Expand panel"
          className="edge-handle"
          title="Expand panel"
          type="button"
          onClick={handleExpand}
        >
          {dockSide === "right" ? <ChevronLeftIcon /> : <ChevronRightIcon />}
        </button>
      ) : (
        <>
          <header className="panel-header">
            <div>
              <h1>Redmine Tickets</h1>
              <p>{showingSettings ? "Settings" : `${tickets.length} open`}</p>
            </div>
            <div className="header-actions">
              <button
                aria-label="Refresh tickets"
                title="Refresh tickets"
                type="button"
                onClick={() => {
                  if (!settings) {
                    setViewState("settings");
                    return;
                  }

                  void refreshTickets(settings);
                }}
              >
                <RefreshIcon />
              </button>
              <button
                aria-label="Show settings"
                title="Show settings"
                type="button"
                onClick={() => setViewState("settings")}
              >
                <SettingsIcon />
              </button>
              <button
                aria-label="Collapse panel"
                title="Collapse panel"
                type="button"
                onClick={handleCollapse}
              >
                <ChevronRightIcon />
              </button>
            </div>
          </header>

          {error ? <div className="error-banner">{error}</div> : null}

          {viewState === "loading" ? (
            <div className="status-panel">Loading</div>
          ) : null}

          {showingSettings ? (
            <SettingsForm
              initialSettings={settings}
              monitors={monitors}
              onSave={handleSave}
              saving={saving}
            />
          ) : null}

          {viewState === "tickets" && tickets.length === 0 ? (
            <div className="status-panel">No open tickets</div>
          ) : null}

          {viewState === "tickets" && tickets.length > 0 ? (
            <TicketList
              onOpenTicket={handleOpenTicket}
              onTicketContextMenu={(ticket, position) => {
                setTicketContextMenu({ ticket, x: position.x, y: position.y });
              }}
              tickets={tickets}
            />
          ) : null}

          {ticketContextMenu ? (
            <div
              className="ticket-context-menu"
              style={{
                left: Math.min(ticketContextMenu.x, window.innerWidth - 220),
                top: Math.min(ticketContextMenu.y, window.innerHeight - 240)
              }}
            >
              <button
                type="button"
                onClick={() => {
                  void handleOpenTicket(ticketContextMenu.ticket);
                  setTicketContextMenu(null);
                }}
              >
                Open in browser
              </button>
              <div className="context-menu-section">
                <span>Status</span>
                {issueStatuses.length > 0 ? (
                  issueStatuses.map((status) => (
                    <button
                      key={status.id}
                      type="button"
                      onClick={() => {
                        void handleChangeStatus(ticketContextMenu.ticket, status);
                      }}
                    >
                      {status.name}
                    </button>
                  ))
                ) : (
                  <span className="context-menu-empty">No statuses loaded</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setCommentTicket(ticketContextMenu.ticket);
                  setComment("");
                  setTicketContextMenu(null);
                }}
              >
                Add comment
              </button>
            </div>
          ) : null}

          {commentTicket ? (
            <div className="comment-dialog" role="dialog" aria-label="Add comment">
              <div className="comment-dialog-header">
                <strong>#{commentTicket.id}</strong>
                <button
                  aria-label="Close comment dialog"
                  type="button"
                  onClick={() => setCommentTicket(null)}
                >
                  x
                </button>
              </div>
              <textarea
                autoFocus
                onChange={(event) => setComment(event.target.value)}
                placeholder="Comment"
                value={comment}
              />
              <button
                className="primary-action"
                disabled={comment.trim().length === 0}
                type="button"
                onClick={() => {
                  void handleSubmitComment();
                }}
              >
                Save comment
              </button>
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}
