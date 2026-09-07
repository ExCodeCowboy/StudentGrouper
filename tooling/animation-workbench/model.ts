/** Pose channels offset the baseline; the optional source-time channel retimes it. */
export const CHANNELS = [
  { id: 'motion.time', label: 'Source time', group: 'Motion', min: 0, max: 6.8, step: 1 / 30, unit: 's' },
  { id: 'body.x', label: 'Horizontal', group: 'Body', min: -120, max: 120, step: 1, unit: 'px' },
  { id: 'body.y', label: 'Vertical', group: 'Body', min: -60, max: 60, step: 1, unit: 'px' },
  { id: 'pelvis.x', label: 'Horizontal', group: 'Pelvis', min: -35, max: 35, step: 1, unit: 'px' },
  { id: 'pelvis.y', label: 'Vertical', group: 'Pelvis', min: -30, max: 30, step: 1, unit: 'px' },
  { id: 'pelvis.angle', label: 'Rotation', group: 'Pelvis', min: -20, max: 20, step: 1, unit: '°' },
  { id: 'chest.x', label: 'Horizontal', group: 'Chest', min: -35, max: 35, step: 1, unit: 'px' },
  { id: 'chest.y', label: 'Vertical', group: 'Chest', min: -30, max: 30, step: 1, unit: 'px' },
  { id: 'chest.angle', label: 'Rotation', group: 'Chest', min: -25, max: 25, step: 1, unit: '°' },
  { id: 'lumbar.y', label: 'Vertical', group: 'Spine', min: -25, max: 25, step: 1, unit: 'px' },
  { id: 'lumbar.angle', label: 'Rotation', group: 'Spine', min: -20, max: 20, step: 1, unit: '°' },
  { id: 'neck.angle', label: 'Rotation', group: 'Neck', min: -35, max: 35, step: 1, unit: '°' },
  { id: 'head.angle', label: 'Rotation', group: 'Head', min: -40, max: 40, step: 1, unit: '°' },
  { id: 'tail.angle', label: 'Rotation', group: 'Tail', min: -35, max: 35, step: 1, unit: '°' },
  { id: 'tail.curl', label: 'Curl', group: 'Tail', min: -40, max: 40, step: 1, unit: 'px' },
  { id: 'attention', label: 'Attention', group: 'Expression', min: -1, max: 1, step: .05, unit: '' },
  { id: 'nearEar', label: 'Near ear', group: 'Expression', min: -35, max: 35, step: 1, unit: '°' },
  { id: 'farEar', label: 'Far ear', group: 'Expression', min: -35, max: 35, step: 1, unit: '°' },
  { id: 'paw.near-front.x', label: 'Horizontal', group: 'Near front paw', min: -90, max: 90, step: 1, unit: 'px' },
  { id: 'paw.near-front.y', label: 'Vertical', group: 'Near front paw', min: -70, max: 70, step: 1, unit: 'px' },
  { id: 'paw.far-front.x', label: 'Horizontal', group: 'Far front paw', min: -90, max: 90, step: 1, unit: 'px' },
  { id: 'paw.far-front.y', label: 'Vertical', group: 'Far front paw', min: -70, max: 70, step: 1, unit: 'px' },
  { id: 'paw.near-hind.x', label: 'Horizontal', group: 'Near hind paw', min: -90, max: 90, step: 1, unit: 'px' },
  { id: 'paw.near-hind.y', label: 'Vertical', group: 'Near hind paw', min: -70, max: 70, step: 1, unit: 'px' },
  { id: 'paw.far-hind.x', label: 'Horizontal', group: 'Far hind paw', min: -90, max: 90, step: 1, unit: 'px' },
  { id: 'paw.far-hind.y', label: 'Vertical', group: 'Far hind paw', min: -70, max: 70, step: 1, unit: 'px' },
] as const;

export type ChannelId = typeof CHANNELS[number]['id'];
export type Easing = 'smooth' | 'linear' | 'hold';
export type Keyframe = { id: string; time: number; value: number; easing: Easing };
export type ClipDocument = {
  version: 1;
  name: string;
  duration: number;
  tracks: Partial<Record<ChannelId, Keyframe[]>>;
};

export const KEY_TIME_TOLERANCE = 1 / 120;
const MAX_JSON_LENGTH = 1_000_000;
const MAX_TRACK_KEYS = 512;
const MAX_TOTAL_KEYS = 4096;
const EASINGS: readonly string[] = ['smooth', 'linear', 'hold'];
const CHANNEL_MAP = new Map<string, typeof CHANNELS[number]>(CHANNELS.map(channel => [channel.id, channel]));

