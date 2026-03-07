'use client'

import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { User, Shield } from 'lucide-react'

export default function SettingsPage() {
  const { data: session } = useSession()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-zinc-400">Manage your account settings</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <User className="h-5 w-5 text-zinc-400" />
            <div>
              <CardTitle className="text-zinc-100">Profile</CardTitle>
              <CardDescription>Your account information</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={session?.user?.name || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={session?.user?.email || ''} disabled />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-zinc-400" />
            <div>
              <CardTitle className="text-zinc-100">Security</CardTitle>
              <CardDescription>How your data is protected</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
              <div>
                <p className="text-zinc-100 font-medium">Provider keys encrypted at rest</p>
                <p className="text-zinc-400">AES-256-GCM encryption. Keys are useless without the server secret.</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
              <div>
                <p className="text-zinc-100 font-medium">Platform keys hashed with bcrypt</p>
                <p className="text-zinc-400">Plaintext keys are never stored. Only shown once on creation.</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
              <div>
                <p className="text-zinc-100 font-medium">Keys never appear in logs</p>
                <p className="text-zinc-400">Request logs contain prompts and responses, never API keys.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
