export function buildReorderUpdates(orderedIds: string[]): Array<{ id: string; sortOrder: number }> {
  return orderedIds.map((id, index) => ({ id, sortOrder: index + 1 }));
}
