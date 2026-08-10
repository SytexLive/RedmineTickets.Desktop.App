import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TicketList } from "./TicketList";

describe("TicketList", () => {
  it("renders ticket subject and metadata", () => {
    render(
      <TicketList
        tickets={[
          {
            id: 7,
            subject: "Fix refresh",
            status: "New",
            priority: "Normal",
            project: "Desktop",
            tracker: "Bug",
            updatedAt: "2026-08-10T08:00:00Z",
            url: "https://redmine.example.com/issues/7"
          }
        ]}
        onOpenTicket={() => undefined}
      />
    );

    expect(screen.getByText("Fix refresh")).toBeTruthy();
    expect(screen.getByText("#7")).toBeTruthy();
  });

  it("marks high priority tickets with a priority color class", () => {
    render(
      <TicketList
        tickets={[
          {
            id: 8,
            subject: "Fix production issue",
            status: "New",
            priority: "High",
            project: "Desktop",
            tracker: "Bug",
            updatedAt: "2026-08-10T08:00:00Z",
            url: "https://redmine.example.com/issues/8"
          }
        ]}
        onOpenTicket={() => undefined}
      />
    );

    expect(screen.getByRole("button", { name: /fix production issue/i })).toHaveClass(
      "ticket-priority-high"
    );
  });
});
