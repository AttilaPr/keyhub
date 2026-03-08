import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import { AnnouncementBanners } from '@/components/announcement-banners'
import { ImpersonationBanner } from '@/components/impersonation-banner'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { ToastProvider } from '@/components/ui/toast'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <ToastProvider>
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <ImpersonationBanner />
          <SiteHeader />
          <AnnouncementBanners />
          <div className="flex flex-1 flex-col">
            <div className="flex flex-1 flex-col gap-2">
              <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-6">
                {children}
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ToastProvider>
  )
}
