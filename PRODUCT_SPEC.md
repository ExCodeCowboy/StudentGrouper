# Student Grouper product contract

This is the behavior the product currently promises. It is intentionally narrower than a general classroom-management system. A follow-up contributor should preserve these rules unless a change is discussed as a product decision.

## Product shape

The teacher has three main work areas:

- **Students** — roster, attendance, language, gender, reading/math/writing levels, and pairwise grouping notes.
- **Groups** — reusable saved arrangements and their grouping recipe.
- **Today** — a dated, two-step workflow: choose stations, then assign groups to rounds.
  Optional planning blocks show routes across several days and share station settings within that block.

The interaction model is cards and places. Students are placed into groups; groups are placed into activity/location slots. The tool makes a useful first draft, but the teacher remains visibly in control.

## Manual changes, locks, and undo

- A manual drag is a teacher choice and implicitly locks that placement.
- In the Groups view, dragging a student moves only that student. It never silently relocates or swaps other students.
- In a rotation, dropping onto an occupied editable slot may swap the displaced assignment so the round remains valid.
- Every placement shows a locked or unlocked icon. Clicking it deliberately changes that state.
- Automatic actions may change only future, unlocked rotation assignments or unlocked student placements.
- Normal editing is stable. Automatic changes happen only after a clearly named action such as **Make groups** or **Build / Optimize**.
- Destructive resets and deletions require confirmation. The in-memory Undo history keeps the latest 30 snapshots but does not survive an app restart.
- Successful automatic work is quiet. If the result is incomplete or compromised, the app explains the issue in teacher language.

## Students and classes

- More than one class may be created, selected, renamed, and deleted.
- The final remaining class cannot be deleted.
- A student has a name, optional language and gender, three Low/Medium/High skill levels, and a Here/Away state.
- Away students are omitted from newly generated groups, including any stale locked placement.
- Grouping notes are pairwise: **Keep apart** or **Prefer together**.
- Student and class deletion remove dependent live references. Stable IDs, rather than names, connect records.

## Grouping

Each saved arrangement has one primary goal and at most one secondary goal. Locks are scoped to that arrangement.

Primary goals:

- Mixed reading, math, or writing level
- Similar reading, math, or writing level
- Random, respecting keep-apart notes and existing locks

Secondary goals:

- Mix genders
- Prefer a shared language

Required grouping behavior:

- Explicit group counts start at two and can exceed eight, up to the roster size (with at least eight choices available). Existing larger arrangements remain selectable as attendance or the roster changes.
- **Pairs** chooses the count from present students: two per group, with one trio for odd attendance when possible. Locks remain authoritative.
- Each nonempty group in Pairs mode has one randomly chosen **starter**, marked with a gold star beside their name in the group editor and student group reveal. The saved choice survives reveals, reopening, and backups. Make groups draws again after partners are placed, including for the odd trio. If the starter leaves or becomes absent, choose a present replacement without changing other pairs. Reset clears starters; ordinary count mode does not show them. Old pair exports gain starters without changing memberships.
- Every present student is placed exactly once when a valid arrangement is found. Random mode leaves students unassigned rather than creating a new forbidden pairing when no full arrangement is found within its bounded search.
- Automatic group sizes differ by at most one when locks permit it. Existing locks remain authoritative when they force a larger difference, and the UI says so.
- **Keep apart** carries a very large penalty and is respected whenever a valid placement exists.
- **Prefer together**, mixed gender, and shared language are preferences rather than hard promises.
- Similar-level grouping forms balanced skill bands. Mixed-level grouping distributes levels across groups.
- **Make groups** shuffles unlocked students within each selected reading, math, or writing level before placement, for both pairs and larger groups in Similar or Mixed mode. Skill ordering, relationships, secondary goals, and locks still guide placement. Normal editing does not reshuffle; fresh draws may repeat partners when choices are limited or by chance.
- Names within each group are displayed alphabetically in the teacher editor, student reveals, daily student charts, and printouts. Display sorting does not change memberships or the randomly selected starter.
- Random grouping ignores skill levels and reshuffles unlocked students on **Make groups**. Keep-apart conflicts caused by existing manual locks are shown as cautions.
- After the initial placement, deterministic multi-pass swaps continue while a swap improves the total score, up to a safety limit of 100 sweeps.
- The numeric score is an implementation detail and is not shown as a teacher-facing dashboard.
- Skill labels are hidden on group cards by default and appear only after **Show levels** is chosen.
- A saved arrangement may be renamed or deleted when another arrangement exists. Each group may have a custom name and picture.

Student presentation:

