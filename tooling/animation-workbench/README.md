# Motion Desk

A local animation workbench for the Cat & yarn reveal. It uses the same `WalkingTabby`, `CatScene`, and articulated rig as the classroom app. Editing a take does not change classroom data or the published animation.

## Start

Use the repository's existing Node dependencies:

```text
npm install
npm run animation:dev
```

Open **http://127.0.0.1:5174/**. The ordinary app development server can also serve `http://127.0.0.1:5173/tooling/animation-workbench/`.

The dedicated workbench runs on port 5174. Closing its terminal stops it. No new packages, camera, microphone, remote media, or external services are needed.

## A useful first pass

1. Leave the loop set to **2.0–4.3 seconds**, the cat's acting beat. Scrub with the timeline or enter an exact playhead time.
2. In **Pose studio**, drag the coral body or paw handles. Use the inspector for head, neck, spine, tail, and ear controls. Each change creates a key at the playhead.
3. Turn on **Onion skin** and adjust its frame spacing. Blue/green ghosts precede the current pose; pink ghosts follow it. **Bones** and **Silhouette** help assess construction and readability.
4. Move timeline diamonds to change timing. Drag points in the curve to change timing and value together. Select a key to edit its time or outgoing interpolation: smooth, linear, or hold.
5. Choose **A / B compare**. A initially shows the original reveal; B shows the edited take. Both share one clock. **Capture edit as A** saves an in-memory comparison before the next revision.
6. Check **Classroom** to see the actual reveal at laptop, projector, or Full HD dimensions. The measured scene keeps its requested viewport even when its preview is scaled down.
7. Use **Contact sheet** for six evenly spaced poses from the selected playback range. Click a pose to inspect it. Export the pose or sheet as a standalone SVG for further review.

The inspector scrolls independently so the transport, timeline, and curve remain visible on a laptop. Arrow keys step by 1/30 second and Space toggles playback when focus is outside a control. Pose handles also support arrow keys; Shift moves them five drawing units. Timeline keys move one frame with arrows, ten with Shift, or fine increments with Alt. Curve keys support vertical arrows for value changes.

## Offsets and real pose holds

Most tracks are **offsets from the existing performance**. Zero retains the original pose. Distances use the rig's drawing units, not physical screen pixels; positive Y points down. The first inspector edit creates zero anchors at the beginning and end of the clip. To confine a change to the acting beat, key zero at the beginning and end of that smaller range before adding its expressive peak.

**Motion → Source time** is different: it maps the editor's time to a time in the original reveal. An absent track plays at normal speed. A flat segment freezes the original motion; a steeper segment advances it faster. New source-time keys use linear interpolation so identity anchors preserve normal playback. Source-time edits move the cat, yarn, blink, and cover together.

**Hold 4 frames** freezes the source time and all existing pose-offset tracks for four frames at the playhead. The clip stays 6.8 seconds long, and motion catches up toward the next source-time key. Inspect that next segment's slope if the catch-up feels rushed. A key's **Hold offset** interpolation freezes only that adjustment; it does not stop the original animation. **Copy pose / Paste pose** transfers the sampled source time and pose controls to another point.

The adapter limits unreachable paws and floor penetration while keeping all three limb lengths and the elbow/knee bend directions intact. A note appears when a request is constrained; the saved key keeps the requested value. Constraints preserve the rig, not artistic appeal—extreme edits still need silhouette and motion review.

## Save, exchange, and use a take

The current draft automatically saves under `student-grouper-animation-workbench-v1` in this browser's local storage. It is independent of the app's classroom storage. Port 5173 and port 5174 have separate drafts. Undo/redo history and reference A last for the current session.

**Export clip** opens the editable JSON and offers copy/download. **Import** accepts a file or pasted JSON, validates it, and can be undone. SVG exports contain original vector art, the toy silhouette, and exact sample times; they do not contain editor controls. The contact sheet is a still review artifact, not a video export.

To render an exported take in code:

```tsx
import { parseClip } from './model';
import { evaluateCat } from './catAdapter';
import { WalkingTabby } from '../../src/revealEffects/catIllustration';

const clip = parseClip(savedJson);
const sample = evaluateCat(clip, editorTime, 960);

<WalkingTabby
  time={sample.sourceTime}
  distance={sample.blocking.distance / sample.blocking.scale}
  strideOffset={sample.blocking.strideOffset}
  pose={sample.rig}
/>
```

`CatScene` also accepts the sampled `pose` and `blocking`, with `time={sample.sourceTime}`. The tooling adapter lives outside the application bundle. To promote a take into the classroom app, deliberately move its approved tracks and required evaluator into the runtime, or translate the changes into `sceneMotion.ts`; then repeat the app tests and scene review. Exporting or editing does not silently perform that promotion.

## Files and extension points

| File | Purpose |
| --- | --- |
| `model.ts` | Versioned document, channel metadata, interpolation, immutable key edits, real holds, JSON validation |
| `catAdapter.ts` | Sample source time, apply offsets to the real cat rig, constrain paws, expose handles |
| `Stage.tsx` | Pose canvas, onion skins, skeleton, draggable/keyboard handles, actual classroom preview |
| `Timeline.tsx` | Scrubbing, key dragging, curve editing, loop and playhead markers |
| `Workbench.tsx` | Playback, inspector, comparison, contact sheet, JSON/SVG exchange |
| `useClipHistory.ts` | Gesture-grouped undo/redo and isolated browser draft |
| `vite.config.ts` | Separate development/build entry point |

The first adapter is the cat. Adding another character means defining its channel metadata, evaluator, handles, and renderer; the numeric keyframe, timeline, history, and exchange code can be reused. Apollo has no editable adapter yet.

## Check and build

```text
npm run animation:test
npm run animation:check
npm run animation:build
```

Tests cover interpolation, import validation, immutable edits, collision handling, baseline fidelity, timing holds, reach constraints, fixed bone lengths, and ground clearance. UI checks should include grouped drag undo, exact key editing, A/B playback, JSON round trip, SVG export, and a narrow viewport.

The optional workbench build goes to `tooling/animation-workbench/dist/`, which is ignored. The root app build and its GitHub Pages deployment do not include the workbench. Application validation remains `npm test`, `npm run lint`, and `npm run build`.
