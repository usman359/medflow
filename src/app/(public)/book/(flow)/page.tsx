import type { Metadata } from "next"
import { BookingStepper } from "@/components/booking/booking-stepper"
import {
  ClinicStep,
  DetailsStep,
  DoctorStep,
  ReviewStep,
  ServiceStep,
  TimeStep,
} from "@/components/booking/booking-steps"
import { BookingSummary } from "@/components/booking/booking-summary"
import { loadBookingParams } from "@/lib/search-params/booking"
import { getCurrentUser } from "@/server/auth"
import { resolveBooking } from "@/server/booking/flow"

export const metadata: Metadata = {
  title: "Book an appointment",
  description: "Choose a service, doctor, clinic and time, and book your MedFlow appointment online.",
}

export default async function BookPage({ searchParams }: PageProps<"/book">) {
  const params = await loadBookingParams(searchParams)
  const user = await getCurrentUser()
  const state = await resolveBooking(params, user)

  return (
    <div className="container-page grid gap-6 py-8 md:gap-8 md:py-12">
      <header className="grid gap-1">
        <p className="eyebrow">Online booking</p>
        <h1 className="text-3xl font-semibold sm:text-4xl">Book an appointment</h1>
      </header>

      <BookingStepper params={params} step={state.step} firstIncomplete={state.firstIncomplete} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="step-title" className="min-w-0">
          {state.step === "service" && <ServiceStep state={state} params={params} />}
          {state.step === "doctor" && <DoctorStep state={state} params={params} />}
          {state.step === "clinic" && <ClinicStep state={state} params={params} />}
          {state.step === "time" && <TimeStep state={state} params={params} />}
          {state.step === "details" && <DetailsStep state={state} params={params} user={user} />}
          {state.step === "review" && <ReviewStep state={state} params={params} />}
        </section>
        <BookingSummary state={state} params={params} />
      </div>
    </div>
  )
}
