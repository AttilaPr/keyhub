'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/fetch'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import {
  Settings2,
  Shield,
  Gauge,
  Database,
  Sparkles,
  Mail,
  X,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'

interface SystemConfigData {
  maintenanceMode: boolean
  signupsEnabled: boolean
  defaultPlan: string
  maxUsersTotal: number
  globalRateLimitRpm: number
  allowedEmailDomains: string[]
  providerTimeoutMs: number
  logRetentionDays: number
  semanticCacheEnabled: boolean
  anomalyDetectionEnabled: boolean
  customBannerMessage: string
}

export default function SystemConfigPage() {
  const [config, setConfig] = useState<SystemConfigData | null>(null)
  const [original, setOriginal] = useState<SystemConfigData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [domainInput, setDomainInput] = useState('')
  const { addToast } = useToast()

  const fetchConfig = useCallback(() => {
    setLoading(true)
    setError(null)
    fetch('/api/admin/system/config')
      .then((res) => {
        if (!res.ok) throw new Error(`Server error (${res.status})`)
        return res.json()
      })
      .then((data: SystemConfigData) => {
        setConfig(data)
        setOriginal(data)
      })
      .catch((err) => {
        setError(err.message || 'Failed to load system config')
        setConfig(null)
        setOriginal(null)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchConfig() }, [fetchConfig])

  function getChangedFields(): Partial<SystemConfigData> {
    if (!config || !original) return {}
    const changes: Partial<SystemConfigData> = {}
    for (const key of Object.keys(config) as (keyof SystemConfigData)[]) {
      const cur = config[key]
      const orig = original[key]
      if (Array.isArray(cur) && Array.isArray(orig)) {
        if (JSON.stringify(cur) !== JSON.stringify(orig)) {
          (changes as any)[key] = cur
        }
      } else if (cur !== orig) {
        (changes as any)[key] = cur
      }
    }
    return changes
  }

  const hasChanges = Object.keys(getChangedFields()).length > 0

  async function handleSave() {
    const changes = getChangedFields()
    if (Object.keys(changes).length === 0) return

    setSaving(true)
    try {
      const res = await apiFetch('/api/admin/system/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Server error (${res.status})`)
      }
      const data: SystemConfigData = await res.json()
      setConfig(data)
      setOriginal(data)
      addToast({ title: 'Configuration saved', variant: 'success' })
    } catch (err: unknown) {
      addToast({
        title: 'Failed to save configuration',
        description: err instanceof Error ? err.message : 'An unexpected error occurred',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  function updateConfig<K extends keyof SystemConfigData>(key: K, value: SystemConfigData[K]) {
    setConfig((prev) => prev ? { ...prev, [key]: value } : prev)
  }

  function addDomain() {
    const domain = domainInput.trim().toLowerCase()
    if (!domain) return
    if (config?.allowedEmailDomains.includes(domain)) {
      setDomainInput('')
      return
    }
    updateConfig('allowedEmailDomains', [...(config?.allowedEmailDomains || []), domain])
    setDomainInput('')
  }

  function removeDomain(domain: string) {
    updateConfig(
      'allowedEmailDomains',
      (config?.allowedEmailDomains || []).filter((d) => d !== domain)
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <AlertCircle className="h-10 w-10 text-red-400" />
            <p className="text-sm text-muted-foreground text-center">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchConfig}>
              <RefreshCw className="h-4 w-4 mr-2" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">System Configuration</h1>
          <p className="text-muted-foreground">Platform-wide settings and feature toggles</p>
        </div>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="gap-2"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-[180px] w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : config ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* General Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Settings2 className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-foreground">General</CardTitle>
                  <CardDescription>Core platform behavior</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-foreground/80">Maintenance Mode</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Returns 503 on all API routes. Admin panel stays accessible.
                  </p>
                </div>
                <Switch
                  checked={config.maintenanceMode}
                  onCheckedChange={(checked) => updateConfig('maintenanceMode', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-foreground/80">Signups Enabled</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Allow new user registration
                  </p>
                </div>
                <Switch
                  checked={config.signupsEnabled}
                  onCheckedChange={(checked) => updateConfig('signupsEnabled', checked)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground/80">Custom Banner Message</Label>
                <Textarea
                  placeholder="Enter a message to display to all users..."
                  value={config.customBannerMessage}
                  onChange={(e) => updateConfig('customBannerMessage', e.target.value)}
                  className="min-h-[80px] resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Displays a dismissible info banner to all logged-in users. Leave empty to hide.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Limits Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Gauge className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-foreground">Limits</CardTitle>
                  <CardDescription>Platform capacity controls</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label className="text-foreground/80">Max Users Total</Label>
                <Input
                  type="number"
                  min={0}
                  value={config.maxUsersTotal}
                  onChange={(e) => updateConfig('maxUsersTotal', parseInt(e.target.value) || 0)}
                />
                <p className="text-xs text-muted-foreground">
                  Hard cap on total registered users. 0 = unlimited.
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground/80">Global Rate Limit (RPM)</Label>
                <Input
                  type="number"
                  min={0}
                  value={config.globalRateLimitRpm}
                  onChange={(e) => updateConfig('globalRateLimitRpm', parseInt(e.target.value) || 0)}
                />
                <p className="text-xs text-muted-foreground">
                  Platform-wide requests per minute ceiling. 0 = unlimited.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Data Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-foreground">Data</CardTitle>
                  <CardDescription>Retention and timeout settings</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label className="text-foreground/80">Log Retention (days)</Label>
                <Input
                  type="number"
                  min={1}
                  value={config.logRetentionDays}
                  onChange={(e) => updateConfig('logRetentionDays', parseInt(e.target.value) || 90)}
                />
                <p className="text-xs text-muted-foreground">
                  Auto-purge request logs older than this many days.
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground/80">Provider Timeout (ms)</Label>
                <Input
                  type="number"
                  min={1000}
                  step={1000}
                  value={config.providerTimeoutMs}
                  onChange={(e) => updateConfig('providerTimeoutMs', parseInt(e.target.value) || 30000)}
                />
                <p className="text-xs text-muted-foreground">
                  Global timeout for upstream provider calls.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Features Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-foreground">Features</CardTitle>
                  <CardDescription>Feature toggles</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-foreground/80">Semantic Cache</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Enable semantic caching for similar requests
                  </p>
                </div>
                <Switch
                  checked={config.semanticCacheEnabled}
                  onCheckedChange={(checked) => updateConfig('semanticCacheEnabled', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-foreground/80">Anomaly Detection</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Detect and alert on unusual activity patterns
                  </p>
                </div>
                <Switch
                  checked={config.anomalyDetectionEnabled}
                  onCheckedChange={(checked) => updateConfig('anomalyDetectionEnabled', checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Access Section */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-foreground">Access</CardTitle>
                  <CardDescription>Registration and domain restrictions</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-foreground/80">Allowed Email Domains</Label>
                <p className="text-xs text-muted-foreground">
                  If non-empty, only users with these email domains can register. Leave empty to allow any domain.
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. company.com"
                    value={domainInput}
                    onChange={(e) => setDomainInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addDomain()
                      }
                    }}
                  />
                  <Button variant="outline" onClick={addDomain} type="button">
                    Add
                  </Button>
                </div>
                {config.allowedEmailDomains.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {config.allowedEmailDomains.map((domain) => (
                      <Badge
                        key={domain}
                        variant="secondary"
                        className="gap-1 pr-1"
                      >
                        <Mail className="h-3 w-3" />
                        {domain}
                        <button
                          onClick={() => removeDomain(domain)}
                          className="ml-1 rounded-full p-0.5 hover:bg-zinc-700 cursor-pointer"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
