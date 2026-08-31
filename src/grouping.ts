import type {
  Group,
  GroupSet,
  Relationship,
  Student,
} from './model';
import { createGroupShells } from './sample';

function relationshipBetween(
  relationships: Relationship[],
  leftId: string,
  rightId: string,
) {
  return relationships.find(
    (relationship) =>
      (relationship.studentAId === leftId && relationship.studentBId === rightId) ||
      (relationship.studentAId === rightId && relationship.studentBId === leftId),
  );
}

function candidateScore(
  student: Student,
  group: Group,
  allStudents: Student[],
  groupSet: GroupSet,
  relationships: Relationship[],
) {
  const members = group.studentIds
    .map((id) => allStudents.find((item) => item.id === id))
    .filter((item): item is Student => Boolean(item));
  let score = members.length * 2;

  for (const member of members) {
    const relationship = relationshipBetween(relationships, student.id, member.id);
    if (relationship?.kind === 'apart') score += 10_000;
    if (relationship?.kind === 'together') score -= 60;
  }

  const attribute = groupSet.recipe.primaryAttribute;
  if (groupSet.recipe.mode === 'mixed') {
    const sameLevel = members.filter((member) => member[attribute] === student[attribute]).length;
    score += sameLevel * 18;
  } else if (members.length) {
    const average = members.reduce((sum, member) => sum + member[attribute], 0) / members.length;
    score += Math.abs(average - student[attribute]) * 20;
  }

  if (groupSet.recipe.secondaryGoal === 'mix-gender' && student.gender) {
    score += members.filter((member) => member.gender === student.gender).length * 4;
  }
  if (groupSet.recipe.secondaryGoal === 'share-language' && student.language) {
    const sharesLanguage = members.some(
      (member) => member.language.toLowerCase() === student.language.toLowerCase(),
    );
    if (sharesLanguage) score -= 7;
  }
  return score;
}

function balancedCapacities(groups: Group[], studentCount: number) {
  const capacities = groups.map((group) => group.studentIds.length);
  let seatsLeft = studentCount - capacities.reduce((sum, count) => sum + count, 0);
  while (seatsLeft > 0) {
    let smallestIndex = 0;
    for (let index = 1; index < capacities.length; index += 1) {
      if (capacities[index] < capacities[smallestIndex]) smallestIndex = index;
    }
    capacities[smallestIndex] += 1;
    seatsLeft -= 1;
  }
  return capacities;
}

function optimalSimilarCapacities(
  students: Student[],
  attribute: GroupSet['recipe']['primaryAttribute'],
  groupCount: number,
) {
  const levels = students.map((student) => student[attribute]).sort((left, right) => left - right);
  const smallerSize = Math.floor(levels.length / groupCount);
  const largerGroups = levels.length % groupCount;
  const bandPenalty = (offset: number, size: number) => {
    const band = levels.slice(offset, offset + size);
    let penalty = 0;
    for (let left = 0; left < band.length; left += 1) {
      for (let right = left + 1; right < band.length; right += 1) {
        const difference = band[left] - band[right];
        penalty += difference * difference;
      }
    }
    return penalty;
  };
  const memo = new Map<string, { penalty: number; capacities: number[] }>();
  const search = (
    groupIndex: number,
    offset: number,
    extrasLeft: number,
  ): { penalty: number; capacities: number[] } => {
    if (groupIndex === groupCount) {
      return {
        penalty: offset === levels.length ? 0 : Number.POSITIVE_INFINITY,
        capacities: [],
      };
    }
    const key = `${groupIndex}:${offset}:${extrasLeft}`;
    const known = memo.get(key);
    if (known) return known;
    const groupsLeft = groupCount - groupIndex;
    const options: { penalty: number; capacities: number[] }[] = [];
    if (groupsLeft > extrasLeft) {
      const rest = search(groupIndex + 1, offset + smallerSize, extrasLeft);
      options.push({
        penalty: bandPenalty(offset, smallerSize) + rest.penalty,
        capacities: [smallerSize, ...rest.capacities],
      });
    }
    if (extrasLeft > 0) {
      const largerSize = smallerSize + 1;
      const rest = search(groupIndex + 1, offset + largerSize, extrasLeft - 1);
      options.push({
        penalty: bandPenalty(offset, largerSize) + rest.penalty,
        capacities: [largerSize, ...rest.capacities],
      });
    }
    const best = options.sort((left, right) => left.penalty - right.penalty)[0];
    memo.set(key, best);
    return best;
  };
  return search(0, 0, largerGroups).capacities;
}

