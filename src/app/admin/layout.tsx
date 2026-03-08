import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { AdminSidebar } from '@/components/admin-sidebar'
import { AdminHeader } from '@/components/admin-header'
import { AdminBreadcrumbWrapper } from '@/components/admin-breadcrumb-wrapper'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { ToastProvider } from '@/components/ui/toast'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session || session.user.role !== 'SUPER_ADMIN') {
    redirect('/dashboard')
  }

  const env = process.env.NODE_ENV === 'production'
    ? 'PRODUCTION'
    : process.env.NODE_ENV === 'test'
      ? 'STAGING'
      : 'DEVELOPMENT'

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
        <AdminSidebar variant="inset" />
        <SidebarInset>
          <AdminHeader />
          <div className={`flex h-8 items-center justify-center text-xs font-semibold tracking-wider ${
            env === 'PRODUCTION'
              ? 'bg-red-500/10 text-red-400'
              : env === 'STAGING'
                ? 'bg-yellow-500/10 text-yellow-400'
                : 'bg-primary/10 text-primary'
          }`}>
            {env}
          </div>
          <div className="flex flex-1 flex-col">
            <div className="flex flex-1 flex-col gap-2">
              <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-6">
                <AdminBreadcrumbWrapper />
                {children}
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ToastProvider>
  )
}
