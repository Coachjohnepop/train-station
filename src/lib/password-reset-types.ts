export type StoredResetToken = {
  email: string;
  expiresAt: string;
  createdAt: string;
  /** Present only in the token store. Never send this back to the browser. */
  rawToken?: string;
};