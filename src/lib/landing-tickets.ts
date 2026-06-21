export type TicketTierId = "free" | "coach-class" | "first-class";

export type TicketTier = {
  id: TicketTierId;
  title: string;
  subtitle: string;
  price: string;
  priceNote?: string;
  accent: string;
  signupPlan: string;
  joinRec: string;
  perks: string[];
};

export const TICKET_TIERS: TicketTier[] = [
  {
    id: "free",
    title: "Free",
    subtitle: "Explorer",
    price: "$0",
    priceNote: "starter access",
    accent: "from-zinc-500/20 to-zinc-800/40 border-zinc-500/40",
    signupPlan: "explorer",
    joinRec: "explorer",
    perks: ["Starter programs", "Basic logging"],
  },
  {
    id: "coach-class",
    title: "Coach Class",
    subtitle: "Ticket",
    price: "$25",
    priceNote: "/mo",
    accent: "from-[#7c3aed]/25 to-[#4c1d95]/30 border-[#7c3aed]/50",
    signupPlan: "member",
    joinRec: "member",
    perks: ["All programs — 4-week blocks", "15-min coach Zoom", "SMS accountability texts"],
  },
  {
    id: "first-class",
    title: "1st Class",
    subtitle: "Ticket",
    price: "$50",
    priceNote: "/mo",
    accent: "from-amber-500/20 to-[#7c3aed]/20 border-amber-400/40",
    signupPlan: "pro",
    joinRec: "pro",
    perks: [
      "Everything in Coach Class",
      "Live Zoom with John & Steph",
      "20-min Zoom with Coach Byrd",
    ],
  },
];

export const COMING_SOON_PROGRAMS = [
  {
    slug: "stretching",
    name: "Stretching",
    emoji: "🧘",
    blurb: "Daily mobility flows — coming soon.",
  },
  {
    slug: "nutrition",
    name: "Nutrition",
    emoji: "🥗",
    blurb: "Habits, macros, and coach-guided eating.",
  },
  {
    slug: "yoga",
    name: "Yoga",
    emoji: "🕉️",
    blurb: "Recovery, breath, and flexibility tracks.",
  },
  {
    slug: "glute-building",
    name: "Glute Building",
    emoji: "🍑",
    blurb: "Progressive glute specialization program.",
  },
  {
    slug: "mobility",
    name: "Mobility",
    emoji: "🔄",
    blurb: "Joint prep for lifters and athletes.",
  },
  {
    slug: "combat-conditioning",
    name: "Combat Conditioning",
    emoji: "🥊",
    blurb: "Fight-ready conditioning blocks.",
  },
] as const;