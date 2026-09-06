import type highsLoader from 'highs';
import type { Classroom } from '../model';
import { stationCapacity } from '../rotations';
import {
  constant,
  LinearModel,
  ModelSizeLimit,
  plus,
  scale,
  type Expression,
} from './linearModel';
import {
  choicesFromClassroom,
  classroomFromChoices,
  compareScores,
  createBlockProblem,
  greedyChoices,
  SCORE_LABELS,
  SCORE,
  scoreChoices,
  validChoices,
  type BlockProblem,
  type DailyRequirement,
  type PlannerScore,
} from './problem';

export type PlannerEngine = Awaited<ReturnType<typeof highsLoader>>;
export type PlannerResult = {
  classroom: Classroom;
  blockId: string;
  status: 'optimal' | 'limited' | 'failed';
  before: PlannerScore;
  after: PlannerScore;
  provenPriorities: number;
  elapsedMs: number;
  detail?: string;
};
export type PlannerOptions = {
  timeLimitMs?: number;
  preserveSessionIds?: string[];
  onProgress?: (label: string) => void;
};

function buildModel(problem: BlockProblem) {
  const model = new LinearModel();
  const objectives = SCORE_LABELS.map(() => constant(0));
  const addCost = (priority: number, cost: Expression) => {
    objectives[priority] = plus(objectives[priority], cost);
  };
  const x = problem.slots.map((slot) =>
    slot.choices.map(() => model.variable()),
  );
  const at = (slot: number, key: string) =>
    plus(
      ...problem.slots[slot].choices.flatMap((choice, index) =>
        choice.key === key ? [x[slot][index]] : [],
      ),
    );
  for (const slot of problem.slots) {
    const assigned = plus(...x[slot.index]);
    model.constrain(assigned, '<=', 1);
    addCost(SCORE.empty, plus(constant(1), scale(assigned, -1)));
    const previous = slot.choices.findIndex(
      (choice) => choice.station.id === slot.originalStationId,
    );
    addCost(
      SCORE.changes,
      previous < 0
        ? slot.originalStationId
          ? constant(1)
          : assigned
        : plus(constant(1), scale(x[slot.index][previous], -1)),
    );
  }
  for (const time of problem.times) {
    addCost(SCORE.empty, constant(time.missingFixed));
    for (const { station } of time.choices) {
      const fixed = time.fixed.filter(
        (visit) => visit.assignment.stationId === station.id,
      ).length;
      model.constrain(
        plus(
          ...time.slots.flatMap((slot) =>
            slot.choices.flatMap((choice, index) =>
              choice.station.id === station.id ? [x[slot.index][index]] : [],
            ),
          ),
        ),
        '<=',
        Math.max(0, stationCapacity(station, time.groupCount) - fixed),
      );
    }
  }
  const requiredCount = (requirement: DailyRequirement) =>
    plus(
      ...requirement.times.flatMap((time) => [
        constant(
          problem.times[time].fixed.filter(
            (visit) =>
              visit.assignment.groupId === requirement.groupId &&
              visit.key === requirement.key,
          ).length,
        ),
        ...problem.times[time].slots
          .filter((slot) => slot.groupId === requirement.groupId)
          .map((slot) => at(slot.index, requirement.key)),
      ]),
    );
  for (const requirement of problem.dailyLimits) {
    const count = requiredCount(requirement);
    model.constrain(count, '<=', Math.max(1, count.constant));
  }
  for (const requirement of problem.dailyRequired) {
    addCost(
      requirement.pinned ? SCORE.pinned : SCORE.daily,
      model.positive(
        plus(constant(1), scale(requiredCount(requirement), -1)),
        1,
      ),
    );
  }
  const worstMissing = model.variable(
    false,
    Math.max(0, ...problem.learners.map((learner) => learner.eligible.length)),
  );
  objectives[SCORE.worstMissing] = worstMissing;
  const worstPriorityMissing = problem.priorityActivities.size
    ? model.variable(false, problem.priorityActivities.size)
    : constant(0);
  objectives[SCORE.priorityWorst] = worstPriorityMissing;
  for (const learner of problem.learners) {
    const keys = [...new Set([...learner.eligible, ...learner.fixed.flat()])];
    const visits = problem.times.map(
      (_, time) =>
        new Map(
          keys.map((key) => [
            key,
            plus(
              constant(
                learner.fixed[time].filter((activity) => activity === key)
                  .length,
              ),
              ...learner.slots[time].map((slot) => at(slot, key)),
            ),
          ]),
        ),
    );
    for (const [time, activities] of visits.entries()) {
      model.constrain(
        plus(...activities.values()),
        '<=',
        Math.max(1, learner.fixed[time].length),
      );
    }
    for (const key of problem.onceOnly) {
      const count = plus(
        ...visits.map((activities) => activities.get(key) ?? constant(0)),
      );
      model.constrain(count, '<=', Math.max(1, count.constant));
    }
    let seen = new Map(keys.map((key) => [key, constant(0)]));
    for (const [time, activities] of visits.entries()) {
      const next = new Map(
        keys.map((key) => [
          key,
          model.or([seen.get(key)!, activities.get(key)!]),
        ]),
      );
      const newVisits = plus(
        ...keys.map((key) => plus(next.get(key)!, scale(seen.get(key)!, -1))),
      );
      const repeats = plus(...activities.values(), scale(newVisits, -1));
      const maxRepeats = Math.max(1, learner.fixed[time].length);
      if (learner.slots[time].length || learner.fixed[time].length) {
        for (const key of learner.eligible) {
          if (problem.priorityActivities.has(key) && problem.times[time].choices.some((choice) => choice.key === key)) {
            addCost(SCORE.priorityDelay, scale(plus(constant(1), scale(next.get(key)!, -1)), learner.weight));
          }
        }
      }
      for (const key of learner.eligible) {
        // Repeats * (1 - previously seen), linearized using a bounded repeat count.
        addCost(
          SCORE.prematureRepeats,
          scale(
            model.positive(
              plus(repeats, scale(seen.get(key)!, -maxRepeats)),
              maxRepeats,
            ),
            learner.weight,
          ),
        );
      }
      if (
        time > 0 &&
        problem.times[time - 1].day.id === problem.times[time].day.id
      ) {
        for (const key of keys) {
          const current = activities.get(key)!;
          const previous = visits[time - 1].get(key)!;
          // Editable membership has at most one visit. Retained duplicate
          // history is constant and can be multiplied directly.
          const adjacent =
            current.terms.size === 0
              ? scale(previous, current.constant)
              : previous.terms.size === 0
                ? scale(current, previous.constant)
                : model.positive(plus(current, previous, constant(-1)), 1);
          addCost(SCORE.consecutive, scale(adjacent, learner.weight));
        }
      }
      seen = next;
    }
    const missing = plus(
      constant(learner.eligible.length),
      ...learner.eligible.map((key) => scale(seen.get(key)!, -1)),
    );
    model.constrain(plus(worstMissing, scale(missing, -1)), '>=', 0);
    const priorityMissing = plus(...learner.eligible
      .filter((key) => problem.priorityActivities.has(key))
      .map((key) => plus(constant(1), scale(seen.get(key)!, -1))));
    model.constrain(plus(worstPriorityMissing, scale(priorityMissing, -1)), '>=', 0);
    addCost(SCORE.priorityMissing, scale(priorityMissing, learner.weight));
    addCost(SCORE.missing, scale(missing, learner.weight));
    addCost(
      SCORE.onceMissing,
      scale(
        plus(
          ...learner.eligible
            .filter((key) => problem.onceOnly.has(key))
            .map((key) => plus(constant(1), scale(seen.get(key)!, -1))),
        ),
        learner.weight,
      ),
    );
    const dayIds = [...new Set(problem.times.map((time) => time.day.id))];
    for (const key of keys) {
      const pairCost = (counts: Expression[]) => {
        const count = plus(...counts);
        const bound = counts.reduce(
          (sum, item) => sum + Math.max(1, item.constant),
          0,
        );
        return plus(
          ...Array.from({ length: Math.max(0, bound - 1) }, (_, index) =>
            model.positive(plus(count, constant(-index - 1)), bound),
          ),
        );
      };
      addCost(
        SCORE.blockRepeatPairs,
        scale(
          pairCost(visits.map((activities) => activities.get(key)!)),
          learner.weight,
        ),
      );
      for (const dayId of dayIds) {
        addCost(
          SCORE.dayRepeatPairs,
          scale(
            pairCost(
              visits.flatMap((activities, time) =>
                problem.times[time].day.id === dayId
                  ? [activities.get(key)!]
                  : [],
              ),
            ),
            learner.weight,
          ),
        );
      }
    }
  }
  return { model, objectives, x };
}

