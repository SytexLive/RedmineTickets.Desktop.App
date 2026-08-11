import { useCallback, useEffect, useRef, useState } from "react";
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
  loadTicketState,
  type MonitorInfo,
  openTicketUrl,
  type RedmineUser,
  saveSettings,
  saveTicketState,
  type RedmineSettings,
  type TicketNotificationState,
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
import { buildTicketUrl } from "./domain/ticket";
import type { Ticket } from "./domain/ticket";
import { applyTicketRefresh, markTicketRead } from "./domain/ticketNotifications";
import { createTranslator, formatError, type Language } from "./i18n";
import { playTicketNotificationSound } from "./notifications/sound";

type ViewState = "loading" | "settings" | "tickets";

type TicketContextMenu = {
  ticket: Ticket;
  x: number;
  y: number;
};

export function App() {
  const [settings, setSettings] = useState<RedmineSettings | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketState, setTicketState] = useState<TicketNotificationState>({
    knownTicketIds: [],
    unreadTicketIds: []
  });
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
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("");
  const [quickTicketNumber, setQuickTicketNumber] = useState("");
  const ticketContextMenuRef = useRef<HTMLDivElement | null>(null);
  const ticketStateRef = useRef<TicketNotificationState>({
    knownTicketIds: [],
    unreadTicketIds: []
  });
  const hasInitializedTicketBaselineRef = useRef(false);

  const refreshTickets = useCallback(async (nextSettings: RedmineSettings) => {
    try {
      const loadedTickets = await fetchTickets(nextSettings);
      setTickets(loadedTickets);
      const result = applyTicketRefresh(
        ticketStateRef.current,
        loadedTickets.map((ticket) => ticket.id),
        hasInitializedTicketBaselineRef.current
      );
      ticketStateRef.current = result.state;
      hasInitializedTicketBaselineRef.current = result.initialized;
      setTicketState(result.state);
      void saveTicketState(result.state).catch(() => undefined);
      if (result.newTicketIds.length > 0) {
        playTicketNotificationSound({
          enabled: nextSettings.ticketNotificationsEnabled,
          volume: nextSettings.ticketNotificationVolume
        });
      }
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

  const refreshAssignableUsers = useCallback(async (
    nextSettings: RedmineSettings,
    projectId: number
  ) => {
    try {
      const loadedUsers = await fetchAssignableUsers(nextSettings, projectId);
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
    Promise.all([
      loadSettings(),
      loadTicketState().catch(() => ({ knownTicketIds: [], unreadTicketIds: [] }))
    ])
      .then(([loadedSettings, loadedTicketState]) => {
        if (cancelled) {
          return;
        }

        ticketStateRef.current = loadedTicketState;
        setTicketState(loadedTicketState);
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

  useEffect(() => {
    if (!ticketContextMenu) {
      return;
    }

    function closeContextMenuOnOutsideClick(event: MouseEvent) {
      const target = event.target;
      if (
        target instanceof Node &&
        ticketContextMenuRef.current?.contains(target)
      ) {
        return;
      }

      setTicketContextMenu(null);
    }

    document.addEventListener("mousedown", closeContextMenuOnOutsideClick);
    return () => {
      document.removeEventListener("mousedown", closeContextMenuOnOutsideClick);
    };
  }, [ticketContextMenu]);

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

  function markTicketAsRead(ticketId: number) {
    const nextTicketState = markTicketRead(ticketStateRef.current, ticketId);
    ticketStateRef.current = nextTicketState;
    setTicketState(nextTicketState);
    void saveTicketState(nextTicketState).catch(() => undefined);
  }

  async function handleOpenTicket(ticket: Ticket) {
    markTicketAsRead(ticket.id);
    try {
      await openTicketUrl(ticket.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleOpenTicketNumber() {
    if (!settings) {
      setViewState("settings");
      return;
    }

    const ticketId = Number(quickTicketNumber.trim());
    markTicketAsRead(ticketId);
    try {
      await openTicketUrl(buildTicketUrl(settings.baseUrl, ticketId));
      setQuickTicketNumber("");
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
      if (comment.trim().length > 0) {
        await addTicketComment(settings, commentTicket.id, comment);
      }
      if (selectedAssigneeId) {
        await assignTicket(settings, commentTicket.id, Number(selectedAssigneeId));
      }
      setComment("");
      setSelectedAssigneeId("");
      setCommentTicket(null);
      await refreshTickets(settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function handleOpenCommentDialog(ticket: Ticket) {
    setCommentTicket(ticket);
    setComment("");
    setSelectedAssigneeId("");
    setAssignableUsers([]);
    setTicketContextMenu(null);

    if (settings) {
      void refreshAssignableUsers(settings, ticket.projectId);
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
            <label className="ticket-number-form">
              <span>{t("ticketNumber")}</span>
              <input
                aria-label={t("ticketNumber")}
                inputMode="numeric"
                onChange={(event) => setQuickTicketNumber(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleOpenTicketNumber();
                  }
                }}
                pattern="[0-9]*"
                placeholder="#12345"
                title={t("openTicketNumber")}
                value={quickTicketNumber}
              />
            </label>
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
              unreadTicketIds={ticketState.unreadTicketIds}
            />
          ) : null}

          {ticketContextMenu ? (
            <div
              className="ticket-context-menu"
              ref={ticketContextMenuRef}
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
              <button
                type="button"
                onClick={() => {
                  handleOpenCommentDialog(ticketContextMenu.ticket);
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
              <div className="comment-dialog-ticket-context">
                <div>
                  <span>{t("ticketTitle")}</span>
                  <strong>{commentTicket.subject}</strong>
                </div>
                <div>
                  <span>{t("project")}</span>
                  <strong>{commentTicket.project}</strong>
                </div>
              </div>
              <textarea
                autoFocus
                onChange={(event) => setComment(event.target.value)}
                placeholder={t("comment")}
                value={comment}
              />
              <label className="comment-dialog-field">
                <span>{t("assignTo")}</span>
                <select
                  aria-label={t("assignTo")}
                  onChange={(event) => setSelectedAssigneeId(event.target.value)}
                  value={selectedAssigneeId}
                >
                  <option value="">{t("noAssignment")}</option>
                  {assignableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </label>
              {assignableUsers.length === 0 ? (
                <span className="comment-dialog-empty">{t("noUsersLoaded")}</span>
              ) : null}
              <button
                className="primary-action"
                disabled={comment.trim().length === 0 && !selectedAssigneeId}
                type="button"
                onClick={() => {
                  void handleSubmitComment();
                }}
              >
                {t("saveChanges")}
              </button>
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}
