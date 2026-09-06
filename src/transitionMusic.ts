import { transitionMelodies } from './transitionMelodies';

// These recordings were supplied by the project owner, who confirmed Suno
// commercial-use rights. See docs/TRANSITION_MUSIC.md for source filenames.
export const richTransitionMusic = [
  { id: 'rich-bells', name: 'Bells', description: 'A rich bell transition song.', asset: 'music/transitions/bells.mp3', durationSeconds: 120 },
  { id: 'rich-oboe', name: 'Oboe', description: 'A rich oboe transition song.', asset: 'music/transitions/oboe.mp3', durationSeconds: 119 },
  { id: 'rich-strings', name: 'Strings', description: 'A rich string transition song.', asset: 'music/transitions/strings.mp3', durationSeconds: 119 },
  { id: 'rich-guitar', name: 'Guitar', description: 'A rich guitar transition song.', asset: 'music/transitions/guitar.mp3', durationSeconds: 130 },
  { id: 'rich-koto', name: 'Koto', description: 'A rich koto transition song.', asset: 'music/transitions/koto.mp3', durationSeconds: 129 },
] as const;

export const transitionMusic = [
  ...richTransitionMusic.map((track) => ({ ...track, kind: 'rich' as const })),
  ...transitionMelodies.map((tune) => ({ id: tune.id, name: `${tune.name} (minimal)`, description: tune.description, kind: 'minimal' as const })),
];
export type TransitionMusicId = typeof transitionMusic[number]['id'];
export const transitionLengths = [30, 45, 60, 90, 120] as const;
export type TransitionLength = typeof transitionLengths[number];
export type RichTransitionTrack = typeof richTransitionMusic[number];

export function isTransitionMusicId(value: unknown): value is TransitionMusicId {
  return transitionMusic.some((track) => track.id === value);
}

export function getTransitionMusic(id: TransitionMusicId) {
  return transitionMusic.find((track) => track.id === id) ?? transitionMusic[richTransitionMusic.length];
}

// Metadata is used before decoding. The playing countdown uses AudioBuffer's
// actual duration, including the decoder's treatment of encoder delay/padding.
export function transitionMusicSeconds(id: TransitionMusicId, length: TransitionLength): number {
  const track = getTransitionMusic(id);
  return track.kind === 'rich' ? Math.min(length, track.durationSeconds) : length;
}

export function transitionRecordingUrl(track: RichTransitionTrack, basePath = import.meta.env?.BASE_URL ?? '/') {
  return `${basePath.replace(/\/?$/, '/')}${track.asset}`;
}
