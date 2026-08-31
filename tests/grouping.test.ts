import assert from 'node:assert/strict';
import { describe as nodeDescribe, test as nodeTest } from 'node:test';
import {
  generateGroups,
  groupingPenalty,
  moveStudent,
  optimizeGroups,
} from '../src/grouping';
import type { GroupSet, Relationship, Student } from '../src/model';
import { groupSet, sampleClassroom, student, studentsWithLevels } from './fixtures';

function describe(name: string, body: () => void) {
  void nodeDescribe(name, body);
}

function test(name: string, body: () => void) {
  void nodeTest(name, body);
}

function placedStudentIds(set: GroupSet) {
  return set.groups.flatMap((group) => group.studentIds);
}

function groupContaining(set: GroupSet, studentId: string) {
  return set.groups.find((group) => group.studentIds.includes(studentId));
}

function skillDispersion(set: GroupSet, pupils: Student[]) {
  return set.groups.reduce((total, group) => {
    const levels = group.studentIds.map(
      (id) => pupils.find((studentItem) => studentItem.id === id)!.reading,
    );
    let groupTotal = 0;
    for (let left = 0; left < levels.length; left += 1) {
      for (let right = left + 1; right < levels.length; right += 1) {
        const difference = levels[left] - levels[right];
        groupTotal += difference * difference;
      }
    }
    return total + groupTotal;
  }, 0);
}

function optimalBalancedDispersion(levels: number[], groupCount: number) {
  const sorted = [...levels].sort((left, right) => left - right);
  const smallerSize = Math.floor(levels.length / groupCount);
  const largerGroups = levels.length % groupCount;
  const bandCost = (offset: number, size: number) => {
    const band = sorted.slice(offset, offset + size);
    let total = 0;
    for (let left = 0; left < band.length; left += 1) {
      for (let right = left + 1; right < band.length; right += 1) {
        const difference = band[left] - band[right];
        total += difference * difference;
      }
    }
    return total;
  };
  const memo = new Map<string, number>();
  const search = (groupIndex: number, offset: number, extrasLeft: number): number => {
    if (groupIndex === groupCount) return offset === sorted.length ? 0 : Number.POSITIVE_INFINITY;
    const key = `${groupIndex}:${offset}:${extrasLeft}`;
    const known = memo.get(key);
    if (known !== undefined) return known;
    let best = Number.POSITIVE_INFINITY;
    const groupsLeft = groupCount - groupIndex;
    if (groupsLeft > extrasLeft) {
      best = Math.min(
        best,
        bandCost(offset, smallerSize) +
          search(groupIndex + 1, offset + smallerSize, extrasLeft),
      );
    }
    if (extrasLeft > 0) {
      const largerSize = smallerSize + 1;
      best = Math.min(
        best,
        bandCost(offset, largerSize) +
          search(groupIndex + 1, offset + largerSize, extrasLeft - 1),
      );
    }
    memo.set(key, best);
    return best;
  };
  return search(0, 0, largerGroups);
}

