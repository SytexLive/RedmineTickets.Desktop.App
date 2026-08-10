import { useCallback, useEffect, useState } from "react";
import {
  addTicketComment,
  assignTicket,
  collapseWindow,
  dockWindow,
  expandWindow,
  fetchAssignableUsers,
  fetchIssueStatuses,
  fetchTickets,
  listMonitors,
  type IssueStatus,
  loadSettings,
  type MonitorInfo,
  openTicketUrl,
  type RedmineUser,
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
import { createTranslator, formatError, type Language } from "./i18n";

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
  const [assignableUsers, setAssignableUsers] = useState<RedmineUser[]>([]);
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

  const refreshAssignableUsers = useCallback(async (nextSettings: RedmineSettings) => {
    try {
      const loadedUsers = await fetchAssignableUsers(nextSettings);
      setAssignableUsers(loadedUsers);
    } catch {
      setAssignableUsers([]);
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
        void refreshAssignableUsers(loadedSettings);
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
  }, [refreshAssignableUsers, refreshIssueStatuses, refreshTickets]);

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
      await refreshAssignableUsers(nextSettings);
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

  async function handleAssignTicket(ticket: Ticket, user: RedmineUser) {
    if (!settings) {
      setViewState("settings");
      return;
    }

    setTicketContextMenu(null);
    try {
      await assignTicket(settings, ticket.id, user.id);
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
  const language: Language = settings?.language ?? "de";
  const t = createTranslator(language);
  const dockSide = settings?.dockSide ?? "right";
  const visibleError = error ? formatError(error, language) : null;

  return (
    <main
      className={`app-shell app-shell-${dockSide}${collapsed ? " app-shell-collapsed" : ""}`}
    >
      {collapsed ? (
        <button
          aria-label={t("expandPanel")}
          className="edge-handle"
          title={t("expandPanel")}
          type="button"
          onClick={handleExpand}
        >
          {dockSide === "right" ? <ChevronLeftIcon /> : <ChevronRightIcon />}
        </button>
      ) : (
        <>
          <header className="panel-header">
            <div>
              <h1>{t("title")}</h1>
              <p>{showingSettings ? t("settings") : `${tickets.length} ${t("openCount")}`}</p>
            </div>
            <div className="header-actions">
              <button
                aria-label={t("refreshTickets")}
                title={t("refreshTickets")}
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
                aria-label={t("showSettings")}
                title={t("showSettings")}
                type="button"
                onClick={() => setViewState("settings")}
              >
                <SettingsIcon />
              </button>
              <button
                aria-label={t("collapsePanel")}
                title={t("collapsePanel")}
                type="button"
                onClick={handleCollapse}
              >
                {dockSide === "right" ? <ChevronRightIcon /> : <ChevronLeftIcon />}
              </button>
            </div>
          </header>

          {visibleError ? <div className="error-banner">{visibleError}</div> : null}

          {viewState === "loading" ? (
            <div className="status-panel">{t("loading")}</div>
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
            <div className="status-panel">{t("noOpenTickets")}</div>
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
                {t("openInBrowser")}
              </button>
              <div className="context-menu-section">
                <span>{t("status")}</span>
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
                  <span className="context-menu-empty">{t("noStatusesLoaded")}</span>
                )}
              </div>
              <div className="context-menu-section">
                <span>{t("assignTo")}</span>
                {assignableUsers.length > 0 ? (
                  assignableUsers.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => {
                        void handleAssignTicket(ticketContextMenu.ticket, user);
                      }}
                    >
                      {user.firstname} {user.lastname}
                    </button>
                  ))
                ) : (
                  <span className="context-menu-empty">{t("noUsersLoaded")}</span>
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
                {t("addComment")}
              </button>
            </div>
          ) : null}

          {commentTicket ? (
            <div className="comment-dialog" role="dialog" aria-label={t("addComment")}>
              <div className="comment-dialog-header">
                <strong>#{commentTicket.id}</strong>
                <button
                  aria-label={t("closeCommentDialog")}
                  type="button"
                  onClick={() => setCommentTicket(null)}
                >
                  x
                </button>
              </div>
              <textarea
                autoFocus
                onChange={(event) => setComment(event.target.value)}
                placeholder={t("comment")}
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
                {t("saveComment")}
              </button>
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}
