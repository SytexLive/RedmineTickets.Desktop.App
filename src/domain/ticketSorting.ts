import type { Ticket } from "./ticket";

export type TicketSortOption =
  | "updated-desc"
  | "created-desc"
  | "priority-desc"
  | "project-asc"
  | "id-desc"
  | "id-asc";

const priorityWeights: Record<string, number> = {
  sofort: 5,
  immediate: 5,
  "sehr hoch": 4,
  urgent: 4,
  hoch: 3,
  high: 3,
  normal: 2,
  niedrig: 1,
  low: 1
};

function dateValue(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const parsedDate = Date.parse(value);
  return Number.isNaN(parsedDate) ? 0 : parsedDate;
}

function priorityValue(priority: string): number {
  return priorityWeights[priority.trim().toLowerCase()] ?? 0;
}

function compareByIdDesc(left: Ticket, right: Ticket): number {
  return right.id - left.id;
}

function compareByProjectAsc(left: Ticket, right: Ticket): number {
  return left.project.localeCompare(right.project, undefined, {
    sensitivity: "base"
  });
}

export function sortTickets(tickets: Ticket[], sortOption: TicketSortOption): Ticket[] {
  return [...tickets].sort((left, right) => {
    if (sortOption === "updated-desc") {
      return dateValue(right.updatedAt) - dateValue(left.updatedAt) || compareByIdDesc(left, right);
    }

    if (sortOption === "created-desc") {
      return dateValue(right.createdAt) - dateValue(left.createdAt) || compareByIdDesc(left, right);
    }

    if (sortOption === "priority-desc") {
      return priorityValue(right.priority) - priorityValue(left.priority) || compareByIdDesc(left, right);
    }

    if (sortOption === "project-asc") {
      return compareByProjectAsc(left, right) || compareByIdDesc(left, right);
    }

    if (sortOption === "id-asc") {
      return left.id - right.id;
    }

    return compareByIdDesc(left, right);
  });
}
