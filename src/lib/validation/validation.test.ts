import { describe, expect, it } from "vitest"
import { newStaffSchema, resetPasswordSchema, updateAccessSchema } from "./admin"
import { signInSchema, signUpSchema } from "./auth"
import { createBookingSchema, patientDetailsSchema, receptionBookingSchema } from "./booking"
import { clinicSchema, doctorSchema, exceptionSchema, ruleSchema, serviceSchema } from "./settings"
import { visitNoteSchema } from "./visit-note"

const uuid = () => crypto.randomUUID()
const issuesOf = (r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  r.success ? [] : r.error!.issues.map((i) => `${i.path.join(".")}: ${i.message}`)

describe("auth schemas", () => {
  it("normalises the email and rejects an empty password", () => {
    expect(signInSchema.parse({ email: "  Jo@Example.COM ", password: "x" }).email).toBe("jo@example.com")
    expect(signInSchema.safeParse({ email: "jo@example.com", password: "" }).success).toBe(false)
  })

  it("requires matching passwords of at least 8 characters", () => {
    const base = { name: "Jo Bloggs", email: "jo@example.com" }
    expect(signUpSchema.safeParse({ ...base, password: "longenough", confirmPassword: "longenough" }).success).toBe(
      true
    )
    expect(issuesOf(signUpSchema.safeParse({ ...base, password: "short", confirmPassword: "short" }))).toContain(
      "password: Use at least 8 characters"
    )
    expect(
      issuesOf(signUpSchema.safeParse({ ...base, password: "longenough", confirmPassword: "different1" }))
    ).toContain("confirmPassword: Passwords don't match")
  })
})

describe("booking schemas", () => {
  const patient = { firstName: "Jo", lastName: "Bloggs", dateOfBirth: "1990-05-01", phone: "(617) 555-0100" }

  it("accepts normal patient details", () => {
    expect(patientDetailsSchema.safeParse(patient).success).toBe(true)
  })

  it("rejects future and impossible birth dates, and junk phone numbers", () => {
    expect(patientDetailsSchema.safeParse({ ...patient, dateOfBirth: "2999-01-01" }).success).toBe(false)
    expect(patientDetailsSchema.safeParse({ ...patient, dateOfBirth: "1800-01-01" }).success).toBe(false)
    expect(patientDetailsSchema.safeParse({ ...patient, dateOfBirth: "not-a-date" }).success).toBe(false)
    expect(patientDetailsSchema.safeParse({ ...patient, phone: "call me maybe" }).success).toBe(false)
  })

  it("requires every id to be a uuid and the time to carry a UTC offset", () => {
    const booking = {
      doctorId: uuid(),
      clinicId: uuid(),
      serviceId: uuid(),
      consultationType: "in_person" as const,
      startsAt: "2026-10-08T14:30:00.000Z",
      reason: "Knee pain",
      idempotencyKey: uuid(),
    }
    expect(createBookingSchema.safeParse(booking).success).toBe(true)
    expect(createBookingSchema.safeParse({ ...booking, doctorId: "nope" }).success).toBe(false)
    expect(createBookingSchema.safeParse({ ...booking, startsAt: "2026-10-08T14:30:00" }).success).toBe(false)
    expect(createBookingSchema.safeParse({ ...booking, reason: "x" }).success).toBe(false)
    expect(createBookingSchema.safeParse({ ...booking, consultationType: "telepathy" }).success).toBe(false)
  })

  it("lets reception supply either an existing patient or new patient details", () => {
    const base = {
      doctorId: uuid(),
      clinicId: uuid(),
      serviceId: uuid(),
      consultationType: "in_person" as const,
      startsAt: "2026-10-08T14:30:00.000Z",
      reason: "Phone booking",
      idempotencyKey: uuid(),
    }
    expect(receptionBookingSchema.safeParse({ ...base, patientId: uuid() }).success).toBe(true)
    expect(
      receptionBookingSchema.safeParse({
        ...base,
        newPatient: { firstName: "A", lastName: "B", phone: "555 0100", dateOfBirth: "", email: "" },
      }).success
    ).toBe(true)
  })
})

describe("settings schemas", () => {
  it("turns a comma-separated language list into an array and trims blanks", () => {
    const doc = doctorSchema.parse({
      name: "Dr. Test",
      title: "Tester",
      bio: "A bio that is comfortably long enough.",
      yearsExperience: "7",
      languages: " English, Spanish ,, ",
      consultationTypes: ["in_person"],
      isActive: true,
      clinicIds: [uuid()],
      specialtyIds: [uuid()],
      serviceIds: [],
    })
    expect(doc.languages).toEqual(["English", "Spanish"])
    expect(doc.yearsExperience).toBe(7)
  })

  it("requires a clinic, a specialty and a visit type for a doctor", () => {
    const issues = issuesOf(
      doctorSchema.safeParse({
        name: "Dr. Test",
        title: "Tester",
        bio: "A bio that is comfortably long enough.",
        yearsExperience: 1,
        languages: "English",
        consultationTypes: [],
        isActive: true,
        clinicIds: [],
        specialtyIds: [],
        serviceIds: [],
      })
    )
    expect(issues).toEqual(
      expect.arrayContaining([
        "consultationTypes: Choose at least one visit type",
        "clinicIds: Assign at least one clinic",
        "specialtyIds: Choose at least one specialty",
      ])
    )
  })

  it("only accepts the supported clinic timezones and https photo links", () => {
    const clinic = {
      name: "Clinic",
      addressLine: "1 Main St",
      city: "Boston, MA",
      phone: "(617) 555-0100",
      email: "",
      timezone: "America/New_York",
      openingHours: "",
      photoUrl: "",
      autoConfirmOnline: false,
      isActive: true,
    }
    expect(clinicSchema.safeParse(clinic).success).toBe(true)
    expect(clinicSchema.safeParse({ ...clinic, timezone: "Mars/Olympus" }).success).toBe(false)
    expect(clinicSchema.safeParse({ ...clinic, photoUrl: "javascript:alert(1)" }).success).toBe(false)
    expect(clinicSchema.parse({ ...clinic, openingHours: "  " }).openingHours).toBeNull()
  })

  it("coerces service numbers and rejects out-of-range values", () => {
    const svc = {
      name: "Checkup",
      description: "A routine check",
      specialtyId: uuid(),
      durationMinutes: "30",
      price: "99.5",
      isActive: true,
    }
    expect(serviceSchema.parse(svc)).toMatchObject({ durationMinutes: 30, price: 99.5 })
    expect(serviceSchema.safeParse({ ...svc, durationMinutes: 2 }).success).toBe(false)
    expect(serviceSchema.safeParse({ ...svc, price: -1 }).success).toBe(false)
  })

  it("validates working hours: HH:MM, end after start, and ordered validity dates", () => {
    const rule = {
      doctorId: uuid(),
      clinicId: uuid(),
      weekday: "1",
      startTime: "09:00",
      endTime: "12:30",
      slotMinutes: "30",
      validFrom: "",
      validTo: "",
    }
    expect(ruleSchema.parse(rule)).toMatchObject({ weekday: 1, slotMinutes: 30, validFrom: null, validTo: null })
    expect(issuesOf(ruleSchema.safeParse({ ...rule, endTime: "08:00" }))).toContain(
      "endTime: End time must be after the start time"
    )
    expect(ruleSchema.safeParse({ ...rule, startTime: "9am" }).success).toBe(false)
    expect(ruleSchema.safeParse({ ...rule, weekday: 7 }).success).toBe(false)
    expect(issuesOf(ruleSchema.safeParse({ ...rule, validFrom: "2026-05-02", validTo: "2026-05-01" }))).toContain(
      "validTo: Must be on or after the start date"
    )
  })

  it("treats an empty clinic on time off as 'every clinic'", () => {
    const parsed = exceptionSchema.parse({
      doctorId: uuid(),
      clinicId: "",
      startDate: "2026-12-24",
      endDate: "2026-12-26",
      reason: "",
    })
    expect(parsed.clinicId).toBeNull()
    expect(parsed.reason).toBeNull()
    expect(
      exceptionSchema.safeParse({
        doctorId: uuid(),
        clinicId: "",
        startDate: "2026-12-26",
        endDate: "2026-12-24",
        reason: "",
      }).success
    ).toBe(false)
  })
})

describe("admin and notes schemas", () => {
  it("never lets a staff account be created as a patient, and enforces password length", () => {
    const base = {
      name: "Staff Person",
      email: "Staff@Example.com",
      password: "a-long-password",
      role: "receptionist" as const,
      clinicIds: [],
      doctorId: "",
    }
    expect(newStaffSchema.parse(base).email).toBe("staff@example.com")
    expect(newStaffSchema.safeParse({ ...base, role: "patient" }).success).toBe(false)
    expect(newStaffSchema.safeParse({ ...base, password: "short" }).success).toBe(false)
    expect(resetPasswordSchema.safeParse({ userId: "u1", password: "short" }).success).toBe(false)
  })

  it("rejects unknown roles in access updates", () => {
    expect(updateAccessSchema.safeParse({ userId: "u1", role: "superuser", clinicIds: [], doctorId: "" }).success).toBe(
      false
    )
    expect(updateAccessSchema.parse({ userId: "u1", role: "doctor", clinicIds: [], doctorId: "" }).doctorId).toBeNull()
  })

  it("trims notes, rejects blank ones and caps length", () => {
    const id = uuid()
    expect(visitNoteSchema.parse({ appointmentId: id, body: "  seen and treated  " }).body).toBe("seen and treated")
    expect(visitNoteSchema.safeParse({ appointmentId: id, body: "   " }).success).toBe(false)
    expect(visitNoteSchema.safeParse({ appointmentId: id, body: "x".repeat(8001) }).success).toBe(false)
  })
})
