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

  const params = new URLSearchParams();
  params.set("set_filter", "1");
  params.append("f[]", "status_id");
  params.set("op[status_id]", "o");
  params.append("f[]", "assigned_to_id");
  params.set("op[assigned_to_id]", "=");
  params.append("v[assigned_to_id][]", String(userId));

  return `${baseUrl.replace(/\/+$/, "")}/issues?${params.toString()}`;
}
