import revealSoundVersions from './revealSoundVersions.json';

/** Bundled CC0 game-audio clips; provenance ships beside the WAV files. */
export type RevealSoundId = 'balloons' | 'zipper' | 'dragon' | 'cat' | 'moon' | 'black-hole' | 'fairy' | 'wave' | 'confetti';
export const REVEAL_SOUND_SAMPLE_RATE = 22050;

type SoundCue = { at: number; duration: number; description: string };
type SoundProfile = { asset: string; durationMs: number; description: string; sourceIds: readonly string[]; cues: readonly SoundCue[] };
const asset = (id: RevealSoundId) => `${import.meta.env?.BASE_URL ?? '/'}sounds/reveals/${id}.wav?v=${revealSoundVersions[id]}`;

/** Cue positions use seconds from the start of the corresponding visual. */
export const REVEAL_SOUND_LIBRARY: Readonly<Record<RevealSoundId, SoundProfile>> = {
  balloons: { asset: asset('balloons'), durationMs: 2600, description: 'Three light swishes and a small recorded bell.', sourceIds: ['swishes', 'foley'], cues: [
    { at: .28, duration: 1.66, description: 'Air passes as the balloons lift' },
  ] },
  zipper: { asset: asset('zipper'), durationMs: 2200, description: 'An actual jacket zipper opens the rainbow.', sourceIds: ['zipper'], cues: [
    { at: .23, duration: 1.18, description: 'The zipper opens' },
  ] },
  dragon: { asset: asset('dragon'), durationMs: 2800, description: 'Two watery bubble hiccups.', sourceIds: ['bubbles'], cues: [
    { at: .68, duration: .37, description: 'First bubble hiccup' },
    { at: 1.28, duration: .55, description: 'Second bubble hiccup' },
  ] },
  cat: { asset: asset('cat'), durationMs: 6800, description: 'A real little mew and a soft yarn tap.', sourceIds: ['cat', 'foley'], cues: [
    { at: 2.05, duration: 1.42, description: 'The cat considers the yarn' },
    { at: 3.22, duration: .38, description: 'Paw touches the yarn' },
  ] },
  moon: { asset: asset('moon'), durationMs: 8800, description: 'A deep engine rumble at liftoff, landing tap, and flag bell.', sourceIds: ['rocket', 'foley'], cues: [
    { at: .24, duration: 2.06, description: 'Liftoff' },
    { at: 5.85, duration: .40, description: 'Landing feet touch down' },
    { at: 6.88, duration: 1.30, description: 'The flag is planted' },
  ] },
  'black-hole': { asset: asset('black-hole'), durationMs: 2500, description: 'An atmospheric space effect from the game krank.', sourceIds: ['magic'], cues: [
    { at: .12, duration: 2.20, description: 'The portal gathers the covers' },
  ] },
  fairy: { asset: asset('fairy'), durationMs: 3200, description: 'A little character giggle, magic accent, and light swishes.', sourceIds: ['magic', 'swishes', 'giggle'], cues: [
    { at: .30, duration: 1.88, description: 'Fairy arrival and wand accent' },
    { at: 1.05, duration: 1.73, description: 'A giggle while the fairy pauses and flies away' },
    { at: 2.50, duration: .21, description: 'Fairy departure' },
  ] },
  wave: { asset: asset('wave'), durationMs: 2600, description: 'A short recording of water washing past.', sourceIds: ['water'], cues: [
    { at: .30, duration: 1.75, description: 'Water swells and recedes' },
  ] },
  confetti: { asset: asset('confetti'), durationMs: 3800, description: 'A short snare roll, then a trumpet ta-da as the covers open.', sourceIds: ['drumroll', 'fanfare'], cues: [
    { at: .10, duration: .90, description: 'A drum roll holds the surprise' },
    { at: 1.05, duration: 2.43, description: 'Ta-da as the confetti bursts' },
  ] },
};
