import { invoke } from "@tauri-apps/api/core";
import type { Ticket } from "../domain/ticket";

export type RedmineSettings = {
  baseUrl: string;
  apiKey: string;
  monitorIndex: number;
  dockSide: "left" | "right";
  refreshIntervalSeconds: number;
};

export type MonitorInfo = {
  index: number;
  label: string;
  isPrimary: boolean;
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

export function fetchTickets(settings: RedmineSettings): Promise<Ticket[]> {
  return invoke("fetch_tickets", { settings });
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
