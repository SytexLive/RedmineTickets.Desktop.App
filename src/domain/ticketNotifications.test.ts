import { describe, expect, it } from "vitest";
import { applyTicketRefresh, markTicketRead } from "./ticketNotifications";

describe("ticket notification state", () => {
  it("uses the first successful fetch as a baseline without unread tickets", () => {
    const result = applyTicketRefresh(
      { knownTicketIds: [], unreadTicketIds: [] },
      [1, 2],
      false
    );

    expect(result.state).toEqual({ knownTicketIds: [1, 2], unreadTicketIds: [] });
    expect(result.newTicketIds).toEqual([]);
    expect(result.initialized).toBe(true);
  });

  it("keeps previously unread tickets during first baseline when they still exist", () => {
    const result = applyTicketRefresh(
      { knownTicketIds: [], unreadTicketIds: [7, 8] },
      [7, 9],
      false
    );

    expect(result.state).toEqual({ knownTicketIds: [7, 9], unreadTicketIds: [7] });
    expect(result.newTicketIds).toEqual([]);
  });

  it("preserves previously known ticket ids during the first baseline", () => {
    const result = applyTicketRefresh(
      { knownTicketIds: [3, 7], unreadTicketIds: [] },
      [7, 9],
      false
    );

    expect(result.state).toEqual({ knownTicketIds: [3, 7, 9], unreadTicketIds: [] });
    expect(result.newTicketIds).toEqual([]);
  });

  it("marks only later unseen ticket ids as new and unread", () => {
    const result = applyTicketRefresh(
      { knownTicketIds: [1, 2], unreadTicketIds: [] },
      [2, 3, 4],
      true
    );

    expect(result.state).toEqual({ knownTicketIds: [1, 2, 3, 4], unreadTicketIds: [3, 4] });
    expect(result.newTicketIds).toEqual([3, 4]);
  });

  it("removes a clicked ticket from unread state", () => {
    expect(markTicketRead({ knownTicketIds: [1, 2], unreadTicketIds: [1, 2] }, 1)).toEqual({
      knownTicketIds: [1, 2],
      unreadTicketIds: [2]
    });
  });
});
