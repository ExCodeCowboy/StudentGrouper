# Whole-block rotation planner

## Problem and decision

The previous planner solves a capacitated assignment for one round at a time. Its Hungarian algorithm is exact for that one round, but its costs summarize history rather than the consequences of the remaining block. It cannot move a Monday choice to improve Tuesday, reserve a scarce future opportunity, or distribute repeatable work between days. Changing its repeat weights cannot fix that limitation.

Use a binary mixed-integer model for all editable rounds in the block, solved locally with the MIT-licensed HiGHS solver (`highs` 1.15.2, pinned). The WebAssembly runtime is shipped with the app and runs in a cancellable Web Worker. No solver service or student-data upload is involved.

Research considered:

- [OR-Tools employee scheduling](https://developers.google.com/optimization/scheduling/employee_scheduling): binary assignment variables, resource constraints, and preferences model a full scheduling horizon. CP-SAT is a strong alternative, but its documented language interfaces do not provide this app's browser integration.
- [HiGHS](https://highs.dev/) and the [JavaScript package](https://github.com/lovasoa/highs-js): a local, permissively licensed MIP solver with a browser WebAssembly distribution. The installed stable package exposes LP-format models and synchronous solving after asynchronous initialization.
- [Hierarchical objectives](https://docs.gurobi.com/projects/optimizer/en/current/features/multiobjective.html): optimize priorities successively while fixing the achieved values of earlier priorities. This avoids enormous blended weights and prevents a cosmetic improvement from sacrificing coverage. Gurobi is a modeling reference, not an application dependency.
- [Solver statuses](https://developers.google.com/optimization/cp/cp_solver): feasible and proven optimal are different outcomes. The application must preserve that distinction when search stops early.

## Hard rules

- One station per group per round, with each station's simultaneous group capacity.
- Preserve completed rounds, learner snapshots, and manual locks exactly. Daily pins specify a set of groups with one visit per day, not fixed rounds. Release generated pin placements before solving so the optimizer can choose their rounds jointly. Existing completed or manually locked visits count toward the request. Selected groups get no additional daily repeat; unselected groups retain the station's normal visit rules. Conflicting retained choices remain visible; new assignments cannot add to their violations.
- Only-once limits follow individual learners across the entire block, including future retained bookings and regrouping. Daily visit limits apply to the group and activity on that date.
- Ignore unnamed activities and invalid locations as automatic destinations; keep their setup cautions.
- Link activity history by stable tracking identity. Activity names never select special behavior.
- Blocks start with fresh history. Earlier planned and completed rounds within the block contribute to visit order. A later booking is a reservation, not a visit already taken.
- Explicit empty assignments are allowed when the rules prevent filling every place.

## Ordered objectives

Minimize the following vector lexicographically; never trade an earlier item for a later one:

1. Unfulfilled pinned daily visits. Impossible requests retain an explicit shortfall instead of making the entire model infeasible.
2. Unassigned group-rounds.
3. Other unfulfilled required daily visits.
4. The largest number of missing **priority** activities for any learner.
5. Total missing priority learner/activity visits.
6. The largest number of missing activities for any learner (fair overall coverage).
7. Total missing learner/activity visits.
8. Missing once-only learner/activity visits among equally good coverage plans.
9. Waiting for first priority visits: after each participating round in which a priority activity is offered, count learners who still have not visited it. This brings first visits forward after securing the higher coverage objectives; repeated visits earn no priority benefit.
10. Premature repeats: for each repeated learner visit, count the other eligible activities the learner had not yet visited before that round.
11. Consecutive repeats within a day.
12. Concentration of repeats within a day, measured by pairs of visits to the same activity.
13. Concentration of repeats across the block, using the same pair count.
14. Changes to existing editable assignments, to avoid needless reshuffling on repeated builds.

An eligible activity is a named, valid station offered on a day when the learner participates. A missed activity may be unavoidable because of pins, insufficient rounds, capacity, or a once-only conflict after regrouping. Coverage is measured per learner; learners with identical participation are grouped internally with a multiplicity to reduce model size without changing the objectives. Empty groups use a group identity so they can still be planned.

Coverage variables represent whether a learner has visited an activity by a particular round. First visits are the differences between consecutive coverage variables. A repeated visit is an assignment that does not increase coverage. Auxiliary linear inequalities model premature repeats, consecutive visits, and visit-count pairs. All objectives have integer values.

`PlannedStation.priority` is optional and defaults off. In a block it follows the linked activity identity, independently of the station's name or visit rule, and applies across linked dates. Multiple priority activities share fair coverage; priorities cannot override retained work, pins, capacities, or once-only limits. Missing priority visits are reported when capacity, retained work, or an unfinished search prevents covering everyone. Priority adds no reward for repeating an activity a learner already visited. Previous blocks do not satisfy this block's priority visits.

## Search and application behavior

Solve each objective in order and constrain its value before solving the next. Keep a validated incumbent throughout. A time limit returns the best validated plan found, never a claim of optimality. Prove optimality only when every nonconstant objective has been solved to optimality. Validate returned assignments independently of the solver model before accepting them, and compare their full objective vector with the existing plan and the chronological draft.

The worker keeps the page responsive. Canceling, worker failure, or a stale result leaves current data intact. Apply a successful result as one undoable change. A day-level optimize action inside a block uses the block planner. Creating a block retains existing days and optimizes newly added dates together; explicit block optimization may rearrange all unlocked dates.

The default search budget is 10 seconds, including model preparation. A model guard stops expansion at 80,000 variables; the browser can terminate an unresponsive worker after 45 seconds. The chronological draft is retained as a fallback and benchmark (`draftPlanningBlock`); it is not the block optimization action. Outside a block, **Build / Optimize** uses the same full-day search when daily pins or priority stations are present, without creating a saved block; other single days retain the previous algorithm. Draft filling also favors priority first visits, while full optimization can reserve a scarce round for a group pinned elsewhere later.

Production uses a bundled classic worker; development uses module workers. [MDN's compatibility data](https://github.com/mdn/browser-compat-data/blob/main/api/Worker.json) places module-worker support at Safari 15, later than the application's Safari 13 build target. The desktop policy allows same-origin worker/runtime loading and specifically `wasm-unsafe-eval`, without enabling JavaScript `eval`; see the [CSP specification](https://www.w3.org/TR/CSP3/). The solver asset is about 3.43 MB (1.20 MB gzip) and its license notice is shipped in `public/licenses/HiGHS.txt`.

## Acceptance checks

- Five groups over two days can all visit priority Math Games early with capacity two, while two groups retain daily teacher pins. First visits fill the earliest feasible slots; repeatable priority stations yield to other new activities after their first visit.
- Priority objectives are checked against exhaustive small schedules, including multiple priority stations and impossible coverage. Single-day bottlenecks, learner regrouping, completed history, linked edits, and old/new backup imports are covered.

- The September 7–8 classroom case improves the whole-block objective, especially consecutive repeats, without changing once-only limits or daily pins.
- A future bottleneck where a chronological choice loses a once-only visit is solved by changing the earlier choice.
- A tiny independently enumerated schedule agrees with the exact solver's objective vector.
- Multiple pinned groups, shared capacity, a pinned group with only one free round, existing completed/manual visits, removing generated pins, impossible pin requests, once-only conflicts, and migration of old round-specific pins are covered.
- Regrouping, future locks, completed snapshots, shared capacity, unnamed stations, impossible coverage, and arbitrary activity renames are covered.
- Timeout and invalid solver results do not replace a better or valid incumbent.
- Browser worker loading, cancellation, stale edits, and the production asset build are checked. A Mac build still needs a real-device check.

## Validation recorded September 6, 2026

- 147 domain tests pass, including four exhaustive tiny-schedule comparisons of the full priority vector, a future-lock bottleneck, individual learner history after regrouping, retained conflicting locks, impossible daily requirements, bounded larger-group search, solver-output rejection, cancellation, and input freshness.
- In the original four-activity classroom fixture, the chronological plan had three consecutive group repeats (16 affected learner-visits); the optimum has two (10 affected learner-visits), while preserving complete first-visit coverage and the daily teacher pin. Zero consecutive repeats is incompatible with the higher priorities in that fixture.
- In the user's updated five-activity setup—Teacher Table, Reading, Writing, Word Work, and Clay Time—the saved Tuesday gap is filled. Every group covers all five activities, there are no consecutive repeats, all three once-only activities remain once-only, and Blue Stars keeps its Round 1 teacher pin each day. All objective tiers are proven optimal. Verified in the actual local preview.
- The packaged app was separately served on localhost and verified through the browser: a new two-day block optimizes successfully using the bundled worker/Wasm asset, and canceling a subsequent rebuild preserves its routes. No browser errors were reported. Type checking, lint, and the production build pass.
- Solver reports are transient UI state; no backup schema change is needed. The existing frozen old-export compatibility tests continue to pass. No public app or GitHub branch was updated by this work.