describe('generateGroups', () => {
  test('places every present student exactly once and keeps ordinary groups balanced', () => {
    const classroom = sampleClassroom();
    const set = classroom.groupSets[0];
    const originalStudents = structuredClone(classroom.students);
    const originalSet = structuredClone(set);

    const generated = generateGroups(classroom.students, classroom.relationships, set);
    const placed = placedStudentIds(generated);
    const sizes = generated.groups.map((group) => group.studentIds.length);

    assert.equal(placed.length, classroom.students.length);
    assert.equal(new Set(placed).size, placed.length);
    assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
    assert.deepEqual(classroom.students, originalStudents, 'students are not mutated');
    assert.deepEqual(set, originalSet, 'the saved arrangement is not mutated');
  });

  test('omits absent students, including students whose old placement was locked', () => {
    const classroom = sampleClassroom();
    classroom.students.find((item) => item.id === 'student-2')!.absent = true;

    const generated = generateGroups(
      classroom.students,
      classroom.relationships,
      classroom.groupSets[0],
    );

    assert.ok(!placedStudentIds(generated).includes('student-2'));
    assert.ok(!generated.groups.flatMap((group) => group.lockedStudentIds).includes('student-2'));
  });

  test('clamps the requested group count to the supported range of two through eight', () => {
    const pupils = studentsWithLevels([1, 2, 3]);
    const tooFew = generateGroups(pupils, [], groupSet(1));
    const tooMany = generateGroups(pupils, [], groupSet(10));

    assert.equal(tooFew.groups.length, 2);
    assert.equal(tooMany.groups.length, 8);
  });

  test('preserves one canonical placement when malformed data locks a student twice', () => {
    const pupils = [student('student-1'), student('student-2', { absent: true })];
    const set = groupSet(3);
    set.groups[0].lockedStudentIds = ['student-1', 'missing-student'];
    set.groups[1].lockedStudentIds = ['student-1', 'student-2'];

    const generated = generateGroups(pupils, [], set);

    assert.deepEqual(placedStudentIds(generated), ['student-1']);
    assert.deepEqual(generated.groups.flatMap((group) => group.lockedStudentIds), ['student-1']);
    assert.equal(groupContaining(generated, 'student-1')?.id, set.groups[0].id);
  });

  test('keeps a valid locked student in the same group when regenerating', () => {
    const classroom = sampleClassroom();
    classroom.groupSets[0].groups[0].imageDataUrl = 'data:image/png;base64,group-picture';
    const generated = generateGroups(
      classroom.students,
      classroom.relationships,
      classroom.groupSets[0],
    );

    assert.ok(generated.groups[0].studentIds.includes('student-2'));
    assert.ok(generated.groups[0].lockedStudentIds.includes('student-2'));
    assert.equal(generated.groups[0].imageDataUrl, 'data:image/png;base64,group-picture');
  });

  test('places the full roster with five similar-reading groups and mixed genders', () => {
    const classroom = sampleClassroom();
    const set = classroom.groupSets[0];
    set.recipe = {
      groupCount: 5,
      primaryAttribute: 'reading',
      mode: 'similar',
      secondaryGoal: 'mix-gender',
    };

    const generated = generateGroups(classroom.students, classroom.relationships, set);
    const expectedIds = classroom.students
      .filter((studentItem) => !studentItem.absent)
      .map((studentItem) => studentItem.id)
      .sort();
    const placedIds = placedStudentIds(generated).sort();

    assert.deepEqual(placedIds, expectedIds);
    assert.equal(new Set(placedIds).size, expectedIds.length);
    assert.deepEqual(
      generated.groups.map((group) => group.studentIds.length).sort((left, right) => left - right),
      [4, 5, 5, 5, 5],
    );
  });

  test('separates a keep-apart pair when another group is available', () => {
    const pupils = studentsWithLevels([2, 2, 2, 2]);
    const relationships: Relationship[] = [{
      id: 'apart-1',
      studentAId: pupils[0].id,
      studentBId: pupils[1].id,
      kind: 'apart',
    }];

    const generated = generateGroups(pupils, relationships, groupSet(2));

    assert.notEqual(
      groupContaining(generated, pupils[0].id)?.id,
      groupContaining(generated, pupils[1].id)?.id,
    );
  });

  test('places a prefer-together pair together without unbalancing the result', () => {
    const pupils = studentsWithLevels([2, 2, 2, 2]);
    const relationships: Relationship[] = [{
      id: 'together-1',
      studentAId: pupils[0].id,
      studentBId: pupils[1].id,
      kind: 'together',
    }];

    const generated = generateGroups(pupils, relationships, groupSet(2));

    assert.equal(
      groupContaining(generated, pupils[0].id)?.id,
      groupContaining(generated, pupils[1].id)?.id,
    );
    assert.deepEqual(generated.groups.map((group) => group.studentIds.length), [2, 2]);
  });

  test('relationship preferences cannot create uneven automatic group sizes', () => {
    const pupils = studentsWithLevels(Array.from({ length: 12 }, () => 2));
    const relationships: Relationship[] = [];
    for (let left = 0; left < pupils.length; left += 1) {
      for (let right = left + 1; right < pupils.length; right += 1) {
        relationships.push({
          id: `together-${left}-${right}`,
          studentAId: pupils[left].id,
          studentBId: pupils[right].id,
          kind: 'together',
        });
      }
    }

    const generated = generateGroups(pupils, relationships, groupSet(3));

    assert.deepEqual(generated.groups.map((group) => group.studentIds.length), [4, 4, 4]);
  });

  test('uses locked placements when choosing which groups receive the extra seat', () => {
    const pupils = studentsWithLevels(Array.from({ length: 10 }, () => 2));
    const set = groupSet(3);
    set.groups[0].lockedStudentIds = pupils.slice(0, 3).map((item) => item.id);
    set.groups[1].lockedStudentIds = pupils.slice(3, 7).map((item) => item.id);

    const generated = generateGroups(pupils, [], set);

    assert.deepEqual(generated.groups.map((group) => group.studentIds.length), [3, 4, 3]);
  });

  test('when locks force imbalance, unlocked students are distributed as evenly as possible', () => {
    const pupils = studentsWithLevels(Array.from({ length: 10 }, () => 2));
    const set = groupSet(3);
    set.groups[0].lockedStudentIds = pupils.slice(0, 5).map((item) => item.id);

    const generated = generateGroups(pupils, [], set);
    const sizes = generated.groups.map((group) => group.studentIds.length);

    assert.equal(sizes[0], 5);
    assert.ok(Math.abs(sizes[1] - sizes[2]) <= 1);
    assert.equal(sizes.reduce((sum, size) => sum + size, 0), pupils.length);
  });

  test('mixed-skill mode distributes low, medium, and high students across groups', () => {
    const pupils = studentsWithLevels([3, 3, 2, 2, 1, 1]);
    const generated = generateGroups(pupils, [], groupSet(2));

    const levelRoutes = generated.groups.map((group) =>
      group.studentIds
        .map((id) => pupils.find((item) => item.id === id)!.reading)
        .sort((left, right) => left - right),
    );
    assert.deepEqual(levelRoutes, [[1, 2, 3], [1, 2, 3]]);
  });

  test('similar-skill mode forms meaningfully different skill bands', () => {
    const classroom = sampleClassroom();
    const base = classroom.groupSets[0];
    const generated = generateGroups(classroom.students, classroom.relationships, {
      ...base,
      recipe: { ...base.recipe, primaryAttribute: 'math', mode: 'similar' },
      groups: base.groups.map((group) => ({ ...group, lockedStudentIds: [] })),
    });
    const averages = generated.groups.map((group) =>
      group.studentIds.reduce(
        (sum, id) => sum + classroom.students.find((item) => item.id === id)!.math,
        0,
      ) / group.studentIds.length,
    );

    assert.ok(Math.max(...averages) - Math.min(...averages) >= 1.5);
  });

  test('similar-skill mode does not strand high learners in a low band on a skewed roster', () => {
    const pupils = studentsWithLevels([1, 1, 2, 2, 2, 2, 2, 2, 3, 3]);
    const set = groupSet(3);
    set.recipe.mode = 'similar';

    const generated = generateGroups(pupils, [], set);
    const bands = generated.groups.map((group) =>
      group.studentIds
        .map((id) => pupils.find((item) => item.id === id)!.reading)
        .sort((left, right) => left - right),
    );

    assert.deepEqual(bands, [[1, 1, 2], [2, 2, 2, 2], [2, 3, 3]]);
  });

  test('similar-skill mode matches the optimal balanced skill dispersion across skewed rosters', () => {
    const patterns = [
      (index: number) => (index % 3) + 1,
      (index: number, count: number) => index < count * 0.6 ? 1 : index < count * 0.85 ? 2 : 3,
      (index: number, count: number) => index < count * 0.15 ? 1 : index < count * 0.4 ? 2 : 3,
      (index: number) => ((index * 7 + 2) % 3) + 1,
      (index: number) => ((index * index + 1) % 3) + 1,
    ];
    for (let studentCount = 2; studentCount <= 32; studentCount += 1) {
      for (let count = 2; count <= Math.min(8, studentCount); count += 1) {
        for (const pattern of patterns) {
          const levels = Array.from(
            { length: studentCount },
            (_, index) => pattern(index, studentCount) as 1 | 2 | 3,
          );
          const pupils = studentsWithLevels(levels);
          const set = groupSet(count);
          set.recipe.mode = 'similar';
          const generated = generateGroups(pupils, [], set);

          assert.equal(
            skillDispersion(generated, pupils),
            optimalBalancedDispersion(levels, count),
            `${studentCount} learners in ${count} groups missed the optimal bands for ${levels.join(',')}`,
          );
        }
      }
    }
  });

  test('mix-gender goal gives every group both genders when the roster permits it', () => {
    const pupils: Student[] = Array.from({ length: 8 }, (_, index) =>
      student(`student-${index + 1}`, {
        name: String.fromCharCode(65 + index),
        gender: index < 4 ? 'Girl' : 'Boy',
      }),
    );
    const set = groupSet(2);
    set.recipe.secondaryGoal = 'mix-gender';

    const generated = generateGroups(pupils, [], set);

    for (const group of generated.groups) {
      const genders = new Set(
        group.studentIds.map((id) => pupils.find((item) => item.id === id)!.gender),
      );
      assert.deepEqual(genders, new Set(['Girl', 'Boy']));
    }
  });

  test('share-language goal clusters students who share a language', () => {
    const pupils: Student[] = Array.from({ length: 8 }, (_, index) =>
      student(`student-${index + 1}`, {
        name: String.fromCharCode(65 + index),
        language: index % 2 === 0 ? 'Spanish' : 'English',
      }),
    );
    const set = groupSet(2);
    set.recipe.secondaryGoal = 'share-language';

    const generated = generateGroups(pupils, [], set);

    for (const group of generated.groups) {
      const languages = new Set(
        group.studentIds.map((id) => pupils.find((item) => item.id === id)!.language),
      );
      assert.equal(languages.size, 1);
    }
  });

  test('returns the same grouping for the same inputs', () => {
    const classroom = sampleClassroom();
    const first = generateGroups(
      classroom.students,
      classroom.relationships,
      classroom.groupSets[0],
    );
    const second = generateGroups(
      classroom.students,
      classroom.relationships,
      classroom.groupSets[0],
    );

    assert.deepEqual(second, first);
  });

  test('places every learner exactly once across recipes, roster sizes, and group counts', () => {
    for (let studentCount = 1; studentCount <= 25; studentCount += 1) {
      const levels = Array.from(
        { length: studentCount },
        (_, index) => ((index % 3) + 1) as 1 | 2 | 3,
      );
      const pupils = levels.map((level, index) => student(`student-${index + 1}`, {
        reading: level,
        math: level,
        writing: level,
        gender: index % 2 === 0 ? 'Girl' : 'Boy',
        language: index % 3 === 0 ? 'Spanish' : 'English',
      }));
      for (let count = 2; count <= 8; count += 1) {
        for (const mode of ['mixed', 'similar'] as const) {
          for (const secondaryGoal of ['none', 'mix-gender', 'share-language'] as const) {
            const set = groupSet(count);
            set.recipe.mode = mode;
            set.recipe.secondaryGoal = secondaryGoal;
            const generated = generateGroups(pupils, [], set);
            const placedIds = placedStudentIds(generated);
            const sizes = generated.groups.map((group) => group.studentIds.length);

            assert.equal(placedIds.length, pupils.length);
            assert.equal(new Set(placedIds).size, pupils.length);
            assert.deepEqual(
              [...placedIds].sort(),
              pupils.map((studentItem) => studentItem.id).sort(),
            );
            assert.ok(
              Math.max(...sizes) - Math.min(...sizes) <= 1,
              `${studentCount} students in ${count} ${mode}/${secondaryGoal} groups were uneven`,
            );
          }
        }
      }
    }
  });
});

