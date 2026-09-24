import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Commit",
  robots: { index: false, follow: false },
};

/** John's affiliate door. */
export default function CommitPage() {
  redirect("/join?ref=COMMIT");
}
