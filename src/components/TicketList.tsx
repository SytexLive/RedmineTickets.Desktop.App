import { useState } from "react";
import type { Ticket } from "../domain/ticket";
import { sortTickets, type TicketSortOption } from "../domain/ticketSorting";

type TicketListProps = {
  tickets: Ticket[];
  unreadTicketIds?: number[];
  sortLabels?: TicketSortLabels;
  onOpenTicket: (ticket: Ticket) => void;
  onTicketContextMenu?: (ticket: Ticket, position: { x: number; y: number }) => void;
};

export type TicketSortLabels = {
  sortBy: string;
  updatedDesc: string;
  createdDesc: string;
  priorityDesc: string;
  idDesc: string;
  idAsc: string;
};

const defaultSortLabels: TicketSortLabels = {
  sortBy: "Sort by",
  updatedDesc: "Updated newest",
  createdDesc: "Created newest",
  priorityDesc: "Priority highest",
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

export function TicketList({
  tickets,
  unreadTicketIds,
  sortLabels = defaultSortLabels,
  onOpenTicket,
  onTicketContextMenu
}: TicketListProps) {
  const [sortOption, setSortOption] = useState<TicketSortOption>("updated-desc");
  const unreadIdSet = new Set(unreadTicketIds ?? []);
  const sortedTickets = sortTickets(tickets, sortOption);

  return (
    <section className="ticket-list-panel" aria-label="Redmine tickets">
      <div className="ticket-list-toolbar">
        <label>
          <span>{sortLabels.sortBy}</span>
          <select
            aria-label={sortLabels.sortBy}
            value={sortOption}
            onChange={(event) => setSortOption(event.target.value as TicketSortOption)}
          >
            <option value="updated-desc">{sortLabels.updatedDesc}</option>
            <option value="created-desc">{sortLabels.createdDesc}</option>
            <option value="priority-desc">{sortLabels.priorityDesc}</option>
            <option value="id-desc">{sortLabels.idDesc}</option>
            <option value="id-asc">{sortLabels.idAsc}</option>
          </select>
        </label>
      </div>
      <div className="ticket-list">
        {sortedTickets.map((ticket) => {
          const isUnread = unreadIdSet.has(ticket.id);

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
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
