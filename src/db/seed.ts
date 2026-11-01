import "./load-env"
import { TZDate } from "@date-fns/tz"
import { hashPassword } from "better-auth/crypto"
import { sql } from "drizzle-orm"
import { randomUUID } from "node:crypto"
import type { AppointmentStatus, ConsultationType, Role } from "../lib/domain"
import { DOCTOR_PORTRAITS, PHOTOS, unsplash } from "../lib/photos"
import { db } from "./index"
import * as s from "./schema"

/**
 * Development seed. Wipes every app table and rebuilds a realistic dataset:
 * 3 clinics, 8 specialties, 17 services, 12 doctors with weekly schedules,
 * demo accounts for every role, ~30 patients and appointments spread over
 * the past three weeks, today and the next three weeks in every status.
 *
 * Run with `npm run db:seed`. Deterministic apart from "today".
 */

export const DEMO_PASSWORD = "medflow-demo-2026"

// ---------------------------------------------------------------------------
// Deterministic randomness

let rngState = 20261005
function rand() {
  rngState |= 0
  rngState = (rngState + 0x6d2b79f5) | 0
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)]
const chance = (p: number) => rand() < p

const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const usedRefs = new Set<string>()
function reference() {
  let ref: string
  do {
    ref = "MF-" + Array.from({ length: 6 }, () => pick(REF_ALPHABET.split(""))).join("")
  } while (usedRefs.has(ref))
  usedRefs.add(ref)
  return ref
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

// ---------------------------------------------------------------------------
// Catalog

const CLINICS = [
  {
    key: "riverside",
    name: "MedFlow Riverside",
    addressLine: "120 Charles River Plaza",
    city: "Boston, MA",
    phone: "(617) 555-0142",
    email: "riverside@medflow.test",
    timezone: "America/New_York",
    photoUrl: unsplash(PHOTOS.clinicExterior, 1200),
    openingHours: "Mon–Fri 8:30–17:30 · Sat 9:00–13:00",
    autoConfirmOnline: false,
  },
  {
    key: "midtown",
    name: "MedFlow Midtown",
    addressLine: "455 Lexington Avenue, 6th floor",
    city: "New York, NY",
    phone: "(212) 555-0187",
    email: "midtown@medflow.test",
    timezone: "America/New_York",
    photoUrl: unsplash(PHOTOS.clinicLobby, 1200),
    openingHours: "Mon–Fri 8:30–17:30 · Sat 9:00–13:00",
    autoConfirmOnline: true,
  },
  {
    key: "lakeshore",
    name: "MedFlow Lakeshore",
    addressLine: "200 N Michigan Avenue",
    city: "Chicago, IL",
    phone: "(312) 555-0119",
    email: "lakeshore@medflow.test",
    timezone: "America/Chicago",
    photoUrl: unsplash(PHOTOS.clinicRoom, 1200),
    openingHours: "Mon–Fri 8:30–17:30 · Sat 9:00–13:00",
    autoConfirmOnline: false,
  },
] as const
type ClinicKey = (typeof CLINICS)[number]["key"]

const SPECIALTIES = [
  {
    slug: "general-practice",
    name: "General Practice",
    icon: "stethoscope",
    description: "Everyday health concerns, check-ups, prescriptions and referrals for the whole family.",
  },
  {
    slug: "cardiology",
    name: "Cardiology",
    icon: "heart-pulse",
    description: "Heart and blood-pressure care, from palpitations and chest pain to long-term heart health.",
  },
  {
    slug: "dermatology",
    name: "Dermatology",
    icon: "sparkles",
    description: "Skin, hair and nail conditions, mole checks and treatment plans for acne and eczema.",
  },
  {
    slug: "pediatrics",
    name: "Pediatrics",
    icon: "baby",
    description: "Care for babies, children and teens: wellness visits, vaccinations and sick visits.",
  },
  {
    slug: "orthopedics",
    name: "Orthopedics",
    icon: "bone",
    description: "Bones, joints and muscles: back pain, sports injuries and arthritis management.",
  },
  {
    slug: "womens-health",
    name: "Women's Health",
    icon: "flower-2",
    description: "Gynecology, prenatal care, contraception advice and routine screenings.",
  },
  {
    slug: "mental-health",
    name: "Mental Health",
    icon: "brain",
    description: "Assessments and ongoing support for anxiety, depression, sleep and stress.",
  },
  {
    slug: "ophthalmology",
    name: "Ophthalmology",
    icon: "eye",
    description: "Eye exams, vision changes, contact lens fittings and eye-condition management.",
  },
] as const
type SpecialtySlug = (typeof SPECIALTIES)[number]["slug"]

const SERVICES: {
  slug: string
  name: string
  specialty: SpecialtySlug
  durationMinutes: number
  price: number
  description: string
}[] = [
  {
    slug: "general-consultation",
    name: "General consultation",
    specialty: "general-practice",
    durationMinutes: 20,
    price: 90,
    description: "A visit for a new or ongoing health concern.",
  },
  {
    slug: "annual-physical",
    name: "Annual physical",
    specialty: "general-practice",
    durationMinutes: 40,
    price: 180,
    description: "A full yearly check-up with routine screening and lab orders.",
  },
  {
    slug: "vaccination",
    name: "Vaccination",
    specialty: "general-practice",
    durationMinutes: 20,
    price: 40,
    description: "Flu, travel and routine adult vaccines.",
  },
  {
    slug: "cardiology-consultation",
    name: "Cardiology consultation",
    specialty: "cardiology",
    durationMinutes: 30,
    price: 220,
    description: "Assessment of heart symptoms, risk factors and test results.",
  },
  {
    slug: "ecg-review",
    name: "ECG and review",
    specialty: "cardiology",
    durationMinutes: 30,
    price: 150,
    description: "A resting ECG with the results explained on the day.",
  },
  {
    slug: "skin-check",
    name: "Full skin check",
    specialty: "dermatology",
    durationMinutes: 30,
    price: 160,
    description: "A head-to-toe mole and skin cancer screening.",
  },
  {
    slug: "acne-treatment",
    name: "Acne treatment plan",
    specialty: "dermatology",
    durationMinutes: 30,
    price: 140,
    description: "A personalised plan for persistent or adult acne.",
  },
  {
    slug: "child-wellness-visit",
    name: "Child wellness visit",
    specialty: "pediatrics",
    durationMinutes: 30,
    price: 120,
    description: "Growth, development and vaccination check for your child.",
  },
  {
    slug: "pediatric-sick-visit",
    name: "Pediatric sick visit",
    specialty: "pediatrics",
    durationMinutes: 30,
    price: 95,
    description: "Same-week care when your child is unwell.",
  },
  {
    slug: "joint-pain-assessment",
    name: "Joint pain assessment",
    specialty: "orthopedics",
    durationMinutes: 30,
    price: 200,
    description: "Diagnosis and a treatment plan for knee, hip or shoulder pain.",
  },
  {
    slug: "sports-injury",
    name: "Sports injury consultation",
    specialty: "orthopedics",
    durationMinutes: 60,
    price: 210,
    description: "Assessment of sprains, strains and overuse injuries.",
  },
  {
    slug: "well-woman-exam",
    name: "Well-woman exam",
    specialty: "womens-health",
    durationMinutes: 60,
    price: 190,
    description: "Routine gynecological exam and screening.",
  },
  {
    slug: "prenatal-visit",
    name: "Prenatal visit",
    specialty: "womens-health",
    durationMinutes: 30,
    price: 150,
    description: "Regular pregnancy check-ins with your obstetrician.",
  },
  {
    slug: "therapy-session",
    name: "Therapy session",
    specialty: "mental-health",
    durationMinutes: 60,
    price: 170,
    description: "A 50-minute talking-therapy session.",
  },
  {
    slug: "mental-health-assessment",
    name: "Mental health assessment",
    specialty: "mental-health",
    durationMinutes: 60,
    price: 200,
    description: "A first appointment to understand your needs and agree a plan.",
  },
  {
    slug: "eye-exam",
    name: "Comprehensive eye exam",
    specialty: "ophthalmology",
    durationMinutes: 30,
    price: 130,
    description: "Vision testing and an eye health check.",
  },
  {
    slug: "contact-lens-fitting",
    name: "Contact lens fitting",
    specialty: "ophthalmology",
    durationMinutes: 30,
    price: 110,
    description: "Measurement, trial lenses and aftercare advice.",
  },
]

type Weekday = 1 | 2 | 3 | 4 | 5 | 6

type DoctorSeed = {
  key: keyof typeof DOCTOR_PORTRAITS
  email: string
  name: string
  title: string
  bio: string
  yearsExperience: number
  languages: string[]
  consultationTypes: ConsultationType[]
  specialties: SpecialtySlug[]
  slotMinutes: number
  schedule: Partial<Record<ClinicKey, Weekday[]>>
}

const DOCTORS: DoctorSeed[] = [
  {
    key: "rahimKhan",
    email: "doctor@medflow.test",
    name: "Dr. Rahim Khan",
    title: "General Practitioner",
    bio: "Dr. Khan looks after adults and families with a focus on preventive care and managing long-term conditions like diabetes and high blood pressure. Patients appreciate his clear explanations and unhurried appointments.",
    yearsExperience: 11,
    languages: ["English", "Urdu", "Hindi"],
    consultationTypes: ["in_person", "video"],
    specialties: ["general-practice"],
    slotMinutes: 20,
    schedule: { riverside: [1, 3, 5, 6], midtown: [2, 4] },
  },
  {
    key: "elenaMorales",
    email: "elena.morales@medflow.test",
    name: "Dr. Elena Morales",
    title: "Cardiologist",
    bio: "Dr. Morales specialises in heart rhythm problems and cardiovascular prevention. She has led MedFlow's cardiology service since it opened.",
    yearsExperience: 18,
    languages: ["English", "Spanish"],
    consultationTypes: ["in_person"],
    specialties: ["cardiology"],
    slotMinutes: 30,
    schedule: { riverside: [1, 2, 3, 4] },
  },
  {
    key: "marcusBell",
    email: "marcus.bell@medflow.test",
    name: "Dr. Marcus Bell",
    title: "Orthopedic Specialist",
    bio: "A former college athlete, Dr. Bell treats sports injuries and joint pain and helps patients get back to the activities they love.",
    yearsExperience: 9,
    languages: ["English"],
    consultationTypes: ["in_person"],
    specialties: ["orthopedics"],
    slotMinutes: 30,
    schedule: { midtown: [1, 3, 5], lakeshore: [2, 4] },
  },
  {
    key: "lukasWeber",
    email: "lukas.weber@medflow.test",
    name: "Dr. Lukas Weber",
    title: "Dermatologist",
    bio: "Dr. Weber treats acne, eczema and psoriasis and runs MedFlow's skin cancer screening clinic. Follow-ups can often be done by video.",
    yearsExperience: 7,
    languages: ["English", "German"],
    consultationTypes: ["in_person", "video"],
    specialties: ["dermatology"],
    slotMinutes: 30,
    schedule: { midtown: [1, 2, 3, 4, 5] },
  },
  {
    key: "sofiaRinaldi",
    email: "sofia.rinaldi@medflow.test",
    name: "Dr. Sofia Rinaldi",
    title: "Pediatrician",
    bio: "Dr. Rinaldi cares for children from newborns to teenagers and is known for making nervous little patients feel at ease.",
    yearsExperience: 12,
    languages: ["English", "Italian"],
    consultationTypes: ["in_person", "video"],
    specialties: ["pediatrics"],
    slotMinutes: 30,
    schedule: { riverside: [1, 2, 3], lakeshore: [4, 5] },
  },
  {
    key: "amaraOkafor",
    email: "amara.okafor@medflow.test",
    name: "Dr. Amara Okafor",
    title: "Psychiatrist",
    bio: "Dr. Okafor supports adults living with anxiety, depression and sleep problems, combining medication management with talking therapy.",
    yearsExperience: 10,
    languages: ["English", "Igbo"],
    consultationTypes: ["in_person", "video"],
    specialties: ["mental-health"],
    slotMinutes: 60,
    schedule: { midtown: [2, 3, 4, 5, 6] },
  },
  {
    key: "margaretDoyle",
    email: "margaret.doyle@medflow.test",
    name: "Dr. Margaret Doyle",
    title: "Obstetrician & Gynecologist",
    bio: "With over two decades in women's health, Dr. Doyle provides prenatal care, menopause support and routine gynecological screening.",
    yearsExperience: 24,
    languages: ["English"],
    consultationTypes: ["in_person"],
    specialties: ["womens-health"],
    slotMinutes: 30,
    schedule: { riverside: [1, 2, 4, 5] },
  },
  {
    key: "nkechiAdeyemi",
    email: "nkechi.adeyemi@medflow.test",
    name: "Dr. Nkechi Adeyemi",
    title: "Cardiologist",
    bio: "Dr. Adeyemi focuses on heart failure and hypertension, and runs MedFlow Lakeshore's cardiac follow-up clinic.",
    yearsExperience: 14,
    languages: ["English", "Yoruba"],
    consultationTypes: ["in_person", "video"],
    specialties: ["cardiology"],
    slotMinutes: 30,
    schedule: { lakeshore: [1, 2, 3, 4] },
  },
  {
    key: "priyaNair",
    email: "priya.nair@medflow.test",
    name: "Dr. Priya Nair",
    title: "Family Physician",
    bio: "Dr. Nair is a family physician with a special interest in women's health, offering everything from check-ups to contraception advice.",
    yearsExperience: 8,
    languages: ["English", "Malayalam", "Hindi"],
    consultationTypes: ["in_person", "video"],
    specialties: ["general-practice", "womens-health"],
    slotMinutes: 20,
    schedule: { lakeshore: [1, 3, 5, 6] },
  },
  {
    key: "danielTan",
    email: "daniel.tan@medflow.test",
    name: "Dr. Daniel Tan",
    title: "Ophthalmologist",
    bio: "Dr. Tan manages glaucoma, cataracts and everyday vision problems, and fits contact lenses for first-time wearers.",
    yearsExperience: 13,
    languages: ["English", "Mandarin"],
    consultationTypes: ["in_person"],
    specialties: ["ophthalmology"],
    slotMinutes: 30,
    schedule: { midtown: [1, 2], riverside: [3, 4] },
  },
  {
    key: "kenjiSato",
    email: "kenji.sato@medflow.test",
    name: "Dr. Kenji Sato",
    title: "Internal Medicine Physician",
    bio: "Dr. Sato has twenty years of experience in internal medicine and helps patients manage complex, overlapping conditions and medications.",
    yearsExperience: 20,
    languages: ["English", "Japanese"],
    consultationTypes: ["in_person", "video"],
    specialties: ["general-practice"],
    slotMinutes: 20,
    schedule: { lakeshore: [2, 3, 4, 5] },
  },
  {
    key: "graceMensah",
    email: "grace.mensah@medflow.test",
    name: "Dr. Grace Mensah",
    title: "Pediatrician",
    bio: "Dr. Mensah focuses on childhood asthma and allergies and offers same-week sick visits at MedFlow Midtown.",
    yearsExperience: 6,
    languages: ["English", "French", "Twi"],
    consultationTypes: ["in_person"],
    specialties: ["pediatrics"],
    slotMinutes: 30,
    schedule: { midtown: [1, 3, 4, 5] },
  },
]

/** Clinic-local working blocks. Saturdays are morning only. */
const WEEKDAY_BLOCKS: [string, string][] = [
  ["09:00", "12:30"],
  ["13:30", "17:00"],
]
const SATURDAY_BLOCKS: [string, string][] = [["09:00", "13:00"]]

const STAFF: { email: string; name: string; role: Role; clinics: ClinicKey[] }[] = [
  { email: "admin@medflow.test", name: "Sam Patel", role: "admin", clinics: [] },
  { email: "manager@medflow.test", name: "Morgan Lee", role: "manager", clinics: ["riverside", "midtown"] },
  { email: "reception@medflow.test", name: "Jamie Brooks", role: "receptionist", clinics: ["riverside"] },
  { email: "reception.midtown@medflow.test", name: "Chris Alvarez", role: "receptionist", clinics: ["midtown"] },
  { email: "reception.lakeshore@medflow.test", name: "Taylor Kim", role: "receptionist", clinics: ["lakeshore"] },
]

const FIRST_NAMES = [
  "Olivia",
  "Liam",
  "Emma",
  "Noah",
  "Ava",
  "Ethan",
  "Sophia",
  "Mason",
  "Isabella",
  "Lucas",
  "Mia",
  "Henry",
  "Amelia",
  "James",
  "Harper",
  "Benjamin",
  "Evelyn",
  "Elijah",
  "Abigail",
  "Daniel",
  "Chloe",
  "Mateo",
  "Zoe",
  "Samuel",
  "Nora",
  "David",
  "Layla",
  "Owen",
  "Aisha",
  "Wei",
]
const LAST_NAMES = [
  "Johnson",
  "Nguyen",
  "Garcia",
  "Thompson",
  "Martinez",
  "Robinson",
  "Clark",
  "Lewis",
  "Walker",
  "Hall",
  "Young",
  "Allen",
  "King",
  "Wright",
  "Scott",
  "Green",
  "Baker",
  "Adams",
  "Nelson",
  "Hill",
  "Campbell",
  "Mitchell",
  "Roberts",
  "Carter",
  "Phillips",
  "Evans",
  "Turner",
  "Torres",
  "Parker",
  "Collins",
]

const REASONS: Record<SpecialtySlug, string[]> = {
  "general-practice": [
    "Persistent cough for two weeks",
    "Annual check-up",
    "Follow-up on blood pressure",
    "Fatigue and low energy",
    "Prescription renewal",
    "Sore throat and fever",
  ],
  cardiology: [
    "Occasional heart palpitations",
    "Follow-up after ECG",
    "High cholesterol review",
    "Chest tightness when exercising",
  ],
  dermatology: ["Mole that has changed shape", "Persistent acne", "Itchy rash on arms", "Eczema flare-up"],
  pediatrics: ["Ear infection symptoms", "Routine 2-year check-up", "Vaccinations", "Recurring stomach aches"],
  orthopedics: ["Knee pain after running", "Lower back pain", "Shoulder stiffness", "Sprained ankle"],
  "womens-health": ["Routine screening", "Prenatal check-in", "Irregular cycles", "Contraception advice"],
  "mental-health": ["Trouble sleeping", "Anxiety at work", "Follow-up on medication", "Low mood for several weeks"],
  ophthalmology: ["Blurry vision when reading", "Contact lens fitting", "Dry, irritated eyes", "Annual eye exam"],
}

const CANCEL_REASONS = [
  "Patient rescheduled",
  "Feeling better",
  "Work conflict",
  "Doctor unavailable",
  "Booked by mistake",
]

const VISIT_NOTES = [
  "Symptoms reviewed and examination unremarkable. Advised rest and fluids; return if not improving within a week.",
  "Discussed results with the patient. Plan agreed: continue current treatment and review in three months.",
  "Examination findings consistent with history. Prescription issued and self-care advice given.",
  "Patient reports good progress since last visit. No changes to the plan; routine follow-up booked.",
]

// ---------------------------------------------------------------------------
// Time helpers (clinic-local → UTC instants)

function localDay(tz: string, offsetDays: number) {
  const today = new TZDate(Date.now(), tz)
  return new TZDate(today.getFullYear(), today.getMonth(), today.getDate() + offsetDays, tz)
}

function atLocal(day: TZDate, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number)
  return new Date(new TZDate(day.getFullYear(), day.getMonth(), day.getDate(), h, m, day.timeZone!).getTime())
}