- **Student view** presents the current groups with large names and group visuals, starting with every group hidden. Roster editing, skill levels, relationship notes, and lock editing stay in the teacher view.
- Student view provides Groups / Today navigation, a compact saved-arrangement selector, and Rebuild groups using that arrangement's existing settings. These limited projection controls are allowed; recipe editing, skill values, and relationship details remain in the teacher editor. The selector may show saved arrangement names. Switching pages preserves the reveal and fullscreen; switching arrangements or rebuilding covers groups until the next reveal. Rebuild is saved and undoable from the teacher editor. Today always uses the selected day and its own arrangement. Leaving Today pauses its timer and stops music; returning restores the paused round, reveal, and name visibility.
- **Reveal all teams** reveals every group together in one click. There are no individual-team reveal controls or countdown. **Hide again** resets only the presentation; it never changes group membership.
- The shared, modular reveal system offers Balloon lift-off, Rainbow zipper, Dragon hiccup, Black-hole whoosh, Fairy dust, Ocean wave, and Confetti party. A Surprise me option avoids the preceding effect; each effect finishes within three seconds. Both student screens use the same registry and playback controls.
- A teacher can turn off effects. The display also honors reduced-motion preferences, revealing immediately without motion.
- Only present, placed students appear. Empty groups are omitted. Larger arrangements and pairs wrap into additional rows.
- Full screen is optional; the student screen still works in a normal app window. Leaving and reopening starts a fresh reveal.
- **Group themes** previews eight name-and-symbol sets: Woodland Friends, Space Explorers, Ocean Crew, Garden Buddies, Dino Discoverers, Weather Wonders, Storybook Friends, and Busy Builders. Applying a theme preserves group identity, membership, locks, and saved rotation references. It replaces current names and pictures as one undoable change. Themes support pairs and larger arrangements, persist in backups, and apply to newly added groups while retaining existing custom edits during regrouping.
- **Today → Student view** presents a team-by-round chart of the selected day, with group/station visuals and location names. **Reveal the day** uncovers all rounds and teams together with one effect; the chart stays visible throughout the day. There are no per-round reveals. Student names are optional and shown once per team when membership is unchanged all day. Shared stations appear for every assigned group, and completed rounds use historical snapshots. Revealing or hiding the day never changes the plan or completion marks.
- The daily student display includes a silent rotation timer with Start, Pause, Resume, Reset, +1 minute, and a teacher-controlled next-round action. Default duration is 15 minutes. The clock uses a deadline, retains partial seconds when paused, and catches up after sleep or delayed callbacks. Saving a changed duration immediately applies the full new time to the current round, preserving running or paused status; idle and finished timers become ready. Music-only changes preserve progress. Starting or finishing a timer does not mark a round complete or edit a schedule. Returning to teacher view pauses the clock and stops transition playback.
- The title and date share a compact header above the timer and daily chart. At the end of a round, **Next round** is the primary action and **Restart round** is secondary; the final round offers Restart round without a next-round action. Moving on always requires the teacher's click.
- **Timer & transition** saves duration, optional automatic playback, and music choices per class. Five owner-supplied rich recordings and four synthesized public-domain melodies labeled **(minimal)** offer 30/45/60/90/120 seconds, capped at two minutes. Shortened recordings fade out over three seconds; shorter files end naturally. The Mac app bundles all music for offline playback. YouTube can be selected instead, with a built-in fallback if it cannot play; YouTube videos retain their own length. Automatic music is off by default, plays once per completed countdown, and never starts the next round automatically. Built-in music leaves the chart visible and highlights the next destination column. No camera, microphone, or recording is needed. YouTube is only contacted after a playback request; no student or classroom data is sent to the player.

## Daily stations and locations

Planning a day is explicitly two steps:

1. Choose activities, reusable room locations, visuals, and an initial round count.
2. Review or edit group assignments.

Rules:

- A station is a dated activity/location pair, not a permanent classroom object.
- Locations are reusable and may be added, renamed, or removed. A location already referenced by history is archived rather than destructively removed.
- Activity names are free text with recent names offered as suggestions; they are not a separately managed library object.
- Outside planning blocks, activity history is keyed by the trimmed, case-insensitive activity name. Within a block, copied stations share a stable activity identity, so renaming or moving an activity does not reset its tracking.
- The built-in visual library contains 20 icons. A teacher may instead upload a GIF, JPG, or PNG; the app stores a resized static PNG copy locally.
- Unnamed stations are counted as unfinished, excluded from automatic assignment, and explained with a caution naming their location.
- Duplicate locations and one activity name used at multiple locations are allowed, but shown as cautions because they can create an impossible round or ambiguous history.
- A new day starts from the most recent earlier day’s station setup. One through eight initial rounds are supported, and open rounds may later be added or removed.
- Previous and next arrows skip Saturday and Sunday. The date picker still allows a weekend to be chosen directly and marks dates that already have plans.

## Rotation scheduling