function finite(value: unknown, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} must be a finite number.`);
}

function validName(name: unknown): asserts name is string {
  if (typeof name !== 'string' || !name.trim() || name.length > 120 || Array.from(name).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) {
    throw new Error('Clip name must contain 1–120 characters without control characters.');
  }
}

function validDuration(duration: unknown): asserts duration is number {
  finite(duration, 'Clip duration');
  if (duration <= 0 || duration > 120) throw new Error('Clip duration must be greater than zero and at most 120 seconds.');
}

function validEasing(easing: unknown): asserts easing is Easing {
  if (typeof easing !== 'string' || !EASINGS.includes(easing)) throw new Error('Key easing must be smooth, linear, or hold.');
}

function channelMetadata(channel: ChannelId) {
  const metadata = CHANNEL_MAP.get(channel);
  if (!metadata) throw new Error(`Unknown animation channel: ${String(channel)}.`);
  return metadata;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function createClip(name = 'Cat acting study', duration = 6.8): ClipDocument {
  validName(name);
  validDuration(duration);
  return { version: 1, name, duration, tracks: {} };
}

/** Keys are sorted by the edit/import helpers. Easing belongs to the outgoing key. */
export function sampleTrack(keys: readonly Keyframe[], time: number): number {
  finite(time, 'Sample time');
  if (!keys.length) return 0;
  if (time <= keys[0].time) return keys[0].value;
  for (let i = 1; i < keys.length; i++) {
    const right = keys[i];
    if (time < right.time) {
      const left = keys[i - 1];
      const progress = (time - left.time) / (right.time - left.time);
      const amount = left.easing === 'hold' ? 0 : left.easing === 'linear' ? progress : progress * progress * (3 - 2 * progress);
      return left.value + (right.value - left.value) * amount;
    }
  }
  return keys[keys.length - 1].value;
}

export function sampleChannel(clip: ClipDocument, channel: ChannelId, time: number): number {
  channelMetadata(channel);
  finite(time, 'Sample time');
  const keys = clip.tracks[channel] ?? [];
  if (channel === 'motion.time' && !keys.length) return clamp(time, 0, clip.duration);
  return sampleTrack(keys, time);
}

function nextKeyId(clip: ClipDocument): string {
  const ids = new Set(Object.values(clip.tracks).flatMap(keys => keys.map(key => key.id)));
  let index = 1;
  while (ids.has(`k${index}`)) index++;
  return `k${index}`;
}

function editValues(clip: ClipDocument, channel: ChannelId, time: number, value: number) {
  const metadata = channelMetadata(channel);
  finite(time, 'Key time');
  finite(value, 'Key value');
  return { time: clamp(time, 0, clip.duration), value: clamp(value, metadata.min, metadata.max) };
}

function withTrack(clip: ClipDocument, channel: ChannelId, keys: Keyframe[]): ClipDocument {
  if (keys.length > MAX_TRACK_KEYS) throw new Error(`A channel can contain at most ${MAX_TRACK_KEYS} keys.`);
  const tracks = { ...clip.tracks };
  if (keys.length) tracks[channel] = [...keys].sort((a, b) => a.time - b.time);
  else delete tracks[channel];
  if (Object.values(tracks).reduce((total, track) => total + track.length, 0) > MAX_TOTAL_KEYS) {
    throw new Error(`A clip can contain at most ${MAX_TOTAL_KEYS} keys.`);
  }
  return { ...clip, tracks };
}

/** A nearby key is replaced, keeping its identity and easing unless explicitly changed. */
export function setKey(clip: ClipDocument, channel: ChannelId, time: number, value: number, easing?: Easing): ClipDocument {
  const edit = editValues(clip, channel, time, value);
  if (easing !== undefined) validEasing(easing);
  const keys = clip.tracks[channel] ?? [];
  const nearby = keys.filter(key => Math.abs(key.time - edit.time) <= KEY_TIME_TOLERANCE)
    .sort((a, b) => Math.abs(a.time - edit.time) - Math.abs(b.time - edit.time))[0];
  const next: Keyframe = { id: nearby?.id ?? nextKeyId(clip), ...edit, easing: easing ?? nearby?.easing ?? 'smooth' };
  return withTrack(clip, channel, [...keys.filter(key => Math.abs(key.time - edit.time) > KEY_TIME_TOLERANCE), next]);
}

/** Dragging onto another key merges it into the dragged key, whose identity is retained. */
export function moveKey(clip: ClipDocument, channel: ChannelId, keyId: string, time: number, value?: number): ClipDocument {
  channelMetadata(channel);
  finite(time, 'Key time');
  if (value !== undefined) finite(value, 'Key value');
  const keys = clip.tracks[channel] ?? [];
  const key = keys.find(candidate => candidate.id === keyId);
  if (!key) return clip;
  const edit = editValues(clip, channel, time, value ?? key.value);
  return withTrack(clip, channel, [
    ...keys.filter(candidate => candidate.id !== keyId && Math.abs(candidate.time - edit.time) > KEY_TIME_TOLERANCE),
    { ...key, ...edit },
  ]);
}

export function removeKey(clip: ClipDocument, channel: ChannelId, keyId: string): ClipDocument {
  channelMetadata(channel);
  const keys = clip.tracks[channel] ?? [];
  if (!keys.some(key => key.id === keyId)) return clip;
  return withTrack(clip, channel, keys.filter(key => key.id !== keyId));
}

export function setKeyEasing(clip: ClipDocument, channel: ChannelId, keyId: string, easing: Easing): ClipDocument {
  channelMetadata(channel);
  validEasing(easing);
  const keys = clip.tracks[channel] ?? [];
  if (!keys.some(key => key.id === keyId)) return clip;
  return withTrack(clip, channel, keys.map(key => key.id === keyId ? { ...key, easing } : key));
}

/** Freeze the complete evaluated pose, then catch up toward the next surviving key. */
export function holdPose(clip: ClipDocument, start: number, length = 4 / 30): ClipDocument {
  finite(start, 'Hold start');
  finite(length, 'Hold length');
  if (length <= 0) throw new Error('Hold length must be greater than zero.');
  const from = clamp(start, 0, clip.duration);
  const to = Math.min(clip.duration, from + length);
  if (to - from <= KEY_TIME_TOLERANCE) return clip;
  let edited = clip;
  if (!clip.tracks['motion.time']?.length) {
    edited = setKey(edited, 'motion.time', 0, 0, 'linear');
    edited = setKey(edited, 'motion.time', clip.duration, clip.duration, 'linear');
  }
  for (const channel of CHANNELS) {
    if (channel.id !== 'motion.time' && !clip.tracks[channel.id]?.length) continue;
    const value = sampleChannel(clip, channel.id, from);
    const surviving = (edited.tracks[channel.id] ?? []).filter(key => key.time <= from || key.time >= to);
    edited = withTrack(edited, channel.id, surviving);
    edited = setKey(edited, channel.id, from, value, 'hold');
    edited = setKey(edited, channel.id, to, value, 'linear');
  }
  return edited;
}

export function cloneClip(clip: ClipDocument): ClipDocument {
  return { ...clip, tracks: Object.fromEntries(Object.entries(clip.tracks).map(([channel, keys]) => [channel, keys.map(key => ({ ...key }))])) };
}

function record(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
}

function exactFields(value: Record<string, unknown>, fields: readonly string[], label: string) {
  if (Object.keys(value).length !== fields.length || fields.some(field => !Object.hasOwn(value, field))) {
    throw new Error(`${label} must contain only ${fields.join(', ')}.`);
  }
}

/** Validate imports before they can affect a pose or be saved as the local working clip. */
export function parseClip(json: string): ClipDocument {
  if (typeof json !== 'string' || json.length > MAX_JSON_LENGTH) throw new Error('Clip JSON must be text shorter than 1 MB.');
  let input: unknown;
  try { input = JSON.parse(json); } catch { throw new Error('The clip file is not valid JSON.'); }
  record(input, 'Clip');
  exactFields(input, ['version', 'name', 'duration', 'tracks'], 'Clip');
  if (input.version !== 1) throw new Error('Unsupported clip version. This editor reads version 1.');
  validName(input.name);
  validDuration(input.duration);
  record(input.tracks, 'Clip tracks');
  const clip = createClip(input.name, input.duration);
  const usedIds = new Set<string>();
  let totalKeys = 0;
  for (const [channel, candidate] of Object.entries(input.tracks)) {
    const metadata = CHANNEL_MAP.get(channel);
    if (!metadata) throw new Error(`Unknown animation channel: ${channel}.`);
    if (!Array.isArray(candidate) || candidate.length > MAX_TRACK_KEYS) throw new Error(`${channel} must be an array of at most ${MAX_TRACK_KEYS} keys.`);
    totalKeys += candidate.length;
    if (totalKeys > MAX_TOTAL_KEYS) throw new Error(`A clip can contain at most ${MAX_TOTAL_KEYS} keys.`);
    const keys: Keyframe[] = candidate.map((entry: unknown) => {
      record(entry, `${channel} key`);
      exactFields(entry, ['id', 'time', 'value', 'easing'], `${channel} key`);
      if (typeof entry.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(entry.id) || usedIds.has(entry.id)) {
        throw new Error('Key IDs must be unique and contain 1–64 letters, digits, hyphens, or underscores.');
      }
      usedIds.add(entry.id);
      finite(entry.time, `${channel} key time`);
      finite(entry.value, `${channel} key value`);
      validEasing(entry.easing);
      if (entry.time < 0 || entry.time > clip.duration) throw new Error(`${channel} key time is outside the clip.`);
      if (entry.value < metadata.min || entry.value > metadata.max) throw new Error(`${channel} value must be between ${metadata.min} and ${metadata.max}.`);
      return { id: entry.id, time: entry.time, value: entry.value, easing: entry.easing };
    }).sort((a, b) => a.time - b.time);
    if (keys.some((key, index) => index > 0 && key.time === keys[index - 1].time)) throw new Error(`${channel} has duplicate key times.`);
    if (keys.length) clip.tracks[metadata.id] = keys;
  }
  return clip;
}

/** Export the same validated, normalized format that the importer accepts. */
export function serializeClip(clip: ClipDocument): string {
  return JSON.stringify(parseClip(JSON.stringify(clip)), null, 2);
}
