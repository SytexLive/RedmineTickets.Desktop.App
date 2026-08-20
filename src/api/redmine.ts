import { invoke } from "@tauri-apps/api/core";
import type { Ticket } from "../domain/ticket";

export type RedmineSettings = {
  baseUrl: string;
  apiKey: string;
  monitorIndex: number;
  dockSide: "left" | "right";
  refreshIntervalSeconds: number;
  language: "de" | "en";
  ticketNotificationsEnabled: boolean;
  ticketNotificationVolume: number;
  ticketNotificationSound: string;
};

export type TicketNotificationState = {
  knownTicketIds: number[];
  unreadTicketIds: number[];
};

export type MonitorInfo = {
  index: number;
  label: string;
  isPrimary: boolean;
};

export type IssueStatus = {
  id: number;
  name: string;
};

export type RedmineProject = {
  id: number;
  name: string;
};

export type RedmineTracker = {
  id: number;
  name: string;
};

export type IssuePriority = {
  id: number;
  name: string;
};

export type RedmineUser = {
  id: number;
  name: string;
};

export type NewTicket = {
  subject: string;
  projectId: number;
  trackerId: number;
  priorityId?: number;
  statusId?: number;
  assignedToId?: number;
  description?: string;
  attachments?: NewTicketAttachment[];
};

export type NewTicketAttachment = {
  filename: string;
  contentType: string;
  content: number[];
};

type PanelSettings = Pick<RedmineSettings, "monitorIndex" | "dockSide">;

function toPanelSettings(settings?: RedmineSettings | null): PanelSettings | null {
  if (!settings) {
    return null;
  }

  return {
    monitorIndex: settings.monitorIndex,
    dockSide: settings.dockSide
  };
}

export function loadSettings(): Promise<RedmineSettings | null> {
  return invoke("load_settings");
}

export function saveSettings(settings: RedmineSettings): Promise<void> {
  return invoke("save_settings", { settings });
}

export function loadTicketState(): Promise<TicketNotificationState> {
  return invoke("load_ticket_state");
}

export function saveTicketState(state: TicketNotificationState): Promise<void> {
  return invoke("save_ticket_state", { state });
}

export function fetchTickets(settings: RedmineSettings): Promise<Ticket[]> {
  return invoke("fetch_tickets", { settings });
}

export function createTicket(settings: RedmineSettings, ticket: NewTicket): Promise<void> {
  return invoke("create_ticket", { settings, ticket });
}

export function fetchProjects(settings: RedmineSettings): Promise<RedmineProject[]> {
  return invoke("fetch_projects", { settings });
}

export function fetchTrackers(settings: RedmineSettings): Promise<RedmineTracker[]> {
  return invoke("fetch_trackers", { settings });
}

export function fetchIssuePriorities(settings: RedmineSettings): Promise<IssuePriority[]> {
  return invoke("fetch_issue_priorities", { settings });
}

export function fetchIssueStatuses(settings: RedmineSettings): Promise<IssueStatus[]> {
  return invoke("fetch_issue_statuses", { settings });
}

export function fetchAssignableUsers(
  settings: RedmineSettings,
  projectId: number
): Promise<RedmineUser[]> {
  return invoke("fetch_assignable_users", { settings, projectId });
}

export function updateTicketStatus(
  settings: RedmineSettings,
  ticketId: number,
  statusId: number
): Promise<void> {
  return invoke("update_ticket_status", { settings, ticketId, statusId });
}

export function addTicketComment(
  settings: RedmineSettings,
  ticketId: number,
  comment: string
): Promise<void> {
  return invoke("add_ticket_comment", { settings, ticketId, comment });
}

export function assignTicket(
  settings: RedmineSettings,
  ticketId: number,
  userId: number
): Promise<void> {
  return invoke("assign_ticket", { settings, ticketId, userId });
}

export function listMonitors(): Promise<MonitorInfo[]> {
  return invoke("list_monitors");
}

export function dockWindow(settings?: RedmineSettings | null): Promise<void> {
  return invoke("dock_window", { settings: toPanelSettings(settings) });
}

export function collapseWindow(settings?: RedmineSettings | null): Promise<void> {
  return invoke("collapse_window", { settings: toPanelSettings(settings) });
}

export function expandWindow(settings?: RedmineSettings | null): Promise<void> {
  return invoke("expand_window", { settings: toPanelSettings(settings) });
}

export function openTicketUrl(url: string): Promise<void> {
  return invoke("open_ticket_url", { url });
}
