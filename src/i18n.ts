export type Language = "de" | "en";

export type TranslationKey =
  | "addComment"
  | "apiKey"
  | "assignTo"
  | "assignedToId"
  | "accentColor"
  | "accentColorHex"
  | "autostart"
  | "cancel"
  | "allCustomers"
  | "closeCommentDialog"
  | "closeCreateTicketDialog"
  | "collapsePanel"
  | "comment"
  | "createTicket"
  | "customer"
  | "chooseOption"
  | "description"
  | "descriptionAttachmentHint"
  | "descriptionAttachments"
  | "descriptionBold"
  | "descriptionBulletedList"
  | "descriptionCode"
  | "descriptionItalic"
  | "descriptionQuote"
  | "errorPrefix"
  | "expandPanel"
  | "createdTicketsTab"
  | "checkForUpdates"
  | "internalComment"
  | "internalCommentHint"
  | "language"
  | "loading"
  | "myOpenTicketsTab"
  | "monitor"
  | "noOpenUsers"
  | "noOpenTickets"
  | "noTicketsForCustomer"
  | "noAssignment"
  | "noStatusesLoaded"
  | "noUsersLoaded"
  | "openCount"
  | "openInBrowser"
  | "openTicketNumber"
  | "pinPanel"
  | "project"
  | "projectId"
  | "priority"
  | "priorityId"
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
  | "sortBy"
  | "sortCreatedDesc"
  | "sortIdAsc"
  | "sortIdDesc"
  | "sortPriorityDesc"
  | "sortProjectAsc"
  | "sortUpdatedDesc"
  | "status"
  | "statusId"
  | "test"
  | "testTicketNotificationSound"
  | "ticketsLoading"
  | "ticketNumber"
  | "ticketNotifications"
  | "ticketNotificationVolume"
  | "ticketNotificationSound"
  | "ticketTitle"
  | "title"
  | "tracker"
  | "trackerId"
  | "unassignedUser"
  | "unpinPanel"
  | "updateChecking"
  | "updateCurrent"
  | "updateInstalled"
  | "updateFailed"
  | "usersTab"
  | "watchedTicketsTab";

