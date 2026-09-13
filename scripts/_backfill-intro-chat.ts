#!/usr/bin/env npx tsx
/**
 * Post the Calendly 1:1 Messages pair for recent confirmed intros
 * that shipped before the chat workflow existed.
 *
 *   npx tsx scripts/_backfill-intro-chat.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env", quiet: true });
dotenv.config({ path: ".env.go-prod", override: true, quiet: true });

async function main() {
  const { getBookings } = await import("../src/lib/booking");
  const { postIntroBookedChat } = await import("../src/lib/coach-member-notify");
  const { getAccountByUserId, getAccountByEmail } = await import(
    "../src/lib/member-accounts-store"
  );

  const since = Date.now() - 3 * 24 * 60 * 60 * 1000;
  const bookings = (await getBookings()).filter((b) => {
    if (b.status === "cancelled") return false;
    const t = new Date(b.scheduledAt || b.createdAt || 0).getTime();
    return Number.isFinite(t) && t >= since;
  });

  let posted = 0;
  for (const b of bookings) {
    let userId = b.userId || "";
    if (!userId && b.memberEmail) {
      const acc = await getAccountByEmail(b.memberEmail);
      userId = acc?.userId || "";
    }
    if (!userId) continue;
    const acc = await getAccountByUserId(userId);
    const name = acc?.account.name || b.memberEmail || "Member";
    const ok = await postIntroBookedChat({
      userId,
      memberName: name,
      scheduledAt: b.scheduledAt ? new Date(b.scheduledAt).toISOString() : null,
      claimSuffix: b.calendlyInviteeUri || b.id,
    });
    if (ok) {
      posted += 1;
      console.log("posted", name, b.scheduledAt || b.id);
    }
  }
  console.log(`done · posted ${posted} of ${bookings.length} recent bookings`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
