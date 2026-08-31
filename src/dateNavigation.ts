function dateAtNoon(value: string) {
  return new Date(`${value}T12:00:00`);
}

function dateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function shiftSchoolDay(value: string, direction: -1 | 1) {
  const next = dateAtNoon(value);
  do {
    next.setDate(next.getDate() + direction);
  } while (next.getDay() === 0 || next.getDay() === 6);
  return dateValue(next);
}

export function shiftCalendarMonth(value: string, direction: -1 | 1) {
  const [year, month] = value.split('-').map(Number);
  const next = new Date(year, month - 1 + direction, 1, 12);
  return dateValue(next).slice(0, 7);
}

export function calendarMonth(value: string) {
  const [year, month] = value.split('-').map(Number);
  const first = new Date(year, month - 1, 1, 12);
  const final = new Date(year, month, 0, 12);
  return {
    leadingBlanks: first.getDay(),
    dates: Array.from(
      { length: final.getDate() },
      (_, index) => dateValue(new Date(year, month - 1, index + 1, 12)),
    ),
  };
}
