/** Client-only helpers for password manager autofill + save/update prompts. */

type SavePasswordInput = {
  email: string;
  password: string;
  name?: string;
  form?: HTMLFormElement | null;
};

function passwordCredentialCtor():
  | (new (data: { id: string; password: string; name?: string }) => Credential)
  | (new (form: HTMLFormElement) => Credential)
  | undefined {
  return (window as Window & {
    PasswordCredential?: new (data: {
      id: string;
      password: string;
      name?: string;
    }) => Credential;
  }).PasswordCredential;
}

function readUsernameFromForm(form: HTMLFormElement): string {
  const el =
    form.querySelector<HTMLInputElement>('input[autocomplete="username"]') ||
    form.querySelector<HTMLInputElement>('input[name="username"]') ||
    form.querySelector<HTMLInputElement>('input[type="email"]');
  return el?.value?.trim() || "";
}

function readPasswordFromForm(form: HTMLFormElement): string {
  const el =
    form.querySelector<HTMLInputElement>('input[autocomplete="new-password"]') ||
    form.querySelector<HTMLInputElement>('input[autocomplete="current-password"]') ||
    form.querySelector<HTMLInputElement>('input[name="password"]');
  return el?.value || "";
}

async function waitForDom(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/**
 * Prompt the browser / OS password manager to save or replace the saved login.
 * Uses the same email id so Keychain, iCloud Passwords, Chrome, etc. update in place.
 */
export async function offerSavePassword(input: SavePasswordInput): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const email = input.email.trim() || (input.form ? readUsernameFromForm(input.form) : "");
  const password = input.password || (input.form ? readPasswordFromForm(input.form) : "");
  if (!email || !password) return false;

  const Ctor = passwordCredentialCtor();
  if (!Ctor || !navigator.credentials?.store) return false;

  await waitForDom();

  if (input.form) {
    try {
      const FormCtor = Ctor as new (form: HTMLFormElement) => Credential;
      await navigator.credentials.store(new FormCtor(input.form));
      return true;
    } catch {
      /* fall through to explicit credential */
    }
  }

  try {
    const DataCtor = Ctor as new (data: {
      id: string;
      password: string;
      name?: string;
    }) => Credential;
    await navigator.credentials.store(
      new DataCtor({
        id: email,
        password,
        name: input.name,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export async function offerSavePasswordFromForm(form: HTMLFormElement | null): Promise<boolean> {
  if (!form) return false;
  return offerSavePassword({
    email: readUsernameFromForm(form),
    password: readPasswordFromForm(form),
    form,
  });
}

/** Alias used after password reset — replaces any saved login for this email. */
export async function offerUpdateSavedPassword(input: SavePasswordInput): Promise<boolean> {
  return offerSavePassword(input);
}