export type DemoUserEntry = {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
};

export const DEMO_USER_DIRECTORY: DemoUserEntry[] = [
  { id: "demo-user", email: "demo@thetrainstation.co", name: "Demo Member (Alex)", phone: "(555) 987-6543" },
  { id: "demo-user-john", email: "john@thetrainstation.co", name: "John", phone: "(555) 111-2233" },
  { id: "demo-user-stephanie", email: "stephanie@thetrainstation.co", name: "Stephanie", phone: "(555) 111-2234" },
  { id: "demo-user-2", email: "jordan.member@example.com", name: "Jordan Lee", phone: "(555) 222-3344" },
  { id: "demo-user-3", email: "casey.prospective@example.com", name: "Casey Rivera" },
  { id: "demo-instr", email: "coach.sam@example.com", name: "Sam Coach", phone: "(555) 123-0001" },
];

export function resolveDemoUser(userId: string): DemoUserEntry | undefined {
  return DEMO_USER_DIRECTORY.find((u) => u.id === userId);
}

export function resolveDemoUserByEmail(email: string): DemoUserEntry | undefined {
  return DEMO_USER_DIRECTORY.find((u) => u.email === email);
}