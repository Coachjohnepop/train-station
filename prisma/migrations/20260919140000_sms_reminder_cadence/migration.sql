-- D&D card / intro: consistent vs minimum program reminder texts (Twilio-ready).

ALTER TABLE "User" ADD COLUMN "smsReminderCadence" TEXT;
