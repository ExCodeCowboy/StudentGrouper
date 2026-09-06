# Development and release guide

## Technology and architecture

- React 19 and TypeScript provide the interface.
- Vite builds the browser application.
- Tauri 2 wraps the same Vite build for macOS and uses the system webview rather than bundling a browser engine.
- IndexedDB is the persistence layer in both targets. Tauri currently provides the shell and packaging; there is no Rust database or remote service.
- The public information site has a Vinext source in `website/` and a static GitHub Pages representation in `public-site/`.

Important source areas:

| Path | Responsibility |
| --- | --- |
| `src/model.ts` | Persisted types and stable ID creation |
| `src/grouping.ts` | Initial grouping, penalties, multi-pass optimization, student moves |
| `src/rotations.ts` | History, filling/rebuilding schedules, manual moves, cautions |
| `src/storage.ts` | IndexedDB transactions, recovery, migrations, import/export, image normalization |
| `src/groupSets.ts` | Saved-arrangement reset, selection, and deletion |
| `src/classrooms.ts` | Class rename and guarded deletion |
| `src/dateNavigation.ts` | Weekday and calendar calculations |
| `src/App.tsx` | Application state, autosave, Undo, and orchestration |
| `src/views/` | Students, Groups, and Today user interfaces |
| `tests/` | Pure domain and persistence-contract tests |
| `src-tauri/` | Desktop configuration, icons, and Rust shell |
| `public-site/` | Static HTML published at the GitHub Pages root |
| `website/` | Vinext information-site source and shared public-site styling/assets |

The domain modules are deliberately independent of React. Keep scheduling and grouping decisions there so they remain deterministic and easy to test.

## Local development

Node.js 22.13 or newer is required.

```text
npm install
npm run dev
```

Run the desktop shell from the repository root:

```text
npm run tauri:dev
```

The Tauri development command starts Vite automatically. Production desktop builds run the root `npm run build` before packaging.

## Validation

Required application checks:

```text
npm test
npm run lint
npm run build
```

The test runner bundles `tests/domain.test.ts`, which imports the focused test files, and executes them with Node’s test API. Add domain behavior to the relevant test file and ensure it is included by `tests/domain.test.ts`.

If the Vinext information site changes:

```text
cd website
npm install
npm run lint
npm run build
```

GitHub runs both sets of checks for pushes to `master` and for pull requests.

## Persistence details

The `student-grouper` IndexedDB database has one object store named `application` and two records:

- `current` — newest complete application state.
- `previous` — the preceding complete generation.

Saving the current and previous generations happens in one IndexedDB transaction. Loading validates `current`, falls back to `previous`, then normalizes supported legacy station/activity shapes. The application starts with fictional sample data only when neither generation can be loaded.

Do not assume the browser and Tauri webview use the same physical database. They share code and schema, not storage. JSON export/restore is the supported transfer path.

## GitHub Pages

Every push to `master` runs `.github/workflows/pages.yml`:

1. Build the Vite app with base path `/StudentGrouper/app/`.
2. Place `public-site/` at the Pages root.
3. Copy `website/app/globals.css`, `website/public/favicon.svg`, and `website/public/og.png` into that root.
4. Place the Vite build under `/app/`.
5. Publish the assembled artifact.

Canonical URLs:

- `https://excodecowboy.github.io/StudentGrouper/`
- `https://excodecowboy.github.io/StudentGrouper/app/`
- `https://excodecowboy.github.io/StudentGrouper/help/`
- `https://excodecowboy.github.io/StudentGrouper/privacy/`

Because browser storage is origin-scoped rather than path-scoped, the earlier move from the Pages root to `/app/` did not change the IndexedDB origin.

## Mac release procedure

The manual **Build the Mac downloads** workflow builds both `x86_64-apple-darwin` and `aarch64-apple-darwin`, runs the domain tests, creates DMGs, and attaches them to a GitHub release.

Before running it:

1. Update the version in the root `package.json`, lockfile, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json` as required by the Tauri toolchain.
2. Update the workflow release text if this is not the first public release.
3. Run all local validation.
4. Commit and push the version change.
5. Dispatch `.github/workflows/mac-release.yml` and watch both matrix jobs.
6. Open the release page and confirm both `Student-Grouper-x64.dmg` and `Student-Grouper-aarch64.dmg` are attached.
7. Install and launch the correct DMG on real hardware before announcing it.

The current app identifier is `com.excodecowboy.studentgrouper`, the minimum macOS version is 10.15, and builds use ad-hoc signing (`-`). Public distribution therefore requires the documented Control-click → Open flow until Developer ID signing and notarization are added.

## Public-site maintenance

GitHub Pages is canonical. The old Sites deployment is only a compatibility address. When public copy changes, keep these sources aligned:

- `website/app/page.tsx`, `website/app/help/page.tsx`, and `website/app/privacy/page.tsx`
- `public-site/index.html`, `public-site/help/index.html`, and `public-site/privacy/index.html`

The two versions share `website/app/globals.css` and the images in `website/public/` when GitHub Pages builds. A future contributor may remove this duplication with a small static-generation step, but should not add a runtime server or content-management system for it.
