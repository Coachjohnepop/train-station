import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  const { measurements, notes, calendlyOpened, programSlug } = body;

  const coachEmail = 'jeremy@thetrainstation.co';
  const subject = 'New member completed onboarding wizard';
  const message = `
A member has completed the new onboarding wizard for program: ${programSlug || 'general'}.

Measurements:
- Weight: ${measurements?.weight || 'not provided'} lbs
- Notes: ${notes || 'none'}

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

    return NextResponse.json({ 
      success: true, 
      simulated: true,
      sentTo: coachEmail 
    });
  }

  // TODO: wire real email (Resend, SendGrid, etc.)
  // For production you would do:
  // await sendEmail({ to: coachEmail, subject, text: message });
  return NextResponse.json({ 
    success: true, 
    message: 'Email queued (production mode not fully wired yet)' 
  });
}