function similarLevelSlots(
  students: Student[],
  attribute: GroupSet['recipe']['primaryAttribute'],
  capacities: number[],
) {
  const levels = students.map((student) => student[attribute]).sort((left, right) => left - right);
  let offset = 0;
  return capacities.map((capacity) => {
    const slots = levels.slice(offset, offset + capacity);
    offset += capacity;
    return slots;
  });
}

function closestLevelSlot(slots: number[], level: number) {
  let closestIndex = 0;
  for (let index = 1; index < slots.length; index += 1) {
    if (Math.abs(slots[index] - level) < Math.abs(slots[closestIndex] - level)) {
      closestIndex = index;
    }
  }
  return closestIndex;
}

function groupPenalty(
  group: Group,
  students: Student[],
  relationships: Relationship[],
  groupSet: GroupSet,
) {
  const members = group.studentIds
    .map((id) => students.find((student) => student.id === id))
    .filter((student): student is Student => Boolean(student));
  const attribute = groupSet.recipe.primaryAttribute;
  let penalty = 0;
  for (let left = 0; left < members.length; left += 1) {
    for (let right = left + 1; right < members.length; right += 1) {
      const leftStudent = members[left];
      const rightStudent = members[right];
      const relationship = relationshipBetween(
        relationships,
        leftStudent.id,
        rightStudent.id,
      );
      if (relationship?.kind === 'apart') penalty += 10_000;
      if (relationship?.kind === 'together') penalty -= 60;

      if (groupSet.recipe.mode === 'similar') {
        const difference = leftStudent[attribute] - rightStudent[attribute];
        penalty += difference * difference * 500;
      } else if (leftStudent[attribute] === rightStudent[attribute]) {
        penalty += 18;
      }

      if (
        groupSet.recipe.secondaryGoal === 'mix-gender' &&
        leftStudent.gender &&
        leftStudent.gender === rightStudent.gender
      ) {
        penalty += 4;
      }
      if (
        groupSet.recipe.secondaryGoal === 'share-language' &&
        leftStudent.language &&
        leftStudent.language.toLowerCase() === rightStudent.language.toLowerCase()
      ) {
        penalty -= 7;
      }
    }
  }
  return penalty;
}

export function groupingPenalty(
  groupSet: GroupSet,
  students: Student[],
  relationships: Relationship[],
) {
  return groupSet.groups.reduce(
    (total, group) => total + groupPenalty(group, students, relationships, groupSet),
    0,
  );
}

export function optimizeGroups(
  students: Student[],
  relationships: Relationship[],
  groupSet: GroupSet,
): GroupSet {
  const startingStudentIds = groupSet.groups
    .flatMap((group) => group.studentIds)
    .sort();
  const groups = groupSet.groups.map((group) => ({
    ...group,
    studentIds: [...group.studentIds],
    lockedStudentIds: [...group.lockedStudentIds],
  }));
  let improved = true;
  let sweep = 0;
  while (improved && sweep < 100) {
    improved = false;
    sweep += 1;
    for (let leftGroupIndex = 0; leftGroupIndex < groups.length; leftGroupIndex += 1) {
      const leftGroup = groups[leftGroupIndex];
      for (let rightGroupIndex = leftGroupIndex + 1; rightGroupIndex < groups.length; rightGroupIndex += 1) {
        const rightGroup = groups[rightGroupIndex];
        for (let leftIndex = 0; leftIndex < leftGroup.studentIds.length; leftIndex += 1) {
          for (let rightIndex = 0; rightIndex < rightGroup.studentIds.length; rightIndex += 1) {
            // A prior accepted swap can change either position. Always read the
            // current learners so a later swap cannot duplicate a stale ID.
            const leftId = leftGroup.studentIds[leftIndex];
            const rightId = rightGroup.studentIds[rightIndex];
            if (leftGroup.lockedStudentIds.includes(leftId)) continue;
            if (rightGroup.lockedStudentIds.includes(rightId)) continue;
            const before =
              groupPenalty(leftGroup, students, relationships, groupSet) +
              groupPenalty(rightGroup, students, relationships, groupSet);
            leftGroup.studentIds[leftIndex] = rightId;
            rightGroup.studentIds[rightIndex] = leftId;
            const after =
              groupPenalty(leftGroup, students, relationships, groupSet) +
              groupPenalty(rightGroup, students, relationships, groupSet);
            if (after < before) {
              improved = true;
            } else {
              leftGroup.studentIds[leftIndex] = leftId;
              rightGroup.studentIds[rightIndex] = rightId;
            }
          }
        }
      }
    }
  }
  const optimizedStudentIds = groups
    .flatMap((group) => group.studentIds)
    .sort();
  const preservedEveryPlacement =
    optimizedStudentIds.length === startingStudentIds.length &&
    optimizedStudentIds.every((id, index) => id === startingStudentIds[index]);
  if (!preservedEveryPlacement) return groupSet;
  return { ...groupSet, groups };
}

