"use client"

import Link from "next/link"
import { useEffect } from "react"
import { Button } from "@/components/ui/button"

/** Catches unexpected errors in any route segment. Nothing technical is shown to the visitor. */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main id="main" className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">Something went wrong</p>
      <h1 className="text-3xl font-semibold tracking-tight">We hit a snag loading this page</h1>
      <p className="max-w-md text-muted-foreground">
        Nothing you did caused this, and your information is safe. Please try again. If it keeps happening, call your
        clinic and we&apos;ll help you directly.
      </p>
      {error.digest && <p className="text-xs text-muted-foreground">Reference: {error.digest}</p>}
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </main>
  )
}
