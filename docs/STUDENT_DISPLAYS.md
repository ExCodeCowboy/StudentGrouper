# Student displays and team themes

## Teacher controls

- **Groups → Group themes** previews eight themes: Woodland Friends, Space Explorers, Ocean Crew, Garden Buddies, Dino Discoverers, Weather Wonders, Storybook Friends, and Busy Builders. Applying a theme replaces names, colors, symbols, and uploaded pictures for that arrangement. It preserves group IDs, memberships, locks, and schedule references. Undo restores the prior appearance.
- Each theme has twelve distinct teams and numbered extensions for larger arrangements. New groups use the arrangement’s chosen theme. Existing custom names and pictures survive Make groups. Old exports do not need a theme field.
- **Groups → Student view → Reveal all teams** reveals every team together with one click. There are no individual-team reveal controls or countdown. Hide again resets the presentation without changing groups.
- **Today → Student view → Reveal the day** uncovers the entire selected day in one click, with one effect for every team and round together. The team-by-round chart remains visible for the class to follow throughout the day. There are no per-round reveals or navigation steps. Hide again resets the whole presentation without changing the plan or completion marks.
- Student names can be hidden. When membership is the same all day, names appear once beside the team; when historical membership differs by round, each round keeps its own names. Shared stations appear for each assigned group. Missing destinations say “Check with your teacher.”
- Both student views offer Full screen, Teacher view, an effect picker, and instant reveals. Escape returns to teaching when outside browser fullscreen. Wide daily charts can be focused and scrolled with the keyboard.

The presentation model contains names and group/station visuals, with locations for rotations. It omits student levels, relationships, private arrangement names, rules, locks, and planning diagnostics. Completed rounds use saved learner/activity/location snapshots. Present-day rounds use present students in the day’s arrangement, even if the teacher selected another arrangement on the Groups page.

## Reveal effects

The menu offers Balloon lift-off, Rainbow zipper, Dragon hiccup, Black-hole whoosh, Fairy dust, Ocean wave, and Confetti party. **Surprise me!** chooses from the registry and avoids the preceding effect in that presentation. Reveals take at most 2.8 seconds, except Fairy dust (3.2 seconds), which includes a one-second hover in the middle before the fairy flies away. The selected effect is remembered on the device using a small local preference; no classroom information is stored there.

Effects use local SVG, CSS, and symbols. They play without sound, external services, image downloads, or new animation dependencies. Reduced-motion preferences disable all reveal animation. Selecting None, hiding again, or closing the screen cancels the current effect. Controls remain usable during playback.

Black-hole whoosh breaks each cover into ribbons that orbit the shared portal, tumble, and shrink along an inward spiral. The ribbons can travel beyond the chart edges, and the portal stays open until they are absorbed.

Question marks on animated covers use the display's `--reveal-question-size` (44px on the daily chart, 70px on team cards), weight 850, and line-height 1, matching the hidden cards so the reveal begins without a sudden size jump.

## Adding or removing an effect

The effect system is under `src/revealEffects/`:

1. Create an effect module and its CSS file. Export a `RevealEffect` with a stable `id`, `name`, `description`, bounded `durationMs`, a `Stage` component for the screen overlay, and a `Cover` component for each card. An effect that covers the whole screen, such as Rainbow zipper’s full-screen curtain, can return `null` from `Cover`.
2. Add its definition to `revealEffects` in `registry.ts`. That one registration adds it to both menus and the Surprise me pool. Remove the entry to remove it from both screens; a saved selection for a removed effect falls back to Surprise me on next opening.
3. Scope CSS to the effect’s own classes. Keep all animation within `durationMs`, use `animation-fill-mode: both` for exiting covers, and leave pointer events to the shared layer. Cover components may use `--reveal-target-x`, `--reveal-target-y`, and `--reveal-left` to coordinate motion with their position. The measured `--reveal-cover-left`, `--reveal-cover-top`, `--reveal-cover-width`, and `--reveal-cover-height` values let fixed-position effects start at each card and escape scrolling containers.
4. Run the application checks and try the effect in both student views, including Hide again during playback and a reduced-motion device.

`useRevealEffects.ts` owns preference loading, selection, random choice, motion preference, playback lifetime, and cancellation. `RevealEffects.tsx` owns the picker, overlay, cover positioning, and accessibility hiding. Screens never branch on individual effect IDs and receive no scheduling callback. New effects require no edits to either student view.

## Validation

Domain checks cover privacy, absent/missing students, completed snapshots after regrouping, shared stations, wrong active arrangement, missing destinations, large themed arrangements, preservation of locks/IDs, theme backup round trips, added-group naming, random effect variety, disabled/removed effects, and bounded effect durations. Browser checks cover applying/undoing a theme, daily routes, simultaneous reveals, effect playback/cancellation, names visibility, and return to the teacher screen.
