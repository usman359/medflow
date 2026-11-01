import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Forbidden() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">Error 403</p>
      <h1 className="text-3xl font-semibold tracking-tight">You don&apos;t have access to this page</h1>
      <p className="max-w-md text-muted-foreground">
        Your account doesn&apos;t have permission to view this area. If you think this is a mistake, contact your clinic
        administrator.
      </p>
      <Button asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </main>
  )
}
