/**
 * A saved bot stays on the open form. The address bar changes without a Next
 * navigation, and the form keeps showing that bot until the edit query itself
 * changes (Back, or opening another bot).
 */
export function nextShownAutomationsEdit(
  edit: string | null,
  seenEdit: string | null,
  shownEdit: string | null,
): { seenEdit: string | null; shownEdit: string | null } {
  if (edit !== seenEdit) {
    return { seenEdit: edit, shownEdit: edit };
  }
  return { seenEdit, shownEdit };
}

/** Keep the unsaved form's key on the row that was just created. */
export function withCreatedFormKey<T extends { id: string; key: string }>(
  rows: readonly T[],
  createdId: string | null | undefined,
  draftKey: string | null | undefined,
): T[] {
  const id = String(createdId ?? "").trim();
  const key = String(draftKey ?? "").trim();
  if (!id || !key) {
    return rows as T[];
  }
  return rows.map((row) => (row.id === id ? { ...row, key } : row));
}

export function mergeSavedPlaybookCard<
  T extends { key: string; playbook: { id: string } | null },
>(
  cards: readonly T[],
  playbook: { id: string },
  draftKey?: string | null,
): T[] {
  const saved = playbook as T["playbook"];
  const index = cards.findIndex((item) => item.playbook?.id === playbook.id);
  if (index >= 0) {
    return cards.map((item, itemIndex) =>
      itemIndex === index ? { ...item, playbook: saved } : item,
    );
  }
  const draftIndex = cards.findIndex((item) => !item.playbook?.id);
  if (draftIndex >= 0) {
    return cards.map((item, itemIndex) =>
      itemIndex === draftIndex ? { ...item, playbook: saved } : item,
    );
  }
  const key = String(draftKey ?? "").trim() || playbook.id;
  return [{ key, playbook: saved } as T, ...cards];
}
