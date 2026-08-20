export type Ticket = {
  id: number;
  subject: string;
  status: string;
  priority: string;
  project: string;
  projectId: number;
  tracker: string;
  assignee?: string;
  assigneeId?: number;
  createdAt?: string;
  updatedAt: string;
  url: string;
};

export function buildTicketUrl(baseUrl: string, ticketId: number): string {
  if (!Number.isInteger(ticketId) || ticketId <= 0) {
    throw new Error("Ticket ID must be positive");
  }

  return `${baseUrl.replace(/\/+$/, "")}/issues/${ticketId}`;
}

export function buildUserOpenTicketsUrl(baseUrl: string, userId: number): string {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("User ID must be positive");
  }

  return `${baseUrl.replace(/\/+$/, "")}/issues?status_id=open&assigned_to_id=${userId}`;
}
