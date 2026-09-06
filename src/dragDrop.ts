type DragKind = 'student' | 'group' | 'station';
type Transfer = Pick<DataTransfer, 'setData' | 'getData' | 'effectAllowed'>;

export function writeDrag(transfer: Transfer, kind: DragKind, id: string) {
  transfer.effectAllowed = 'move';
  transfer.setData(`application/x-${kind}-id`, id);
  // WebKit/native pasteboards may discard custom MIME types. Keep a typed text
  // fallback so a student cannot accidentally be interpreted as a station.
  transfer.setData('text/plain', `student-grouper:${kind}:${id}`);
}

export function readDrag(
  transfer: Pick<DataTransfer, 'getData'>,
  kind: DragKind,
) {
  const custom = transfer.getData(`application/x-${kind}-id`);
  if (custom) return custom;
  const text = transfer.getData('text/plain');
  const prefix = `student-grouper:${kind}:`;
  return text.startsWith(prefix) ? text.slice(prefix.length) : '';
}
