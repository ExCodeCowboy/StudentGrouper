# Student Grouper project handoff

Last reviewed: September 6, 2026

## Current update: version 0.2.0

The 0.2.0 work adds whole-block planning with a local HiGHS solver, learner-level activity tracking, once-only station limits, shared capacity, and multiple daily pins whose rounds are chosen by the planner. Group creation supports random arrangements, pairs, and counts above eight while respecting keep-apart rules. Student displays include a whole-day chart, simultaneous team reveals, seven modular effects, and eight naming themes. The Mac window now leaves HTML drag-and-drop to the webview.

There are 165 tests. Browser checks covered the September 7–8 sample block, pin selection and planning, theme previews, reveals, cancellation, and old backup imports. Intel and Apple-silicon installers are built by the release workflow; installation, performance, and native drag-and-drop still require a real Mac check.

For the current design and validation details, read [planning blocks](PLANNING_BLOCKS.md), [the planner model](PLANNER_ALGORITHM.md), [student displays](STUDENT_DISPLAYS.md), and [the development guide](DEVELOPMENT.md). Completed snapshots and manual locks remain authoritative. Pins request one visit each day, while their generated round placements may move on rebuild. Legacy round-specific pins migrate to the selected group. Block tracking uses stable activity IDs; names do not change planning priorities.

The remainder of this document is the original 0.1.0 baseline and follow-up notes. Its older counts, size limits, search description, and name-based history behavior are historical; the current guides above take precedence.

## Start here

Student Grouper 0.1.0 is working, public, and deliberately small. The safest next contribution is validation and hardening rather than another layer of features.

- Public home: <https://excodecowboy.github.io/StudentGrouper/>
- Browser app: <https://excodecowboy.github.io/StudentGrouper/app/>
- Mac downloads: <https://github.com/ExCodeCowboy/StudentGrouper/releases/latest>
- Repository: <https://github.com/ExCodeCowboy/StudentGrouper>
- Product rules: [PRODUCT_SPEC.md](../PRODUCT_SPEC.md)
- Development and release guide: [DEVELOPMENT.md](DEVELOPMENT.md)

The legacy information site at `student-grouper.jkodesign.chatgpt.site` remains available for old bookmarks, but GitHub Pages is the canonical public address.

## What is complete

- Multiple classes with create, select, rename, and guarded delete.
- Roster editing, bulk name entry, Here/Away attendance, language, gender, and three skill levels.
- Keep-apart and prefer-together grouping notes.
- Two-to-eight balanced groups with mixed/similar skill goals, one optional secondary goal, deterministic multi-pass improvement, and lock preservation.
- Multiple saved group arrangements, reset/delete confirmation, group rename/picture, deliberate locks, hidden-by-default skill labels, and Undo.
- Dated two-step station planning with reusable locations, recent activity suggestions, 20 built-in icons, custom images, one-to-eight rounds, and weekday navigation.
- Rotation editing by station or group, unused-station trays, drag locks, unlock-all, add/remove round, completion tracking, expandable/ignorable cautions, and Build / Optimize.
- Learner-level activity history across regrouping, with completed-round snapshots.
- Landscape print view containing groups, learners, rounds, activity visuals, activity names, and locations.
- Transactional local persistence with current/previous generations, data migration, complete JSON export/import, and friendly failure messages.
- GitHub Pages deployment, public information/help/privacy pages, and separate Intel/Apple-silicon Mac DMGs.
- 91 domain tests covering grouping, optimization, rotation assignment, history, backup/recovery, class management, and date navigation.

## Product decisions to preserve

1. Manual actions are authoritative. A drag locks the teacher’s choice, and automation does not move it.
2. Dragging a student does not rebalance the other groups. Rebalancing happens only when **Make groups** is pressed.
3. There is no exposed “optimization score” or collection of advanced weighting controls.
4. Activities are names entered for a day; locations are the reusable objects.
5. History follows learners by normalized activity name, not by station ID or location.
6. Problems are cautions with plain-language details. A teacher may intentionally ignore one.
7. Student data stays local. Do not add telemetry, remote storage, or runtime AI as an incidental implementation choice.

## Recommended follow-up, in order

