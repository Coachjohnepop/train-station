/** Client-only helpers for password manager autofill + save prompts. */

type SavePasswordInput = {
  email: string;
  password: string;
  name?: string;
};

export async function offerSavePassword(input: SavePasswordInput): Promise<void> {
  if (typeof window === "undefined") return;
  const email = input.email.trim();
  const password = input.password;
  if (!email || !password) return;

  const Ctor = (window as Window & {
    PasswordCredential?: new (data: {
      id: string;
      password: string;
      name?: string;
    }) => Credential;
  }).PasswordCredential;
  if (!Ctor || !navigator.credentials?.store) return;

  try {
    const cred = new Ctor({
      id: email,
      password,
      name: input.name,
    });
    await navigator.credentials.store(cred);
  } catch {
    /* User dismissed or browser blocked the prompt */
  }
}

export async function offerSavePasswordFromForm(form: HTMLFormElement | null): Promise<void> {
  if (!form || typeof window === "undefined") return;

  const Ctor = (window as Window & {
    PasswordCredential?: new (form: HTMLFormElement) => Credential;
  }).PasswordCredential;
  if (!Ctor || !navigator.credentials?.store) return;

  try {
    const cred = new Ctor(form);
    await navigator.credentials.store(cred);
  } catch {
    /* ignore */
  }
}