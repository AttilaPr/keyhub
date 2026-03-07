import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { Sidebar } from '@/components/dashboard/sidebar'
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
      <div className="min-h-screen bg-zinc-950">
        <Sidebar />
        <main className="pl-64">
          <div className="mx-auto max-w-6xl p-8">
            {children}
          </div>
        </main>
      </div>
    </ToastProvider>
  )
}