### 1. Observe one real planning session

Use a fictional or properly de-identified roster that resembles a real class. Watch a teacher complete this route without coaching:

1. Create a class and enter 20–30 students.
2. Add two relationship notes and mark absences.
3. Make five similar-reading groups with mixed genders.
4. Correct two students by dragging, then regenerate and confirm the manual choices stay fixed.
5. Plan three rounds with five stations, print, move to the next weekday, and continue the route.
6. Export a backup, make a visible change, restore the backup, and confirm the change is reversed.

Record confusion and time-to-complete before proposing features. Favor label, spacing, and workflow fixes over new concepts.

### 2. Test on the actual older MacBook Air

Measure cold launch, first interaction, Make groups, Build / Optimize, date changes, opening the icon library, and printing. Exercise the largest supported case: eight groups, eight stations, eight rounds, plus several earlier days. The rotation search explores permutations; current sizes should be reasonable, but this has not been profiled on the target hardware.

Also verify the Intel DMG installation instructions and the first-launch Control-click → Open flow. The current build is ad-hoc signed, not Apple-notarized.

### 3. Add browser-level regression tests

The pure domain logic is well covered; the largest remaining test gap is the React workflow. Add a small number of high-value tests rather than snapshotting the entire UI:

- A dragged student moves alone and becomes locked.
- Reset and delete confirmations protect data.
- A new date uses the two-step station/assignment flow.
- By station and By group show the same assignments.
- Cautions expand, highlight the affected row/cell, and can be ignored/restored.
- Export followed by restore visibly returns the prior class state.
- The print stylesheet includes all groups and rounds at common paper sizes.

### 4. Resolve the provisional-history policy with the teacher

Today, any plan from an earlier date counts as provisional activity history even when its rounds were never marked complete. Completed rounds retain a learner snapshot; incomplete older rounds infer learners from the associated saved arrangement.

This makes the next day continue from what was planned, which is convenient when completion marks are forgotten. It can be wrong when a station day was canceled. Before changing it, ask which failure is less disruptive:

- Assume an earlier plan happened unless the teacher explicitly clears it; or
- Count only completed rounds and make completion easier or more prominent.

Whichever policy is chosen needs explicit tests and plain-language UI.

### 5. Harden distribution after the workflow is proven

- Add Apple Developer ID signing and notarization if public adoption justifies the cost and setup.
- Decide on a license before inviting outside code contributions. No license is currently included.
- Replace the fixed release text with release notes appropriate to each version.
- Consider automated release triggering only after the manual release procedure is comfortable.

### 6. Reduce public-site duplication

`website/` is the richer Vinext source used by the legacy Sites deployment. `public-site/` contains static GitHub Pages HTML, and GitHub Pages copies its CSS and images from `website/`. Copy can drift between the two. Prefer a small build-time export or shared content source; do not introduce a CMS or server merely to solve this.

## Known boundaries and risks

- No end-to-end browser tests or automated visual/print tests yet.
- Performance has not been measured on the target older Intel Mac.
- The Mac app and browser app do not share storage automatically; use backup export/restore.
- Backup shape validation protects major structure but is not a full field-by-field schema validator.
- `schemaVersion` remains `1` while legacy station/activity shapes are migrated during load. A future incompatible change should introduce an explicit versioned migration rather than adding more shape guessing.
- Undo is session-only and capped at 30 snapshots.
- Native HTML drag-and-drop is mouse/trackpad oriented. Keyboard-only assignment editing deserves an accessibility review before claiming full keyboard support.
- The Tauri window minimum is 960×680. Confirm it remains comfortable with macOS display scaling on the target machine.

## Definition of done for follow-up changes

- Preserve the invariants in [PRODUCT_SPEC.md](../PRODUCT_SPEC.md), or update that contract as an explicit product change.
- Add or adjust focused tests for changed domain behavior.
- Run `npm test`, `npm run lint`, and `npm run build` at the repository root.
- If `website/` changes, also run `npm run lint` and `npm run build` inside `website/`.
- Check the working tree for unrelated user changes before editing or committing.
- For a public release, verify both architectures’ DMGs and the GitHub Pages links rather than assuming the workflows succeeded.
