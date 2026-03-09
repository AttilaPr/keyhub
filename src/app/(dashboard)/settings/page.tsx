'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/components/ui/toast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { ShieldOff, Wallet, FileDown } from 'lucide-react'
import { UserIcon } from '@/components/ui/user'
import { ShieldCheckIcon } from '@/components/ui/shield-check'
import { LockIcon } from '@/components/ui/lock'
import { LoaderPinwheelIcon } from '@/components/ui/loader-pinwheel'
import { DeleteIcon } from '@/components/ui/delete'
import { CopyIcon } from '@/components/ui/copy'
import { DownloadIcon } from '@/components/ui/download'
import { KeyIcon } from '@/components/ui/key'
import { BellIcon } from '@/components/ui/bell'
import { ActivityIcon } from '@/components/ui/activity'
import { useAnimatedIcon } from '@/hooks/use-animated-icon'

type MfaSetupStep = 'idle' | 'qr' | 'verify' | 'backup'

export default function SettingsPage() {
  const { data: session, update: updateSession } = useSession()
  const { addToast } = useToast()
  const [name, setName] = useState('')
  const [nameInitialized, setNameInitialized] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [budgetAmount, setBudgetAmount] = useState('')
  const [budgetHardCap, setBudgetHardCap] = useState(false)
  const [savingBudget, setSavingBudget] = useState(false)
  const [budgetLoaded, setBudgetLoaded] = useState(false)

  // MFA state
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [mfaLoading, setMfaLoading] = useState(true)
  const [remainingBackupCodes, setRemainingBackupCodes] = useState(0)
  const [setupDialogOpen, setSetupDialogOpen] = useState(false)
  const [setupStep, setSetupStep] = useState<MfaSetupStep>('idle')
  const [qrCode, setQrCode] = useState('')
  const [manualEntryKey, setManualEntryKey] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [setupError, setSetupError] = useState('')
  const [setupLoading, setSetupLoading] = useState(false)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [disableDialogOpen, setDisableDialogOpen] = useState(false)
  const [disablePassword, setDisablePassword] = useState('')
  const [disableCode, setDisableCode] = useState('')
  const [disableLoading, setDisableLoading] = useState(false)
  const [disableError, setDisableError] = useState('')

  // Data export state
  const [exporting, setExporting] = useState(false)

  // Notification preferences
  const [notifPrefsLoaded, setNotifPrefsLoaded] = useState(false)
  const [savingNotifPrefs, setSavingNotifPrefs] = useState(false)
  const [emailBudgetAlerts, setEmailBudgetAlerts] = useState(true)
  const [emailAnomalyAlerts, setEmailAnomalyAlerts] = useState(true)
  const [emailKeyRotation, setEmailKeyRotation] = useState(true)
  const [emailKeyExpiry, setEmailKeyExpiry] = useState(true)

  // Anomaly detection settings
  const [anomalyDetectionEnabled, setAnomalyDetectionEnabled] = useState(true)
  const [anomalyThresholdSigma, setAnomalyThresholdSigma] = useState('3.0')
  const [anomalyNotifyEmail, setAnomalyNotifyEmail] = useState(true)
  const [anomalyNotifyWebhook, setAnomalyNotifyWebhook] = useState(true)
  const [savingAnomalySettings, setSavingAnomalySettings] = useState(false)

  // Animated icon refs for card hover
  const profileIcon = useAnimatedIcon()
  const passwordIcon = useAnimatedIcon()
  const mfaIcon = useAnimatedIcon()
  const securityIcon = useAnimatedIcon()
  const notifIcon = useAnimatedIcon()
  const anomalyIcon = useAnimatedIcon()
  const dangerIcon = useAnimatedIcon()

  const fetchMfaStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/totp/status')
      if (res.ok) {
        const data = await res.json()
        setMfaEnabled(data.totpEnabled)
        setRemainingBackupCodes(data.remainingBackupCodes)
      }
    } catch {
      // Silent fail
    } finally {
      setMfaLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch('/api/budget')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data) {
          setBudgetAmount(data.monthlyBudgetUsd !== null ? String(data.monthlyBudgetUsd) : '')
          setBudgetHardCap(data.budgetHardCap)
          setBudgetLoaded(true)
        }
      })
      .catch(() => {})

    fetchMfaStatus()

    fetch('/api/settings/notifications')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data) {
          setEmailBudgetAlerts(data.emailBudgetAlerts)
          setEmailAnomalyAlerts(data.emailAnomalyAlerts)
          setEmailKeyRotation(data.emailKeyRotation)
          setEmailKeyExpiry(data.emailKeyExpiry)
          setAnomalyDetectionEnabled(data.anomalyDetectionEnabled)
          setAnomalyThresholdSigma(String(data.anomalyThresholdSigma))
          setAnomalyNotifyEmail(data.anomalyNotifyEmail)
          setAnomalyNotifyWebhook(data.anomalyNotifyWebhook)
          setNotifPrefsLoaded(true)
        }
      })
      .catch(() => {})
  }, [fetchMfaStatus])

  async function handleBudgetSave() {
    setSavingBudget(true)
    try {
      const res = await fetch('/api/budget', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monthlyBudgetUsd: budgetAmount ? budgetAmount : null,
          budgetHardCap,
        }),
      })
      if (res.ok) {
        addToast({ title: 'Budget updated', variant: 'success' })
      } else {
        const data = await res.json().catch(() => ({}))
        addToast({ title: 'Error', description: data.error || 'Failed to update budget', variant: 'destructive' })
      }
    } catch {
      addToast({ title: 'Network error', description: 'Could not reach server', variant: 'destructive' })
    } finally {
      setSavingBudget(false)
    }
  }

  if (session?.user?.name && !nameInitialized) {
    setName(session.user.name)
    setNameInitialized(true)
  }

  async function handleProfileUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      addToast({ title: 'Name is required', variant: 'destructive' })
      return
    }
    setSavingProfile(true)
    try {
      const res = await fetch('/api/settings/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (res.ok) {
        await updateSession()
        addToast({ title: 'Profile updated', description: 'Your name has been changed.', variant: 'success' })
      } else {
        const data = await res.json().catch(() => ({}))
        addToast({ title: 'Error', description: data.error || 'Failed to update profile', variant: 'destructive' })
      }
    } catch {
      addToast({ title: 'Network error', description: 'Could not reach server', variant: 'destructive' })
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleDeleteAccount() {
    if (!deletePassword) {
      addToast({ title: 'Password required', description: 'Enter your password to confirm deletion.', variant: 'destructive' })
      return
    }
    setDeleting(true)
    try {
      const res = await fetch('/api/settings/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePassword }),
      })
      if (res.ok) {
        signOut({ callbackUrl: '/login' })
      } else {
        const data = await res.json().catch(() => ({}))
        addToast({ title: 'Error', description: data.error || 'Failed to delete account', variant: 'destructive' })
        setDeleting(false)
      }
    } catch {
      addToast({ title: 'Network error', description: 'Could not reach server', variant: 'destructive' })
      setDeleting(false)
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()

    if (newPassword !== confirmPassword) {
      addToast({ title: 'Passwords do not match', description: 'New password and confirmation must match.', variant: 'destructive' })
      return
    }

    if (newPassword.length < 8) {
      addToast({ title: 'Password too short', description: 'Password must be at least 8 characters.', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/settings/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })

      if (res.ok) {
        addToast({ title: 'Password updated', description: 'Your password has been changed successfully.', variant: 'success' })
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        const data = await res.json().catch(() => ({}))
        addToast({ title: 'Error', description: data.error || 'Failed to change password', variant: 'destructive' })
      }
    } catch {
      addToast({ title: 'Network error', description: 'Could not reach server', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // MFA: Start setup
  async function handleMfaSetup() {
    setSetupLoading(true)
    setSetupError('')
    try {
      const res = await fetch('/api/auth/totp/setup', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setQrCode(data.qrCode)
        setManualEntryKey(data.manualEntryKey)
        setSetupStep('qr')
        setSetupDialogOpen(true)
      } else {
        addToast({ title: 'Error', description: data.error || 'Failed to start MFA setup', variant: 'destructive' })
      }
    } catch {
      addToast({ title: 'Network error', description: 'Could not reach server', variant: 'destructive' })
    } finally {
      setSetupLoading(false)
    }
  }

  // MFA: Verify setup code
  async function handleVerifySetup() {
    setSetupLoading(true)
    setSetupError('')
    try {
      const res = await fetch('/api/auth/totp/verify-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: totpCode }),
      })
      const data = await res.json()
      if (res.ok) {
        setBackupCodes(data.backupCodes)
        setSetupStep('backup')
        setMfaEnabled(true)
        setRemainingBackupCodes(data.backupCodes.length)
        addToast({ title: 'MFA enabled', description: 'Two-factor authentication is now active.', variant: 'success' })
      } else {
        setSetupError(data.error || 'Verification failed')
      }
    } catch {
      setSetupError('Network error. Please try again.')
    } finally {
      setSetupLoading(false)
    }
  }

  // MFA: Disable
  async function handleDisableMfa() {
    setDisableLoading(true)
    setDisableError('')
    try {
      const res = await fetch('/api/auth/totp/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: disablePassword, code: disableCode }),
      })
      const data = await res.json()
      if (res.ok) {
        setMfaEnabled(false)
        setRemainingBackupCodes(0)
        setDisableDialogOpen(false)
        setDisablePassword('')
        setDisableCode('')
        addToast({ title: 'MFA disabled', description: 'Two-factor authentication has been removed.', variant: 'success' })
      } else {
        setDisableError(data.error || 'Failed to disable MFA')
      }
    } catch {
      setDisableError('Network error. Please try again.')
    } finally {
      setDisableLoading(false)
    }
  }

  async function handleCopyBackupCodes() {
    const text = backupCodes.join('\n')
    try {
      await navigator.clipboard.writeText(text)
      addToast({ title: 'Copied', description: 'Backup codes copied to clipboard.', variant: 'success' })
    } catch {
      addToast({ title: 'Failed to copy', description: 'Could not access clipboard', variant: 'destructive' })
    }
  }

  function handleDownloadBackupCodes() {
    const text = `KeyHub Backup Codes\n${'='.repeat(30)}\n\nSave these codes in a safe place.\nEach code can only be used once.\n\n${backupCodes.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\nGenerated: ${new Date().toISOString()}\n`
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'keyhub-backup-codes.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleExportData() {
    setExporting(true)
    try {
      const res = await fetch('/api/settings/export', { method: 'POST' })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `keyhub-data-export-${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        URL.revokeObjectURL(url)
        addToast({ title: 'Export complete', description: 'Your data has been downloaded.', variant: 'success' })
      } else {
        const data = await res.json().catch(() => ({}))
        addToast({ title: 'Export failed', description: data.error || 'Failed to export data', variant: 'destructive' })
      }
    } catch {
      addToast({ title: 'Network error', description: 'Could not reach server', variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  function resetSetupDialog() {
    setSetupDialogOpen(false)
    setSetupStep('idle')
    setQrCode('')
    setManualEntryKey('')
    setTotpCode('')
    setSetupError('')
    setBackupCodes([])
  }

  async function handleNotifPrefsSave() {
    setSavingNotifPrefs(true)
    try {
      const res = await fetch('/api/settings/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailBudgetAlerts,
          emailAnomalyAlerts,
          emailKeyRotation,
          emailKeyExpiry,
        }),
      })
      if (res.ok) {
        addToast({ title: 'Notification preferences saved', variant: 'success' })
      } else {
        const data = await res.json().catch(() => ({}))
        addToast({ title: 'Error', description: data.error || 'Failed to save preferences', variant: 'destructive' })
      }
    } catch {
      addToast({ title: 'Network error', description: 'Could not reach server', variant: 'destructive' })
    } finally {
      setSavingNotifPrefs(false)
    }
  }

  async function handleAnomalySettingsSave() {
    const sigmaVal = parseFloat(anomalyThresholdSigma)
    if (isNaN(sigmaVal) || sigmaVal < 1.0 || sigmaVal > 10.0) {
      addToast({ title: 'Invalid threshold', description: 'Sigma must be between 1.0 and 10.0', variant: 'destructive' })
      return
    }
    setSavingAnomalySettings(true)
    try {
      const res = await fetch('/api/settings/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anomalyDetectionEnabled,
          anomalyThresholdSigma: sigmaVal,
          anomalyNotifyEmail,
          anomalyNotifyWebhook,
        }),
      })
      if (res.ok) {
        addToast({ title: 'Anomaly detection settings saved', variant: 'success' })
      } else {
        const data = await res.json().catch(() => ({}))
        addToast({ title: 'Error', description: data.error || 'Failed to save settings', variant: 'destructive' })
      }
    } catch {
      addToast({ title: 'Network error', description: 'Could not reach server', variant: 'destructive' })
    } finally {
      setSavingAnomalySettings(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings</p>
      </div>

      <Card {...profileIcon.handlers}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <UserIcon ref={profileIcon.iconRef} size={20} />
            <div>
              <CardTitle className="text-foreground">Profile</CardTitle>
              <CardDescription>Your account information</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="profile-name">Name</Label>
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={session?.user?.email || ''} disabled />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={savingProfile || name.trim() === (session?.user?.name || '')}
              >
                {savingProfile && <LoaderPinwheelIcon size={16} className="mr-2 animate-spin" />}
                Save Profile
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card {...passwordIcon.handlers}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <LockIcon ref={passwordIcon.iconRef} size={20} />
            <div>
              <CardTitle className="text-foreground">Change Password</CardTitle>
              <CardDescription>Update your account password</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Min. 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving && <LoaderPinwheelIcon size={16} className="mr-2 animate-spin" />}
                Update Password
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Two-Factor Authentication */}
      <Card {...mfaIcon.handlers}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <ShieldCheckIcon ref={mfaIcon.iconRef} size={20} />
            <div>
              <CardTitle className="text-foreground">Two-Factor Authentication</CardTitle>
              <CardDescription>Add an extra layer of security to your account</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {mfaLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderPinwheelIcon size={16} className="animate-spin" />
              Loading MFA status...
            </div>
          ) : mfaEnabled ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
                    <ShieldCheckIcon size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">MFA Enabled</p>
                    <p className="text-xs text-muted-foreground">
                      {remainingBackupCodes} backup code{remainingBackupCodes !== 1 ? 's' : ''} remaining
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-primary/10 text-primary">
                  Active
                </span>
              </div>
              <Separator />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDisableDialogOpen(true)
                    setDisableError('')
                    setDisablePassword('')
                    setDisableCode('')
                  }}
                >
                  <ShieldOff className="mr-2 h-4 w-4" />
                  Disable MFA
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-full bg-card">
                  <ShieldOff className="size-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">MFA Not Enabled</p>
                  <p className="text-xs text-muted-foreground">
                    Protect your account with a TOTP authenticator app
                  </p>
                </div>
              </div>
              <Button onClick={handleMfaSetup} disabled={setupLoading}>
                {setupLoading && <LoaderPinwheelIcon size={16} className="mr-2 animate-spin" />}
                <ShieldCheckIcon size={16} className="mr-2" />
                Enable MFA
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MFA Setup Dialog */}
      <Dialog open={setupDialogOpen} onOpenChange={(open) => {
        if (!open && setupStep !== 'backup') {
          resetSetupDialog()
        }
        if (!open && setupStep === 'backup') {
          resetSetupDialog()
        }
      }}>
        <DialogContent className="max-w-md">
          {setupStep === 'qr' && (
            <>
              <DialogHeader>
                <DialogTitle>Set Up Two-Factor Authentication</DialogTitle>
                <DialogDescription>
                  Scan the QR code with your authenticator app (Google Authenticator, Authy, 1Password, etc.)
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center gap-4 py-4">
                {qrCode && (
                  <div className="rounded-lg bg-white p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrCode} alt="TOTP QR Code" width={220} height={220} />
                  </div>
                )}
                <div className="w-full space-y-2">
                  <Label className="text-xs text-muted-foreground">Manual entry key</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded bg-muted px-3 py-2 text-xs font-mono text-muted-foreground break-all">
                      {manualEntryKey}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(manualEntryKey)
                          addToast({ title: 'Copied', description: 'Manual entry key copied.', variant: 'success' })
                        } catch {
                          addToast({ title: 'Failed to copy', description: 'Could not access clipboard', variant: 'destructive' })
                        }
                      }}
                    >
                      <CopyIcon size={16} />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => { setSetupStep('verify'); setTotpCode(''); setSetupError('') }}>
                  Continue
                </Button>
              </div>
            </>
          )}

          {setupStep === 'verify' && (
            <>
              <DialogHeader>
                <DialogTitle>Verify Setup</DialogTitle>
                <DialogDescription>
                  Enter the 6-digit code from your authenticator app to confirm setup.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="setup-totp-code">Authentication Code</Label>
                  <Input
                    id="setup-totp-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    placeholder="000000"
                    value={totpCode}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '')
                      if (val.length <= 6) setTotpCode(val)
                    }}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && totpCode.length === 6) handleVerifySetup()
                    }}
                  />
                </div>
                {setupError && <p className="text-sm text-destructive">{setupError}</p>}
              </div>
              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setSetupStep('qr')}>
                  Back
                </Button>
                <Button
                  onClick={handleVerifySetup}
                  disabled={setupLoading || totpCode.length !== 6}
                >
                  {setupLoading && <LoaderPinwheelIcon size={16} className="mr-2 animate-spin" />}
                  Verify & Enable
                </Button>
              </div>
            </>
          )}

          {setupStep === 'backup' && (
            <>
              <DialogHeader>
                <DialogTitle>Save Your Backup Codes</DialogTitle>
                <DialogDescription>
                  Store these codes in a safe place. Each code can only be used once. They will not be shown again.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-2">
                  {backupCodes.map((code, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-md bg-muted px-3 py-2"
                    >
                      <KeyIcon size={14} className="shrink-0" />
                      <code className="text-sm font-mono text-foreground/80">{code}</code>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopyBackupCodes}>
                    <CopyIcon size={16} className="mr-2" />
                    Copy
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownloadBackupCodes}>
                    <DownloadIcon size={16} className="mr-2" />
                    Download .txt
                  </Button>
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={resetSetupDialog}>
                  Done
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* MFA Disable Dialog */}
      <Dialog open={disableDialogOpen} onOpenChange={(open) => {
        setDisableDialogOpen(open)
        if (!open) {
          setDisablePassword('')
          setDisableCode('')
          setDisableError('')
          setDisableLoading(false)
        }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Enter your password and a current TOTP code to disable MFA.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="disable-password">Password</Label>
              <Input
                id="disable-password"
                type="password"
                placeholder="Your current password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="disable-totp-code">TOTP Code</Label>
              <Input
                id="disable-totp-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="000000"
                value={disableCode}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '')
                  if (val.length <= 6) setDisableCode(val)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && disablePassword && disableCode.length === 6) handleDisableMfa()
                }}
              />
            </div>
            {disableError && <p className="text-sm text-destructive">{disableError}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDisableDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={disableLoading || !disablePassword || disableCode.length !== 6}
              onClick={handleDisableMfa}
            >
              {disableLoading && <LoaderPinwheelIcon size={16} className="mr-2 animate-spin" />}
              Disable MFA
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card {...securityIcon.handlers}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <ShieldCheckIcon ref={securityIcon.iconRef} size={20} />
            <div>
              <CardTitle className="text-foreground">Security</CardTitle>
              <CardDescription>How your data is protected</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-2 w-2 rounded-full bg-primary shrink-0" />
              <div>
                <p className="text-foreground font-medium">Provider keys encrypted at rest</p>
                <p className="text-muted-foreground">AES-256-GCM encryption. Keys are useless without the server secret.</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-2 w-2 rounded-full bg-primary shrink-0" />
              <div>
                <p className="text-foreground font-medium">Platform keys hashed with bcrypt</p>
                <p className="text-muted-foreground">Plaintext keys are never stored. Only shown once on creation.</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-2 w-2 rounded-full bg-primary shrink-0" />
              <div>
                <p className="text-foreground font-medium">Keys never appear in logs</p>
                <p className="text-muted-foreground">Request logs contain prompts and responses, never API keys.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Wallet className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-foreground">Budget</CardTitle>
              <CardDescription>Set a monthly spending limit</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="budget-amount">Monthly Budget (USD)</Label>
              <Input
                id="budget-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="No limit"
                value={budgetAmount}
                onChange={(e) => setBudgetAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Leave empty for unlimited spending</p>
            </div>
            <div className="space-y-2">
              <Label>Hard Cap</Label>
              <div className="flex items-center gap-3">
                <Switch
                  checked={budgetHardCap}
                  onCheckedChange={setBudgetHardCap}
                />
                <span className="text-sm text-muted-foreground">
                  {budgetHardCap ? 'Block requests when budget exceeded' : 'Allow requests (warn only)'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={handleBudgetSave}
              disabled={savingBudget}
            >
              {savingBudget && <LoaderPinwheelIcon size={16} className="mr-2 animate-spin" />}
              Save Budget
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card {...notifIcon.handlers}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <BellIcon ref={notifIcon.iconRef} size={20} />
            <div>
              <CardTitle className="text-foreground">Notification Preferences</CardTitle>
              <CardDescription>Choose which email notifications you receive</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!notifPrefsLoaded ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderPinwheelIcon size={16} className="animate-spin" />
              Loading preferences...
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Budget Alerts</p>
                    <p className="text-xs text-muted-foreground">Get notified when you approach or exceed your budget limit</p>
                  </div>
                  <Switch checked={emailBudgetAlerts} onCheckedChange={setEmailBudgetAlerts} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Anomaly Alerts</p>
                    <p className="text-xs text-muted-foreground">Get notified when unusual activity is detected on your account</p>
                  </div>
                  <Switch checked={emailAnomalyAlerts} onCheckedChange={setEmailAnomalyAlerts} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Key Rotation Reminders</p>
                    <p className="text-xs text-muted-foreground">Get reminded to rotate your provider keys on schedule</p>
                  </div>
                  <Switch checked={emailKeyRotation} onCheckedChange={setEmailKeyRotation} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Key Expiry Warnings</p>
                    <p className="text-xs text-muted-foreground">Get notified when your platform keys are about to expire</p>
                  </div>
                  <Switch checked={emailKeyExpiry} onCheckedChange={setEmailKeyExpiry} />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button onClick={handleNotifPrefsSave} disabled={savingNotifPrefs}>
                  {savingNotifPrefs && <LoaderPinwheelIcon size={16} className="mr-2 animate-spin" />}
                  Save Preferences
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Anomaly Detection Settings */}
      <Card {...anomalyIcon.handlers}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <ActivityIcon ref={anomalyIcon.iconRef} size={20} />
            <div>
              <CardTitle className="text-foreground">Anomaly Detection</CardTitle>
              <CardDescription>Configure automatic detection of unusual activity patterns</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!notifPrefsLoaded ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderPinwheelIcon size={16} className="animate-spin" />
              Loading settings...
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Enable Anomaly Detection</p>
                    <p className="text-xs text-muted-foreground">Automatically detect request volume spikes, cost anomalies, and high error rates</p>
                  </div>
                  <Switch checked={anomalyDetectionEnabled} onCheckedChange={setAnomalyDetectionEnabled} />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="sigma-threshold">Sensitivity Threshold (Sigma Multiplier)</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      id="sigma-threshold"
                      type="number"
                      step="0.1"
                      min="1.0"
                      max="10.0"
                      value={anomalyThresholdSigma}
                      onChange={(e) => setAnomalyThresholdSigma(e.target.value)}
                      className="w-24"
                      disabled={!anomalyDetectionEnabled}
                    />
                    <span className="text-sm text-muted-foreground">
                      {parseFloat(anomalyThresholdSigma) <= 2.0
                        ? 'Very sensitive (more alerts)'
                        : parseFloat(anomalyThresholdSigma) <= 3.0
                          ? 'Default sensitivity'
                          : parseFloat(anomalyThresholdSigma) <= 5.0
                            ? 'Less sensitive (fewer alerts)'
                            : 'Very low sensitivity'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Lower values trigger alerts more easily. Default is 3.0 (alerts when values exceed mean + 3 standard deviations).
                  </p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm font-medium text-foreground mb-3">Notification Channels</p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-foreground/80">Email</p>
                        <p className="text-xs text-muted-foreground">Receive anomaly alerts via email</p>
                      </div>
                      <Switch
                        checked={anomalyNotifyEmail}
                        onCheckedChange={setAnomalyNotifyEmail}
                        disabled={!anomalyDetectionEnabled}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-foreground/80">Webhook</p>
                        <p className="text-xs text-muted-foreground">Dispatch anomaly events to your webhook endpoints</p>
                      </div>
                      <Switch
                        checked={anomalyNotifyWebhook}
                        onCheckedChange={setAnomalyNotifyWebhook}
                        disabled={!anomalyDetectionEnabled}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button onClick={handleAnomalySettingsSave} disabled={savingAnomalySettings}>
                  {savingAnomalySettings && <LoaderPinwheelIcon size={16} className="mr-2 animate-spin" />}
                  Save Settings
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* GDPR Data Export */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <FileDown className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-foreground">Export My Data</CardTitle>
              <CardDescription>Download all your account data as JSON</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground font-medium">GDPR-compliant data export</p>
              <p className="text-sm text-muted-foreground">
                Includes your profile, key metadata (no secrets), logs summary, organization memberships, webhook endpoints, and settings.
              </p>
            </div>
            <Button variant="outline" onClick={handleExportData} disabled={exporting}>
              {exporting ? (
                <LoaderPinwheelIcon size={16} className="mr-2 animate-spin" />
              ) : (
                <FileDown className="mr-2 h-4 w-4" />
              )}
              Export Data
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-red-900/50" {...dangerIcon.handlers}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <DeleteIcon ref={dangerIcon.iconRef} size={20} />
            <div>
              <CardTitle className="text-red-400">Danger Zone</CardTitle>
              <CardDescription>Irreversible actions on your account</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground font-medium">Delete account</p>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and all associated data including API keys, request logs, and usage history.
              </p>
            </div>
            <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => { setDeleteDialogOpen(open); if (!open) { setDeletePassword(''); setDeleting(false) } }}>
              <AlertDialogTrigger
                render={<Button variant="destructive" />}
              >
                Delete Account
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action is permanent and cannot be undone. All your provider keys, platform keys, request logs, and usage data will be deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="px-0 py-2">
                  <Label htmlFor="delete-password" className="text-sm text-muted-foreground">
                    Enter your password to confirm
                  </Label>
                  <Input
                    id="delete-password"
                    type="password"
                    placeholder="Your current password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    className="mt-2"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && deletePassword) handleDeleteAccount()
                    }}
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <Button
                    variant="destructive"
                    disabled={deleting || !deletePassword}
                    onClick={handleDeleteAccount}
                  >
                    {deleting && <LoaderPinwheelIcon size={16} className="mr-2 animate-spin" />}
                    Delete permanently
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
