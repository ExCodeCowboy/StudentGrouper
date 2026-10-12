# Student displays and team themes

## Teacher controls

- **Groups → Group themes** previews eight themes: Woodland Friends, Space Explorers, Ocean Crew, Garden Buddies, Dino Discoverers, Weather Wonders, Storybook Friends, and Busy Builders. Applying a theme replaces names, colors, symbols, and uploaded pictures for that arrangement. It preserves group IDs, memberships, locks, and schedule references. Undo restores the prior appearance.
- Each theme has twelve distinct teams and numbered extensions for larger arrangements. New groups use the arrangement’s chosen theme. Existing custom names and pictures survive Make groups. Old exports do not need a theme field.
- **Groups → Student view → Reveal all teams** reveals every team together with one click. There are no individual-team reveal controls or countdown. Hide again resets the presentation without changing groups.
- Student view has **Groups / Today** navigation, so the teacher can stay in the projected workspace. Today uses the already-selected date and that day's saved arrangement. Choosing an arrangement on Groups does not switch the daily plan. Switching pages retains revealed groups/the day; choosing another arrangement starts its groups covered.
- A compact saved-arrangement selector and **Rebuild groups** are available in the Groups presentation. Rebuild uses the selected arrangement's existing recipe, attendance, relationships, and locks, redraws pair starters, and saves through the same undoable action as the teacher editor. New groups start covered, ready for Reveal all teams. Keep-apart or unplaced-student issues show a neutral teacher-check message without exposing relationship details. Saved arrangement names are intentionally available in this selector; skill values, recipes, and private relationship notes stay in the teacher editor.
- The group heading shares the top toolbar with navigation. Teacher view and Full screen are labeled icon buttons; the reveal-effect selector is the small down arrow beside the reveal button in both presentations. Twelve pairs fit in the 1280×720 preview; larger rosters and long names can still scroll. Names within each group remain alphabetical, with the saved starter star attached to the chosen student.
- In **Pairs** mode, one student in every pair (and the odd trio) gets a gold starter star. Both group views show the same saved choice; the student reveal explains that the starter goes first. Hiding/revealing, ordinary edits, and reopening do not redraw valid starters. Make groups draws again. Attendance or membership edits replace only starters who are no longer present in that group. Backups preserve the selection; older pair backups gain starters without regrouping.
- **Today → Student view → Reveal the day** uncovers the entire selected day in one click, with one effect for every team and round together. The team-by-round chart remains visible for the class to follow throughout the day. There are no per-round reveals. Hide again resets the whole presentation and pauses its timer without changing the plan or completion marks.
- The daily view keeps its title and date together in the compact toolbar, leaving more room for the rotation chart.
- Student names can be hidden. When membership is the same all day, names appear once beside the team; when historical membership differs by round, each round keeps its own names. Shared stations appear for each assigned group. Missing destinations say “Check with your teacher.”
- Both student views offer Full screen, Teacher view, an effect picker, and instant reveals. Fullscreen uses a shared container, so navigating between Groups and Today does not exit it. Teacher view returns to the corresponding editor. Escape returns to teaching when outside browser fullscreen; Escape in a settings dialog or native selector dismisses that control first. Wide daily charts can be focused and scrolled with the keyboard.

The card presentation model contains names and group/station visuals, plus the starter's ID for pair reveals and locations for rotations. It omits student levels, relationships, arrangement names, rules, locks, and planning diagnostics. The separate teacher-operated arrangement selector receives only saved IDs and names. Completed rounds use saved learner/activity/location snapshots. Present-day rounds use present students in the day’s arrangement, even if the teacher selected another arrangement on the Groups page.

## Rotation timer and transition music

Switching from Today to Groups pauses the countdown and stops transition music. Returning to Today restores the same round and paused time, the day's reveal, and the student-name visibility setting. Resuming never replays the reveal. These presentation choices are kept only while student view is open; the paused clock is also retained when returning to the teacher editor until the app reloads.

**Today → Student view → Timer & transition** saves the following per class, including in exported backups:

- Round duration: defaults to 15 minutes; editable from 5 seconds to 120 minutes.
- Transition source: built-in music, or a YouTube video link. Supported links include watch, share, Shorts, live, and embed links; URL start times are retained.
- **Rich songs:** Bells, Oboe, Strings, Guitar, and Koto, supplied by the project owner. **Minimal tunes:** Ode to Joy, Au clair de la lune, Twinkle, Twinkle, Little Star, and Lavender's Blue, each labeled **(minimal)**.
- Song length: 30, 45, 60, 90, or 120 seconds (default 45), capped at two minutes for all built-in music. Longer recordings fade out over the final three seconds; shorter recordings end naturally. Minimal tunes use complete phrases at each length. Preview stops when closed. [Music sources and arrangement notes](TRANSITION_MUSIC.md) document both libraries.
- **Play transition music when time is up**: off by default. The timer itself is silent. Music can also be started manually.

