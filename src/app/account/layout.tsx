import { AccountNav } from "@/components/account/account-nav"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { requireRole } from "@/server/auth"

export default async function AccountLayout({ children }: LayoutProps<"/account">) {
  const user = await requireRole("patient")
  return (
    <>
      <SiteHeader />
      <div className="container-page grid flex-1 gap-8 py-8 md:grid-cols-[14rem_minmax(0,1fr)] md:py-12">
        <aside className="grid content-start gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Signed in as</p>
            <p className="truncate font-semibold text-teal-900">{user.name}</p>
          </div>
          <AccountNav />
        </aside>
        <main id="main" className="grid min-w-0 content-start gap-6">
          {children}
        </main>
      </div>
      <SiteFooter />
    </>
  )
}
