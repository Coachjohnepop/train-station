import { defaultPlatformAdminPath } from "@/lib/admin-nav-sections";

export type LoginWorkspace = "member" | "coach" | "admin";

export type LoginAccountOption = {
  id: string;
  email: string;
  name: string;
  workspace: LoginWorkspace;
  redirect: string;
};

/** House operators who keep a member seat plus coach/admin workspaces. */
export const OPERATOR_LOGIN_PEOPLE = [
  { email: "john@thetrainstation.co", name: "John" },
  { email: "jeremy@thetrainstation.co", name: "Jeremy" },
] as const;

export const LOGIN_WORKSPACES: {
  workspace: LoginWorkspace;
  label: string;
  redirect: string;
}[] = [
  { workspace: "member", label: "Member", redirect: "/member/today" },
  { workspace: "coach", label: "Coach", redirect: "/admin/today" },
  { workspace: "admin", label: "Admin", redirect: defaultPlatformAdminPath() },
];

export function loginWorkspaceLabel(workspace: LoginWorkspace): string {
  if (workspace === "member") return "Member";
  if (workspace === "coach") return "Coach";
  return "Admin";
}

export function loginAccountLabel(option: LoginAccountOption): string {
  return `${option.name} · ${loginWorkspaceLabel(option.workspace)}`;
}

export function operatorLoginAccounts(): LoginAccountOption[] {
  const out: LoginAccountOption[] = [];
  for (const person of OPERATOR_LOGIN_PEOPLE) {
    for (const workspace of LOGIN_WORKSPACES) {
      out.push({
        id: `${person.email}-${workspace.workspace}`,
        email: person.email,
        name: person.name,
        workspace: workspace.workspace,
        redirect: workspace.redirect,
      });
    }
  }
  return out;
}

export function loginAccountHref(
  option: LoginAccountOption,
  extra?: { switchAccount?: boolean },
): string {
  const params = new URLSearchParams();
  params.set("email", option.email);
  params.set("redirect", option.redirect);
  if (extra?.switchAccount) params.set("switch", "1");
  return `/login?${params.toString()}`;
}

export function groupLoginAccounts(options: LoginAccountOption[]): {
  workspace: LoginWorkspace;
  label: string;
  options: LoginAccountOption[];
}[] {
  return LOGIN_WORKSPACES.map((workspace) => ({
    workspace: workspace.workspace,
    label: workspace.label,
    options: options.filter((option) => option.workspace === workspace.workspace),
  })).filter((group) => group.options.length > 0);
}

const OPERATOR_EMAILS = new Set(
  OPERATOR_LOGIN_PEOPLE.map((person) => person.email.toLowerCase()),
);

/** Remembered emails that are not John/Jeremy — listed under Member. */
export function historyMemberAccounts(history: string[]): LoginAccountOption[] {
  const extra: LoginAccountOption[] = [];
  const seen = new Set<string>();
  for (const raw of history) {
    const email = raw.trim().toLowerCase();
    if (!email || !email.includes("@") || OPERATOR_EMAILS.has(email) || seen.has(email)) {
      continue;
    }
    seen.add(email);
    extra.push({
      id: `history-${email}`,
      email,
      name: email.split("@")[0] || email,
      workspace: "member",
      redirect: "/member/today",
    });
  }
  return extra;
}

export function isSafeAppPath(value: string | null | undefined): value is string {
  const raw = value?.trim() ?? "";
  return raw.startsWith("/") && !raw.startsWith("//");
}

export function signedInAccountHref(
  option: LoginAccountOption,
  currentEmail?: string | null,
): string {
  const normalized = currentEmail?.trim().toLowerCase() ?? "";
  if (normalized && normalized === option.email) return option.redirect;
  return loginAccountHref(option, { switchAccount: Boolean(normalized) });
}
