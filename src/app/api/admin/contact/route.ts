import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminContact, updateAdminContact } from "@/lib/booking";
import { COACH_CALENDLY_URL } from "@/lib/brand";
import { requireStaff } from "@/lib/api-auth";

function isDemoMode() {
  const url = process.env.DATABASE_URL ?? "";
  return !url || url.includes("dummy.supabase") || url.includes("dummy");
}
let demoContact = { 
  email: "jeremy@thetrainstation.co",
  phone: "(555) 123-4567",
  calendlyUrl: COACH_CALENDLY_URL
};

const updateSchema = z.object({
  email: z.string().email(),
  phone: z.string().optional(),
  calendlyUrl: z.string().url().optional().or(z.literal("")),
});

export async function GET() {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  if (isDemoMode()) return NextResponse.json(demoContact);
  const contact = await getAdminContact();
  return NextResponse.json(contact);
}

export async function PATCH(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }
  if (isDemoMode()) {
    demoContact = { ...demoContact, ...parsed.data };
    return NextResponse.json(demoContact);
  }
  const updated = await updateAdminContact(parsed.data.email, parsed.data.phone, parsed.data.calendlyUrl || undefined);
  return NextResponse.json(updated);
}
