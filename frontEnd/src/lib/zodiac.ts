// Client mirror of backEnd/helpers/zodiac.js, sun signs only.
//
// Duplicated rather than fetched because the sign has to appear the instant a
// date is picked — a round-trip to show "♌ Leo" under the input would make the
// one delightful moment in the form feel broken. The server stays the
// authority: whatever it computes is what the reading uses.
//
// If the cusp dates here ever drift from the server's, the form shows one sign
// and the result shows another. Keep the two tables in sync.

export type Sign = { name: string; emoji: string };

const SIGN_RANGES: Array<{ month: number; day: number; name: string; emoji: string }> = [
  { month: 1, day: 1, name: "Capricorn", emoji: "♑" },
  { month: 1, day: 20, name: "Aquarius", emoji: "♒" },
  { month: 2, day: 19, name: "Pisces", emoji: "♓" },
  { month: 3, day: 21, name: "Aries", emoji: "♈" },
  { month: 4, day: 20, name: "Taurus", emoji: "♉" },
  { month: 5, day: 21, name: "Gemini", emoji: "♊" },
  { month: 6, day: 21, name: "Cancer", emoji: "♋" },
  { month: 7, day: 23, name: "Leo", emoji: "♌" },
  { month: 8, day: 23, name: "Virgo", emoji: "♍" },
  { month: 9, day: 23, name: "Libra", emoji: "♎" },
  { month: 10, day: 23, name: "Scorpio", emoji: "♏" },
  { month: 11, day: 22, name: "Sagittarius", emoji: "♐" },
  { month: 12, day: 22, name: "Capricorn", emoji: "♑" },
];

// Parsed by hand rather than with `new Date(value)`: that treats a bare
// "YYYY-MM-DD" as UTC midnight, which reads back as the previous day for
// anyone west of Greenwich and silently hands them the wrong sign.
export function signForDate(value: string | null | undefined): Sign | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (year < 1900 || year > new Date().getFullYear()) return null;

  let sign = SIGN_RANGES[0];
  for (const range of SIGN_RANGES) {
    if (month > range.month || (month === range.month && day >= range.day)) sign = range;
  }
  return { name: sign.name, emoji: sign.emoji };
}

// Widest date the form should accept, as an input[type=date] max. Nobody under
// 13 should be here (and the terms say so), so the cap doubles as a soft gate.
export function maxBirthDate(): string {
  const now = new Date();
  const cutoff = new Date(now.getFullYear() - 13, now.getMonth(), now.getDate());
  return `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(
    cutoff.getDate()
  ).padStart(2, "0")}`;
}
