import type { Group } from '../model';

export function GroupVisual({
  group,
  small = false,
}: {
  group: Group;
  small?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`group-symbol${small ? ' small' : ''}${group.imageDataUrl ? ' has-image' : ''}`}
      style={{ background: group.color }}
    >
      {group.imageDataUrl ? (
        // The picture is a local teacher-provided data URL, not a network image.
        // oxlint-disable-next-line next/no-img-element
        <img src={group.imageDataUrl} alt="" />
      ) : group.symbol}
    </span>
  );
}
