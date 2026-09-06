# Student Grouper

Student Grouper is a local-first classroom tool for making student groups, continuing station rotations across days, and printing picture-friendly schedules for young readers.

[Public site](https://excodecowboy.github.io/StudentGrouper/) · [Try it in a browser](https://excodecowboy.github.io/StudentGrouper/app/) · [Download for Mac](https://github.com/ExCodeCowboy/StudentGrouper/releases/latest)

![Student Grouper: classroom groups and station rotations, made simpler](website/public/og.png)

## Project status

Version 0.3.0 adds silent rotation timers and transition music: four familiar public-domain melodies with gentle accompaniment, optional YouTube videos, and automatic fallback when a video cannot play. It includes whole-block planning, flexible daily station pins, random groups and pairs, and animated student displays with eight team themes. The browser app and public information pages are hosted on GitHub Pages; Mac releases provide separate Intel and Apple-silicon installers. The application has 176 tests, including legacy backup imports, planner validation, timer behavior, and music playback.

For follow-up work, start with [the project handoff](docs/PROJECT_HANDOFF.md). The product rules that should not change accidentally are in [the product contract](PRODUCT_SPEC.md), and the build and release details are in [the development guide](docs/DEVELOPMENT.md).

## Why it exists

This was made for the small, repetitive planning decisions that consume a surprising amount of a teacher’s morning. The app can make a useful first draft, but the teacher stays in control:

- Build mixed or similar reading, math, or writing groups.
- Create random groups, pairs, or more than eight groups while respecting keep-apart notes.
- Add one clear secondary preference, such as mixed gender or shared language.
- Note students who work well together or should have space.
- Drag one student without causing other students to jump between groups.
- Lock deliberate choices and rebuild only what remains unlocked.
- Continue activity history across dates, even after regrouping.
- Plan a block of days together, limit activities to once per block, and share a station between groups.
- Pin multiple groups for a daily station visit and let the planner choose their rounds.
- Plan activities and reusable classroom locations separately.
- Print group routes with activity pictures, words, colors, and symbols.
- Project daily rotations or reveal all teams together with seven playful visual effects.
- Run a quiet rotation timer, then play a YouTube transition song or an offline tune lasting 30, 45, or 60 seconds.
- Choose woodland, space, ocean, garden, dinosaur, weather, storybook, or builder names and symbols for groups.
- Export and restore a complete local backup.

## Privacy

Student Grouper has no accounts, cloud database, analytics, advertising, or tracking. The Mac app stores classroom information on that Mac. The browser version stores it inside that browser on that device. Exported backups go only where the teacher chooses to save them.

Optional YouTube transition videos connect to YouTube and may show its ads or collect playback data under its own policies. The Mac app also loads a small player page from the public site. Only video parameters are passed to that player, never classroom records. Built-in tunes and the timer work offline; no camera or microphone is used.

The app was created with help from AI, but AI is not part of the running app and student information is never sent to an AI model.

## Mac downloads

The release workflow produces two DMG installers:

- `x86_64` for older Intel MacBook Air models.
- `aarch64` for Apple-silicon Macs (M1 and newer).

The current minimum is macOS 10.15. Early public builds are ad-hoc signed rather than Apple-notarized, so macOS may require a Control-click → **Open** confirmation on first launch.

The desktop shell is Tauri. It uses the Mac’s built-in webview instead of shipping a second browser engine, so the application code and local data model are shared with the browser build.

## Development

Use Node.js 22.13 or newer. Install and run the classroom app:

```text
npm install
npm run dev
```

Validation:

```text
npm test
npm run lint
npm run build
```

Run inside the desktop shell:

```text
npm run tauri:dev
```

The public information site lives in `website/` and has its own lockfile and scripts. A static copy in `public-site/` is published with the browser app on GitHub Pages.

The application is intentionally split into pure domain modules in `src/` and React views in `src/views/`. Read [the development guide](docs/DEVELOPMENT.md) before changing persistence, deployment, or release packaging.

## Product boundaries

The project intentionally does not include a student information system integration, behavior tracking, cloud sync, accounts, analytics, AI scheduling, weighted optimization controls, or a multi-week calendar editor. The working product contract is in [PRODUCT_SPEC.md](PRODUCT_SPEC.md).

Created with AI for a teacher I know.
