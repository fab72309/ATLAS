const pad2 = (value: number) => value.toString().padStart(2, '0');

export const getLocalDate = (date: Date = new Date()) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

export const getLocalTime = (date: Date = new Date()) =>
  `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

export const getLocalDateTime = (date: Date = new Date()) =>
  `${getLocalDate(date)}T${getLocalTime(date)}`;
