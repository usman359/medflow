import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Unauthorized() {
  return (
    <main id="main" className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">Sign in required</p>
      <h1 className="text-3xl font-semibold tracking-tight">Please sign in to continue</h1>
      <Button asChild>
        <Link href="/sign-in">Sign in</Link>
      </Button>
    </main>
  )
}
