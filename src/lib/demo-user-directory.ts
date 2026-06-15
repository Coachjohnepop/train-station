export type DemoUserEntry = {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
};

export const DEMO_USER_DIRECTORY: DemoUserEntry[] = [
  { id: "demo-user-john-steph", email: "chadkaite@thetrainstation.co", name: "Chad & Kaite", phone: "(555) 111-2235" },
  { id: "demo-user", email: "demo@thetrainstation.co", name: "Alex", phone: "(555) 987-6543" },
  { id: "demo-user-john", email: "chad@thetrainstation.co", name: "Chad", phone: "(555) 111-2233" },
  { id: "demo-user-stephanie", email: "kaite@thetrainstation.co", name: "Kaite", phone: "(555) 111-2234" },
  { id: "demo-user-2", email: "jordan.member@example.com", name: "Jordan Lee", phone: "(555) 222-3344" },
  { id: "demo-user-3", email: "casey.prospective@example.com", name: "Casey Rivera" },
  { id: "demo-coach-jeremy", email: "jeremy@thetrainstation.co", name: "Coach Jeremy", phone: "(555) 123-0001" },
];

export function resolveDemoUser(userId: string): DemoUserEntry | undefined {
  return DEMO_USER_DIRECTORY.find((u) => u.id === userId);
}

export function resolveDemoUserByEmail(email: string): DemoUserEntry | undefined {
  return DEMO_USER_DIRECTORY.find((u) => u.email === email);
}