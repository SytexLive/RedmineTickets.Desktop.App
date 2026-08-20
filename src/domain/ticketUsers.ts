import type { Ticket } from "./ticket";

export type TicketAssigneeSummary = {
  assignee: string;
  assigneeId?: number;
  openTicketCount: number;
};

export function summarizeOpenTicketsByAssignee(
  tickets: Ticket[],
  unassignedLabel = "Unassigned"
): TicketAssigneeSummary[] {
  const counts = new Map<string, TicketAssigneeSummary>();

  for (const ticket of tickets) {
    const assignee = ticket.assignee?.trim() || unassignedLabel;
    const key = ticket.assigneeId ? String(ticket.assigneeId) : `name:${assignee}`;
    const currentSummary = counts.get(key);

    if (currentSummary) {
      currentSummary.openTicketCount += 1;
    } else {
      counts.set(key, {
        assignee,
        assigneeId: ticket.assigneeId,
        openTicketCount: 1
      });
    }
  }

  return Array.from(counts.values()).sort((left, right) => {
    if (right.openTicketCount !== left.openTicketCount) {
      return right.openTicketCount - left.openTicketCount;
    }

    return left.assignee.localeCompare(right.assignee);
  });
}
