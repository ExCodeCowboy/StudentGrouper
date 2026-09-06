# Planning blocks and desktop drop fix

This change adds a bounded planning workflow to the existing daily editor. See the updated rules in [PRODUCT_SPEC.md](../PRODUCT_SPEC.md).

## Teacher walkthrough

1. Open **Today → Plan a block**. Choose a name and date range, normally two school days. Existing days in that range are retained; missing weekdays are created using the current day's station setup and groups.
2. In **Stations**, leave the teacher station on **Rotate normally**. Under **Pin groups every day**, open **Choose groups**, select one or more groups, and choose **Save pins**. Each selected group gets one visit per day; the planner chooses the rounds. At capacity one, the groups visit in different rounds. The popup supports Cancel and clearing the selection.
3. Set a packet to **Only once per block**. The limit follows learners if groups change.
4. Set makeup work to **May repeat**, and increase **Groups at the same time** to allow several groups to work at their desks.
5. Use **Build / Optimize block** to plan all dates together. Manual locks and completed rounds remain. If rules conflict, the app shows cautions; it does not automatically violate the once-only limit to fill a gap.
6. Review the whole-block routes and select a date to edit its rounds. In **By group**, assignments can be selected from a menu as well as dragged. **Print block** prints every day with a page break between dates.
7. **Start next block** reuses station settings with fresh tracking. Earlier plans remain available on their dates.

Station settings, additions, and removals apply across the current block. A station used by a completed round cannot be removed. Daily pins are changed in station settings rather than removed with **Unlock all**. Rebuilding releases generated pin placements so their rounds can change. Completed visits and manual locks count toward daily pins and remain untouched. If capacity, available rounds, or once-only rules prevent every pin, the planner fits as many as possible and identifies the missing groups. Other groups may still visit normally. Old exports with a single round-specific pin keep the selected group, with automatic round choice on the next rebuild.

Block planning favors a first visit to any eligible station before returning to one already visited in the block. It considers each learner, so a student's previous visit does not make a station count as visited for new members of their group. Only earlier rounds count for that preference; a later booking is not an already-taken visit. Future once-only bookings still reserve their activity to prevent a second assignment. Once-only activities receive extra priority among otherwise equal new visits. This applies to makeup stations too: allowing repeats does not give them priority over an unvisited station. Daily requirements, station capacity, manual locks, and completed work still apply, so coverage is a goal rather than a guarantee. Use **Build / Optimize block** to apply this preference to an existing plan.

After first visits are covered, the planner also avoids repeating a makeup activity within the same day when another eligible station is available. An unnamed station cannot be scheduled; the header counts it as unfinished and the caution identifies its location.

**Build / Optimize block** now uses a local HiGHS mixed-integer solver for the whole block. It can revisit a Monday choice to improve Tuesday, balances missing activity coverage between learners, and then reduces premature and consecutive repeats. **Cancel planning** stops without changing the plan. The result states whether the priorities were proven optimal or the search reached its limit. See [PLANNER_ALGORITHM.md](PLANNER_ALGORITHM.md) for the research, ordered objectives, and validation.

## Pairs, larger arrangements, and random grouping

In **Groups**, choose **Pairs** from the group-count menu or select a count above eight. Pairs uses current attendance; an odd roster normally produces one trio. Existing locks can make sizes uneven and are retained. Additional groups have distinct names and the board wraps into rows.

Choose **Random** under **Group by** and press **Make groups** to shuffle unlocked learners. Skill levels do not influence random mode. Keep-apart notes are hard constraints for new placements; a bounded search leaves visible unassigned learners if a complete arrangement cannot be found. Locked conflicting partners remain with an explicit caution until the teacher changes their placement.

The chronological draft uses a capacitated assignment algorithm. Whole-block optimization replaces that draft when it finds a better validated schedule and bounds search time for larger arrangements. Unblocked days with daily pins also use the full search when **Build / Optimize** is chosen, so scarce free rounds are considered together. Regression coverage includes 24 groups at 24 stations, twelve random pairs, odd attendance, shared capacity above eight, and restrictive keep-apart notes.

## Student view and the group reveal

In **Groups**, finish arranging students, then choose **Student view**. Each team starts as a mystery card. **Reveal all teams** reveals every team together in one click, without a countdown or individual-team steps.

Use **Hide again** to repeat the surprise with the same groups. The shared effect menu offers seven short reveals, **Surprise me!**, and an instant option; reduced-motion settings skip animation. **Full screen** enlarges the display where supported. **Teacher view** returns to editing, and reopening the display hides every team again.

The display shows group names, pictures, and present students already assigned to groups. It leaves out empty groups, unassigned students, levels, grouping notes, locks, and the arrangement title. It does not change the saved arrangement or history.

**Today → Student view → Reveal the day** shows every team’s destinations for every round with one reveal. The whole-day chart stays visible for the class to follow, with optional student names and no per-round reveals. **Groups → Group themes** offers eight sets of playful names and symbols without regrouping students. See [Student displays and team themes](STUDENT_DISPLAYS.md) for the controls and modular effect architecture.

## History and persistence

Blocks have stable activity identities. Names are used once to link activities when adopting existing days; subsequent renames and location changes retain their history. Older blocks cannot influence the new block's counts. Days outside blocks retain the legacy activity-name history behavior.

Planned learner membership is captured before changes to saved groups, eliminating history drift when regrouping. Completing a round replaces its snapshot with the learners present at completion. Already-corrupted historical membership cannot be recovered retrospectively. Earlier unfinished plans still count as intended activity history; remove canceled rounds to free their activities. Future once-only assignments in the same block are reserved when optimizing one day.

The new persisted fields are additive and optional; old backups remain supported. Backups round-trip block dates, activity identities, capacities, visit rules, daily pins, and planned learner snapshots.

## Desktop drag and drop

The Tauri window now uses `dragDropEnabled: false` so native file-drop interception does not consume HTML drop events. The application uses browser drag events and file pickers, not native file drops. A typed `text/plain` fallback also preserves application drag payloads when a WebKit/native pasteboard does not preserve custom MIME types.

The shell behavior is documented in [Tauri's configuration reference](https://v2.tauri.app/reference/config/#windowconfig), with matching macOS symptoms reported in [Tauri issue 14373](https://github.com/tauri-apps/tauri/issues/14373).

The config and payload paths have regression coverage. A rebuilt Intel/Apple-silicon Mac app still needs a real-device check: move a student, a group by station, and a station by group; verify only the intended assignments move and the resulting manual choices lock. A Windows or browser check cannot establish macOS webview behavior.
