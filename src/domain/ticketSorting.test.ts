import { describe, expect, it } from "vitest";
import type { Ticket } from "./ticket";
import { sortTickets, type TicketSortOption } from "./ticketSorting";

function ticket(overrides: Partial<Ticket>): Ticket {
  return {
    id: 1,
    subject: "Ticket",
    status: "New",
    priority: "Normal",
    project: "Desktop",
    projectId: 12,
    tracker: "Bug",
    createdAt: "2026-08-09T08:00:00Z",
    updatedAt: "2026-08-10T08:00:00Z",
    url: "https://redmine.example.com/issues/1",
    ...overrides
  };
}

describe("sortTickets", () => {
  it("sorts tickets by newest created date first", () => {
    const tickets = [
      ticket({ id: 1, subject: "Older", createdAt: "2026-08-09T08:00:00Z" }),
      ticket({ id: 2, subject: "Newer", createdAt: "2026-08-11T08:00:00Z" }),
      ticket({ id: 3, subject: "Middle", createdAt: "2026-08-10T08:00:00Z" })
    ];

    expect(sortTickets(tickets, "created-desc").map((sortedTicket) => sortedTicket.id)).toEqual([
      2, 3, 1
    ]);
  });

  it("sorts tickets by highest Redmine priority first", () => {
    const tickets = [
      ticket({ id: 1, priority: "Normal" }),
      ticket({ id: 2, priority: "Niedrig" }),
      ticket({ id: 3, priority: "Sofort" }),
      ticket({ id: 4, priority: "Hoch" })
    ];

    expect(sortTickets(tickets, "priority-desc").map((sortedTicket) => sortedTicket.id)).toEqual([
      3, 4, 1, 2
    ]);
  });

  it("sorts tickets by customer project name", () => {
    const tickets = [
      ticket({ id: 1, project: "Zeta" }),
      ticket({ id: 2, project: "alpha" }),
      ticket({ id: 3, project: "Beta" })
    ];

    expect(sortTickets(tickets, "project-asc").map((sortedTicket) => sortedTicket.id)).toEqual([
      2, 3, 1
    ]);
  });

  it("keeps the original ticket array unchanged", () => {
    const tickets = [
      ticket({ id: 1, updatedAt: "2026-08-09T08:00:00Z" }),
      ticket({ id: 2, updatedAt: "2026-08-11T08:00:00Z" })
    ];

    sortTickets(tickets, "updated-desc");

    expect(tickets.map((unsortedTicket) => unsortedTicket.id)).toEqual([1, 2]);
  });

  it("falls back to ticket id ordering when sort values match", () => {
    const tickets = [
      ticket({ id: 9, subject: "Same date" }),
      ticket({ id: 4, subject: "Same date" })
    ];
    const option: TicketSortOption = "updated-desc";

    expect(sortTickets(tickets, option).map((sortedTicket) => sortedTicket.id)).toEqual([9, 4]);
  });
});
