import { useCallback, useEffect, useRef, useState } from "react";
import {
  addTicketComment,
  assignTicket,
  collapseWindow,
  createTicket,
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
  type NewTicket,
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
  PinIcon,
  PlusIcon,
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

function parseRequiredPositiveNumber(value: string) {
  return Number(value.trim());
}

function parseOptionalPositiveNumber(value: string) {
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? Number(trimmedValue) : undefined;
}

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
  const [pinned, setPinned] = useState(false);
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [issueStatuses, setIssueStatuses] = useState<IssueStatus[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<RedmineUser[]>([]);
  const [ticketContextMenu, setTicketContextMenu] =
    useState<TicketContextMenu | null>(null);
  const [commentTicket, setCommentTicket] = useState<Ticket | null>(null);
  const [comment, setComment] = useState("");
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("");
  const [showCreateTicketDialog, setShowCreateTicketDialog] = useState(false);
  const [newTicketSubject, setNewTicketSubject] = useState("");
  const [newTicketProjectId, setNewTicketProjectId] = useState("");
  const [newTicketTrackerId, setNewTicketTrackerId] = useState("");
  const [newTicketPriorityId, setNewTicketPriorityId] = useState("");
  const [newTicketStatusId, setNewTicketStatusId] = useState("");
  const [newTicketAssignedToId, setNewTicketAssignedToId] = useState("");
  const [newTicketDescription, setNewTicketDescription] = useState("");
  const [quickTicketNumber, setQuickTicketNumber] = useState("");
  const ticketContextMenuRef = useRef<HTMLDivElement | null>(null);
  const collapseTimerRef = useRef<number | null>(null);
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
          volume: nextSettings.ticketNotificationVolume,
          sound: nextSettings.ticketNotificationSound
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

  useEffect(() => {
    return () => {
      if (collapseTimerRef.current !== null) {
        window.clearTimeout(collapseTimerRef.current);
      }
    };
  }, []);

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

  async function handleCreateTicket() {
    if (!settings) {
      setViewState("settings");
      return;
    }

    const ticket: NewTicket = {
      subject: newTicketSubject.trim(),
      projectId: parseRequiredPositiveNumber(newTicketProjectId),
      trackerId: parseRequiredPositiveNumber(newTicketTrackerId),
      priorityId: parseOptionalPositiveNumber(newTicketPriorityId),
      statusId: parseOptionalPositiveNumber(newTicketStatusId),
      assignedToId: parseOptionalPositiveNumber(newTicketAssignedToId),
      description:
        newTicketDescription.trim().length > 0 ? newTicketDescription.trim() : undefined
    };

    try {
      await createTicket(settings, ticket);
      setShowCreateTicketDialog(false);
      setNewTicketSubject("");
      setNewTicketProjectId("");
      setNewTicketTrackerId("");
      setNewTicketPriorityId("");
      setNewTicketStatusId("");
      setNewTicketAssignedToId("");
      setNewTicketDescription("");
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

  function handleExpand() {
    if (collapseTimerRef.current !== null) {
      window.clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
    setCollapsed(false);
    void expandWindow(settings);
  }

  function handlePanelMouseEnter() {
    if (collapseTimerRef.current !== null) {
      window.clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }

    if (collapsed) {
      handleExpand();
    }
  }

  function handlePanelMouseLeave() {
    if (pinned || collapsed) {
      return;
    }

    if (collapseTimerRef.current !== null) {
      window.clearTimeout(collapseTimerRef.current);
    }

    collapseTimerRef.current = window.setTimeout(() => {
      setCollapsed(true);
      void collapseWindow(settings);
      collapseTimerRef.current = null;
    }, 350);
  }

  const showingSettings = viewState === "settings";
  const language: Language = settings?.language ?? "de";
  const t = createTranslator(language);
  const dockSide = settings?.dockSide ?? "right";
  const visibleError = error ? formatError(error, language) : null;
  const canCreateTicket =
    newTicketSubject.trim().length > 0 &&
    newTicketProjectId.trim().length > 0 &&
    newTicketTrackerId.trim().length > 0;

  return (
    <main
      className={`app-shell app-shell-${dockSide}${collapsed ? " app-shell-collapsed" : ""}`}
      onMouseEnter={handlePanelMouseEnter}
      onMouseLeave={handlePanelMouseLeave}
    >
      {collapsed ? null : (
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
                aria-label={t("createTicket")}
                title={t("createTicket")}
                type="button"
                onClick={() => {
                  if (!settings) {
                    setViewState("settings");
                    return;
                  }

                  setShowCreateTicketDialog(true);
                  setError(null);
                }}
              >
                <PlusIcon />
              </button>
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
                aria-pressed={pinned}
                aria-label={pinned ? t("unpinPanel") : t("pinPanel")}
                className={pinned ? "is-active" : undefined}
                title={pinned ? t("unpinPanel") : t("pinPanel")}
                type="button"
                onClick={() => setPinned((nextPinned) => !nextPinned)}
              >
                <PinIcon />
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
              onPreviewTicketNotificationSound={(sound, volume) =>
                playTicketNotificationSound({ enabled: true, volume, sound })
              }
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
              sortLabels={{
                sortBy: t("sortBy"),
                updatedDesc: t("sortUpdatedDesc"),
                createdDesc: t("sortCreatedDesc"),
                priorityDesc: t("sortPriorityDesc"),
                idDesc: t("sortIdDesc"),
                idAsc: t("sortIdAsc")
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

          {showCreateTicketDialog ? (
            <div className="create-ticket-dialog" role="dialog" aria-label={t("createTicket")}>
              <div className="comment-dialog-header">
                <strong>{t("createTicket")}</strong>
                <button
                  aria-label={t("closeCreateTicketDialog")}
                  type="button"
                  onClick={() => setShowCreateTicketDialog(false)}
                >
                  x
                </button>
              </div>
              <label className="comment-dialog-field">
                <span>{t("ticketTitle")}</span>
                <input
                  autoFocus
                  aria-label={t("ticketTitle")}
                  onChange={(event) => setNewTicketSubject(event.target.value)}
                  value={newTicketSubject}
                />
              </label>
              <div className="create-ticket-grid">
                <label className="comment-dialog-field">
                  <span>{t("projectId")}</span>
                  <input
                    aria-label={t("projectId")}
                    inputMode="numeric"
                    onChange={(event) => setNewTicketProjectId(event.target.value)}
                    value={newTicketProjectId}
                  />
                </label>
                <label className="comment-dialog-field">
                  <span>{t("trackerId")}</span>
                  <input
                    aria-label={t("trackerId")}
                    inputMode="numeric"
                    onChange={(event) => setNewTicketTrackerId(event.target.value)}
                    value={newTicketTrackerId}
                  />
                </label>
                <label className="comment-dialog-field">
                  <span>{t("priorityId")}</span>
                  <input
                    aria-label={t("priorityId")}
                    inputMode="numeric"
                    onChange={(event) => setNewTicketPriorityId(event.target.value)}
                    value={newTicketPriorityId}
                  />
                </label>
                <label className="comment-dialog-field">
                  <span>{t("statusId")}</span>
                  <input
                    aria-label={t("statusId")}
                    inputMode="numeric"
                    onChange={(event) => setNewTicketStatusId(event.target.value)}
                    value={newTicketStatusId}
                  />
                </label>
                <label className="comment-dialog-field">
                  <span>{t("assignedToId")}</span>
                  <input
                    aria-label={t("assignedToId")}
                    inputMode="numeric"
                    onChange={(event) => setNewTicketAssignedToId(event.target.value)}
                    value={newTicketAssignedToId}
                  />
                </label>
              </div>
              <label className="comment-dialog-field">
                <span>{t("description")}</span>
                <textarea
                  aria-label={t("description")}
                  onChange={(event) => setNewTicketDescription(event.target.value)}
                  value={newTicketDescription}
                />
              </label>
              <button
                className="primary-action"
                disabled={!canCreateTicket}
                type="button"
                onClick={() => {
                  void handleCreateTicket();
                }}
              >
                {t("createTicket")}
              </button>
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}
