import { useState } from "react";
import type { Ticket } from "../domain/ticket";
import { sortTickets, type TicketSortOption } from "../domain/ticketSorting";

type TicketListProps = {
  tickets: Ticket[];
  unreadTicketIds?: number[];
  sortLabels?: Partial<TicketSortLabels>;
  onMarkAllRead?: () => void;
  onOpenTicket: (ticket: Ticket) => void;
  onTicketContextMenu?: (ticket: Ticket, position: { x: number; y: number }) => void;
};

export type TicketSortLabels = {
  allCustomers: string;
  customer: string;
  createdPrefix: string;
  daysAgo: string;
  hoursAgo: string;
  justNow: string;
  markAllRead: string;
  minutesAgo: string;
  noTicketsForCustomer: string;
  onlyNew: string;
  search: string;
  sortBy: string;
  updatedDesc: string;
  createdDesc: string;
  priorityDesc: string;
  projectAsc: string;
  idDesc: string;
  idAsc: string;
};

const defaultSortLabels: TicketSortLabels = {
  allCustomers: "All customers",
  customer: "Customer",
  createdPrefix: "Created",
  daysAgo: "d",
  hoursAgo: "h",
  justNow: "Just now",
  markAllRead: "Mark all as read",
  minutesAgo: "m",
  noTicketsForCustomer: "No tickets for this customer",
  onlyNew: "Only new",
  search: "Search tickets",
  sortBy: "Sort by",
  updatedDesc: "Updated newest",
  createdDesc: "Created newest",
  priorityDesc: "Priority highest",
  projectAsc: "Customer A-Z",
  idDesc: "Ticket number descending",
  idAsc: "Ticket number ascending"
};

function priorityClassName(priority: string) {
  const normalizedPriority = priority.trim().toLowerCase();

  if (["sofort", "immediate"].includes(normalizedPriority)) {
    return "ticket-priority-immediate";
  }

  if (["sehr hoch", "urgent"].includes(normalizedPriority)) {
    return "ticket-priority-very-high";
  }

  if (["hoch", "high"].includes(normalizedPriority)) {
    return "ticket-priority-high";
  }

  if (normalizedPriority === "normal") {
    return "ticket-priority-normal";
  }

  if (["niedrig", "low"].includes(normalizedPriority)) {
    return "ticket-priority-low";
  }

  return "ticket-priority-default";
}

function ticketMatchesSearch(ticket: Ticket, searchQuery: string) {
  const normalizedSearch = searchQuery.trim().toLowerCase();
  if (!normalizedSearch) {
    return true;
  }

  return [
    String(ticket.id),
    ticket.subject,
    ticket.project,
    ticket.priority,
    ticket.status,
    ticket.tracker,
    ticket.assignee ?? ""
  ].some((value) => value.toLowerCase().includes(normalizedSearch));
}

function formatRelativeTicketTime(value: string | undefined, labels: TicketSortLabels) {
  if (!value) {
    return "";
  }

  const parsedDate = Date.parse(value);
  if (Number.isNaN(parsedDate)) {
    return "";
  }

  const elapsedMs = Math.max(0, Date.now() - parsedDate);
  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  if (elapsedMinutes < 1) {
    return labels.justNow;
  }

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}${labels.minutesAgo}`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `${elapsedHours}${labels.hoursAgo}`;
  }

  return `${Math.floor(elapsedHours / 24)}${labels.daysAgo}`;
}

export function TicketList({
  tickets,
  unreadTicketIds,
  sortLabels,
  onMarkAllRead,
  onOpenTicket,
  onTicketContextMenu
}: TicketListProps) {
  const labels = { ...defaultSortLabels, ...sortLabels };
  const [sortOption, setSortOption] = useState<TicketSortOption>("updated-desc");
  const [projectFilter, setProjectFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const unreadIdSet = new Set(unreadTicketIds ?? []);
  const projectOptions = Array.from(
    new Set(tickets.map((ticket) => ticket.project).filter(Boolean))
  ).sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
  const filteredTickets = tickets.filter((ticket) => {
    if (projectFilter && ticket.project !== projectFilter) {
      return false;
    }

    if (showUnreadOnly && !unreadIdSet.has(ticket.id)) {
      return false;
    }

    return ticketMatchesSearch(ticket, searchQuery);
  });
  const sortedTickets = sortTickets(filteredTickets, sortOption);
  const hasUnreadTickets = unreadIdSet.size > 0;

  return (
    <section className="ticket-list-panel" aria-label="Redmine tickets">
      <div className="ticket-list-toolbar">
        <div className="ticket-list-search-row">
          <label className="ticket-list-search">
            <span>{labels.search}</span>
            <input
              aria-label={labels.search}
              onChange={(event) => setSearchQuery(event.target.value)}
              type="search"
              value={searchQuery}
            />
          </label>
          <label className="ticket-list-checkbox">
            <input
              aria-label={labels.onlyNew}
              checked={showUnreadOnly}
              onChange={(event) => setShowUnreadOnly(event.target.checked)}
              type="checkbox"
            />
            <span>{labels.onlyNew}</span>
          </label>
        </div>
        <label>
          <span>{labels.customer}</span>
          <select
            aria-label={labels.customer}
            value={projectFilter}
            onChange={(event) => setProjectFilter(event.target.value)}
          >
            <option value="">{labels.allCustomers}</option>
            {projectOptions.map((project) => (
              <option key={project} value={project}>
                {project}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{labels.sortBy}</span>
          <select
            aria-label={labels.sortBy}
            value={sortOption}
            onChange={(event) => setSortOption(event.target.value as TicketSortOption)}
          >
            <option value="updated-desc">{labels.updatedDesc}</option>
            <option value="created-desc">{labels.createdDesc}</option>
            <option value="priority-desc">{labels.priorityDesc}</option>
            <option value="project-asc">{labels.projectAsc}</option>
            <option value="id-desc">{labels.idDesc}</option>
            <option value="id-asc">{labels.idAsc}</option>
          </select>
        </label>
        {onMarkAllRead && hasUnreadTickets ? (
          <button className="ticket-list-toolbar-action" type="button" onClick={onMarkAllRead}>
            {labels.markAllRead}
          </button>
        ) : null}
      </div>
      <div className="ticket-list">
        {sortedTickets.length === 0 ? (
          <div className="ticket-list-empty">{labels.noTicketsForCustomer}</div>
        ) : null}
        {sortedTickets.map((ticket) => {
          const isUnread = unreadIdSet.has(ticket.id);
          const updatedLabel = formatRelativeTicketTime(ticket.updatedAt, labels);

          return (
            <button
              aria-label={isUnread ? `${ticket.subject} unread` : ticket.subject}
              className={`ticket-row ${priorityClassName(ticket.priority)}${isUnread ? " ticket-row-unread" : ""}`}
              key={ticket.id}
              type="button"
              onClick={() => onOpenTicket(ticket)}
              onContextMenu={(event) => {
                if (!onTicketContextMenu) {
                  return;
                }

                event.preventDefault();
                onTicketContextMenu(ticket, { x: event.clientX, y: event.clientY });
              }}
            >
              <span className="ticket-row-top">
                <span className="ticket-id">#{ticket.id}</span>
                <span className="ticket-project">{ticket.project}</span>
                <span className="ticket-priority">{ticket.priority}</span>
              </span>
              <span className="ticket-subject">{ticket.subject}</span>
              <span className="ticket-row-bottom">
                <span>{ticket.tracker}</span>
                <span>{ticket.status}</span>
                {updatedLabel ? (
                  <span className="ticket-row-updated-time">
                    {updatedLabel}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