// ---------------------------------------------------------------------------

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed: NODE_ENV is production. The seed wipes every table.")
  }
  const now = new Date()
  console.log("Seeding MedFlow…")

  await db.transaction(async (tx) => {
    await tx.execute(sql`
      TRUNCATE TABLE audit_events, notifications, visit_notes, appointments, patients,
        availability_exceptions, availability_rules, staff_clinics, doctor_services,
        doctor_clinics, doctor_specialties, doctors, services, specialties, clinics,
        verification, account, session, "user"
      CASCADE
    `)

    // --- Users ----------------------------------------------------------------
    // One hash reused for every demo account keeps the seed fast; fine for dev data.
    const passwordHash = await hashPassword(DEMO_PASSWORD)
    const userIdByEmail = new Map<string, string>()
    const userRows: (typeof s.user.$inferInsert)[] = []
    const addUser = (email: string, name: string, role: Role) => {
      const id = randomUUID()
      userIdByEmail.set(email, id)
      userRows.push({ id, email, name, role, emailVerified: true })
      return id
    }

    for (const staff of STAFF) addUser(staff.email, staff.name, staff.role)
    for (const doctor of DOCTORS) addUser(doctor.email, doctor.name, "doctor")
    const demoPatientUserId = addUser("patient@medflow.test", "Jordan Rivera", "patient")

    // Patients: the demo patient, 11 more with accounts, and walk-ins without one.
    const patientSeeds = Array.from({ length: 30 }, (_, i) => {
      const firstName = FIRST_NAMES[i]
      const lastName = LAST_NAMES[(i * 7) % LAST_NAMES.length]
      const email = `${firstName}.${lastName}@example.com`.toLowerCase()
      const userId = i < 11 ? addUser(email, `${firstName} ${lastName}`, "patient") : null
      return { firstName, lastName, email: i < 22 ? email : null, userId }
    })

    await tx.insert(s.user).values(userRows)
    await tx.insert(s.account).values(
      userRows.map((u) => ({
        id: randomUUID(),
        accountId: u.id,
        providerId: "credential",
        userId: u.id,
        password: passwordHash,
      }))
    )

    // --- Catalog --------------------------------------------------------------
    const clinicRows = await tx
      .insert(s.clinics)
      .values(CLINICS.map(({ key, ...c }) => ({ slug: key, ...c })))
      .returning()
    const clinicByKey = new Map(clinicRows.map((c) => [c.slug as ClinicKey, c]))

    const specialtyRows = await tx
      .insert(s.specialties)
      .values([...SPECIALTIES])
      .returning()
    const specialtyBySlug = new Map(specialtyRows.map((sp) => [sp.slug as SpecialtySlug, sp]))

    const serviceRows = await tx
      .insert(s.services)
      .values(
        SERVICES.map(({ specialty, price, ...svc }) => ({
          ...svc,
          priceCents: price * 100,
          specialtyId: specialtyBySlug.get(specialty)!.id,
        }))
      )
      .returning()
    const servicesBySpecialty = new Map<SpecialtySlug, typeof serviceRows>()
    for (const svc of SERVICES) {
      const row = serviceRows.find((r) => r.slug === svc.slug)!
      servicesBySpecialty.set(svc.specialty, [...(servicesBySpecialty.get(svc.specialty) ?? []), row])
    }

    // --- Doctors ----------------------------------------------------------------
    const doctorRows = await tx
      .insert(s.doctors)
      .values(
        DOCTORS.map((d) => ({
          userId: userIdByEmail.get(d.email)!,
          slug: d.name
            .replace(/^Dr\.\s*/, "")
            .toLowerCase()
            .replace(/[^a-z]+/g, "-"),
          name: d.name,
          title: d.title,
          bio: d.bio,
          photoUrl: unsplash(DOCTOR_PORTRAITS[d.key], 800),
          yearsExperience: d.yearsExperience,
          languages: d.languages,
          consultationTypes: d.consultationTypes,
        }))
      )
      .returning()

    const doctors = DOCTORS.map((seed, i) => ({
      seed,
      row: doctorRows[i],
      services: seed.specialties.flatMap((sp) => servicesBySpecialty.get(sp) ?? []),
    }))

    await tx
      .insert(s.doctorSpecialties)
      .values(
        doctors.flatMap((d) =>
          d.seed.specialties.map((sp) => ({ doctorId: d.row.id, specialtyId: specialtyBySlug.get(sp)!.id }))
        )
      )
    await tx.insert(s.doctorClinics).values(
      doctors.flatMap((d) =>
        Object.keys(d.seed.schedule).map((ck) => ({
          doctorId: d.row.id,
          clinicId: clinicByKey.get(ck as ClinicKey)!.id,
        }))
      )
    )
    await tx
      .insert(s.doctorServices)
      .values(doctors.flatMap((d) => d.services.map((svc) => ({ doctorId: d.row.id, serviceId: svc.id }))))

    const ruleRows: (typeof s.availabilityRules.$inferInsert)[] = []
    for (const d of doctors) {
      for (const [ck, weekdays] of Object.entries(d.seed.schedule)) {
        for (const weekday of weekdays) {
          for (const [startTime, endTime] of weekday === 6 ? SATURDAY_BLOCKS : WEEKDAY_BLOCKS) {
            ruleRows.push({
              doctorId: d.row.id,
              clinicId: clinicByKey.get(ck as ClinicKey)!.id,
              weekday,
              startTime,
              endTime,
              slotMinutes: d.seed.slotMinutes,
            })
          }
        }
      }
    }
    await tx.insert(s.availabilityRules).values(ruleRows)

    // Time off: a conference day and a few days of leave, across all clinics.
    const exceptionSeeds = [
      { doctor: "lukasWeber", from: 3, days: 1, reason: "Dermatology conference" },
      { doctor: "elenaMorales", from: 8, days: 2, reason: "Annual leave" },
      { doctor: "marcusBell", from: 15, days: 1, reason: "Training day" },
    ] as const
    const exceptionRanges: { doctorId: string; startsAt: Date; endsAt: Date }[] = []
    for (const ex of exceptionSeeds) {
      const d = doctors.find((x) => x.seed.key === ex.doctor)!
      const tz = clinicByKey.get(Object.keys(d.seed.schedule)[0] as ClinicKey)!.timezone
      const startsAt = atLocal(localDay(tz, ex.from), "00:00")
      const endsAt = atLocal(localDay(tz, ex.from + ex.days), "00:00")
      exceptionRanges.push({ doctorId: d.row.id, startsAt, endsAt })
      await tx.insert(s.availabilityExceptions).values({ doctorId: d.row.id, startsAt, endsAt, reason: ex.reason })
    }

    // --- Staff scope ------------------------------------------------------------
    const staffClinicRows = STAFF.flatMap((st) =>
      st.clinics.map((ck) => ({ userId: userIdByEmail.get(st.email)!, clinicId: clinicByKey.get(ck)!.id }))
    )
    await tx.insert(s.staffClinics).values(staffClinicRows)

    // --- Patients ---------------------------------------------------------------
    const patientRows = await tx
      .insert(s.patients)
      .values([
        {
          userId: demoPatientUserId,
          firstName: "Jordan",
          lastName: "Rivera",
          dateOfBirth: "1990-04-17",
          phone: "(617) 555-0100",
          email: "patient@medflow.test",
        },
        ...patientSeeds.map((p, i) => ({
          userId: p.userId,
          firstName: p.firstName,
          lastName: p.lastName,
          dateOfBirth: `${1950 + ((i * 13) % 68)}-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 27) + 1).padStart(2, "0")}`,
          phone: `(${pick(["617", "212", "312", "646", "773"])}) 555-${String(1000 + i * 37).slice(-4)}`,
          email: p.email,
        })),
      ])
      .returning()
    const demoPatient = patientRows[0]

    // --- Appointments -----------------------------------------------------------
    type Planned = typeof s.appointments.$inferInsert
    const planned: Planned[] = []
    const busy = new Map<string, { start: number; end: number }[]>() // doctor/patient id → intervals
    const overlaps = (key: string, start: number, end: number) =>
      (busy.get(key) ?? []).some((iv) => start < iv.end && iv.start < end)
    const occupy = (key: string, start: number, end: number) =>
      busy.set(key, [...(busy.get(key) ?? []), { start, end }])

    const receptionFor = (clinicKey: ClinicKey) =>
      userIdByEmail.get(
        clinicKey === "riverside"
          ? "reception@medflow.test"
          : clinicKey === "midtown"
            ? "reception.midtown@medflow.test"
            : "reception.lakeshore@medflow.test"
      )!

    function statusFor(start: Date, end: Date): AppointmentStatus {
      if (end.getTime() <= now.getTime()) {
        const r = rand()
        return r < 0.7 ? "completed" : r < 0.83 ? "no_show" : "cancelled"
      }
      if (start.getTime() <= now.getTime()) return "checked_in"
      const r = rand()
      return r < 0.5 ? "confirmed" : r < 0.88 ? "requested" : "cancelled"
    }

    /** Places an appointment if the doctor and patient are both free; returns whether it was placed. */
    function place(opts: {
      doctor: (typeof doctors)[number]
      clinicKey: ClinicKey
      start: Date
      blockEnd: Date
      patient: (typeof patientRows)[number]
      status?: AppointmentStatus
      serviceSlug?: string
    }): boolean {
      const { doctor, clinicKey, start, blockEnd, patient } = opts
      const service = opts.serviceSlug
        ? doctor.services.find((svc) => svc.slug === opts.serviceSlug)!
        : pick(doctor.services)
      const end = new Date(start.getTime() + service.durationMinutes * MINUTE)
      const s0 = start.getTime()
      const e0 = end.getTime()
      if (e0 > blockEnd.getTime()) return false
      if (
        exceptionRanges.some(
          (ex) => ex.doctorId === doctor.row.id && s0 < ex.endsAt.getTime() && ex.startsAt.getTime() < e0
        )
      )
        return false
      if (overlaps(doctor.row.id, s0, e0) || overlaps(patient.id, s0, e0)) return false

      const clinic = clinicByKey.get(clinicKey)!
      let status = opts.status ?? statusFor(start, end)
      const online = patient.userId !== null && chance(0.75)
      if (status === "requested" && online && clinic.autoConfirmOnline) status = "confirmed"

      const createdAt = new Date(Math.min(now.getTime() - HOUR, s0 - (1 + Math.floor(rand() * 12)) * DAY))
      const confirmed = ["confirmed", "checked_in", "completed", "no_show"].includes(status)
      const specialty = SERVICES.find((svc) => svc.slug === service.slug)!.specialty

      occupy(doctor.row.id, s0, e0)
      occupy(patient.id, s0, e0)
      planned.push({
        reference: reference(),
        patientId: patient.id,
        doctorId: doctor.row.id,
        clinicId: clinic.id,
        serviceId: service.id,
        consultationType: doctor.seed.consultationTypes.includes("video") && chance(0.25) ? "video" : "in_person",
        startsAt: start,
        endsAt: end,
        status,
        source: online ? "online" : "reception",
        reason: pick(REASONS[specialty]),
        createdByUserId: online ? patient.userId : receptionFor(clinicKey),
        createdAt,
        updatedAt: createdAt,
        confirmedAt: confirmed ? new Date(createdAt.getTime() + 2 * HOUR) : null,
        checkedInAt: status === "checked_in" || status === "completed" ? new Date(s0 - 10 * MINUTE) : null,
        completedAt: status === "completed" ? end : null,
        cancelledAt: status === "cancelled" ? new Date(Math.min(now.getTime(), createdAt.getTime() + DAY)) : null,
        cancelledReason: status === "cancelled" ? pick(CANCEL_REASONS) : null,
      })
      return true
    }

    /** Every slot start for a doctor on a clinic-local day, with its block end. */
    function slotsOn(doctor: (typeof doctors)[number], offset: number) {
      const out: { clinicKey: ClinicKey; start: Date; blockEnd: Date }[] = []
      for (const [ck, weekdays] of Object.entries(doctor.seed.schedule)) {
        const clinicKey = ck as ClinicKey
        const day = localDay(clinicByKey.get(clinicKey)!.timezone, offset)
        const weekday = day.getDay()
        if (!weekdays.includes(weekday as Weekday)) continue
        for (const [from, to] of weekday === 6 ? SATURDAY_BLOCKS : WEEKDAY_BLOCKS) {
          const blockStart = atLocal(day, from)
          const blockEnd = atLocal(day, to)
          for (let t = blockStart.getTime(); t < blockEnd.getTime(); t += doctor.seed.slotMinutes * MINUTE) {
            out.push({ clinicKey, start: new Date(t), blockEnd })
          }
        }
      }
      return out
    }

    // The demo patient's own history, so /account has something in every state.
    const doc = (key: DoctorSeed["key"]) => doctors.find((d) => d.seed.key === key)!
    const demoPlan: {
      doctor: DoctorSeed["key"]
      from: number
      step: 1 | -1
      status: AppointmentStatus
      service: string
    }[] = [
      { doctor: "rahimKhan", from: -10, step: -1, status: "completed", service: "general-consultation" },
      { doctor: "danielTan", from: -18, step: -1, status: "completed", service: "eye-exam" },
      { doctor: "lukasWeber", from: -5, step: -1, status: "cancelled", service: "skin-check" },
      { doctor: "elenaMorales", from: 3, step: 1, status: "confirmed", service: "cardiology-consultation" },
      { doctor: "rahimKhan", from: 9, step: 1, status: "requested", service: "annual-physical" },
    ]
    for (const p of demoPlan) {
      placeLoop: for (let offset = p.from; Math.abs(offset) < 40; offset += p.step) {
        for (const slot of slotsOn(doc(p.doctor), offset)) {
          if (slot.start.getUTCMinutes() !== 0) continue // on-the-hour times read nicely in the demo
          if (
            place({ doctor: doc(p.doctor), patient: demoPatient, status: p.status, serviceSlug: p.service, ...slot })
          ) {
            break placeLoop
          }
        }
      }
    }

    // A busy "today" for the reception and doctor dashboards, then a sprinkle elsewhere.
    const others = patientRows.slice(1)
    for (let offset = -21; offset <= 21; offset++) {
      for (const doctor of doctors) {
        const slots = slotsOn(doctor, offset)
        const p = offset === 0 ? (doctor.seed.key === "rahimKhan" ? 0.45 : 0.25) : 0.03
        for (const slot of slots) {
          if (chance(p)) place({ doctor, patient: pick(others), ...slot })
        }
      }
    }

    const appointmentRows = await tx.insert(s.appointments).values(planned).returning()

    // --- Visit notes, audit trail, notifications --------------------------------
    const noteRows = appointmentRows
      .filter((a) => a.status === "completed" && (a.patientId === demoPatient.id || chance(0.6)))
      .map((a) => ({
        appointmentId: a.id,
        doctorId: a.doctorId,
        body: pick(VISIT_NOTES),
        createdAt: a.completedAt ?? a.endsAt,
        updatedAt: a.completedAt ?? a.endsAt,
      }))
    if (noteRows.length) await tx.insert(s.visitNotes).values(noteRows)

    const auditRows: (typeof s.auditEvents.$inferInsert)[] = []
    for (const a of appointmentRows) {
      const creator = userRows.find((u) => u.id === a.createdByUserId)
      auditRows.push({
        actorUserId: a.createdByUserId,
        actorRole: creator?.role ?? null,
        entityType: "appointment",
        entityId: a.id,
        action: "created",
        toStatus: "requested",
        metadata: { source: a.source },
        createdAt: a.createdAt,
      })
      if (a.status !== "requested") {
        auditRows.push({
          actorUserId:
            a.status === "completed"
              ? null
              : receptionFor(clinicRows.find((c) => c.id === a.clinicId)!.slug as ClinicKey),
          actorRole: a.status === "completed" ? "doctor" : "receptionist",
          entityType: "appointment",
          entityId: a.id,
          action: "status_changed",
          fromStatus: a.status === "completed" ? "checked_in" : "requested",
          toStatus: a.status,
          createdAt: a.completedAt ?? a.cancelledAt ?? a.checkedInAt ?? a.confirmedAt ?? a.createdAt,
        })
      }
    }
    await tx.insert(s.auditEvents).values(auditRows)

    const demoUpcoming = appointmentRows.filter((a) => a.patientId === demoPatient.id && a.startsAt > now)
    await tx.insert(s.notifications).values(
      demoUpcoming.map((a) => ({
        userId: demoPatientUserId,
        type: a.status === "confirmed" ? "appointment_confirmed" : "appointment_requested",
        title: a.status === "confirmed" ? "Your appointment is confirmed" : "We received your booking request",
        body: `Reference ${a.reference}. We'll see you soon.`,
        link: `/account/appointments/${a.id}`,
        createdAt: a.confirmedAt ?? a.createdAt,
      }))
    )

    // --- Summary ------------------------------------------------------------------
    const byStatus = appointmentRows.reduce<Record<string, number>>((acc, a) => {
      acc[a.status] = (acc[a.status] ?? 0) + 1
      return acc
    }, {})
    const todayCount = planned.filter((a) => {
      const tz = clinicRows.find((c) => c.id === a.clinicId)!.timezone
      const start = (a.startsAt as Date).getTime()
      return start >= localDay(tz, 0).getTime() && start < localDay(tz, 1).getTime()
    }).length
    console.log(
      `  ${clinicRows.length} clinics, ${specialtyRows.length} specialties, ${serviceRows.length} services, ${doctorRows.length} doctors`
    )
    console.log(`  ${ruleRows.length} availability rules, ${exceptionSeeds.length} exceptions`)
    console.log(`  ${patientRows.length} patients, ${userRows.length} user accounts`)
    console.log(`  ${appointmentRows.length} appointments (${todayCount} today):`, byStatus)
    console.log(`  ${noteRows.length} visit notes, ${auditRows.length} audit events`)
  })

  console.log(`\nDemo accounts (password: ${DEMO_PASSWORD}):`)
  for (const email of [
    "patient@medflow.test",
    "reception@medflow.test",
    "doctor@medflow.test",
    "manager@medflow.test",
    "admin@medflow.test",
  ]) {
    console.log(`  ${email}`)
  }
}

main()
  .then(() => db.$client.end())
  .catch(async (error) => {
    console.error(error)
    await db.$client.end()
    process.exit(1)
  })
