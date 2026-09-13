import type { Student } from './model';

export type PickerStudent = Pick<Student, 'id' | 'name'>;

// Use the whole present roster, including students who have no group yet.
// Only presentation fields leave the teacher's roster.
export function eligiblePickerStudents(students: readonly Student[]): PickerStudent[] {
  const seen = new Set<string>();
  return students.flatMap((student) => {
    if (student.absent || seen.has(student.id)) return [];
    seen.add(student.id);
    return [{ id: student.id, name: student.name }];
  });
}

// Each draw is independent. A previous winner can be picked again.
// An injected random function follows Math.random's range: [0, 1).
export function pickStudent(students: readonly PickerStudent[], random = Math.random): PickerStudent | null {
  if (!students.length) return null;
  return students[Math.floor(random() * students.length)];
}