export function optimizePlanningBlock(
  engine: PlannerEngine,
  classroom: Classroom,
  blockId: string,
  options: PlannerOptions = {},
): PlannerResult {
  const started = performance.now();
  const limit = Math.max(0, options.timeLimitMs ?? 10_000);
  const problem = createBlockProblem(
    classroom,
    blockId,
    options.preserveSessionIds,
  );
  let best = Array<number>(problem.slots.length).fill(-1);
  let bestScore = scoreChoices(problem, best);
  const original = choicesFromClassroom(problem, classroom);
  const before = scoreChoices(problem, original);
  for (const candidate of [original, greedyChoices(problem)]) {
    if (!validChoices(problem, candidate)) continue;
    const score = scoreChoices(problem, candidate);
    if (compareScores(score, bestScore) <= 0) {
      best = candidate;
      bestScore = score;
    }
  }
  let provenPriorities = 0;
  const finish = (
    status: PlannerResult['status'],
    detail?: string,
  ): PlannerResult => ({
    classroom: classroomFromChoices(problem, best),
    blockId,
    status,
    before,
    after: bestScore,
    provenPriorities,
    elapsedMs: performance.now() - started,
    detail,
  });
  if (limit === 0) return finish('limited');
  let built: ReturnType<typeof buildModel>;
  try {
    built = buildModel(problem);
  } catch (error) {
    if (error instanceof ModelSizeLimit)
      return finish(
        'limited',
        'This block is too large for a full search on this device.',
      );
    throw error;
  }
  const { model, objectives, x } = built;
  for (let priority = 0; priority < objectives.length; priority++) {
    const objective = objectives[priority];
    options.onProgress?.(SCORE_LABELS[priority]);
    // Every score component is nonnegative. A feasible zero proves this tier
    // without another search, which is common for coverage and constraints.
    if (bestScore[priority] === 0 || objective.terms.size === 0) {
      model.constrain(objective, '=', bestScore[priority]);
      provenPriorities++;
      continue;
    }
    const remaining = limit - (performance.now() - started);
    if (remaining <= 0) return finish('limited');
    // The incumbent is feasible for all earlier equalities; this cutoff cannot
    // remove a better solution and avoids returning a worse draft on timeout.
    model.constrain(objective, '<=', bestScore[priority]);
    let solution: ReturnType<PlannerEngine['solve']>;
    try {
      solution = engine.solve(model.text(objective), {
        time_limit: remaining / 1000,
        mip_rel_gap: 0,
        mip_abs_gap: 0,
        random_seed: 0,
        threads: 1,
        output_flag: false,
        log_to_console: false,
      });
    } catch {
      return finish(
        'failed',
        'The planner could not finish its search. The best checked draft was kept.',
      );
    }
    const values = solution.Columns;
    let candidateValid = Boolean(values);
    const candidate = x.map((row) => {
      let choice = -1;
      for (const [index, expression] of row.entries()) {
        const id = [...expression.terms.keys()][0];
        const value = values?.[`v${id}`];
        const primal = value && 'Primal' in value ? value.Primal : NaN;
        if (
          !Number.isFinite(primal) ||
          Math.abs(primal - Math.round(primal)) > 1e-5 ||
          primal < -1e-5 ||
          primal > 1 + 1e-5
        )
          candidateValid = false;
        if (primal > 0.5) {
          if (choice >= 0) candidateValid = false;
          choice = index;
        }
      }
      return choice;
    });
    candidateValid = candidateValid && validChoices(problem, candidate);
    if (candidateValid) {
      const score = scoreChoices(problem, candidate);
      if (
        score
          .slice(0, priority)
          .some((value, index) => value !== bestScore[index])
      )
        candidateValid = false;
      else if (compareScores(score, bestScore) < 0) {
        best = candidate;
        bestScore = score;
      }
      if (
        solution.Status === 'Optimal' &&
        (Math.abs(
          solution.ObjectiveValue + objective.constant - score[priority],
        ) > 1e-4 ||
          score[priority] !== bestScore[priority])
      )
        candidateValid = false;
    }
    if (!candidateValid) {
      if (
        solution.Status === 'Time limit reached' ||
        solution.Status === 'Iteration limit reached'
      )
        return finish('limited');
      return finish(
        'failed',
        'A search result failed validation. The best checked draft was kept.',
      );
    }
    if (solution.Status !== 'Optimal') return finish('limited');
    model.constrain(objective, '=', bestScore[priority]);
    provenPriorities++;
  }
  return finish('optimal');
}
