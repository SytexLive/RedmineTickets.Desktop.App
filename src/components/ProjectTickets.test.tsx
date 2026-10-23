import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ProjectTickets } from "./ProjectTickets";

it("filters by project ID, assignment and search, resets and opens empty project wikis", () => {
  const wiki = vi.fn();
  const tickets = [1, 2, 3].map(id => ({ id, subject: `Task ${id}`, project: "Same", projectId: id === 3 ? 2 : 1, assigneeId: id === 2 ? undefined : 9, status: "New", priority: "Normal", tracker: "Bug", updatedAt: "2026-10-20", url: `https://example.com/issues/${id}` }));
  render(<ProjectTickets tickets={tickets} projects={[{id: 1, name: "Same"}, {id: 2, name: "Same"}, {id: 4, name: "Empty"}]} myTicketIds={[1]} language="de" onOpenWiki={wiki} onOpenTicket={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Projekt"), {target: {value: "1"}});
  expect(screen.queryByRole("button", {name: "Task 3"})).toBeNull();
  fireEvent.click(screen.getByRole("button", {name: "Mir zugewiesen"}));
  expect(screen.queryByRole("button", {name: "Task 2"})).toBeNull();
  fireEvent.click(screen.getByRole("button", {name: "Nicht zugewiesen"}));
  expect(screen.getByRole("button", {name: "Task 2"})).toBeTruthy();
  fireEvent.click(screen.getByRole("button", {name: "Filter zurücksetzen"}));
  fireEvent.change(screen.getByLabelText("Tickets suchen"), {target: {value: "#3"}});
  expect(screen.getByRole("button", {name: "Task 3"})).toBeTruthy();
  expect(screen.queryByRole("button", {name: "Task 1"})).toBeNull();
  fireEvent.change(screen.getByLabelText("Projekt"), {target: {value: "4"}});
  fireEvent.click(screen.getByRole("button", {name: "Wiki öffnen"}));
  expect(wiki).toHaveBeenCalledWith(4);
});
