-- Row Level Security (defense-in-depth when app uses a non-superuser DB role).
-- Prisma must set session vars before queries — see src/lib/prisma-rls.ts
-- The default Supabase `postgres` role bypasses RLS; create `train_station_app` for enforcement.

CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS text AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_current_user_role() RETURNS text AS $$
  SELECT NULLIF(current_setting('app.user_role', true), '');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_is_staff() RETURNS boolean AS $$
  SELECT app_current_user_role() IN ('ADMIN', 'INSTRUCTOR');
$$ LANGUAGE sql STABLE;

-- Member-owned tables
ALTER TABLE "WorkoutLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExercisePerformance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProgramEnrollment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserEquipment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserWeatherLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PromptResponse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserMeasurement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SmsLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Booking" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workout_log_access ON "WorkoutLog";
CREATE POLICY workout_log_access ON "WorkoutLog"
  FOR ALL
  USING ("userId" = app_current_user_id() OR app_is_staff())
  WITH CHECK ("userId" = app_current_user_id() OR app_is_staff());

DROP POLICY IF EXISTS exercise_performance_access ON "ExercisePerformance";
CREATE POLICY exercise_performance_access ON "ExercisePerformance"
  FOR ALL
  USING ("userId" = app_current_user_id() OR app_is_staff())
  WITH CHECK ("userId" = app_current_user_id() OR app_is_staff());

DROP POLICY IF EXISTS program_enrollment_access ON "ProgramEnrollment";
CREATE POLICY program_enrollment_access ON "ProgramEnrollment"
  FOR ALL
  USING ("userId" = app_current_user_id() OR app_is_staff())
  WITH CHECK ("userId" = app_current_user_id() OR app_is_staff());

DROP POLICY IF EXISTS user_equipment_access ON "UserEquipment";
CREATE POLICY user_equipment_access ON "UserEquipment"
  FOR ALL
  USING ("userId" = app_current_user_id() OR app_is_staff())
  WITH CHECK ("userId" = app_current_user_id() OR app_is_staff());

DROP POLICY IF EXISTS user_weather_log_access ON "UserWeatherLog";
CREATE POLICY user_weather_log_access ON "UserWeatherLog"
  FOR ALL
  USING ("userId" = app_current_user_id() OR app_is_staff())
  WITH CHECK ("userId" = app_current_user_id() OR app_is_staff());

DROP POLICY IF EXISTS prompt_response_access ON "PromptResponse";
CREATE POLICY prompt_response_access ON "PromptResponse"
  FOR ALL
  USING ("userId" = app_current_user_id() OR app_is_staff())
  WITH CHECK ("userId" = app_current_user_id() OR app_is_staff());

DROP POLICY IF EXISTS user_measurement_access ON "UserMeasurement";
CREATE POLICY user_measurement_access ON "UserMeasurement"
  FOR ALL
  USING ("userId" = app_current_user_id() OR app_is_staff())
  WITH CHECK ("userId" = app_current_user_id() OR app_is_staff());

DROP POLICY IF EXISTS sms_log_access ON "SmsLog";
CREATE POLICY sms_log_access ON "SmsLog"
  FOR ALL
  USING ("userId" = app_current_user_id() OR app_is_staff())
  WITH CHECK ("userId" = app_current_user_id() OR app_is_staff());

DROP POLICY IF EXISTS booking_access ON "Booking";
CREATE POLICY booking_access ON "Booking"
  FOR ALL
  USING ("userId" = app_current_user_id() OR app_is_staff())
  WITH CHECK ("userId" = app_current_user_id() OR app_is_staff());

DROP POLICY IF EXISTS subscription_access ON "Subscription";
CREATE POLICY subscription_access ON "Subscription"
  FOR ALL
  USING ("userId" = app_current_user_id() OR app_is_staff())
  WITH CHECK ("userId" = app_current_user_id() OR app_is_staff());

-- Users: members read/update self; staff read all
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_select ON "User";
CREATE POLICY user_select ON "User"
  FOR SELECT
  USING (id = app_current_user_id() OR app_is_staff());

DROP POLICY IF EXISTS user_update ON "User";
CREATE POLICY user_update ON "User"
  FOR UPDATE
  USING (id = app_current_user_id() OR app_is_staff())
  WITH CHECK (id = app_current_user_id() OR app_is_staff());

DROP POLICY IF EXISTS user_insert ON "User";
CREATE POLICY user_insert ON "User"
  FOR INSERT
  WITH CHECK (app_is_staff());