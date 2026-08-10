export type Language = "de" | "en";

export type TranslationKey =
  | "addComment"
  | "apiKey"
  | "assignTo"
  | "closeCommentDialog"
  | "collapsePanel"
  | "comment"
  | "errorPrefix"
  | "expandPanel"
  | "language"
  | "loading"
  | "monitor"
  | "noOpenTickets"
  | "noAssignment"
  | "noStatusesLoaded"
  | "noUsersLoaded"
  | "openCount"
  | "openInBrowser"
  | "redmineUrl"
  | "refreshInterval"
  | "refreshTickets"
  | "save"
  | "saveComment"
  | "saveChanges"
  | "saving"
  | "settings"
  | "showSettings"
  | "side"
  | "sideLeft"
  | "sideRight"
  | "status"
  | "title";

const translations: Record<Language, Record<TranslationKey, string>> = {
  de: {
    addComment: "Kommentar hinzuf\u00fcgen",
    apiKey: "API-Schl\u00fcssel",
    assignTo: "Zuweisen an",
    closeCommentDialog: "Kommentardialog schlie\u00dfen",
    collapsePanel: "Panel einklappen",
    comment: "Kommentar",
    errorPrefix: "Redmine-Fehler",
    expandPanel: "Panel ausklappen",
    language: "Sprache",
    loading: "L\u00e4dt",
    monitor: "Monitor",
    noOpenTickets: "Keine offenen Tickets",
    noAssignment: "Nicht ändern",
    noStatusesLoaded: "Keine Status geladen",
    noUsersLoaded: "Keine Benutzer geladen",
    openCount: "offen",
    openInBrowser: "Im Browser \u00f6ffnen",
    redmineUrl: "Redmine URL",
    refreshInterval: "Aktualisierungsintervall",
    refreshTickets: "Tickets aktualisieren",
    save: "Speichern",
    saveComment: "Kommentar speichern",
    saveChanges: "\u00c4nderungen speichern",
    saving: "Speichert",
    settings: "Einstellungen",
    showSettings: "Einstellungen anzeigen",
    side: "Seite",
    sideLeft: "Links",
    sideRight: "Rechts",
    status: "Status",
    title: "Redmine Tickets"
  },
  en: {
    addComment: "Add comment",
    apiKey: "API key",
    assignTo: "Assign to",
    closeCommentDialog: "Close comment dialog",
    collapsePanel: "Collapse panel",
    comment: "Comment",
    errorPrefix: "Redmine error",
    expandPanel: "Expand panel",
    language: "Language",
    loading: "Loading",
    monitor: "Monitor",
    noOpenTickets: "No open tickets",
    noAssignment: "Do not change",
    noStatusesLoaded: "No statuses loaded",
    noUsersLoaded: "No users loaded",
    openCount: "open",
    openInBrowser: "Open in browser",
    redmineUrl: "Redmine URL",
    refreshInterval: "Refresh interval",
    refreshTickets: "Refresh tickets",
    save: "Save",
    saveComment: "Save comment",
    saveChanges: "Save changes",
    saving: "Saving",
    settings: "Settings",
    showSettings: "Show settings",
    side: "Side",
    sideLeft: "Left",
    sideRight: "Right",
    status: "Status",
    title: "Redmine Tickets"
  }
};

const backendErrorTranslations: Partial<Record<Language, Record<string, string>>> = {
  de: {
    "Comment must not be empty": "Kommentar darf nicht leer sein",
    "Could not collapse panel": "Panel konnte nicht eingeklappt werden",
    "Could not create app settings directory":
      "Einstellungsverzeichnis konnte nicht erstellt werden",
    "Could not keep panel on top": "Panel konnte nicht im Vordergrund gehalten werden",
    "Could not open ticket in browser": "Ticket konnte nicht im Browser ge\u00f6ffnet werden",
    "Could not parse settings": "Einstellungen konnten nicht gelesen werden",
    "Could not position collapsed panel":
      "Eingeklapptes Panel konnte nicht positioniert werden",
    "Could not position panel": "Panel konnte nicht positioniert werden",
    "Could not read monitors": "Monitore konnten nicht gelesen werden",
    "Could not read primary monitor": "Hauptmonitor konnte nicht gelesen werden",
    "Could not read settings": "Einstellungen konnten nicht geladen werden",
    "Could not resolve app settings directory":
      "Einstellungsverzeichnis konnte nicht ermittelt werden",
    "Could not save settings": "Einstellungen konnten nicht gespeichert werden",
    "Could not serialize settings": "Einstellungen konnten nicht serialisiert werden",
    "Could not show panel": "Panel konnte nicht angezeigt werden",
    "Could not size panel": "Panel-Gro\u00dfe konnte nicht gesetzt werden",
    "Invalid Redmine URL": "Ung\u00fcltige Redmine URL",
    "Invalid ticket URL": "Ung\u00fcltige Ticket-URL",
    "Missing API key": "API-Schl\u00fcssel fehlt",
    "Missing Redmine URL": "Redmine URL fehlt",
    "Network failure while contacting Redmine":
      "Netzwerkfehler beim Kontaktieren von Redmine",
    "Network failure while updating Redmine ticket":
      "Netzwerkfehler beim Aktualisieren des Redmine-Tickets",
    "Redmine authentication failed": "Redmine-Authentifizierung fehlgeschlagen",
    "Redmine returned an unexpected response":
      "Redmine hat eine unerwartete Antwort geliefert",
    "Redmine URL must start with http:// or https://":
      "Redmine URL muss mit http:// oder https:// beginnen",
    "Refresh interval must be at least 15 seconds":
      "Aktualisierungsintervall muss mindestens 15 Sekunden betragen"
  }
};

export function createTranslator(language: Language) {
  return (key: TranslationKey) => translations[language][key];
}

export function formatError(message: string, language: Language) {
  const translatedMessage = backendErrorTranslations[language]?.[message] ?? message;
  return `${translations[language].errorPrefix}: ${translatedMessage}`;
}
