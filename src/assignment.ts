type Cost = number[];
const add = (a: Cost, b: Cost): Cost =>
  a.map((value, index) => value + b[index]);
const subtract = (a: Cost, b: Cost): Cost =>
  a.map((value, index) => value - b[index]);
function less(a: Cost, b: Cost) {
  for (let index = 0; index < a.length; index++) {
    if (a[index] !== b[index]) return a[index] < b[index];
  }
  return false;
}

// Rectangular Hungarian assignment with lexicographic costs. Duplicated station
// slots represent capacity; dummy slots allow explicit gaps. This stays
// polynomial when a class has many pairs instead of only five or six groups.
export function minimumCostAssignment(
  costs: (Cost | null)[][],
  capacities: number[],
): (number | undefined)[] {
  const dimensions = costs.flat().find((cost) => cost !== null)?.length ?? 1;
  const zero = (): Cost => Array<number>(dimensions).fill(0);
  const gapCost = zero();
  gapCost[0] = 1;
  const n = costs.length;
  const slots = capacities.flatMap((capacity, station) =>
    Array.from({ length: Math.min(n, capacity) }, () => station),
  );
  slots.push(...Array.from({ length: n }, () => -1));
  const m = slots.length;
  const u = Array.from({ length: n + 1 }, zero);
  const v = Array.from({ length: m + 1 }, zero);
  const occupants = Array<number>(m + 1).fill(0);
  const previous = Array<number>(m + 1).fill(0);
  for (let row = 1; row <= n; row++) {
    occupants[0] = row;
    let column = 0;
    const best: (Cost | null)[] = Array(m + 1).fill(null);
    const used = Array<boolean>(m + 1).fill(false);
    do {
      used[column] = true;
      const currentRow = occupants[column];
      let delta: Cost | null = null;
      let nextColumn = 0;
      for (let candidate = 1; candidate <= m; candidate++) {
        if (used[candidate]) continue;
        const station = slots[candidate - 1];
        const cost = station < 0 ? gapCost : costs[currentRow - 1][station];
        if (cost) {
          const reduced = subtract(subtract(cost, u[currentRow]), v[candidate]);
          if (!best[candidate] || less(reduced, best[candidate]!)) {
            best[candidate] = reduced;
            previous[candidate] = column;
          }
        }
        if (best[candidate] && (!delta || less(best[candidate]!, delta))) {
          delta = best[candidate];
          nextColumn = candidate;
        }
      }
      if (!delta) throw new Error('No available assignment slot');
      for (let candidate = 0; candidate <= m; candidate++) {
        if (used[candidate]) {
          u[occupants[candidate]] = add(u[occupants[candidate]], delta);
          v[candidate] = subtract(v[candidate], delta);
        } else if (best[candidate])
          best[candidate] = subtract(best[candidate]!, delta);
      }
      column = nextColumn;
    } while (occupants[column] !== 0);
    do {
      const next = previous[column];
      occupants[column] = occupants[next];
      column = next;
    } while (column !== 0);
  }
  const result: (number | undefined)[] = Array(n).fill(undefined);
  for (let column = 1; column <= m; column++) {
    if (occupants[column] && slots[column - 1] >= 0)
      result[occupants[column] - 1] = slots[column - 1];
  }
  return result;
}
