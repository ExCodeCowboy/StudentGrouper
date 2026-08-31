# Student Grouper product contract

## Core behavior

The teacher works with cards and places. Students are placed into groups; groups are placed into station-and-round slots.

- A manual drag is a teacher choice and implicitly locks that placement.
- Dragging a student moves only that student. It never swaps or relocates anyone else.
- Clicking the visible lock releases or restores the lock.
- The app may change its own unlocked choices, but not the teacher’s locked choices.
- Normal editing is stable. Automatic changes happen only after a clearly named action.
- **Fill open spots** fills blanks and does not move existing placements.
- **Rebuild unlocked** may reconsider only future, unlocked assignments.
- Successful automatic work is silent. If a safe result is impossible or compromised, the app explains the issue in teacher language.

## Grouping

Each saved arrangement has one primary goal and at most one secondary goal. Locks are scoped to that arrangement.

Primary goals:

- Mixed reading, math, or writing level
- Similar reading, math, or writing level

Secondary goals:

- Mix genders
- Prefer a shared language

“Keep apart” is respected by automatic grouping when a valid placement exists. “Prefer together” is a preference, not a hard promise. A teacher’s direct placement remains authoritative.

## Rotations

The primary editing view is **By station**. **By group** is a transpose of the same assignments, not a separate schedule.

The current model assumes one group per active station in each round. A day can have two or three rounds, all station history continues across days, and station selections are scoped to the day so activities can be swapped without changing other days.

Only completed rounds advance history. Planned but incomplete rounds do not become historical merely because the date changes.

## Printing

The classroom printout is group-oriented so a child can find their group and follow its route. Every station uses both a picture and a word. Every group uses a symbol, color, and name so meaning does not depend on color printing.

Teacher-provided GIF, JPG, and PNG files are normalized into a local static image. The app does not include an image editor, image search, or animation system.

## Local data

- No account, cloud service, analytics, or network connection is required.
- Changes save automatically on the device.
- Backups contain the roster, grouping instructions, group arrangements, schedules, history, and custom station pictures.
- Students and other entities use stable IDs, so duplicate or renamed display names do not damage history.

## Explicit non-goals

- No student information system or performance analytics
- No behavior-record system
- No calendar integration or multi-week calendar editor
- No weighted optimization sliders or scheduling scores
- No natural-language/AI scheduling interface
- No collaboration or cloud sync
- No print-template or image editor
- No tracking of station history per individual student; history belongs to the group