const translations: Record<Language, Record<TranslationKey, string>> = {
  de: {
    addComment: "Kommentar hinzuf\u00fcgen",
    apiKey: "API-Schl\u00fcssel",
    assignTo: "Zuweisen an",
    assignedToId: "Zuweisung-ID",
    accentColor: "Akzentfarbe",
    accentColorHex: "Akzentfarbe Hex-Code",
    autostart: "Mit Windows starten",
    cancel: "Abbrechen",
    allCustomers: "Alle Kunden",
    closeCommentDialog: "Kommentardialog schlie\u00dfen",
    closeCreateTicketDialog: "Ticketdialog schlie\u00dfen",
    collapsePanel: "Panel einklappen",
    comment: "Kommentar",
    createTicket: "Ticket erstellen",
    customer: "Kunde",
    chooseOption: "Bitte wählen",
    description: "Beschreibung",
    descriptionAttachmentHint: "Bilder hier hineinziehen oder einfügen",
    descriptionAttachments: "Anhänge",
    descriptionBold: "Fett",
    descriptionBulletedList: "Liste",
    descriptionCode: "Code",
    descriptionItalic: "Kursiv",
    descriptionQuote: "Zitat",
    errorPrefix: "Redmine-Fehler",
    expandPanel: "Panel ausklappen",
    createdTicketsTab: "Erstellte Tickets",
    checkForUpdates: "Nach Updates suchen",
    internalComment: "Interner Kommentar",
    internalCommentHint: "Nur Benutzer mit Redmine-Berechtigung für private Notizen sehen diesen Kommentar.",
    language: "Sprache",
    loading: "L\u00e4dt",
    myOpenTicketsTab: "Meine offenen Tickets",
    monitor: "Monitor",
    noOpenUsers: "Keine offenen Tickets f\u00fcr Benutzer",
    noOpenTickets: "Keine offenen Tickets",
    noTicketsForCustomer: "Keine Tickets f\u00fcr diesen Kunden",
    noAssignment: "Nicht ändern",
    noStatusesLoaded: "Keine Status geladen",
    noUsersLoaded: "Keine Benutzer geladen",
    openCount: "offen",
    openInBrowser: "Im Browser \u00f6ffnen",
    openTicketNumber: "Ticketnummer \u00f6ffnen",
    pinPanel: "Panel anheften",
    project: "Projekt",
    projectId: "Projekt-ID",
    priority: "Priorit\u00e4t",
    priorityId: "Priorit\u00e4t-ID",
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
    sortBy: "Sortieren",
    sortCreatedDesc: "Anlagedatum: neueste zuerst",
    sortIdAsc: "Ticketnummer aufsteigend",
    sortIdDesc: "Ticketnummer absteigend",
    sortPriorityDesc: "Priorit\u00e4t: h\u00f6chste zuerst",
    sortProjectAsc: "Kunde A-Z",
    sortUpdatedDesc: "\u00c4nderungsdatum: neueste zuerst",
    status: "Status",
    statusId: "Status-ID",
    test: "Test",
    testTicketNotificationSound: "Ticketton testen",
    ticketsLoading: "Tickets werden geladen",
    ticketNumber: "Ticketnummer",
    ticketNotifications: "Ticketton aktiv",
    ticketNotificationVolume: "Ticketton Lautstärke",
    ticketNotificationSound: "Ticketton",
    ticketTitle: "Titel",
    title: "Redmine Tickets",
    tracker: "Tracker",
    trackerId: "Tracker-ID",
    unassignedUser: "Nicht zugewiesen",
    unpinPanel: "Panel l\u00f6sen",
    updateChecking: "Updates werden gepr\u00fcft",
    updateCurrent: "App ist aktuell",
    updateInstalled: "Update {version} installiert",
    updateFailed: "Update-Pr\u00fcfung fehlgeschlagen",
    usersTab: "Benutzer",
    watchedTicketsTab: "Beobachtete Tickets"
  },
  en: {
    addComment: "Add comment",
    apiKey: "API key",
    assignTo: "Assign to",
    assignedToId: "Assignee ID",
    accentColor: "Accent color",
    accentColorHex: "Accent color hex code",
    autostart: "Start with Windows",
    cancel: "Cancel",
    allCustomers: "All customers",
    closeCommentDialog: "Close comment dialog",
    closeCreateTicketDialog: "Close ticket dialog",
    collapsePanel: "Collapse panel",
    comment: "Comment",
    createTicket: "Create ticket",
    customer: "Customer",
    chooseOption: "Choose",
    description: "Description",
    descriptionAttachmentHint: "Drop or paste images here",
    descriptionAttachments: "Attachments",
    descriptionBold: "Bold",
    descriptionBulletedList: "List",
    descriptionCode: "Code",
    descriptionItalic: "Italic",
    descriptionQuote: "Quote",
    errorPrefix: "Redmine error",
    expandPanel: "Expand panel",
    createdTicketsTab: "Created tickets",
    checkForUpdates: "Check for updates",
    internalComment: "Internal comment",
    internalCommentHint: "Only users with Redmine permission for private notes can see this comment.",
    language: "Language",
    loading: "Loading",
    myOpenTicketsTab: "My open tickets",
    monitor: "Monitor",
    noOpenUsers: "No open tickets for users",
    noOpenTickets: "No open tickets",
    noTicketsForCustomer: "No tickets for this customer",
    noAssignment: "Do not change",
    noStatusesLoaded: "No statuses loaded",
    noUsersLoaded: "No users loaded",
    openCount: "open",
    openInBrowser: "Open in browser",
    openTicketNumber: "Open ticket number",
    pinPanel: "Pin panel",
    project: "Project",
    projectId: "Project ID",
    priority: "Priority",
    priorityId: "Priority ID",
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
    sortBy: "Sort by",
    sortCreatedDesc: "Created newest",
    sortIdAsc: "Ticket number ascending",
    sortIdDesc: "Ticket number descending",
    sortPriorityDesc: "Priority highest",
    sortProjectAsc: "Customer A-Z",
    sortUpdatedDesc: "Updated newest",
    status: "Status",
    statusId: "Status ID",
    test: "Test",
    testTicketNotificationSound: "Test ticket sound",
    ticketsLoading: "Loading tickets",
    ticketNumber: "Ticket number",
    ticketNotifications: "Ticket sound enabled",
    ticketNotificationVolume: "Ticket sound volume",
    ticketNotificationSound: "Ticket sound",
    ticketTitle: "Title",
    title: "Redmine Tickets",
    tracker: "Tracker",
    trackerId: "Tracker ID",
    unassignedUser: "Unassigned",
    unpinPanel: "Unpin panel",
    updateChecking: "Checking for updates",
    updateCurrent: "App is up to date",
    updateInstalled: "Update {version} installed",
    updateFailed: "Update check failed",
    usersTab: "Users",
    watchedTicketsTab: "Watched tickets"
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
    "Could not remove panel shadow": "Panel-Schatten konnte nicht entfernt werden",
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
    "Could not update Windows autostart":
      "Windows-Autostart konnte nicht aktualisiert werden",
    "Autostart must be enabled from the installed app":
      "Autostart muss aus der installierten App aktiviert werden",
    "Invalid accent color": "Ung\u00fcltige Akzentfarbe",
    "Invalid Redmine URL": "Ung\u00fcltige Redmine URL",
    "Invalid ticket notification sound": "Ung\u00fcltiger Ticketton",
    "Invalid ticket URL": "Ung\u00fcltige Ticket-URL",
    "Missing API key": "API-Schl\u00fcssel fehlt",
    "Missing Redmine URL": "Redmine URL fehlt",
    "Network failure while contacting Redmine":
      "Netzwerkfehler beim Kontaktieren von Redmine",
    "Network failure while creating Redmine ticket":
      "Netzwerkfehler beim Erstellen des Redmine-Tickets",
    "Network failure while updating Redmine ticket":
      "Netzwerkfehler beim Aktualisieren des Redmine-Tickets",
    "Redmine authentication failed": "Redmine-Authentifizierung fehlgeschlagen",
    "Redmine returned an unexpected response":
      "Redmine hat eine unerwartete Antwort geliefert",
    "Redmine URL must start with http:// or https://":
      "Redmine URL muss mit http:// oder https:// beginnen",
    "Refresh interval must be at least 15 seconds":
      "Aktualisierungsintervall muss mindestens 15 Sekunden betragen",
    "Ticket ID must be positive": "Ticketnummer muss positiv sein",
    "Ticket project must be positive": "Projekt-ID muss positiv sein",
    "Ticket subject must not be empty": "Titel darf nicht leer sein",
    "Ticket tracker must be positive": "Tracker-ID muss positiv sein"
  }
};

export function createTranslator(language: Language) {
  return (key: TranslationKey) => translations[language][key];
}

export function formatError(message: string, language: Language) {
  const translatedMessage = backendErrorTranslations[language]?.[message] ?? message;
  return `${translations[language].errorPrefix}: ${translatedMessage}`;
}
