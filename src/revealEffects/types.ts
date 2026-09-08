import type { ComponentType } from 'react';
import type { RevealSoundId } from './revealSounds';

// Effects own their visuals and timing. Screens only ask to play/stop a reveal.
export type RevealEffect = {
  id: string;
  name: string;
  description: string;
  durationMs: number;
  sound?: RevealSoundId;
  Stage: ComponentType;
  Cover: ComponentType;
};

export type RevealPlayback = { effect: RevealEffect; sequence: number };
