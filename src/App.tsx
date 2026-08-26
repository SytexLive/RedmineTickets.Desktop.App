import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import {
  addTicketComment,
  assignTicket,
  collapseWindow,
  createTicket,
  dockWindow,
  expandWindow,
  fetchAssignableUsers,
  fetchCreatedOpenTickets,
  fetchIssuePriorities,
  fetchIssueStatuses,
  fetchOpenTickets,
  fetchProjects,
  fetchTickets,
  fetchTrackers,
  fetchWatchedOpenTickets,
  type IssuePriority,
  listMonitors,
  type IssueStatus,
  loadSettings,
  loadTicketState,
  type MonitorInfo,
  type NewTicketAttachment,
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
import { checkAndInstallUpdate } from "./appUpdates";
import { SettingsForm } from "./components/SettingsForm";
import { TicketList } from "./components/TicketList";
import {
  ChevronDownIcon,
  DownloadIcon,
  PinIcon,
  PlusIcon,
  RefreshIcon,
  SettingsIcon
} from "./components/icons";
import {
  buildTicketUrl,
  buildUnassignedOpenTicketsUrl,
  buildUserOpenTicketsUrl
} from "./domain/ticket";
import type { Ticket } from "./domain/ticket";
import { applyTicketRefresh, markTicketRead } from "./domain/ticketNotifications";
import { summarizeOpenTicketsByAssignee } from "./domain/ticketUsers";
import { createTranslator, formatError, type Language } from "./i18n";
import { playTicketNotificationSound } from "./notifications/sound";
import { normalizeAccentColor } from "./theme";

type ViewState = "loading" | "settings" | "tickets";
type TicketTab = "my-open" | "watched" | "created" | "users";
type UpdateStatus = "idle" | "checking" | "current" | "installed" | "error";

type TicketTabCacheEntry = {
  tickets: Ticket[];
  loadedAt: number | null;
};

type TicketTabCache = Record<TicketTab, TicketTabCacheEntry>;
type TicketTabLoadingState = Record<TicketTab, boolean>;

type TicketContextMenu = {
  ticket: Ticket;
  x: number;
  y: number;
};

type TicketContextSubmenu = "assignee" | "status";

const PINNED_PANEL_STORAGE_KEY = "redmineTicketsPanelPinned";
const CONTEXT_MENU_MARGIN = 12;
const CONTEXT_MENU_WIDTH = 240;
const UPDATE_SUCCESS_VISIBLE_MS = 4000;
const TICKET_TABS: TicketTab[] = ["my-open", "watched", "created", "users"];
const RELEASE_NOTE_KEYS = [
  "releaseNoteSearchFilter",
  "releaseNoteCompactCards",
  "releaseNoteTabCounts",
  "releaseNoteAttachments",
  "releaseNoteCommentSaving",
  "releaseNoteWatcherFix"
] as const;

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

function contextMenuLeft(x: number, viewportWidth: number) {
  return Math.max(
    CONTEXT_MENU_MARGIN,
    Math.min(x, viewportWidth - CONTEXT_MENU_WIDTH - CONTEXT_MENU_MARGIN)
  );
}

function findDefaultNormalPriorityId(priorities: IssuePriority[]) {
  const normalPriority = priorities.find((priority) => {
    const normalizedName = priority.name.trim().toLowerCase();
    return normalizedName === "normal";
  });

  return normalPriority ? String(normalPriority.id) : "";
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

function fetchTicketsForTab(settings: RedmineSettings, tab: TicketTab) {
  if (tab === "watched") {
    return fetchWatchedOpenTickets(settings);
  }

  if (tab === "created") {
    return fetchCreatedOpenTickets(settings);
  }

  if (tab === "users") {
    return fetchOpenTickets(settings);
  }

  return fetchTickets(settings);
}

function createEmptyTicketTabCache(): TicketTabCache {
  return {
    "my-open": { tickets: [], loadedAt: null },
    watched: { tickets: [], loadedAt: null },
    created: { tickets: [], loadedAt: null },
    users: { tickets: [], loadedAt: null }
  };
}

function createEmptyTicketTabLoadingState(): TicketTabLoadingState {
  return {
    "my-open": false,
    watched: false,
    created: false,
    users: false
  };
}

function createEmptyTicketTabLoadingCounts(): Record<TicketTab, number> {
  return {
    "my-open": 0,
    watched: 0,
    created: 0,
    users: 0
  };
}

function hasCachedTickets(cacheEntry: TicketTabCacheEntry) {
  return cacheEntry.loadedAt !== null;
}

export function App() {
  const [settings, setSettings] = useState<RedmineSettings | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<RedmineSettings | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTicketTab, setActiveTicketTab] = useState<TicketTab>("my-open");
  const [ticketTabCache, setTicketTabCache] = useState<TicketTabCache>(
    createEmptyTicketTabCache
  );
  const [ticketTabLoading, setTicketTabLoading] = useState<TicketTabLoadingState>(
    createEmptyTicketTabLoadingState
  );
  const [ticketState, setTicketState] = useState<TicketNotificationState>({
    knownTicketIds: [],
    unreadTicketIds: []
  });
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");
  const [installedUpdateVersion, setInstalledUpdateVersion] = useState<string | null>(null);
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
  const [ticketContextSubmenu, setTicketContextSubmenu] =
    useState<TicketContextSubmenu | null>(null);
  const [commentTicket, setCommentTicket] = useState<Ticket | null>(null);
  const [comment, setComment] = useState("");
  const [commentPrivateNotes, setCommentPrivateNotes] = useState(false);
  const [savingComment, setSavingComment] = useState(false);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("");
  const [selectedCommentStatusId, setSelectedCommentStatusId] = useState("");
  const [showVersionInfo, setShowVersionInfo] = useState(false);
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
  const [newTicketAttachments, setNewTicketAttachments] = useState<NewTicketAttachment[]>([]);
  const [quickTicketNumber, setQuickTicketNumber] = useState("");
  const ticketContextMenuRef = useRef<HTMLDivElement | null>(null);
  const newTicketProjectFieldRef = useRef<HTMLLabelElement | null>(null);
  const newTicketDescriptionRef = useRef<HTMLTextAreaElement | null>(null);
  const collapseTimerRef = useRef<number | null>(null);
  const updateStatusTimerRef = useRef<number | null>(null);
  const ticketStateRef = useRef<TicketNotificationState>({
    knownTicketIds: [],
    unreadTicketIds: []
  });
  const activeTicketTabRef = useRef<TicketTab>("my-open");
  const ticketTabCacheRef = useRef<TicketTabCache>(createEmptyTicketTabCache());
  const ticketTabLoadingCountsRef = useRef<Record<TicketTab, number>>(
    createEmptyTicketTabLoadingCounts()
  );
  const hasInitializedTicketBaselineRef = useRef(false);
  const updateCheckStartedRef = useRef(false);
  const viewStateRef = useRef<ViewState>("loading");

  const setTicketTabLoadingState = useCallback((ticketTab: TicketTab, loading: boolean) => {
    const nextLoadingCount = loading
      ? ticketTabLoadingCountsRef.current[ticketTab] + 1
      : Math.max(0, ticketTabLoadingCountsRef.current[ticketTab] - 1);

    ticketTabLoadingCountsRef.current = {
      ...ticketTabLoadingCountsRef.current,
      [ticketTab]: nextLoadingCount
    };

    setTicketTabLoading((currentLoading) => ({
      ...currentLoading,
      [ticketTab]: nextLoadingCount > 0
    }));
  }, []);

  const refreshTickets = useCallback(async (
    nextSettings: RedmineSettings,
    ticketTab: TicketTab = activeTicketTab,
    options: { showLoading?: boolean } = {}
  ) => {
    const showLoading =
      options.showLoading ?? !hasCachedTickets(ticketTabCacheRef.current[ticketTab]);
    if (showLoading) {
      setTicketTabLoadingState(ticketTab, true);
    }
    try {
      const loadedTickets = await fetchTicketsForTab(nextSettings, ticketTab);
      const nextTickets = Array.isArray(loadedTickets) ? loadedTickets : [];
      const nextCacheEntry = {
        tickets: nextTickets,
        loadedAt: Date.now()
      };
      ticketTabCacheRef.current = {
        ...ticketTabCacheRef.current,
        [ticketTab]: nextCacheEntry
      };
      setTicketTabCache(ticketTabCacheRef.current);
      if (activeTicketTabRef.current === ticketTab) {
        setTickets(nextTickets);
        setError(null);
      }
      if (ticketTab === "my-open") {
        const result = applyTicketRefresh(
          ticketStateRef.current,
          nextTickets.map((ticket) => ticket.id),
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
      }
      if (viewStateRef.current !== "settings") {
        setViewState("tickets");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      if (viewStateRef.current !== "settings") {
        setViewState("tickets");
      }
    } finally {
      if (showLoading) {
        setTicketTabLoadingState(ticketTab, false);
      }
    }
  }, [activeTicketTab, setTicketTabLoadingState]);

  const refreshTicketTabsInBackground = useCallback(async (
    nextSettings: RedmineSettings,
    tabs: TicketTab[] = TICKET_TABS,
    options: { showLoading?: boolean; skipCached?: boolean } = {}
  ) => {
    await Promise.all(
      tabs
        .filter((ticketTab) =>
          options.skipCached ? !hasCachedTickets(ticketTabCacheRef.current[ticketTab]) : true
        )
        .map((ticketTab) =>
          refreshTickets(nextSettings, ticketTab, { showLoading: options.showLoading ?? false })
        )
    );
  }, [refreshTickets]);

  const clearUpdateStatusTimer = useCallback(() => {
    if (updateStatusTimerRef.current !== null) {
      window.clearTimeout(updateStatusTimerRef.current);
      updateStatusTimerRef.current = null;
    }
  }, []);

  const showTemporaryUpdateStatus = useCallback((status: "current" | "installed") => {
    clearUpdateStatusTimer();
    setUpdateStatus(status);
    updateStatusTimerRef.current = window.setTimeout(() => {
      setUpdateStatus("idle");
      updateStatusTimerRef.current = null;
    }, UPDATE_SUCCESS_VISIBLE_MS);
  }, [clearUpdateStatusTimer]);

  const handleCheckForUpdates = useCallback(async (options: { silent?: boolean } = {}) => {
    clearUpdateStatusTimer();
    if (!options.silent) {
      setUpdateStatus("checking");
    }

    try {
      const result = await checkAndInstallUpdate();
      if (result.status === "installed") {
        setInstalledUpdateVersion(result.version);
        showTemporaryUpdateStatus("installed");
        return;
      }

      if (!options.silent) {
        showTemporaryUpdateStatus("current");
      }
    } catch (err) {
      if (!options.silent) {
        setUpdateStatus("error");
        setError(err instanceof Error ? err.message : String(err));
      }
    }
  }, [clearUpdateStatusTimer, showTemporaryUpdateStatus]);

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
    const nextPriorities = Array.isArray(loadedPriorities) ? loadedPriorities : [];
    setIssuePriorities(nextPriorities);
    setNewTicketPriorityId((currentPriorityId) =>
      currentPriorityId || findDefaultNormalPriorityId(nextPriorities)
    );
  }, []);

  const refreshAssignableUsers = useCallback(async (
    nextSettings: RedmineSettings,
    projectId: number
  ) => {
    try {
      const loadedUsers = await fetchAssignableUsers(nextSettings, projectId);
      setAssignableUsers(Array.isArray(loadedUsers) ? loadedUsers : []);
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
      setNewTicketAssignableUsers(Array.isArray(loadedUsers) ? loadedUsers : []);
    } catch {
      setNewTicketAssignableUsers([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!updateCheckStartedRef.current) {
      updateCheckStartedRef.current = true;
      void handleCheckForUpdates({ silent: true });
    }

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
        setSettingsDraft(loadedSettings);
        if (!loadedSettings) {
          void dockWindow(null);
          setViewState("settings");
          return;
        }
        void dockWindow(loadedSettings);
        void refreshIssueStatuses(loadedSettings);
        void refreshTicketCreateOptions(loadedSettings);
        void refreshTickets(loadedSettings, "my-open").then(() =>
          refreshTicketTabsInBackground(loadedSettings, ["watched", "created", "users"], {
            showLoading: true,
            skipCached: true
          })
        );
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
  }, [handleCheckForUpdates, refreshIssueStatuses, refreshTicketCreateOptions, refreshTickets]);

  useEffect(() => {
    viewStateRef.current = viewState;
  }, [viewState]);

  useEffect(() => {
    if (!settings) {
      return;
    }

    const intervalMs = Math.max(settings.refreshIntervalSeconds, 15) * 1000;
    const intervalId = window.setInterval(() => {
      void refreshTicketTabsInBackground(settings);
    }, intervalMs);

    return () => window.clearInterval(intervalId);
  }, [refreshTicketTabsInBackground, settings]);

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
      clearUpdateStatusTimer();
    };
  }, [clearUpdateStatusTimer]);

  async function handleSave(nextSettings: RedmineSettings) {
    setSaving(true);
    setError(null);
    try {
      await saveSettings(nextSettings);
      setSettings(nextSettings);
      setSettingsDraft(nextSettings);
      await dockWindow(nextSettings);
      await refreshIssueStatuses(nextSettings);
      await refreshTicketCreateOptions(nextSettings);
      await refreshTickets(nextSettings);
      setViewState("tickets");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function handleCancelSettings() {
    if (!settings) {
      return;
    }

    setSettingsDraft(settings);
    setViewState("tickets");
    setError(null);
  }

  function markTicketAsRead(ticketId: number) {
    const nextTicketState = markTicketRead(ticketStateRef.current, ticketId);
    ticketStateRef.current = nextTicketState;
    setTicketState(nextTicketState);
    void saveTicketState(nextTicketState).catch(() => undefined);
  }

  function markAllTicketsAsRead() {
    const nextTicketState = {
      ...ticketStateRef.current,
      unreadTicketIds: []
    };
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
    setTicketContextSubmenu(null);
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
    setTicketContextSubmenu(null);
    try {
      await assignTicket(settings, ticket.id, user.id);
      await refreshTickets(settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleSubmitComment() {
    if (!settings || !commentTicket || savingComment) {
      return;
    }

    setSavingComment(true);
    try {
      if (comment.trim().length > 0) {
        await addTicketComment(settings, commentTicket.id, comment, commentPrivateNotes);
      }
      if (selectedAssigneeId) {
        await assignTicket(settings, commentTicket.id, Number(selectedAssigneeId));
      }
      if (selectedCommentStatusId) {
        await updateTicketStatus(settings, commentTicket.id, Number(selectedCommentStatusId));
      }
      setComment("");
      setCommentPrivateNotes(false);
      setSelectedAssigneeId("");
      setSelectedCommentStatusId("");
      setCommentTicket(null);
      await refreshTickets(settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingComment(false);
    }
  }

  async function handleOpenAssigneeTickets(assigneeId?: number) {
    if (!settings) {
      setViewState("settings");
      return;
    }

    try {
      const ticketListUrl = assigneeId
        ? buildUserOpenTicketsUrl(settings.baseUrl, assigneeId)
        : buildUnassignedOpenTicketsUrl(settings.baseUrl);
      await openTicketUrl(ticketListUrl);
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
        newTicketDescription.trim().length > 0 ? newTicketDescription.trim() : undefined,
      attachments: newTicketAttachments.length > 0 ? newTicketAttachments : undefined
    };

    try {
      await createTicket(settings, ticket);
      setShowCreateTicketDialog(false);
      setNewTicketSubject("");
      setNewTicketProjectId("");
      setNewTicketProjectSearch("");
      setShowNewTicketProjectOptions(false);
      setNewTicketTrackerId("");
      setNewTicketPriorityId(findDefaultNormalPriorityId(issuePriorities));
      setNewTicketStatusId(findDefaultNewStatusId(issueStatuses));
      setNewTicketAssignedToId("");
      setNewTicketDescription("");
      setNewTicketAttachments([]);
      setNewTicketAssignableUsers([]);
      await refreshTickets(settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function handleOpenTicketContextMenu(ticket: Ticket, position: { x: number; y: number }) {
    setTicketContextMenu({ ticket, x: position.x, y: position.y });
    setTicketContextSubmenu(null);
    setAssignableUsers([]);

    if (settings) {
      void refreshAssignableUsers(settings, ticket.projectId);
    }
  }

  function handleOpenCommentDialog(ticket: Ticket) {
    setCommentTicket(ticket);
    setComment("");
    setCommentPrivateNotes(false);
    setSelectedAssigneeId("");
    setSelectedCommentStatusId("");
    setAssignableUsers([]);
    setTicketContextMenu(null);
    setTicketContextSubmenu(null);

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
    setNewTicketPriorityId((currentPriorityId) =>
      currentPriorityId || findDefaultNormalPriorityId(issuePriorities)
    );
    void refreshTicketCreateOptions(settings);
  }

  async function handleAddNewTicketFiles(files: FileList | File[]) {
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      return;
    }

    const attachments = await Promise.all(
      imageFiles.map(async (file) => ({
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        content: Array.from(new Uint8Array(await file.arrayBuffer()))
      }))
    );

    setNewTicketAttachments((currentAttachments) => [
      ...currentAttachments,
      ...attachments
    ]);
  }

  function handleRemoveNewTicketAttachment(attachmentIndex: number) {
    setNewTicketAttachments((currentAttachments) =>
      currentAttachments.filter((_, index) => index !== attachmentIndex)
    );
  }

  function formatNewTicketDescription(prefix: string, suffix = prefix) {
    const textarea = newTicketDescriptionRef.current;
    if (!textarea) {
      return;
    }

    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const selectedText = newTicketDescription.slice(selectionStart, selectionEnd);
    const fallbackText = selectedText || "Text";
    const formattedText = `${prefix}${fallbackText}${suffix}`;
    const nextDescription =
      newTicketDescription.slice(0, selectionStart) +
      formattedText +
      newTicketDescription.slice(selectionEnd);

    setNewTicketDescription(nextDescription);
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(
        selectionStart + prefix.length,
        selectionStart + prefix.length + fallbackText.length
      );
    });
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
    if (pinned || collapsed || viewStateRef.current === "settings") {
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

  function handleSelectTicketTab(ticketTab: TicketTab) {
    activeTicketTabRef.current = ticketTab;
    setActiveTicketTab(ticketTab);
    const cachedTab = ticketTabCacheRef.current[ticketTab];

    if (hasCachedTickets(cachedTab)) {
      setTickets(cachedTab.tickets);
      setViewState("tickets");
    } else {
      setTickets([]);
    }

    if (settings) {
      void refreshTickets(settings, ticketTab, {
        showLoading: !hasCachedTickets(cachedTab)
      });
    }
  }

  const showingSettings = viewState === "settings";
  const language: Language = settings?.language ?? "de";
  const t = createTranslator(language);
  const dockSide = settings?.dockSide ?? "right";
  const accentColor = normalizeAccentColor(settingsDraft?.accentColor ?? settings?.accentColor);
  const appStyle = { "--accent-color": accentColor } as CSSProperties;
  const visibleError = error ? formatError(error, language) : null;
  const updateMessage =
    updateStatus === "checking"
      ? t("updateChecking")
      : updateStatus === "current"
        ? t("updateCurrent")
        : updateStatus === "installed" && installedUpdateVersion
          ? t("updateInstalled").replace("{version}", installedUpdateVersion)
          : updateStatus === "error"
            ? t("updateFailed")
            : null;
  const activeTicketTabLoading = ticketTabLoading[activeTicketTab];
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
  const ticketTabCounts = {
    "my-open": ticketTabCache["my-open"].tickets.length,
    watched: ticketTabCache.watched.tickets.length,
    created: ticketTabCache.created.tickets.length,
    users: ticketTabCache.users.tickets.length
  } satisfies Record<TicketTab, number>;

  return (
    <main
      className={`app-shell app-shell-${dockSide}${collapsed ? " app-shell-collapsed" : ""}`}
      style={appStyle}
      onMouseEnter={collapsed ? undefined : handlePanelMouseEnter}
      onMouseLeave={handlePanelMouseLeave}
    >
      {collapsed ? (
        <div
          aria-label={`${tickets.length} ${t("openCount")}`}
          className="collapsed-panel-handle"
          onMouseEnter={handlePanelMouseEnter}
          title={`${tickets.length} ${t("openCount")}`}
        />
      ) : (
        <>
          <header className="panel-header">
            <div className="panel-header-top">
              <div className="panel-title-block">
                <h1>{t("title")}</h1>
                <div className="panel-title-meta">
                  <p>{showingSettings ? t("settings") : `${tickets.length} ${t("openCount")}`}</p>
                  <button
                    aria-label={t("versionInfo").replace("{version}", __APP_VERSION__)}
                    className="app-version-button"
                    title={t("versionInfo").replace("{version}", __APP_VERSION__)}
                    type="button"
                    onClick={() => setShowVersionInfo(true)}
                  >
                    v{__APP_VERSION__}
                  </button>
                </div>
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
                  aria-label={t("checkForUpdates")}
                  disabled={updateStatus === "checking"}
                  title={t("checkForUpdates")}
                  type="button"
                  onClick={() => {
                    void handleCheckForUpdates();
                  }}
                >
                  <DownloadIcon />
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

          {updateMessage ? (
            <div className={`update-banner update-banner-${updateStatus}`}>{updateMessage}</div>
          ) : null}

          {visibleError ? <div className="error-banner">{visibleError}</div> : null}

          {showVersionInfo ? (
            <div
              className="version-info-dialog"
              role="dialog"
              aria-label={t("versionInfo").replace("{version}", __APP_VERSION__)}
            >
              <div className="comment-dialog-header">
                <strong>{t("whatsNewTitle").replace("{version}", __APP_VERSION__)}</strong>
                <button
                  aria-label={t("closeVersionInfo")}
                  type="button"
                  onClick={() => setShowVersionInfo(false)}
                >
                  x
                </button>
              </div>
              <ul>
                {RELEASE_NOTE_KEYS.map((releaseNoteKey) => (
                  <li key={releaseNoteKey}>{t(releaseNoteKey)}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {viewState === "loading" ? (
            <div className="status-panel">{t("loading")}</div>
          ) : null}

          {showingSettings ? (
            <SettingsForm
              initialSettings={settingsDraft ?? settings}
              monitors={monitors}
              onChange={setSettingsDraft}
              onCancel={settings ? handleCancelSettings : undefined}
              onSave={handleSave}
              onPreviewTicketNotificationSound={(sound, volume) =>
                playTicketNotificationSound({ enabled: true, volume, sound })
              }
              saving={saving}
            />
          ) : null}

          {viewState === "tickets" && activeTicketTabLoading ? (
            <div className="ticket-loading-progress" role="progressbar" aria-label={t("loading")}>
              <span>{t("ticketsLoading")}</span>
              <div aria-hidden="true" className="ticket-loading-progress-track" />
            </div>
          ) : null}

          {viewState === "tickets" && tickets.length === 0 && !activeTicketTabLoading ? (
            <div className="status-panel">
              {activeTicketTab === "users" ? t("noOpenUsers") : t("noOpenTickets")}
            </div>
          ) : null}

          {viewState === "tickets" && tickets.length > 0 && activeTicketTab !== "users" ? (
            <TicketList
              onOpenTicket={handleOpenTicket}
              onTicketContextMenu={handleOpenTicketContextMenu}
              sortLabels={{
                allCustomers: t("allCustomers"),
                customer: t("customer"),
                createdPrefix: t("createdPrefix"),
                daysAgo: t("daysAgo"),
                hoursAgo: t("hoursAgo"),
                justNow: t("justNow"),
                markAllRead: t("markAllRead"),
                minutesAgo: t("minutesAgo"),
                noTicketsForCustomer: t("noTicketsForCustomer"),
                onlyNew: t("onlyNewTickets"),
                search: t("searchTickets"),
                sortBy: t("sortBy"),
                updatedDesc: t("sortUpdatedDesc"),
                createdDesc: t("sortCreatedDesc"),
                priorityDesc: t("sortPriorityDesc"),
                projectAsc: t("sortProjectAsc"),
                idDesc: t("sortIdDesc"),
                idAsc: t("sortIdAsc")
              }}
              onMarkAllRead={markAllTicketsAsRead}
              tickets={tickets}
              unreadTicketIds={ticketState.unreadTicketIds}
            />
          ) : null}

          {viewState === "tickets" && tickets.length > 0 && activeTicketTab === "users" ? (
            <section className="user-ticket-summary-panel" aria-label={t("usersTab")}>
              <ul className="user-ticket-summary-list">
                {summarizeOpenTicketsByAssignee(tickets, t("unassignedUser")).map((user) => {
                  const assigneeId = user.assigneeId;
                  const rowContent = (
                    <>
                      <span>{user.assignee}</span>
                      <strong>{user.openTicketCount}</strong>
                    </>
                  );

                  return (
                    <li className="user-ticket-summary-row" key={`${user.assigneeId ?? "none"}-${user.assignee}`}>
                      <button
                        aria-label={`${user.assignee} ${user.openTicketCount} offene Tickets`}
                        title={`${user.assignee} ${user.openTicketCount} offene Tickets`}
                        type="button"
                        onClick={() => {
                          void handleOpenAssigneeTickets(assigneeId);
                        }}
                      >
                        {rowContent}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {viewState === "tickets" ? (
            <nav className="bottom-ticket-tabs" aria-label="Ticket views">
              {[
                {
                  id: "my-open" as const,
                  label: t("myOpenTicketsTab"),
                  shortLabel: language === "de" ? "Meine" : "Mine",
                  icon: "inbox"
                },
                {
                  id: "watched" as const,
                  label: t("watchedTicketsTab"),
                  shortLabel: language === "de" ? "Beobachtet" : "Watched",
                  icon: "eye"
                },
                {
                  id: "created" as const,
                  label: t("createdTicketsTab"),
                  shortLabel: language === "de" ? "Erstellt" : "Created",
                  icon: "edit"
                },
                {
                  id: "users" as const,
                  label: t("usersTab"),
                  shortLabel: t("usersTab"),
                  icon: "users"
                }
              ].map((tab) => {
                const tabCount = ticketTabCounts[tab.id];
                const tabLoaded = hasCachedTickets(ticketTabCache[tab.id]);
                const tabLoading = ticketTabLoading[tab.id] && !tabLoaded;
                const tabLabel = tabLoading
                  ? `${tab.label}, ${t("loading")}`
                  : `${tab.label}, ${tabCount} ${t("openCount")}`;

                return (
                  <button
                    aria-label={tab.label}
                    aria-pressed={activeTicketTab === tab.id}
                    className={activeTicketTab === tab.id ? "is-active" : undefined}
                    key={tab.id}
                    title={tabLabel}
                    type="button"
                    onClick={() => handleSelectTicketTab(tab.id)}
                  >
                    <span aria-hidden="true" className={`bottom-ticket-tab-icon icon-${tab.icon}`} />
                    <span>{tab.shortLabel}</span>
                    {tabLoading ? (
                      <span
                        aria-label={t("loading")}
                        className="bottom-ticket-tab-count bottom-ticket-tab-spinner"
                        role="status"
                      />
                    ) : (
                      <strong aria-hidden="true" className="bottom-ticket-tab-count">
                        {tabCount}
                      </strong>
                    )}
                  </button>
                );
              })}
            </nav>
          ) : null}

          {ticketContextMenu ? (
            <div
              className="ticket-context-menu"
              ref={ticketContextMenuRef}
              style={{
                left: contextMenuLeft(ticketContextMenu.x, window.innerWidth),
                top: Math.max(12, Math.min(ticketContextMenu.y, window.innerHeight - 184))
              }}
            >
              <button
                className="context-menu-primary-action"
                type="button"
                onClick={() => {
                  handleOpenCommentDialog(ticketContextMenu.ticket);
                }}
              >
                {t("addComment")}
              </button>
              <div
                className="context-menu-submenu"
                onBlur={(event) => {
                  if (
                    event.relatedTarget instanceof Node &&
                    event.currentTarget.contains(event.relatedTarget)
                  ) {
                    return;
                  }

                  setTicketContextSubmenu(null);
                }}
              >
                <button
                  aria-expanded={ticketContextSubmenu === "assignee"}
                  type="button"
                  onClick={() => {
                    setTicketContextSubmenu((currentSubmenu) =>
                      currentSubmenu === "assignee" ? null : "assignee"
                    );
                  }}
                >
                  <span>{t("assignTo")}</span>
                  <ChevronDownIcon className="context-menu-chevron" />
                </button>
                {ticketContextSubmenu === "assignee" ? (
                  <div className="context-menu-flyout">
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
                          {user.name}
                        </button>
                      ))
                    ) : (
                      <span className="context-menu-empty">{t("noUsersLoaded")}</span>
                    )}
                  </div>
                ) : null}
              </div>
              <div
                className="context-menu-submenu"
                onBlur={(event) => {
                  if (
                    event.relatedTarget instanceof Node &&
                    event.currentTarget.contains(event.relatedTarget)
                  ) {
                    return;
                  }

                  setTicketContextSubmenu(null);
                }}
              >
                <button
                  aria-expanded={ticketContextSubmenu === "status"}
                  type="button"
                  onClick={() => {
                    setTicketContextSubmenu((currentSubmenu) =>
                      currentSubmenu === "status" ? null : "status"
                    );
                  }}
                >
                  <span>{t("status")}</span>
                  <ChevronDownIcon className="context-menu-chevron" />
                </button>
                {ticketContextSubmenu === "status" ? (
                  <div className="context-menu-flyout">
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
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  void handleOpenTicket(ticketContextMenu.ticket);
                  setTicketContextMenu(null);
                  setTicketContextSubmenu(null);
                }}
              >
                {t("openInBrowser")}
              </button>
            </div>
          ) : null}

          {commentTicket ? (
            <div className="comment-dialog" role="dialog" aria-label={t("addComment")}>
              <div className="comment-dialog-header">
                <strong>#{commentTicket.id}</strong>
                <button
                  aria-label={t("closeCommentDialog")}
                  disabled={savingComment}
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
              <label className="comment-dialog-checkbox">
                <input
                  checked={commentPrivateNotes}
                  disabled={comment.trim().length === 0}
                  onChange={(event) => setCommentPrivateNotes(event.target.checked)}
                  type="checkbox"
                />
                <span>
                  <strong>{t("internalComment")}</strong>
                  <small>{t("internalCommentHint")}</small>
                </span>
              </label>
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
              <label className="comment-dialog-field">
                <span>{t("status")}</span>
                <select
                  aria-label={t("status")}
                  onChange={(event) => setSelectedCommentStatusId(event.target.value)}
                  value={selectedCommentStatusId}
                >
                  <option value="">{t("noAssignment")}</option>
                  {issueStatuses.map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.name}
                    </option>
                  ))}
                </select>
              </label>
              {assignableUsers.length === 0 ? (
                <span className="comment-dialog-empty">{t("noUsersLoaded")}</span>
              ) : null}
              <button
                className="primary-action"
                disabled={
                  savingComment ||
                  comment.trim().length === 0 &&
                  !selectedAssigneeId &&
                  !selectedCommentStatusId
                }
                type="button"
                onClick={() => {
                  void handleSubmitComment();
                }}
              >
                {savingComment ? t("saving") : t("saveChanges")}
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
              <div className="comment-dialog-field">
                <span>{t("description")}</span>
                <div className="description-editor-toolbar">
                  <button
                    aria-label={t("descriptionBold")}
                    title={t("descriptionBold")}
                    type="button"
                    onClick={() => formatNewTicketDescription("*")}
                  >
                    B
                  </button>
                  <button
                    aria-label={t("descriptionItalic")}
                    title={t("descriptionItalic")}
                    type="button"
                    onClick={() => formatNewTicketDescription("_")}
                  >
                    I
                  </button>
                  <button
                    aria-label={t("descriptionCode")}
                    title={t("descriptionCode")}
                    type="button"
                    onClick={() => formatNewTicketDescription("@")}
                  >
                    {"<>"}
                  </button>
                  <button
                    aria-label={t("descriptionBulletedList")}
                    title={t("descriptionBulletedList")}
                    type="button"
                    onClick={() => formatNewTicketDescription("* ", "")}
                  >
                    •
                  </button>
                  <button
                    aria-label={t("descriptionQuote")}
                    title={t("descriptionQuote")}
                    type="button"
                    onClick={() => formatNewTicketDescription("> ", "")}
                  >
                    “
                  </button>
                </div>
                <textarea
                  aria-label={t("description")}
                  onDragOver={(event) => {
                    event.preventDefault();
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    void handleAddNewTicketFiles(event.dataTransfer.files);
                  }}
                  onPaste={(event) => {
                    if (event.clipboardData.files.length > 0) {
                      void handleAddNewTicketFiles(event.clipboardData.files);
                    }
                  }}
                  onChange={(event) => setNewTicketDescription(event.target.value)}
                  placeholder={t("descriptionAttachmentHint")}
                  ref={newTicketDescriptionRef}
                  value={newTicketDescription}
                />
              </div>
              {newTicketAttachments.length > 0 ? (
                <div className="create-ticket-attachments">
                  <span>{t("descriptionAttachments")}</span>
                  <ul>
                    {newTicketAttachments.map((attachment, index) => (
                      <li key={`${attachment.filename}-${index}`}>
                        <span>{attachment.filename}</span>
                        <button
                          aria-label={t("attachmentRemove").replace("{filename}", attachment.filename)}
                          type="button"
                          onClick={() => handleRemoveNewTicketAttachment(index)}
                        >
                          x
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
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
