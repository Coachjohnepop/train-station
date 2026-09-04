import { NextResponse } from "next/server";
import { getAdminContact } from "@/lib/booking";
import { COACH_CALENDLY_URL } from "@/lib/brand";
import { requireSession } from "@/lib/api-auth";
import { formatPhoneDisplay } from "@/lib/sms-phone";

/**
 * Coach booking contact for signed-in members (and staff).
 * Safe fields only — not the staff-only admin contact PATCH surface.
 */
export async function GET() {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    const contact = await getAdminContact();
    let nutritionCalendlyUrl: string | null = null;
    try {
      const { getMemberContent } = await import("@/lib/member-content-store");
      const content = await getMemberContent();
      nutritionCalendlyUrl = content.nutritionDesk.calendlyUrl;
    } catch {
      /* optional */
    }
    const introUrl = contact.calendlyUrl || COACH_CALENDLY_URL;
    return NextResponse.json({
      email: contact.email || "jeremy@thetrainstation.co",
      phone: contact.phone ? formatPhoneDisplay(contact.phone) : null,
      calendlyUrl: introUrl,
      nutritionCalendlyUrl: nutritionCalendlyUrl || introUrl,
    });
  } catch {
    return NextResponse.json({
      email: "jeremy@thetrainstation.co",
      phone: null,
      calendlyUrl: COACH_CALENDLY_URL,
      nutritionCalendlyUrl: COACH_CALENDLY_URL,
    });
  }
}
