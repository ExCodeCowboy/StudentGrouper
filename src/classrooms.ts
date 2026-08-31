import type { AppData } from './model';

export function renameClassroom(
  data: AppData,
  classroomId: string,
  requestedName: string,
): AppData {
  const name = requestedName.trim();
  const classroom = data.classrooms.find((item) => item.id === classroomId);
  if (!classroom || !name || classroom.name === name) return data;
  return {
    ...data,
    classrooms: data.classrooms.map((item) =>
      item.id === classroomId ? { ...item, name } : item),
  };
}

export function deleteClassroom(data: AppData, classroomId: string): AppData {
  if (data.classrooms.length <= 1) return data;
  if (!data.classrooms.some((item) => item.id === classroomId)) return data;
  const classrooms = data.classrooms.filter((item) => item.id !== classroomId);
  return {
    ...data,
    classrooms,
    activeClassroomId: data.activeClassroomId === classroomId
      ? classrooms[0].id
      : data.activeClassroomId,
  };
}