describe('multi-pass group optimization', () => {
  test('repeated swaps turn an initially crossed similar-level arrangement into clean bands', () => {
    const pupils = studentsWithLevels([1, 1, 3, 3]);
    const set = groupSet(2);
    set.recipe.mode = 'similar';
    set.groups[0].studentIds = [pupils[0].id, pupils[2].id];
    set.groups[1].studentIds = [pupils[1].id, pupils[3].id];
    const original = structuredClone(set);
    const before = groupingPenalty(set, pupils, []);

    const optimized = optimizeGroups(pupils, [], set);
    const bands = optimized.groups.map((group) => new Set(
      group.studentIds.map((id) => pupils.find((item) => item.id === id)!.reading),
    ));

    assert.deepEqual(set, original, 'the prior arrangement is not mutated');
    assert.ok(groupingPenalty(optimized, pupils, []) < before);
    assert.ok(bands.every((band) => band.size === 1));
    assert.deepEqual(optimized.groups.map((group) => group.studentIds.length), [2, 2]);
  });

  test('uses later passes to improve the secondary language goal without changing skill quality', () => {
    const pupils = [
      student('student-1', { language: 'Spanish' }),
      student('student-2', { language: 'English' }),
      student('student-3', { language: 'Spanish' }),
      student('student-4', { language: 'English' }),
    ];
    const set = groupSet(2);
    set.recipe.secondaryGoal = 'share-language';
    set.groups[0].studentIds = ['student-1', 'student-2'];
    set.groups[1].studentIds = ['student-3', 'student-4'];

    const optimized = optimizeGroups(pupils, [], set);

    for (const group of optimized.groups) {
      const languages = new Set(
        group.studentIds.map((id) => pupils.find((item) => item.id === id)!.language),
      );
      assert.equal(languages.size, 1);
    }
  });

  test('never moves a locked learner during optimization', () => {
    const pupils = studentsWithLevels([1, 1, 3, 3]);
    const set = groupSet(2);
    set.recipe.mode = 'similar';
    set.groups[0].studentIds = [pupils[0].id, pupils[2].id];
    set.groups[1].studentIds = [pupils[1].id, pupils[3].id];
    set.groups[0].lockedStudentIds = [pupils[2].id];
    set.groups[1].lockedStudentIds = [pupils[1].id];

    const optimized = optimizeGroups(pupils, [], set);

    assert.ok(optimized.groups[0].studentIds.includes(pupils[2].id));
    assert.ok(optimized.groups[1].studentIds.includes(pupils[1].id));
  });

  test('stops at a local optimum with no improving unlocked one-student swap', () => {
    const pupils = Array.from({ length: 12 }, (_, index) =>
      student(`student-${index + 1}`, {
        name: String.fromCharCode(65 + index),
        reading: ((index * 2) % 3 + 1) as 1 | 2 | 3,
        language: index % 3 === 0 ? 'Spanish' : 'English',
        gender: index % 2 === 0 ? 'Girl' : 'Boy',
      }),
    );
    const relationships: Relationship[] = [
      { id: 'together-a', studentAId: 'student-1', studentBId: 'student-10', kind: 'together' },
      { id: 'together-b', studentAId: 'student-2', studentBId: 'student-8', kind: 'together' },
      { id: 'apart-a', studentAId: 'student-3', studentBId: 'student-6', kind: 'apart' },
    ];
    const set = groupSet(3);
    set.recipe.mode = 'similar';
    set.recipe.secondaryGoal = 'share-language';
    const optimized = generateGroups(pupils, relationships, set);
    const score = groupingPenalty(optimized, pupils, relationships);

    for (let leftGroup = 0; leftGroup < optimized.groups.length; leftGroup += 1) {
      for (let rightGroup = leftGroup + 1; rightGroup < optimized.groups.length; rightGroup += 1) {
        for (let left = 0; left < optimized.groups[leftGroup].studentIds.length; left += 1) {
          for (let right = 0; right < optimized.groups[rightGroup].studentIds.length; right += 1) {
            const candidate = structuredClone(optimized);
            const leftId = candidate.groups[leftGroup].studentIds[left];
            candidate.groups[leftGroup].studentIds[left] = candidate.groups[rightGroup].studentIds[right];
            candidate.groups[rightGroup].studentIds[right] = leftId;
            assert.ok(groupingPenalty(candidate, pupils, relationships) >= score);
          }
        }
      }
    }
  });
});

