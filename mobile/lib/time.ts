export type Meridiem = 'a. m.' | 'p. m.';

export const HOUR_OPTIONS = Array.from({ length: 12 }, (_, index) => `${index + 1}`);

export const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, index) =>
  `${index * 5}`.padStart(2, '0'),
);

export const MERIDIEM_OPTIONS: Meridiem[] = ['a. m.', 'p. m.'];

export function parseTime(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  const rawHour = match ? Number(match[1]) : 18;
  const rawMinute = match ? Number(match[2]) : 0;

  const hour24 = Math.min(Math.max(rawHour, 0), 23);
  const minute = Math.min(Math.max(Math.round(rawMinute / 5) * 5, 0), 55);
  const meridiem: Meridiem = hour24 >= 12 ? 'p. m.' : 'a. m.';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  return { hour: `${hour12}`, minute: `${minute}`.padStart(2, '0'), meridiem };
}

export function toTimeString(hour: string, minute: string, meridiem: Meridiem) {
  const base = Number(hour) % 12;
  const hour24 = meridiem === 'p. m.' ? base + 12 : base;
  return `${`${hour24}`.padStart(2, '0')}:${minute}`;
}

export function formatTime12(value: string) {
  const { hour, minute, meridiem } = parseTime(value);
  return `${hour}:${minute} ${meridiem}`;
}
