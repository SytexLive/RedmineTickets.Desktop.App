import { useCallback, useEffect, useRef, useState } from "react";
import {
  addTicketComment,
  assignTicket,
  collapseWindow,
  createTicket,
  dockWindow,
  expandWindow,
  fetchAssignableUsers,
  fetchIssuePriorities,
  fetchIssueStatuses,
  fetchProjects,
  fetchTickets,
  fetchTrackers,
  type IssuePriority,
  listMonitors,
  type IssueStatus,
  loadSettings,
  loadTicketState,
  type MonitorInfo,
  type NewTicket,
  openTicketUrl,
  type RedmineProject,
  type RedmineSettings,
  type RedmineTracker,
  type RedmineUser,
  saveSettings,
  saveTicketState,
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

const PINNED_PANEL_STORAGE_KEY = "redmineTicketsPanelPinned";

function selectedOptionId(value: string) {
  return Number(value);
}

function optionalSelectedOptionId(value: string) {
  return value ? Number(value) : undefined;
}

function findDefaultNewStatusId(statuses: IssueStatus[]) {
  const newStatus = statuses.find((status) => {
    const normalizedName = status.name.trim().toLowerCase();
    return normalizedName === "neu" || normalizedName === "new";
  });

  return newStatus ? String(newStatus.id) : "";
}

function loadPinnedPanelState() {
  try {
    return window.localStorage.getItem(PINNED_PANEL_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function savePinnedPanelState(pinned: boolean) {
  try {
    window.localStorage.setItem(PINNED_PANEL_STORAGE_KEY, String(pinned));
  } catch {
    // The panel can still work when localStorage is unavailable.
  }
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
  const [pinned, setPinned] = useState(loadPinnedPanelState);
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [projects, setProjects] = useState<RedmineProject[]>([]);
  const [trackers, setTrackers] = useState<RedmineTracker[]>([]);
  const [issuePriorities, setIssuePriorities] = useState<IssuePriority[]>([]);
  const [issueStatuses, setIssueStatuses] = useState<IssueStatus[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<RedmineUser[]>([]);
  const [newTicketAssignableUsers, setNewTicketAssignableUsers] = useState<RedmineUser[]>([]);
  const [ticketContextMenu, setTicketContextMenu] =
    useState<TicketContextMenu | null>(null);
  const [commentTicket, setCommentTicket] = useState<Ticket | null>(null);
  const [comment, setComment] = useState("");
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("");
  const [showCreateTicketDialog, setShowCreateTicketDialog] = useState(false);
  const [newTicketSubject, setNewTicketSubject] = useState("");
  const [newTicketProjectId, setNewTicketProjectId] = useState("");
  const [newTicketProjectSearch, setNewTicketProjectSearch] = useState("");
  const [showNewTicketProjectOptions, setShowNewTicketProjectOptions] = useState(false);
  const [newTicketTrackerId, setNewTicketTrackerId] = useState("");
  const [newTicketPriorityId, setNewTicketPriorityId] = useState("");
  const [newTicketStatusId, setNewTicketStatusId] = useState("");
  const [newTicketAssignedToId, setNewTicketAssignedToId] = useState("");
  const [newTicketDescription, setNewTicketDescription] = useState("");
  const [quickTicketNumber, setQuickTicketNumber] = useState("");
  const ticketContextMenuRef = useRef<HTMLDivElement | null>(null);
  const newTicketProjectFieldRef = useRef<HTMLLabelElement | null>(null);
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
      const nextStatuses = Array.isArray(loadedStatuses) ? loadedStatuses : [];
      setIssueStatuses(nextStatuses);
      setNewTicketStatusId((currentStatusId) =>
        currentStatusId || findDefaultNewStatusId(nextStatuses)
      );
    } catch {
      setIssueStatuses([]);
    }
  }, []);

  const refreshTicketCreateOptions = useCallback(async (nextSettings: RedmineSettings) => {
    const [loadedProjects, loadedTrackers, loadedPriorities] = await Promise.all([
      fetchProjects(nextSettings).catch(() => []),
      fetchTrackers(nextSettings).catch(() => []),
      fetchIssuePriorities(nextSettings).catch(() => [])
    ]);
    setProjects(Array.isArray(loadedProjects) ? loadedProjects : []);
    setTrackers(Array.isArray(loadedTrackers) ? loadedTrackers : []);
    setIssuePriorities(Array.isArray(loadedPriorities) ? loadedPriorities : []);
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

  const refreshNewTicketAssignableUsers = useCallback(async (
    nextSettings: RedmineSettings,
    projectId: number
  ) => {
    try {
      const loadedUsers = await fetchAssignableUsers(nextSettings, projectId);
      setNewTicketAssignableUsers(loadedUsers);
    } catch {
      setNewTicketAssignableUsers([]);
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
        void refreshTicketCreateOptions(loadedSettings);
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
  }, [refreshIssueStatuses, refreshTicketCreateOptions, refreshTickets]);

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
    if (!showNewTicketProjectOptions) {
      return;
    }

    function closeProjectOptionsOnOutsideClick(event: MouseEvent) {
      const target = event.target;
      if (
        target instanceof Node &&
        newTicketProjectFieldRef.current?.contains(target)
      ) {
        return;
      }

      setShowNewTicketProjectOptions(false);
    }

    document.addEventListener("mousedown", closeProjectOptionsOnOutsideClick);
    return () => {
      document.removeEventListener("mousedown", closeProjectOptionsOnOutsideClick);
    };
  }, [showNewTicketProjectOptions]);

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
      await refreshTicketCreateOptions(nextSettings);
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
      projectId: selectedOptionId(newTicketProjectId),
      trackerId: selectedOptionId(newTicketTrackerId),
      priorityId: optionalSelectedOptionId(newTicketPriorityId),
      statusId: optionalSelectedOptionId(newTicketStatusId),
      assignedToId: optionalSelectedOptionId(newTicketAssignedToId),
      description:
        newTicketDescription.trim().length > 0 ? newTicketDescription.trim() : undefined
    };

    try {
      await createTicket(settings, ticket);
      setShowCreateTicketDialog(false);
      setNewTicketSubject("");
      setNewTicketProjectId("");
      setNewTicketProjectSearch("");
      setShowNewTicketProjectOptions(false);
      setNewTicketTrackerId("");
      setNewTicketPriorityId("");
      setNewTicketStatusId(findDefaultNewStatusId(issueStatuses));
      setNewTicketAssignedToId("");
      setNewTicketDescription("");
      setNewTicketAssignableUsers([]);
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

  function handleOpenCreateTicketDialog() {
    if (!settings) {
      setViewState("settings");
      return;
    }

    setShowCreateTicketDialog(true);
    setError(null);
    setNewTicketAssignableUsers([]);
    setNewTicketProjectSearch("");
    setShowNewTicketProjectOptions(false);
    setNewTicketStatusId((currentStatusId) =>
      currentStatusId || findDefaultNewStatusId(issueStatuses)
    );
    void refreshTicketCreateOptions(settings);
  }

  function handleSearchNewTicketProject(search: string) {
    setNewTicketProjectSearch(search);
    setShowNewTicketProjectOptions(true);
    const matchingProject = projects.find(
      (project) => project.name.trim().toLowerCase() === search.trim().toLowerCase()
    );
    setNewTicketProjectId(matchingProject ? String(matchingProject.id) : "");
    setNewTicketAssignedToId("");
    setNewTicketAssignableUsers([]);

    if (settings && matchingProject) {
      void refreshNewTicketAssignableUsers(settings, matchingProject.id);
    }
  }

  function handleSelectNewTicketProject(project: RedmineProject) {
    setNewTicketProjectId(String(project.id));
    setNewTicketProjectSearch(project.name);
    setShowNewTicketProjectOptions(false);
    setNewTicketAssignedToId("");
    setNewTicketAssignableUsers([]);

    if (settings) {
      void refreshNewTicketAssignableUsers(settings, project.id);
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

  function handleTogglePinned() {
    setPinned((currentPinned) => {
      const nextPinned = !currentPinned;
      savePinnedPanelState(nextPinned);
      return nextPinned;
    });
  }

  const showingSettings = viewState === "settings";
  const language: Language = settings?.language ?? "de";
  const t = createTranslator(language);
  const dockSide = settings?.dockSide ?? "right";
  const visibleError = error ? formatError(error, language) : null;
  const canCreateTicket =
    newTicketSubject.trim().length > 0 &&
    newTicketProjectId.length > 0 &&
    newTicketTrackerId.length > 0;
  const normalizedProjectFilter = newTicketProjectSearch.trim().toLowerCase();
  const filteredProjects =
    normalizedProjectFilter.length === 0
      ? projects
      : projects.filter((project) =>
          project.name.toLowerCase().includes(normalizedProjectFilter)
        );

  return (
    <main
      className={`app-shell app-shell-${dockSide}${collapsed ? " app-shell-collapsed" : ""}`}
      onMouseEnter={handlePanelMouseEnter}
      onMouseLeave={handlePanelMouseLeave}
    >
      {collapsed ? (
        <div
          aria-label={`${tickets.length} ${t("openCount")}`}
          className="collapsed-panel-handle"
          title={`${tickets.length} ${t("openCount")}`}
        >
          <span className="collapsed-ticket-badge">{tickets.length}</span>
        </div>
      ) : (
        <>
          <header className="panel-header">
            <div className="panel-header-top">
              <div className="panel-title-block">
                <h1>{t("title")}</h1>
                <p>{showingSettings ? t("settings") : `${tickets.length} ${t("openCount")}`}</p>
              </div>
              <div className="header-actions">
                <button
                  aria-label={t("createTicket")}
                  title={t("createTicket")}
                  type="button"
                  onClick={handleOpenCreateTicketDialog}
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
                  onClick={handleTogglePinned}
                >
                  <PinIcon />
                </button>
              </div>
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
                <label
                  className="comment-dialog-field create-ticket-project-field"
                  ref={newTicketProjectFieldRef}
                >
                  <span>{t("project")}</span>
                  <input
                    aria-controls="new-ticket-project-options"
                    aria-expanded={showNewTicketProjectOptions}
                    aria-haspopup="listbox"
                    aria-label={t("project")}
                    autoComplete="off"
                    role="combobox"
                    onChange={(event) => handleSearchNewTicketProject(event.target.value)}
                    onFocus={() => setShowNewTicketProjectOptions(true)}
                    value={newTicketProjectSearch}
                  />
                  {showNewTicketProjectOptions && filteredProjects.length > 0 ? (
                    <div
                      className="create-ticket-project-options"
                      id="new-ticket-project-options"
                      role="listbox"
                    >
                      {filteredProjects.map((project) => (
                        <button
                          key={project.id}
                          role="option"
                          type="button"
                          onClick={() => handleSelectNewTicketProject(project)}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            handleSelectNewTicketProject(project);
                          }}
                        >
                          {project.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </label>
                <label className="comment-dialog-field">
                  <span>{t("tracker")}</span>
                  <select
                    aria-label={t("tracker")}
                    onChange={(event) => setNewTicketTrackerId(event.target.value)}
                    value={newTicketTrackerId}
                  >
                    <option value="">{t("chooseOption")}</option>
                    {trackers.map((tracker) => (
                      <option key={tracker.id} value={tracker.id}>
                        {tracker.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="comment-dialog-field">
                  <span>{t("priority")}</span>
                  <select
                    aria-label={t("priority")}
                    onChange={(event) => setNewTicketPriorityId(event.target.value)}
                    value={newTicketPriorityId}
                  >
                    <option value="">{t("noAssignment")}</option>
                    {issuePriorities.map((priority) => (
                      <option key={priority.id} value={priority.id}>
                        {priority.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="comment-dialog-field">
                  <span>{t("status")}</span>
                  <select
                    aria-label={t("status")}
                    onChange={(event) => setNewTicketStatusId(event.target.value)}
                    value={newTicketStatusId}
                  >
                    <option value="">{t("noAssignment")}</option>
                    {issueStatuses.map((status) => (
                      <option key={status.id} value={status.id}>
                        {status.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="comment-dialog-field">
                  <span>{t("assignTo")}</span>
                  <select
                    aria-label={t("assignTo")}
                    onChange={(event) => setNewTicketAssignedToId(event.target.value)}
                    value={newTicketAssignedToId}
                  >
                    <option value="">{t("noAssignment")}</option>
                    {newTicketAssignableUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
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
