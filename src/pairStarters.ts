import type { GroupSet, Student } from './model';

// Choose once and save the choice. Rendering, revealing, and ordinary edits
// must not redraw a starter while that student is still present in the pair.
export function ensurePairStarters(groupSet: GroupSet, students: Student[], random: () => number = Math.random): GroupSet {
  const present = new Set(students.filter((student) => !student.absent).map((student) => student.id));
  let changed = false;
  const groups = groupSet.groups.map((group) => {
    const candidates = groupSet.recipe.sizeMode === 'pairs'
      ? [...new Set(group.studentIds.filter((id) => present.has(id)))]
      : [];
    const starterStudentId = group.starterStudentId && candidates.includes(group.starterStudentId)
      ? group.starterStudentId
      : candidates.length ? candidates[Math.floor(random() * candidates.length)] : undefined;
    if (starterStudentId === group.starterStudentId) return group;
    changed = true;
    const next = { ...group };
    if (starterStudentId) next.starterStudentId = starterStudentId;
    else delete next.starterStudentId;
    return next;
  });
  return changed ? { ...groupSet, groups } : groupSet;
}
