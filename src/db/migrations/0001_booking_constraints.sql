-- Double-booking protection enforced by the database itself.
-- Concurrent inserts that would overlap an active appointment for the same
-- doctor (or the same patient) fail with SQLSTATE 23P01 (exclusion_violation),
-- which the booking service maps to a friendly "slot just taken" error.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_doctor_no_overlap"
  EXCLUDE USING gist (
    "doctor_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  ) WHERE ("status" NOT IN ('cancelled', 'no_show'));
--> statement-breakpoint
ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_patient_no_overlap"
  EXCLUDE USING gist (
    "patient_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  ) WHERE ("status" NOT IN ('cancelled', 'no_show'));
