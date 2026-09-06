type Chord = 'I' | 'ii' | 'IV' | 'V' | 'vi';
type ScoreNote = { pitch: number; beats: number; chord: Chord };
type Phrase = readonly ScoreNote[];
type Voice = 'marimba' | 'pluck' | 'bell' | 'flute' | 'bass';

const note = (chord: Chord) => (pitch: number, beats = 1): ScoreNote => ({ pitch, beats, chord });
const tonic = note('I');
const subdominant = note('IV');
const dominant = note('V');
const supertonic = note('ii');
const submediant = note('vi');

// Melody transcriptions from the public-domain scores cited in
// docs/TRANSITION_MUSIC.md. Harmonies are our own simple, consonant arrangements.
// Durations preserve the tunes' rhythm; semitones are relative to each key's tonic.
const twinkleA: Phrase = [
  tonic(0), tonic(0), tonic(7), tonic(7), subdominant(9), subdominant(9), tonic(7, 2),
  subdominant(5), subdominant(5), tonic(4), tonic(4), dominant(2), dominant(2), tonic(0, 2),
];
const twinkleB: Phrase = [
  tonic(7), tonic(7), subdominant(5), subdominant(5), tonic(4), tonic(4), dominant(2, 2),
  tonic(7), tonic(7), subdominant(5), subdominant(5), tonic(4), tonic(4), dominant(2, 2),
];
const joyA: Phrase = [
  tonic(4), tonic(4), subdominant(5), tonic(7), tonic(7), subdominant(5), tonic(4), dominant(2),
  tonic(0), tonic(0), dominant(2), tonic(4), tonic(4, 1.5), dominant(2, .5), dominant(2, 2),
];
const joyB: Phrase = [
  tonic(4), tonic(4), subdominant(5), tonic(7), tonic(7), subdominant(5), tonic(4), dominant(2),
  tonic(0), tonic(0), dominant(2), tonic(4), dominant(2, 1.5), tonic(0, .5), tonic(0, 2),
];
const joyC: Phrase = [
  dominant(2), dominant(2), tonic(4), tonic(0),
  dominant(2), tonic(4, .5), subdominant(5, .5), tonic(4), tonic(0),
  dominant(2), tonic(4, .5), subdominant(5, .5), tonic(4), dominant(2),
  tonic(0), dominant(2), dominant(-5, 2),
];
const moonA: Phrase = [
  tonic(0), tonic(0), tonic(0), dominant(2), tonic(4, 2), dominant(2, 2),
  tonic(0), tonic(4), dominant(2), dominant(2), tonic(0, 4),
];
const moonB: Phrase = [
  supertonic(2), supertonic(2), supertonic(2), supertonic(2),
  submediant(-3, 2), submediant(-3), submediant(-3),
  supertonic(2), tonic(0), dominant(-1), submediant(-3), dominant(-5, 4),
];
// Lucy Crane's historical 3/8 melody, rather than a modern film/pop arrangement.
// Here one beat represents an eighth note, retaining its lilting three-beat bars.
const lavender: Phrase = [
  tonic(0), tonic(7), tonic(7), tonic(7), subdominant(5, .5), tonic(4, .5), dominant(2, .5), tonic(0, .5),
  tonic(0), subdominant(9), subdominant(9), subdominant(9, 3),
  tonic(0), tonic(7), tonic(7), tonic(7), subdominant(5, .5), tonic(4, .5), dominant(2, .5), tonic(0, .5),
  subdominant(5), tonic(4), dominant(2), tonic(0, 3),
];

// Retain the preference IDs used in earlier previews/backups.
export const transitionMelodies = [
  { id: 'sunny', name: 'Ode to Joy', description: 'Beethoven’s familiar tune on a warm, mellow marimba.', voice: 'marimba', root: 60, forms: { 30: [joyA, joyB, joyB], 45: [joyA, joyB, joyC, joyB], 60: [joyA, joyB, joyC, joyB, joyA, joyB] } },
  { id: 'tiptoe', name: 'Au clair de la lune', description: 'A gentle French folk melody on soft plucked strings.', voice: 'pluck', root: 65, forms: { 30: [moonA, moonA, moonA], 45: [moonA, moonA, moonB, moonA], 60: [moonA, moonA, moonB, moonA, moonA, moonA] } },
  { id: 'starlight', name: 'Twinkle, Twinkle, Little Star', description: 'The familiar star song with soft, rounded music-box notes.', voice: 'bell', root: 72, forms: { 30: [twinkleA, twinkleB, twinkleA], 45: [twinkleA, twinkleB, twinkleB, twinkleA], 60: [twinkleA, twinkleB, twinkleA, twinkleA, twinkleB, twinkleA] } },
  { id: 'meadow', name: 'Lavender’s Blue', description: 'An old nursery melody with a lilting flute sound.', voice: 'flute', root: 67, forms: { 30: [lavender, lavender], 45: [lavender, lavender, lavender], 60: [lavender, lavender, lavender, lavender] } },
] as const;
export type MelodyId = typeof transitionMelodies[number]['id'];
export type MelodyNote = { at: number; duration: number; midi: number; volume: number; voice: Voice; part: 'melody' | 'accompaniment' };

