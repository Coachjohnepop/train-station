-- Growth indexes while the gym is still small (UAT).

CREATE UNIQUE INDEX "ProgramEnrollment_userId_programId_key" ON "ProgramEnrollment"("userId", "programId");
CREATE INDEX "ProgramEnrollment_userId_idx" ON "ProgramEnrollment"("userId");
CREATE INDEX "ProgramEnrollment_programId_idx" ON "ProgramEnrollment"("programId");

-- Member-on-a-day lookups: userIds is a text[] roster, not a join table yet.
CREATE INDEX "CoachTodaySession_userIds_idx" ON "CoachTodaySession" USING GIN ("userIds");
