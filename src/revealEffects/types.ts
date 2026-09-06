import type { ComponentType } from 'react';

// Effects own their visuals and timing. Screens only ask to play/stop a reveal.
export type RevealEffect = {
  id: string;
  name: string;
  description: string;
  durationMs: number;
  Stage: ComponentType;
  Cover: ComponentType;
};

export type RevealPlayback = { effect: RevealEffect; sequence: number };
