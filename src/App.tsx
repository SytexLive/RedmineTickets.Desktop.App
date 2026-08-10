import { useCallback, useEffect, useState } from "react";
import {
  collapseWindow,
  dockWindow,
  expandWindow,
  fetchTickets,
  listMonitors,
  loadSettings,
  type MonitorInfo,
  openTicketUrl,
  saveSettings,
  type RedmineSettings
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

export function App() {
  const [settings, setSettings] = useState<RedmineSettings | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);

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
  }, [refreshTickets]);

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
            <TicketList onOpenTicket={handleOpenTicket} tickets={tickets} />
          ) : null}
        </>
      )}
    </main>
  );
}
