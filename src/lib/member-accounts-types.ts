import type { UserRole } from "@/lib/auth-session";

export type StoredMemberAccount = {
  userId: string;
  role: UserRole;
  name: string;
  phone?: string | null;
  passwordHash?: string | null;
  hidden?: boolean;
  createdAt: string;
};

export type RegisterMemberInput = {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  plan: string;
  password?: string;
};