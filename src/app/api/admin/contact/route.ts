import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminContact, updateAdminContact } from "@/lib/booking";

function isDemoMode() {
  const url = process.env.DATABASE_URL ?? "";
  return !url || url.includes("dummy.supabase") || url.includes("dummy");
}
let demoContact = { email: "coach@thetrainstation.co", phone: "(555) 123-4567" };

const updateSchema = z.object({
  email: z.string().email(),
  phone: z.string().optional(),
});

export async function GET() {
  if (isDemoMode()) return NextResponse.json(demoContact);
  const contact = await getAdminContact();
  return NextResponse.json(contact);
}

export async function PATCH(request: Request) {
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 });
  }
  if (isDemoMode()) {
    demoContact = { ...demoContact, ...parsed.data };
    return NextResponse.json(demoContact);
  }
  const updated = await updateAdminContact(parsed.data.email, parsed.data.phone);
  return NextResponse.json(updated);
}
