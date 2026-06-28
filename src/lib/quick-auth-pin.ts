import { hashPassword, verifyPassword } from "@/lib/password";

const PIN_RE = /^\d{4}$/;

export function isValidPin(pin: string): boolean {
  return PIN_RE.test(pin);
}

export function hashPin(pin: string): string {
  return hashPassword(pin);
}

export function verifyPin(pin: string, storedHash: string): boolean {
  return verifyPassword(pin, storedHash);
}