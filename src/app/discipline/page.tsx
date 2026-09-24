import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Discipline",
  robots: { index: false, follow: false },
};

/** Jeremy's affiliate door. discipline is the spelling. */
export default function DisciplinePage() {
  redirect("/join?ref=DISCIPLINE");
}
