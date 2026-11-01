import Image from "next/image"
import { Logo } from "@/components/brand/logo"
import { PHOTOS, unsplash } from "@/lib/photos"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <Logo />
        <main id="main" className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
      <div className="relative hidden overflow-hidden bg-teal-900 lg:block">
        <Image
          src={unsplash(PHOTOS.heroCheckup, 1400)}
          alt=""
          fill
          sizes="55vw"
          className="object-cover opacity-80"
          priority
        />
        <div className="absolute inset-0 bg-linear-to-t from-teal-900/90 via-teal-900/30 to-transparent" />
        <blockquote className="absolute inset-x-10 bottom-10 max-w-lg text-primary-foreground">
          <p className="text-2xl leading-snug font-medium text-balance">
            “I booked a same-week visit on my phone in two minutes, and got a reminder the day before.”
          </p>
          <footer className="mt-3 text-sm text-primary-foreground/80">MedFlow patient, Boston</footer>
        </blockquote>
      </div>
    </div>
  )
}
