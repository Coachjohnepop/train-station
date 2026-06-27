/** Hidden username for password managers when email isn't adjacent to new-password fields. */
export default function FormUsernameBridge({ email }: { email: string }) {
  const normalized = email.trim();
  if (!normalized) return null;

  return (
    <input
      type="text"
      name="username"
      autoComplete="username"
      value={normalized}
      readOnly
      tabIndex={-1}
      aria-hidden="true"
      className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0"
    />
  );
}