Reveal the day, then Start timer. Pause, Resume, Reset, and +1 minute affect only this presentation. Choosing another round resets its timer; **Next round** moves the highlight and starts a fresh countdown. Once a countdown finishes, Next round becomes the primary action and **Restart round** is secondary. On the final round, only Restart round is offered. The transition music controls also emphasize Next round when another round remains. Finishing a timer never changes stored assignments, marks a round complete, automatically starts the next round, or repeats the reveal. Returning to teacher view pauses the timer and stops music. Its paused position is retained for that day until the app is reloaded; running timers are not stored in backups. Saving a changed duration immediately resets this round to the full new time: running timers continue from it, paused timers stay paused, and idle or finished timers become ready. Any open transition playback closes. Saving only music settings preserves the countdown.

The clock derives remaining time from a deadline, so delayed callbacks or computer sleep do not accumulate drift. Completion triggers at most one transition per run, and automatic transitions wait until the page is visible. Minimal music uses local synthesis; rich MP3s are included in the Mac bundle and loaded from the app's own host in the browser. Playback is exclusive and cancellable, including pending recording loads. The next round is highlighted while transition music plays, with the daily chart still visible. Teachers decide when everyone is ready.

YouTube opens a visible player with ordinary YouTube controls. If playback is blocked, errors, or has not started within eight seconds, that player is removed before the chosen built-in tune starts. Video length is controlled by the selected YouTube video, not the built-in tune length. A teacher can close the video or start the next round at any time. A school network can still block YouTube, and videos may disallow embedding or show ads.

### Mac playback

The pinned Wry 0.55.1 runtime already enables autoplay on macOS by setting `WKWebViewConfiguration.mediaTypesRequiringUserActionForPlayback` to `None`. Starting a timer or manually playing music also prepares Web Audio from the teacher's click. No microphone, camera, or audio recording API is used. The outer player frame explicitly denies camera, microphone, and screen-capture permissions.

Mac's `tauri://localhost` origin cannot supply an HTTP referrer for YouTube. `src/youtubePlayer.ts` therefore uses the small HTTPS helper at `https://excodecowboy.github.io/StudentGrouper/app/transition-player.html`; web previews use the same helper from their own origin. **Publish the web build containing both `public/transition-player.html` and `public/transition-player.js` before distributing the new Mac installer.** The Mac CSP permits just that helper URL, without granting the remote frame native app capabilities. The helper loads YouTube's IFrame API and a privacy-enhanced embed, and receives only the video ID, start time, and a random message channel. Parent messages validate both source and origin; the helper validates its parent/channel. No roster or classroom state is sent.

