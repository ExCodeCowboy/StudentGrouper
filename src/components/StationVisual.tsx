import {
  Apple,
  Blocks,
  BookOpen,
  Calculator,
  FlaskConical,
  Footprints,
  Hand,
  Headphones,
  Laptop,
  Library,
  Music,
  Palette,
  PencilLine,
  Puzzle,
  Scissors,
  Shapes,
  Sprout,
  UserRound,
  UsersRound,
  WholeWord,
} from 'lucide-react';
import type { PlannedStation, StationIconKey } from '../model';

const icons: Record<StationIconKey, typeof BookOpen> = {
  teacher: UserRound,
  reading: BookOpen,
  writing: PencilLine,
  math: Calculator,
  computer: Laptop,
  art: Palette,
  listening: Headphones,
  'word-work': WholeWord,
  independent: Shapes,
  partners: UsersRound,
  science: FlaskConical,
  music: Music,
  puzzles: Puzzle,
  blocks: Blocks,
  cutting: Scissors,
  movement: Footprints,
  library: Library,
  'fine-motor': Hand,
  nature: Sprout,
  snack: Apple,
};

export function StationVisual({
  station,
  compact = false,
}: {
  station: PlannedStation;
  compact?: boolean;
}) {
  const Icon = icons[station.iconKey] ?? Shapes;
  return (
    <span className={`station-visual${compact ? ' compact' : ''}`}>
      <span className="station-picture" aria-hidden="true">
        {station.imageDataUrl ? (
          // The picture is a local teacher-provided data URL, not a network image.
          // oxlint-disable-next-line next/no-img-element
          <img src={station.imageDataUrl} alt="" />
        ) : (
          <Icon />
        )}
      </span>
      <span className="station-name">{station.activityName || 'New activity'}</span>
    </span>
  );
}
