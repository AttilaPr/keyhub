'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { Save } from 'lucide-react'
import { BadgeAlertIcon } from '@/components/ui/badge-alert'
import { BellIcon } from '@/components/ui/bell'
import { LoaderPinwheelIcon } from '@/components/ui/loader-pinwheel'
import { useAnimatedIcon } from '@/hooks/use-animated-icon'

interface NotificationPrefs {
  adminNotifyUserSignup: boolean
  adminNotifyUserSuspended: boolean
  adminNotifyAnomalyDetected: boolean
  adminNotifyKeyLeaked: boolean
  adminNotifyAdminLogin: boolean
  adminNotifyMaintenanceToggled: boolean
}

const NOTIFICATION_LABELS: Record<keyof NotificationPrefs, { title: string; description: string }> = {
  adminNotifyUserSignup: {
    title: 'New user signup',
    description: 'Receive an alert when a new user registers on the platform',
  },
  adminNotifyUserSuspended: {
    title: 'User suspended',
    description: 'Receive an alert when a user account is suspended',
  },
  adminNotifyAnomalyDetected: {
    title: 'Anomaly detected',
    description: 'Receive an alert when an anomaly is detected on any user account',
  },
  adminNotifyKeyLeaked: {
    title: 'Key leaked',
    description: 'Receive an alert when a provider key is reported as leaked',
  },
  adminNotifyAdminLogin: {
    title: 'Admin login',
    description: 'Receive an alert when any super admin logs in (with IP and user-agent)',
  },
  adminNotifyMaintenanceToggled: {
    title: 'Maintenance mode toggled',
    description: 'Receive an alert when maintenance mode is enabled or disabled',
  },
}

const DEFAULT_PREFS: NotificationPrefs = {
  adminNotifyUserSignup: true,
  adminNotifyUserSuspended: true,
  adminNotifyAnomalyDetected: true,
  adminNotifyKeyLeaked: true,
  adminNotifyAdminLogin: true,
  adminNotifyMaintenanceToggled: true,
}

export default function AdminSettingsPage() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const { addToast } = useToast()

  // Animated icon refs for card sections
  const { iconRef: accessIconRef, handlers: accessHandlers } = useAnimatedIcon()
  const { iconRef: notifIconRef, handlers: notifHandlers } = useAnimatedIcon()

  const fetchConfig = useCallback(() => {
    setLoading(true)
    fetch('/api/admin/system/config')
      .then((r) => r.json())
      .then((data) => {
        const newPrefs: NotificationPrefs = { ...DEFAULT_PREFS }
        for (const key of Object.keys(DEFAULT_PREFS) as (keyof NotificationPrefs)[]) {
          if (typeof data[key] === 'boolean') {
            newPrefs[key] = data[key]
          }
        }
        setPrefs(newPrefs)
        setDirty(false)
      })
      .catch(() => addToast({ title: 'Failed to load settings', variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchConfig() }, [fetchConfig])

  function handleToggle(key: keyof NotificationPrefs, checked: boolean) {
    setPrefs((prev) => ({ ...prev, [key]: checked }))
    setDirty(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/system/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      })
      if (!res.ok) throw new Error('Failed to save')
      addToast({ title: 'Notification preferences saved', variant: 'success' })
      setDirty(false)
    } catch {
      addToast({ title: 'Failed to save preferences', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Admin Settings</h1>
        <p className="text-muted-foreground">System configuration and admin preferences</p>
      </div>

      <Card {...accessHandlers}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <BadgeAlertIcon ref={accessIconRef} size={20} className="text-red-400" />
            <div>
              <CardTitle className="text-foreground">Admin Access</CardTitle>
              <CardDescription>Manage admin security settings</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 h-2 w-2 rounded-full bg-primary shrink-0" />
            <div>
              <p className="text-foreground font-medium">Admin routes hidden from non-admins</p>
              <p className="text-muted-foreground">All /admin/* routes return 404 for non-SUPER_ADMIN users</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 h-2 w-2 rounded-full bg-primary shrink-0" />
            <div>
              <p className="text-foreground font-medium">JWT role verification</p>
              <p className="text-muted-foreground">Admin role is verified server-side on every API call</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 h-2 w-2 rounded-full bg-primary shrink-0" />
            <div>
              <p className="text-foreground font-medium">CLI management tools</p>
              <p className="text-muted-foreground">Use <code className="text-primary">pnpm admin:promote &lt;email&gt;</code> and <code className="text-primary">pnpm admin:demote &lt;email&gt;</code> to manage admin access</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Admin Notifications */}
      <Card {...notifHandlers}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BellIcon ref={notifIconRef} size={20} className="text-primary" />
              <div>
                <CardTitle className="text-foreground">Admin Notifications</CardTitle>
                <CardDescription>
                  Configure which alerts are sent to the admin notification channels
                  (email to ADMIN_ALERT_EMAIL, Slack via ADMIN_SLACK_WEBHOOK)
                </CardDescription>
              </div>
            </div>
            <Button
              size="sm"
              disabled={!dirty || saving}
              onClick={handleSave}
            >
              {saving ? (
                <LoaderPinwheelIcon size={16} className="mr-2 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {(Object.keys(NOTIFICATION_LABELS) as (keyof NotificationPrefs)[]).map((key) => {
                const { title, description } = NOTIFICATION_LABELS[key]
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
                  >
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium text-foreground">{title}</Label>
                      <p className="text-xs text-muted-foreground">{description}</p>
                    </div>
                    <Switch
                      checked={prefs[key]}
                      onCheckedChange={(checked: boolean) => handleToggle(key, checked)}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
