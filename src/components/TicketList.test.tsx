import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { TicketList } from "./TicketList";

const styles = readFileSync(join(process.cwd(), "src", "styles.css"), "utf8");

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
            projectId: 12,
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
            projectId: 12,
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

  it("maps German Redmine priority labels to distinct priority classes", () => {
    render(
      <TicketList
        tickets={[
          {
            id: 9,
            subject: "Handle immediately",
            status: "New",
            priority: "Sofort",
            project: "Desktop",
            projectId: 12,
            tracker: "Bug",
            updatedAt: "2026-08-10T08:00:00Z",
            url: "https://redmine.example.com/issues/9"
          },
          {
            id: 10,
            subject: "Handle very high",
            status: "New",
            priority: "Sehr hoch",
            project: "Desktop",
            projectId: 12,
            tracker: "Bug",
            updatedAt: "2026-08-10T08:00:00Z",
            url: "https://redmine.example.com/issues/10"
          }
        ]}
        onOpenTicket={() => undefined}
      />
    );

    expect(screen.getByRole("button", { name: /handle immediately/i })).toHaveClass(
      "ticket-priority-immediate"
    );
    expect(screen.getByRole("button", { name: /handle very high/i })).toHaveClass(
      "ticket-priority-very-high"
    );
  });

  it("opens a ticket context menu on right click", () => {
    const onTicketContextMenu = vi.fn();

    render(
      <TicketList
        tickets={[
          {
            id: 11,
            subject: "Needs status change",
            status: "New",
            priority: "Normal",
            project: "Desktop",
            projectId: 12,
            tracker: "Bug",
            updatedAt: "2026-08-10T08:00:00Z",
            url: "https://redmine.example.com/issues/11"
          }
        ]}
        onOpenTicket={() => undefined}
        onTicketContextMenu={onTicketContextMenu}
      />
    );

    fireEvent.contextMenu(screen.getByRole("button", { name: /needs status change/i }), {
      clientX: 20,
      clientY: 30
    });

    expect(onTicketContextMenu).toHaveBeenCalledWith(
      expect.objectContaining({ id: 11 }),
      { x: 20, y: 30 }
    );
  });

  it("adds an unread class for unread ticket ids", () => {
    render(
      <TicketList
        tickets={[
          {
            id: 12,
            subject: "New assignment",
            status: "New",
            priority: "Normal",
            project: "Desktop",
            projectId: 12,
            tracker: "Bug",
            updatedAt: "2026-08-10T08:00:00Z",
            url: "https://redmine.example.com/issues/12"
          }
        ]}
        unreadTicketIds={[12]}
        onOpenTicket={() => undefined}
      />
    );

    expect(screen.getByRole("button", { name: /new assignment/i })).toHaveClass(
      "ticket-row-unread"
    );
  });

  it("sorts tickets by created date when selected", () => {
    render(
      <TicketList
        tickets={[
          {
            id: 13,
            subject: "Created earlier",
            status: "New",
            priority: "Normal",
            project: "Desktop",
            projectId: 12,
            tracker: "Bug",
            createdAt: "2026-08-09T08:00:00Z",
            updatedAt: "2026-08-12T08:00:00Z",
            url: "https://redmine.example.com/issues/13"
          },
          {
            id: 14,
            subject: "Created later",
            status: "New",
            priority: "Normal",
            project: "Desktop",
            projectId: 12,
            tracker: "Bug",
            createdAt: "2026-08-11T08:00:00Z",
            updatedAt: "2026-08-10T08:00:00Z",
            url: "https://redmine.example.com/issues/14"
          }
        ]}
        onOpenTicket={() => undefined}
      />
    );

    fireEvent.change(screen.getByLabelText("Sort by"), {
      target: { value: "created-desc" }
    });

    expect(screen.getAllByRole("button").map((row) => row.textContent)).toEqual([
      "#14DesktopNormalCreated laterBugNew",
      "#13DesktopNormalCreated earlierBugNew"
    ]);
  });

  it("keeps ticket rows from shrinking when the list overflows", () => {
    render(
      <TicketList
        tickets={Array.from({ length: 20 }, (_, index) => ({
          id: index + 1,
          subject: `Ticket ${index + 1}`,
          status: "New",
          priority: "Normal",
          project: "Desktop",
          projectId: 12,
          tracker: "Bug",
          updatedAt: "2026-08-10T08:00:00Z",
          url: `https://redmine.example.com/issues/${index + 1}`
        }))}
        onOpenTicket={() => undefined}
      />
    );

    expect(styles).toMatch(/\.ticket-row\s*{[^}]*flex-shrink:\s*0;/);
  });

  it("keeps the collapsed handle flush with the monitor edge", () => {
    expect(styles).toMatch(/html,\s*body,\s*#root\s*{[^}]*background:\s*transparent;/);
    expect(styles).toMatch(/\.collapsed-panel-handle\s*{[^}]*--collapsed-edge-width:\s*2px;/);
    expect(styles).toMatch(/\.collapsed-panel-handle\s*{[^}]*background:\s*transparent;/);
    expect(styles).toMatch(/\.collapsed-panel-handle\s*{[^}]*padding:\s*0;/);
    expect(styles).toMatch(/\.collapsed-panel-handle::before\s*{[^}]*width:\s*var\(--collapsed-edge-width\);/);
    expect(styles).not.toMatch(/\.collapsed-panel-handle\s*{[^}]*box-shadow:/);
    expect(styles).toMatch(/\.collapsed-ticket-badge\s*{[^}]*top:\s*50%;/);
    expect(styles).toMatch(/\.collapsed-ticket-badge\s*{[^}]*place-items:\s*center;/);
    expect(styles).toMatch(/\.collapsed-ticket-badge\s*{[^}]*transform:\s*translateY\(-50%\);/);
    expect(styles).toMatch(/\.app-shell-left \.collapsed-panel-handle::before\s*{[^}]*left:\s*0;/);
    expect(styles).toMatch(/\.app-shell-right \.collapsed-panel-handle::before\s*{[^}]*right:\s*0;/);
    expect(styles).toMatch(/\.app-shell-left \.collapsed-ticket-badge\s*{[^}]*left:\s*var\(--collapsed-edge-width\);/);
    expect(styles).toMatch(/\.app-shell-right \.collapsed-ticket-badge\s*{[^}]*right:\s*var\(--collapsed-edge-width\);/);
    expect(styles).toMatch(
      /\.app-shell-collapsed\.app-shell-left,\s*\.app-shell-collapsed\.app-shell-right\s*{[^}]*border-right:\s*0;[^}]*border-left:\s*0;/
    );
  });
});
