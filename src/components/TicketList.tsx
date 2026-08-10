import type { Ticket } from "../domain/ticket";

type TicketListProps = {
  tickets: Ticket[];
  onOpenTicket: (ticket: Ticket) => void;
};

export function TicketList({ tickets, onOpenTicket }: TicketListProps) {
  return (
    <section className="ticket-list" aria-label="Redmine tickets">
      {tickets.map((ticket) => (
        <button
          className="ticket-row"
          key={ticket.id}
          type="button"
          onClick={() => onOpenTicket(ticket)}
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
      ))}
    </section>
  );
}