const chords: Record<Chord, readonly [number, number]> = {
  I: [0, 4], ii: [2, 3], IV: [5, 4], V: [7, 4], vi: [9, 3],
};

export function melodyScore(id: MelodyId, seconds: number): MelodyNote[] {
  if (!Number.isFinite(seconds) || seconds <= 0) return [];
  const tune = transitionMelodies.find((item) => item.id === id) ?? transitionMelodies[0];
  const phrases: readonly Phrase[] = tune.forms[seconds <= 30 ? 30 : seconds <= 45 ? 45 : 60];
  const totalBeats = phrases.flat().reduce((sum, item) => sum + item.beats, 0);
  const leadIn = Math.min(.08, seconds * .01);
  const tail = Math.min(.25, seconds * .02);
  // Fit complete musical phrases to the chosen window; never cut a verse in half
  // or append an unrelated chord to whatever note happened to be playing.
  const beat = (seconds - leadIn - tail) / totalBeats;
  const notes: MelodyNote[] = [];
  let elapsedBeats = 0;
  for (let phraseIndex = 0; phraseIndex < phrases.length; phraseIndex++) {
    const phrase = phrases[phraseIndex];
    for (let index = 0; index < phrase.length; index++) {
      const item = phrase[index];
      const at = leadIn + elapsedBeats * beat;
      const span = item.beats * beat;
      const last = phraseIndex === phrases.length - 1 && index === phrase.length - 1;
      const gap = last ? 0 : Math.min(index === phrase.length - 1 ? .12 : .035, span * .15);
      const duration = span - gap;
      const midi = tune.root + item.pitch;
      notes.push({ at, duration, midi, volume: .2, voice: tune.voice, part: 'melody' });
      // Quiet root/third support follows each written harmony. Both voices end
      // before the next melody note, so older chords cannot bleed into new ones.
      // Fast ornaments remain solo to keep the arrangement spacious.
      if (item.beats >= 1) {
        const [root, third] = chords[item.chord];
        let bass = tune.root - 12 + root;
        while (bass > midi - 7) bass -= 12;
        notes.push({ at, duration, midi: bass, volume: .055, voice: 'bass', part: 'accompaniment' });
        notes.push({ at, duration, midi: bass + third, volume: .035, voice: 'flute', part: 'accompaniment' });
      }
      elapsedBeats += item.beats;
    }
  }
  return notes;
}

export function renderTransitionMelody(id: MelodyId, seconds: number, sampleRate = 22050): Float32Array {
  const samples = new Float32Array(Math.ceil(seconds * sampleRate));
  for (const note of melodyScore(id, seconds)) {
    const first = Math.floor(note.at * sampleRate);
    const length = Math.ceil(note.duration * sampleRate);
    const frequency = 440 * 2 ** ((note.midi - 69) / 12);
    for (let i = 0; i < length && first + i < samples.length; i++) {
      const time = i / sampleRate;
      const phase = 2 * Math.PI * frequency * time;
      const attack = Math.min(1, time / (note.voice === 'flute' ? .035 : .018));
      const release = Math.max(0, Math.min(1, (note.duration - time) / Math.min(.16, note.duration * .3)));
      const decay = Math.exp(-time * (note.voice === 'bell' ? 1.7 : note.voice === 'pluck' ? 2.4 : note.voice === 'marimba' ? 2.8 : .8));
      // Integer harmonics stay in tune. The previous bell's 2.76x partial added
      // a metallic, inharmonic pitch even when the written notes agreed.
      const tone = Math.sin(phase)
        + (note.voice === 'bell' ? .1 * Math.sin(phase * 3) * Math.exp(-time * 5)
          : note.voice === 'marimba' ? .12 * Math.sin(phase * 4) * Math.exp(-time * 14)
            : note.voice === 'pluck' ? .14 * Math.sin(phase * 2) + .04 * Math.sin(phase * 3)
              : .06 * Math.sin(phase * 2));
      samples[first + i] += tone * note.volume * attack * release * decay;
    }
  }
  for (let i = 0; i < samples.length; i++) {
    const fade = Math.min(1, i / (sampleRate * .03), (samples.length - 1 - i) / (sampleRate * .5));
    samples[i] = Math.tanh(samples[i] * 1.4) * fade;
  }
  return samples;
}
