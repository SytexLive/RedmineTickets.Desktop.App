import type { Ticket } from "../domain/ticket";

type TicketListProps = {
  tickets: Ticket[];
  unreadTicketIds?: number[];
  onOpenTicket: (ticket: Ticket) => void;
  onTicketContextMenu?: (ticket: Ticket, position: { x: number; y: number }) => void;
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
  onOpenTicket,
  onTicketContextMenu
}: TicketListProps) {
  const unreadIdSet = new Set(unreadTicketIds ?? []);

  return (
    <section className="ticket-list" aria-label="Redmine tickets">
      {tickets.map((ticket) => {
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
    </section>
  );
}
