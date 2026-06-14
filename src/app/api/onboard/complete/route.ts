import { NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json();
  const { measurements, notes, location, calendlyOpened, programSlug } = body;

  const coachEmail = 'jeremy@thetrainstation.co';
  const subject = 'New member completed onboarding wizard';
  const message = `
A member has completed the new onboarding wizard for program: ${programSlug || 'general'}.

Measurements:
- Weight: ${measurements?.weight || 'not provided'} lbs
- Notes: ${notes || 'none'}

Location (for weather in workouts):
- City: ${location?.city || 'not provided'}
- State: ${location?.state || 'not provided'}

Calendly booking: ${calendlyOpened ? 'opened' : 'not opened'}

Home equipment: updated via wizard.

Please follow up to confirm their first session and assign any coach-specific details.

Member email (demo): demo@thetrainstation.co
`;

  const isDemo = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes('dummy');

  if (isDemo) {
    console.log(`\n[EMAIL SIMULATED]`);
    console.log(`To: ${coachEmail}`);
    console.log(`Subject: ${subject}`);
    console.log(message);
    console.log(`[END EMAIL SIM]\n`);

    // Demo: location is persisted via cookies in the wizard for immediate weather use
    if (location?.city && location?.state) {
      console.log(`[DEMO LOCATION SET] ${location.city}, ${location.state} (cookies)`);
    }

    return NextResponse.json({ 
      success: true, 
      simulated: true,
      sentTo: coachEmail 
    });
  }

  // Real mode: persist location to the demo user (or the current user if we had uid)
  // In a full app the join/onboard would have a userId cookie or session by now.
  try {
    if (location?.city || location?.state) {
      const targetUser = await prisma.user.findUnique({ where: { email: "demo@thetrainstation.co" } });
      if (targetUser) {
        await prisma.user.update({
          where: { id: targetUser.id },
          data: {
            city: location.city || targetUser.city,
            state: location.state || targetUser.state,
          },
        });
      }
    }
  } catch (e) {
    console.error("Failed to persist location to user", e);
  }

  // TODO: wire real email (Resend, SendGrid, etc.)
  // For production you would do:
  // await sendEmail({ to: coachEmail, subject, text: message });
  return NextResponse.json({ 
    success: true, 
    message: 'Email queued (production mode not fully wired yet)' 
  });
}
