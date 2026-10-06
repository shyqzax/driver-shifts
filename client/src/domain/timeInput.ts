/**
 * Ввод времени цифрами: двоеточие ставится само. «12» → «12:», «1230» → «12:30».
 * Первая цифра 3–9 может быть только часом из одной цифры: «9» → «09:».
 * При стирании двоеточие само не возвращается — иначе стереть «12:» не получится.
 */
export function maskTimeInput(raw: string, previous: string): string {
  const isDeleting = raw.length < previous.length;
  let digits = raw.replace(/\D/g, "").slice(0, 4);
  if (!isDeleting && digits.length === 1 && Number(digits) > 2) {
    digits = `0${digits}`;
  }
  if (digits.length < 2) return digits;
  if (digits.length === 2) return isDeleting ? digits : `${digits}:`;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export function isTimeTextComplete(text: string): boolean {
  return /^\d{2}:\d{2}$/.test(text);
}

/** «12:30» → 750 минут от полуночи; неполное или несуществующее время — null. */
export function parseTimeText(text: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(text);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}
