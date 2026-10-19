export type ModalDragOffset = { x: number; y: number };

/** Keep a centered dialog on screen after a title-bar drag. */
export function nextModalDragOffset(input: {
  originX: number;
  originY: number;
  startX: number;
  startY: number;
  clientX: number;
  clientY: number;
  dialogWidth: number;
  dialogHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  margin?: number;
}): ModalDragOffset {
  const margin = input.margin ?? 12;
  const rawX = input.originX + input.clientX - input.startX;
  const rawY = input.originY + input.clientY - input.startY;
  const baseLeft = (input.viewportWidth - input.dialogWidth) / 2;
  const baseTop = (input.viewportHeight - input.dialogHeight) / 2;
  const minLeft = Math.min(margin, Math.max(0, input.viewportWidth - margin - 48));
  const maxLeft = Math.max(minLeft, input.viewportWidth - input.dialogWidth - margin);
  const minTop = Math.min(margin, Math.max(0, input.viewportHeight - margin - 48));
  const maxTop = Math.max(minTop, input.viewportHeight - input.dialogHeight - margin);
  const left = clamp(baseLeft + rawX, minLeft, maxLeft);
  const top = clamp(baseTop + rawY, minTop, maxTop);
  return { x: left - baseLeft, y: top - baseTop };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
