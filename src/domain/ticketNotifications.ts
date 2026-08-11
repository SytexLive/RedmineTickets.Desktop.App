import type { TicketNotificationState } from "../api/redmine";

export type TicketRefreshResult = {
  state: TicketNotificationState;
  newTicketIds: number[];
  initialized: boolean;
};

function uniqueSorted(ids: number[]) {
  return Array.from(new Set(ids)).sort((a, b) => a - b);
}

export function applyTicketRefresh(
  previous: TicketNotificationState,
  ticketIds: number[],
  initialized: boolean
): TicketRefreshResult {
  const currentIds = uniqueSorted(ticketIds);
  const currentIdSet = new Set(currentIds);

  if (!initialized) {
    return {
      state: {
        knownTicketIds: uniqueSorted([...previous.knownTicketIds, ...currentIds]),
        unreadTicketIds: uniqueSorted(
          previous.unreadTicketIds.filter((id) => currentIdSet.has(id))
        )
      },
      newTicketIds: [],
      initialized: true
    };
  }

  const knownIdSet = new Set(previous.knownTicketIds);
  const newTicketIds = currentIds.filter((id) => !knownIdSet.has(id));

  return {
    state: {
      knownTicketIds: uniqueSorted([...previous.knownTicketIds, ...currentIds]),
      unreadTicketIds: uniqueSorted([...previous.unreadTicketIds, ...newTicketIds])
    },
    newTicketIds,
    initialized: true
  };
}

export function markTicketRead(
  previous: TicketNotificationState,
  ticketId: number
): TicketNotificationState {
  return {
    knownTicketIds: previous.knownTicketIds,
    unreadTicketIds: previous.unreadTicketIds.filter((id) => id !== ticketId)
  };
}