Sources: [YouTube IFrame API](https://developers.google.com/youtube/iframe_api_reference), [embedded-player identity and visibility requirements](https://developers.google.com/youtube/terms/required-minimum-functionality), and the installed `wry-0.55.1/src/wkwebview/mod.rs` implementation. Mac autoplay still needs a real-device check after packaging; browser playback alone cannot establish the Mac result.

## Reveal effects

The effect picker offers thirteen reveals, in this order. **Surprise me!** chooses from the same registry and avoids the preceding effect in that presentation. Every reveal finishes within 9.8 seconds.

| Reveal | Length | What happens |
| --- | --- | --- |
| Saturn V · Moon landing | 9.7 s | A 3-2-1 countdown and liftoff, two stage separations, a landing among the boulders, one giant leap and a flag; a gold iris opens onto the groups. |
| Black-hole whoosh | 5.3 s | A hungry portal tugs the question marks like taffy, rips the covers into ribbons and slurps them down, then burps out sparkles and winks out. |
| Pixel Quest · Level clear! | 7.0 s | A pixel bunny bonks every block for a gem, grabs the trophy and clears the level. |
| Block mine · Dig & build | 7.9 s | Cards become pixel blocks; a pickaxe goes tik-tik-tik-CRACK, cubes bob into a hotbar, a rare gem sparkles and the haul builds a little house. |
| Hard dot-to-dot | 8.0 s | A connect-the-dots page counts by 2s or 5s; the class guesses the picture (whale, train, rocket or butterfly, rotated between plays) before it colors in and comes alive. |
| Dino egg hatch | 7.8 s | Every card becomes a speckled egg; a baby dino hatches, tries a mighty roar, and its stomp cracks every egg open. |
| Wizard owl · Magic letters | 7.2 s | An owl in a starry hat delivers sealed letters and casts an opening spell; one stubborn letter needs a second command. |
| Squishy bounce | 7.3 s | A jelly buddy bounces across sleepy pillows, belly-flops SPLAT, and every pillow boings away. |
| Kitten & yarn | 8.5 s | A ginger kitten hops onto a ball of yarn that unravels every knitted cover, pops out in a striped beanie, blinks slowly at the class and hops away. |
| Balloon pop party | 5.3 s | A party-hat hedgehog floats in with balloons, gets tickled by a feather and sneezes every question-mark balloon into confetti. |
| Fairy dust | 5.3 s | A fairy counts to three, fizzles, shakes her wand, then taps each card so it blooms into flowers and butterflies. |
| Ocean wave · Otter surf | 4.9 s | A sea otter surfs a curling wave that washes the sandy covers away, with a dolphin tail-five and a crab that never covers names. |
| Confetti party | 5.0 s | A spotlight catches Pip the party popper going off too early, then both poppers burst the covers into confetti, streamers and gold stars. |

The selected effect is remembered on the device using a small local preference; no classroom information is stored there. Effects are local SVG, CSS and Web Animations with no external services, image downloads or animation libraries. Each reveal has a short bundled soundtrack with a shared mute control (see [REVEAL_SOUNDS.md](REVEAL_SOUNDS.md)). Reduced-motion preferences disable all reveal animation and sound. Selecting None, hiding again, or closing the screen cancels the current effect. Controls remain usable during playback; the header has a light backing for contrast, and header/footer controls stay above full-screen effects.

Question marks on animated covers use the display's `--reveal-question-size` (44px on the daily chart, 70px on team cards), weight 850, and line-height 1, matching the hidden cards so the reveal begins without a sudden size jump. [REVEAL_REFERENCES.md](REVEAL_REFERENCES.md) lists the visual references behind the Moon landing and the kitten.

## Adding or removing an effect

The effect system is under `src/revealEffects/`:

1. Create an effect module and its CSS file. Export a `RevealEffect` with a stable `id`, `name`, `description`, `durationMs` (at most 9800), optional `sound`, a `Stage` component for the full-screen overlay, and a `Cover` component rendered inside each card's cover. A reveal whose stage hides everything may return `null` from `Cover`. Keep the choreography in a pure `<name>Timeline.ts` (functions of seconds and layout) so tests can pin its beats, and add `tests/reveal-<id>.test.ts` imported from `tests/domain.test.ts`.
2. Add its definition to `revealEffects` in `registry.ts`. That one registration adds it to both menus and the Surprise me pool. Remove the entry to remove it from both screens; a saved selection for a removed effect falls back to Surprise me on next opening.
3. Scope CSS to the effect's own classes (the layer and each cover carry `data-reveal-effect="<id>"`). Keep all animation within `durationMs`, use `animation-fill-mode: both` for exiting covers, and leave pointer events to the shared layer.
4. Aim at the cards with the measured cover variables. `measureRevealCovers()` (in `revealTargets.ts`) reads every `.reveal-cover` in one pass and writes, on each cover: `--reveal-center-x` / `--reveal-center-y` (card centre as a 0–1 fraction of the viewport), `--reveal-order` (0–1 left to right), `--reveal-index` and `--reveal-count`, `--reveal-left`, `--reveal-target-x` / `--reveal-target-y` (offset to the screen centre), and the pixel box `--reveal-cover-left/top/width/height` that lets fixed-position effects start at each card and escape scrolling containers. The first cover of a reveal runs this pass automatically. A stage that needs the rectangles in JavaScript calls `useRevealTargets()` (visible cards, left to right, re-measured on resize) or `measureRevealCovers()` directly.
5. Add a sound (optional): a recipe in `scripts/reveal-sound-cues.json` whose `durationMs` equals the effect's, credited sources in `public/sounds/reveals/SOURCES.json` and `CREDITS.md`, a profile in `revealSounds.ts`, and `sound: '<id>'` on the effect. [REVEAL_SOUNDS.md](REVEAL_SOUNDS.md) describes the build.
6. Run `npm test`, `npm run lint` and `npm run build`, and try the effect in Groups and Today, including Hide again during playback and a reduced-motion device.

`useRevealEffects.ts` owns preference loading, selection, random choice, motion preference, playback lifetime, sound and cancellation. `RevealEffects.tsx` owns the picker, overlay, cover positioning, and accessibility hiding. Screens never branch on individual effect IDs and receive no scheduling callback. New effects require no edits to either student view.

Shared helpers: `sceneMotion.ts` has deterministic easing, keyframe and seeded-random helpers; `useSceneTime.ts` supplies a cancellable per-frame scene clock; `bakedTimeline.ts` samples pose functions once into Web Animations so a scene plays on the compositor without per-frame React renders (the Ocean wave and Kitten & yarn use it).

## Validation

Domain checks cover privacy, absent/missing students, completed snapshots after regrouping, shared stations, wrong active arrangement, missing destinations, large themed arrangements, preservation of locks/IDs, theme backup round trips, added-group naming, random effect variety, disabled/removed effects, and bounded effect durations (at most 9.8 seconds each); each reveal also has its own `tests/reveal-<id>.test.ts` pinning its timeline, layouts and sound beats. Timer checks cover delayed callbacks, pause/resume, reset, duration changes in every timer state, extension, next rounds, settings migration, URL validation, all twenty minimal tune/length combinations, rich recordings, audio cancellation, stale playback starts, and the YouTube message bridge. Browser checks cover applying/undoing a theme, daily routes, simultaneous reveals, effect playback/cancellation, names visibility, and return to the teacher screen.
