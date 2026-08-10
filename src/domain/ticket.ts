export type Ticket = {
  id: number;
  subject: string;
  status: string;
  priority: string;
  project: string;
  projectId: number;
  tracker: string;
  updatedAt: string;
  url: string;
};

export function buildTicketUrl(baseUrl: string, ticketId: number): string {
  if (!Number.isInteger(ticketId) || ticketId <= 0) {
    throw new Error("Ticket ID must be positive");
  }

  return `${baseUrl.replace(/\/+$/, "")}/issues/${ticketId}`;
}