describe('moveStudent', () => {
  test('moves and locks only the dragged student', () => {
    const classroom = sampleClassroom();
    const generated = generateGroups(
      classroom.students,
      classroom.relationships,
      classroom.groupSets[0],
    );
    const original = structuredClone(generated);
    const movedStudentId = generated.groups[0].studentIds.find((id) => id !== 'student-2')!;
    const targetGroupId = generated.groups[1].id;

    const moved = moveStudent(generated, movedStudentId, targetGroupId);

    assert.deepEqual(generated, original, 'the prior arrangement is not mutated');
    assert.ok(groupContaining(moved, movedStudentId)?.id === targetGroupId);
    assert.ok(
      moved.groups.find((group) => group.id === targetGroupId)!
        .lockedStudentIds.includes(movedStudentId),
    );
    const everyoneElseBefore = placedStudentIds(generated)
      .filter((id) => id !== movedStudentId)
      .map((id) => [id, groupContaining(generated, id)?.id]);
    const everyoneElseAfter = placedStudentIds(moved)
      .filter((id) => id !== movedStudentId)
      .map((id) => [id, groupContaining(moved, id)?.id]);
    assert.deepEqual(everyoneElseAfter, everyoneElseBefore);
  });

  test('dragging within the same group adds one deliberate lock', () => {
    const set = groupSet(2);
    set.groups[0].studentIds = ['student-1'];

    const once = moveStudent(set, 'student-1', set.groups[0].id);
    const twice = moveStudent(once, 'student-1', set.groups[0].id);

    assert.deepEqual(twice.groups[0].lockedStudentIds, ['student-1']);
    assert.deepEqual(twice.groups[0].studentIds, ['student-1']);
  });

  test('moving a previously locked student clears the old lock', () => {
    const set = groupSet(2);
    set.groups[0].studentIds = ['student-1'];
    set.groups[0].lockedStudentIds = ['student-1'];

    const moved = moveStudent(set, 'student-1', set.groups[1].id);

    assert.deepEqual(moved.groups[0].lockedStudentIds, []);
    assert.deepEqual(moved.groups[1].lockedStudentIds, ['student-1']);
  });

  test('can place an unassigned student and returns the same value for an unknown target', () => {
    const set = groupSet(2);
    const placed = moveStudent(set, 'student-1', set.groups[1].id);
    const ignored = moveStudent(set, 'student-1', 'missing-group');

    assert.deepEqual(placed.groups[1].studentIds, ['student-1']);
    assert.deepEqual(placed.groups[1].lockedStudentIds, ['student-1']);
    assert.equal(ignored, set);
  });
});
