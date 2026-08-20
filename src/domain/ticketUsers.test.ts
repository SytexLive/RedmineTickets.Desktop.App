import { describe, expect, it } from "vitest";
import type { Ticket } from "./ticket";
import { summarizeOpenTicketsByAssignee } from "./ticketUsers";

function ticket(overrides: Partial<Ticket>): Ticket {
  return {
    id: 1,
    subject: "Ticket",
    status: "New",
    priority: "Normal",
    project: "Desktop",
    projectId: 12,
    tracker: "Bug",
    updatedAt: "2026-08-10T08:00:00Z",
    url: "https://redmine.example.com/issues/1",
    ...overrides
  };
}

describe("summarizeOpenTicketsByAssignee", () => {
  it("counts open tickets by assignee and sorts highest count first", () => {
    const summary = summarizeOpenTicketsByAssignee([
      ticket({ id: 1, assignee: "Mina Meyer", assigneeId: 7 }),
      ticket({ id: 2, assignee: "Alex Adler", assigneeId: 4 }),
      ticket({ id: 3, assignee: "Mina Meyer", assigneeId: 7 }),
      ticket({ id: 4, assignee: "Zoe Zimmer", assigneeId: 9 }),
      ticket({ id: 5, assignee: "Mina Meyer", assigneeId: 7 })
    ]);

    expect(summary).toEqual([
      { assignee: "Mina Meyer", assigneeId: 7, openTicketCount: 3 },
      { assignee: "Alex Adler", assigneeId: 4, openTicketCount: 1 },
      { assignee: "Zoe Zimmer", assigneeId: 9, openTicketCount: 1 }
    ]);
  });

  it("groups tickets by assignee ID when the same display name appears more than once", () => {
    const summary = summarizeOpenTicketsByAssignee([
      ticket({ id: 1, assignee: "Alex Adler", assigneeId: 4 }),
      ticket({ id: 2, assignee: "Alex Adler", assigneeId: 7 }),
      ticket({ id: 3, assignee: "Alex Adler", assigneeId: 4 })
    ]);

    expect(summary).toEqual([
      { assignee: "Alex Adler", assigneeId: 4, openTicketCount: 2 },
      { assignee: "Alex Adler", assigneeId: 7, openTicketCount: 1 }
    ]);
  });

  it("groups missing assignees under the localized unassigned label", () => {
    const summary = summarizeOpenTicketsByAssignee(
      [
        ticket({ id: 1, assignee: undefined }),
        ticket({ id: 2, assignee: "   " }),
        ticket({ id: 3, assignee: "Alex Adler" })
      ],
      "Nicht zugewiesen"
    );

    expect(summary).toEqual([
      { assignee: "Nicht zugewiesen", assigneeId: undefined, openTicketCount: 2 },
      { assignee: "Alex Adler", assigneeId: undefined, openTicketCount: 1 }
    ]);
  });
});
