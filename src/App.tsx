import { useCallback, useEffect, useState } from "react";
import {
  collapseWindow,
  dockWindow,
  expandWindow,
  fetchTickets,
  loadSettings,
  openTicketUrl,
  saveSettings,
  type RedmineSettings
} from "./api/redmine";
import { SettingsForm } from "./components/SettingsForm";
import { TicketList } from "./components/TicketList";
import type { Ticket } from "./domain/ticket";

type ViewState = "loading" | "settings" | "tickets";

export function App() {
  const [settings, setSettings] = useState<RedmineSettings | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

    dockWindow().catch(() => undefined);
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

    const intervalId = window.setInterval(() => {
      void refreshTickets(settings);
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, [refreshTickets, settings]);

  async function handleSave(nextSettings: RedmineSettings) {
    setSaving(true);
    setError(null);
    try {
      await saveSettings(nextSettings);
      setSettings(nextSettings);
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

  const showingSettings = viewState === "settings";

  return (
    <main className="app-shell">
      <header className="panel-header">
        <div>
          <h1>Redmine Tickets</h1>
          <p>{showingSettings ? "Settings" : `${tickets.length} open`}</p>
        </div>
        <div className="header-actions">
          <button
            aria-label="Refresh tickets"
            type="button"
            onClick={() => {
              if (!settings) {
                setViewState("settings");
                return;
              }

              void refreshTickets(settings);
            }}
          >
            R
          </button>
          <button
            aria-label="Show settings"
            type="button"
            onClick={() => setViewState("settings")}
          >
            S
          </button>
          <button
            aria-label="Collapse panel"
            type="button"
            onClick={() => {
              void collapseWindow();
            }}
          >
            &gt;
          </button>
        </div>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      {viewState === "loading" ? <div className="status-panel">Loading</div> : null}

      {showingSettings ? (
        <SettingsForm
          initialSettings={settings}
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

      <button
        aria-label="Expand panel"
        className="expand-handle"
        type="button"
        onClick={() => {
          void expandWindow();
        }}
      >
        &lt;
      </button>
    </main>
  );
}