- **By station** is the primary editing view. **By group** is a transpose of the same assignments, not a separate schedule.
- The By group view includes stations with remaining capacity for every round. A station can be dragged or chosen from a menu.
- Each station allows a chosen number of groups at the same time (one by default, supporting the full group count). At most one station is assigned to a group in a round.
- **Priority station** is an optional checkbox, off for existing and imported stations unless explicitly saved. The planner first seeks fair first-visit coverage of priority activities, then brings those visits forward among equally good coverage plans. Existing pins, required daily visits, locks, completed rounds, capacity, and once-only limits still apply. Priority never rewards another visit for a child who has already been there in the current day/block. The setting shares across linked block stations and persists in exports. Enable it, then Build / Optimize to apply it to the schedule; a standalone priority day uses the full-day solver too.
- **Build / Optimize** rebuilds only future, unlocked assignments. If cautions exist, its label becomes **Fix issues**.
- **Unlock all** clears manual assignment locks only in editable rounds. Daily pins are changed in station settings; completed rounds remain unchanged.
- A completed round snapshots its learner IDs, activity name, and location so later regrouping or renaming does not rewrite what happened.
- Scheduling preserves completed work, manual locks, station capacities, and once-only rules. Block optimization considers all dates together. Its ordered priorities are: meet pinned daily visits, fill places, meet other daily requirements, minimize the worst learner's missing activity count, minimize total missing visits, favor once-only coverage, reduce repeats before first-visit coverage, reduce consecutive repeats, spread remaining repeats within days and across the block, and preserve existing editable choices when equally good. Activity names do not affect priorities. See [the planner specification](docs/PLANNER_ALGORITHM.md) for the exact model and acceptance checks.
- Earlier-day planned assignments count as provisional history even if their rounds were not marked complete. This helps tomorrow’s plan continue from yesterday’s intended route. See the open policy question in the handoff before changing this behavior.
- Cautions identify the affected round and, when possible, the affected cell. A teacher can expand all cautions or ignore an intentional one for that day.

## Planning blocks and station rules

- A named block has a first and last date, defaulting to two school days. Blocks cannot overlap. New weekday plans are created; existing plans in the date range join without losing assignments or completion marks.
- Starting the next block starts fresh tracking without deleting prior plans. History and once-only checks are isolated to the block.
- The whole-block overview shows every group's route on each date, with daily editing available underneath. **Build / Optimize block** rebuilds all editable dates together while preserving manual locks and completed rounds.
- Block optimization runs locally in a cancellable worker. A proven result is distinguished from the best plan found within the search limit. Canceling or changing the input before completion prevents an obsolete result from replacing the plan. A successful result is one undoable change. Day-level optimization inside a block uses the same whole-block planner; unblocked days retain their existing scheduling behavior.
- Station names, visuals, locations, capacities, visit rules, and daily pins are shared across the block. Adding or removing a station applies across the block; completed work protects a station from removal.
- Visit rules are **Rotate normally**, **Only once per block**, **Once each day**, and **May repeat**. The once-only rule follows individual learners after regrouping and is an automatic scheduling limit; contradictory manual/completed choices remain visible as cautions. Without a block, the once-only rule covers the selected day.
- Block planning aims to give every learner a turn at every station before returning to a visited station, with additional priority for once-only activities among new visits. This is a preference subject to capacity, available rounds, daily requirements, and retained choices. Only earlier rounds count as already visited for this preference; a later booking does not make a station already visited. Future once-only bookings still reserve that activity to prevent a second assignment. One learner's previous visit does not erase other learners' first-visit preference after regrouping; once-only rules still prohibit a repeat for any learner.
- A separate daily-pin popup selects one or more groups for one visit each day at a station. The planner chooses their rounds, respecting simultaneous group capacity. The station can otherwise rotate normally. Rebuilding may move generated pin placements; completed visits and manual locks remain. Conflicting rules, missing groups, or insufficient rounds produce cautions. Old single-group/round pins migrate to the selected group with automatic round choice. Single days with daily pins use the full-day optimizer as well.
- Planned learner membership is captured before group arrangements change. Completing a round replaces that membership with the learners actually present. Existing history already changed before this upgrade cannot be reconstructed.
- Both earlier planned and completed rounds still count as history. The interface explains this; canceled rounds can be removed to free their activities. Future once-only placements reserve capacity within their block.

## Printing

- The classroom printout is group-oriented so a child can find their group and follow its route.
- It includes the full date and weekday, selected group arrangement, group members, and every round.
- Every station shows both the activity and location, plus its visual.
- Every group uses a symbol, color, name, and optional picture so meaning does not depend on color printing.
- The current print layout targets landscape paper. It is a fixed product view, not a template editor.
- Printing from a block prints each date on a separate sheet.

## Local data and backups

- No account, cloud service, analytics, advertising, AI service, or network connection is required by the running app.
- Both the browser and Mac builds use IndexedDB through the same transactional persistence adapter.
- Each save retains the previous complete generation. Loading prefers the newest valid generation and falls back to the previous one if necessary.
- Changes autosave after a short delay. A visible warning tells the teacher to export a backup if loading or saving fails.
- A JSON backup contains all classes, students, relationships, arrangements, schedules, history, locations, and custom images.
- Import validates and migrates the backup before replacing the open copy. Export/import round trips are covered by tests.
- Browser data belongs to the browser profile and web origin. Mac data belongs to the installed app’s webview storage. Moving between them requires export and restore.

## Explicit non-goals

- No student information system integration or performance analytics
- No behavior-record system
- No calendar integration or multi-week calendar editor
- No weighted optimization sliders or teacher-facing scheduling scores
- No natural-language or runtime AI scheduling interface
- No accounts, collaboration, cloud sync, advertising, or analytics
- No image editor, image search, or animated-GIF system
- No print-template editor
