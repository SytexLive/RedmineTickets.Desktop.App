import { useState } from "react";
import type { RedmineProject } from "../api/redmine";
import type { Ticket } from "../domain/ticket";
import type { Language } from "../i18n";
import { createTranslator } from "../i18n";
import { TicketList } from "./TicketList";

type Props = {
  projects: RedmineProject[];
  tickets: Ticket[];
  myTicketIds: number[];
  language: Language;
  onOpenWiki: (projectId: number) => void;
  onOpenTicket: (ticket: Ticket) => void;
  onTicketContextMenu?: (ticket: Ticket, position: { x: number; y: number }) => void;
};

export function ProjectTickets({ projects, tickets, myTicketIds, language, onOpenWiki, onOpenTicket, onTicketContextMenu }: Props) {
  const [projectId, setProjectId] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [assignment, setAssignment] = useState<"all" | "mine" | "unassigned">("all");
  const [resetKey, setResetKey] = useState(0);
  const de = language === "de";
  const t = createTranslator(language);
  const mine = new Set(myTicketIds);
  const filtered = tickets.filter(ticket => (!projectId || ticket.projectId === Number(projectId)) &&
    (assignment === "all" || (assignment === "mine" ? mine.has(ticket.id) : !ticket.assigneeId)));
  const options = projects.filter(project => String(project.id) === projectId || project.name.toLocaleLowerCase().includes(projectSearch.trim().toLocaleLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  return <section className="project-tickets" aria-label={de ? "Projekte" : "Projects"}>
    <div className="ticket-list-toolbar project-controls">
      <label><span>{de ? "Projekte suchen" : "Search projects"}</span>
        <input type="search" value={projectSearch} onChange={event => setProjectSearch(event.target.value)} />
      </label>
      <label><span>{de ? "Projekt" : "Project"}</span>
        <select value={projectId} onChange={event => setProjectId(event.target.value)}>
          <option value="">{de ? "Alle Projekte" : "All projects"}</option>
          {options.map(project => <option key={project.id} value={project.id}>{project.name} (#{project.id})</option>)}
        </select>
      </label>
      <button type="button" disabled={!projectId} onClick={() => onOpenWiki(Number(projectId))}>{de ? "Wiki öffnen" : "Open wiki"}</button>
      <div className="project-quick-filters">
        {(["all", "mine", "unassigned"] as const).map(value => <button type="button" key={value} aria-pressed={assignment === value} onClick={() => setAssignment(value)}>
          {value === "all" ? (de ? "Alle" : "All") : value === "mine" ? (de ? "Mir zugewiesen" : "Assigned to me") : (de ? "Nicht zugewiesen" : "Unassigned")}
        </button>)}
      </div>
      <button type="button" onClick={() => { setProjectId(""); setProjectSearch(""); setAssignment("all"); setResetKey(key => key + 1); }}>{de ? "Filter zurücksetzen" : "Reset filters"}</button>
    </div>
    <TicketList key={resetKey} hideProjectFilter resultCountLabel={de ? "offene Tickets" : "open tickets"} tickets={filtered} onOpenTicket={onOpenTicket} onTicketContextMenu={onTicketContextMenu}
      sortLabels={{ search: t("searchTickets"), sortBy: t("sortBy"), onlyNew: t("onlyNewTickets"), noTicketsForCustomer: t("noTicketsForCustomer"), updatedDesc: t("sortUpdatedDesc"), createdDesc: t("sortCreatedDesc"), priorityDesc: t("sortPriorityDesc"), projectAsc: t("sortProjectAsc"), idAsc: t("sortIdAsc"), idDesc: t("sortIdDesc"), assigneeAsc: de ? "Zugewiesen an A–Z" : "Assignee A–Z", statusAsc: "Status A–Z", justNow: t("justNow"), minutesAgo: t("minutesAgo"), hoursAgo: t("hoursAgo"), daysAgo: t("daysAgo") }} />
  </section>;
}
