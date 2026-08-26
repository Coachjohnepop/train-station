-- Calendly invitee URIs + official reschedule/cancel links on Booking.
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "calendlyInviteeUri" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "calendlyEventUri" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "calendlyRescheduleUrl" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "calendlyCancelUrl" TEXT;

CREATE INDEX IF NOT EXISTS "Booking_calendlyInviteeUri_idx" ON "Booking"("calendlyInviteeUri");
CREATE INDEX IF NOT EXISTS "Booking_memberEmail_scheduledAt_idx" ON "Booking"("memberEmail", "scheduledAt");
