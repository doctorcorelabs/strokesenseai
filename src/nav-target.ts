// One-shot in-memory navigation target for the hub group sections.
//
// Footer group links point at sections on the Home page. When Home is not
// rendered yet, the link records the target section id here; Home reads it
// exactly once on mount and scrolls to the section. The value lives only in
// this module's memory: nothing is written to browser storage, and it is
// cleared as soon as it is consumed or replaced.

let pendingGroupId: string | null = null;

/** Record the hub section id a navigation wants to land on. */
export function setPendingGroup(groupId: string): void {
  pendingGroupId = groupId;
}

/** Read and clear the pending hub section id, if any. */
export function takePendingGroup(): string | null {
  const groupId = pendingGroupId;
  pendingGroupId = null;
  return groupId;
}
