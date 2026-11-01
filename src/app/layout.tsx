import type { Metadata, Viewport } from "next"
import { Figtree } from "next/font/google"
import { NuqsAdapter } from "nuqs/adapters/next/app"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import "./globals.css"

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: { default: "MedFlow — Book your doctor online", template: "%s · MedFlow" },
  description:
    "Book appointments with MedFlow doctors across our clinics in Boston, New York and Chicago. Find a specialist, pick a time and confirm in minutes.",
}

export const viewport: Viewport = {
  themeColor: "#0f5257",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${figtree.variable} h-full`} data-scroll-behavior="smooth">
      <body className="flex min-h-full flex-col">
        <NuqsAdapter>
          <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        </NuqsAdapter>
        <Toaster theme="light" position="top-center" richColors />
      </body>
    </html>
  )
}
