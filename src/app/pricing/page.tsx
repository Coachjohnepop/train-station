import { redirect } from "next/navigation";

/** Legacy / external “pricing” → membership tickets on join. */
export default function PricingRedirectPage() {
  redirect("/join#tickets");
}
