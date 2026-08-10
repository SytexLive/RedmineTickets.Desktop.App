import { invoke } from "@tauri-apps/api/core";
import type { Ticket } from "../domain/ticket";

export type RedmineSettings = {
  baseUrl: string;
  apiKey: string;
};

export function loadSettings(): Promise<RedmineSettings | null> {
  return invoke("load_settings");
}

export function saveSettings(settings: RedmineSettings): Promise<void> {
  return invoke("save_settings", { settings });
}

export function fetchTickets(settings: RedmineSettings): Promise<Ticket[]> {
  return invoke("fetch_tickets", { settings });
}

export function dockWindow(): Promise<void> {
  return invoke("dock_window");
}

export function collapseWindow(): Promise<void> {
  return invoke("collapse_window");
}

export function expandWindow(): Promise<void> {
  return invoke("expand_window");
}

export function openTicketUrl(url: string): Promise<void> {
  return invoke("open_ticket_url", { url });
}
