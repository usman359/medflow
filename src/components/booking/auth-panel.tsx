"use client"

import { useRouter } from "next/navigation"
import { SignInForm } from "@/components/auth/sign-in-form"
import { SignUpForm } from "@/components/auth/sign-up-form"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

/** Inline sign-up / sign-in so patients never lose their place in the booking flow. */
export function BookingAuthPanel() {
  const router = useRouter()
  const done = () => router.refresh()

  return (
    <Tabs defaultValue="sign-up" className="gap-5">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="sign-up">I&apos;m new to MedFlow</TabsTrigger>
        <TabsTrigger value="sign-in">I have an account</TabsTrigger>
      </TabsList>
      <TabsContent value="sign-up">
        <SignUpForm onSuccess={done} />
      </TabsContent>
      <TabsContent value="sign-in">
        <SignInForm onSuccess={done} />
      </TabsContent>
    </Tabs>
  )
}
