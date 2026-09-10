/** Client-safe strong password for signup Auto Generate. */

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%*?";
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

function randomIndex(max: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % max;
}

function pick(alphabet: string): string {
  return alphabet[randomIndex(alphabet.length)]!;
}

function shuffle(chars: string[]): string[] {
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1);
    const a = chars[i]!;
    chars[i] = chars[j]!;
    chars[j] = a;
  }
  return chars;
}

/** Meets browser passwordRules: 8+ chars, lower, upper, digit. */
export function generateSignupPassword(length = 16): string {
  const size = Math.max(12, Math.min(32, length));
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < size) chars.push(pick(ALL));
  return shuffle(chars).join("");
}
