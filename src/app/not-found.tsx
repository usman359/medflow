import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main id="main" className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">Error 404</p>
      <h1 className="text-3xl font-semibold tracking-tight">We couldn&apos;t find that page</h1>
      <p className="max-w-md text-muted-foreground">
        The link may be out of date, or the page may have moved. Try finding a doctor or head back home.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link href="/">Back to home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/doctors">Find a doctor</Link>
        </Button>
      </div>
    </main>
  )
}