export function generateGroups(
  students: Student[],
  relationships: Relationship[],
  groupSet: GroupSet,
): GroupSet {
  const activeStudents = students.filter((student) => !student.absent);
  const desiredCount = Math.max(2, Math.min(8, groupSet.recipe.groupCount));
  const existingByIndex = groupSet.groups;
  const groups = createGroupShells(desiredCount).map((shell, index) => {
    const existing = existingByIndex[index];
    return existing
      ? {
          ...shell,
          id: existing.id,
          name: existing.name,
          color: existing.color,
          symbol: existing.symbol,
          imageDataUrl: existing.imageDataUrl,
          lockedStudentIds: existing.lockedStudentIds.filter((id) =>
            activeStudents.some((student) => student.id === id),
          ),
        }
      : shell;
  });

  const placedLocked = new Set<string>();
  groups.forEach((group, index) => {
    const existing = existingByIndex[index];
    if (!existing) return;
    group.lockedStudentIds = group.lockedStudentIds.filter((id) => {
      if (placedLocked.has(id)) return false;
      group.studentIds.push(id);
      placedLocked.add(id);
      return true;
    });
  });

  const attribute = groupSet.recipe.primaryAttribute;
  const remaining = activeStudents
    .filter((student) => !placedLocked.has(student.id))
    .sort((left, right) => {
      const primary = groupSet.recipe.mode === 'mixed'
        ? right[attribute] - left[attribute]
        : left[attribute] - right[attribute];
      if (primary !== 0) return primary;
      return left.name.localeCompare(right.name);
    });
  const hasLockedPlacements = groups.some((group) => group.studentIds.length > 0);
  const capacities = groupSet.recipe.mode === 'similar' && !hasLockedPlacements
    ? optimalSimilarCapacities(activeStudents, attribute, groups.length)
    : balancedCapacities(groups, activeStudents.length);
  const levelSlots = similarLevelSlots(activeStudents, attribute, capacities);
  if (groupSet.recipe.mode === 'similar') {
    groups.forEach((group, index) => {
      for (const studentId of group.studentIds) {
        const student = activeStudents.find((item) => item.id === studentId);
        if (!student || levelSlots[index].length === 0) continue;
        levelSlots[index].splice(
          closestLevelSlot(levelSlots[index], student[attribute]),
          1,
        );
      }
    });
  }

  for (const student of remaining) {
    const ranked = groups
      .map((group, index) => ({
        group,
        index,
        score:
          candidateScore(
            student,
            group,
            activeStudents,
            groupSet,
            relationships,
          ) +
          (groupSet.recipe.mode === 'similar'
            ? levelSlots[index].length > 0
              ? Math.abs(
                  student[attribute] - levelSlots[index][closestLevelSlot(
                    levelSlots[index],
                    student[attribute],
                  )],
                ) * 500
              : Number.POSITIVE_INFINITY
            : 0),
      }))
      .filter(({ group, index }) =>
        group.studentIds.length < capacities[index] &&
        (groupSet.recipe.mode !== 'similar' || levelSlots[index].length > 0))
      .sort((left, right) => left.score - right.score || left.index - right.index);
    ranked[0].group.studentIds.push(student.id);
    if (groupSet.recipe.mode === 'similar') {
      levelSlots[ranked[0].index].splice(
        closestLevelSlot(levelSlots[ranked[0].index], student[attribute]),
        1,
      );
    }
  }

  return optimizeGroups(activeStudents, relationships, { ...groupSet, groups });
}

export function moveStudent(
  groupSet: GroupSet,
  studentId: string,
  targetGroupId: string,
): GroupSet {
  const source = groupSet.groups.find((group) => group.studentIds.includes(studentId));
  const target = groupSet.groups.find((group) => group.id === targetGroupId);
  if (!target || source?.id === target.id) {
    if (!target) return groupSet;
    return {
      ...groupSet,
      groups: groupSet.groups.map((group) =>
        group.id === target.id
          ? { ...group, lockedStudentIds: Array.from(new Set([...group.lockedStudentIds, studentId])) }
          : group,
      ),
    };
  }

  const groups = groupSet.groups.map((group) => {
    let studentIds = group.studentIds.filter((id) => id !== studentId);
    let lockedStudentIds = group.lockedStudentIds.filter((id) => id !== studentId);
    if (group.id === target.id) {
      studentIds = [...studentIds, studentId];
      lockedStudentIds = [...lockedStudentIds, studentId];
    }
    return { ...group, studentIds, lockedStudentIds };
  });
  return { ...groupSet, groups };
}
