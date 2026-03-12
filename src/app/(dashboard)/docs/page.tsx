'use client'

import { useEffect, useRef, useState } from 'react'
import { useOrgs } from '@/contexts/orgs-context'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { Circle } from 'lucide-react'
import { CopyIcon } from '@/components/ui/copy'
import { CheckIcon } from '@/components/ui/check'
import { CircleCheckIcon } from '@/components/ui/circle-check'
import { BadgeAlertIcon } from '@/components/ui/badge-alert'
import { ArrowRightIcon } from '@/components/ui/arrow-right'

const YOUR_KEY = 'ak-user-YOUR_PLATFORM_KEY'
const BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://your-keyhub.com'

const codeExamples = [
  {
    label: 'curl',
    lang: 'bash',
    code: `curl ${BASE_URL}/api/v1/chat/completions \\
  -H "Authorization: Bearer ${YOUR_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "openai/gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`,
  },
  {
    label: 'Node.js (OpenAI SDK)',
    lang: 'javascript',
    code: `import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: '${YOUR_KEY}',
  baseURL: '${BASE_URL}/api/v1'
})

const res = await client.chat.completions.create({
  model: 'anthropic/claude-3-5-sonnet-20241022',
  messages: [{ role: 'user', content: 'Hello!' }]
})

console.log(res.choices[0].message.content)`,
  },
  {
    label: 'Python (OpenAI SDK)',
    lang: 'python',
    code: `from openai import OpenAI

client = OpenAI(
    api_key="${YOUR_KEY}",
    base_url="${BASE_URL}/api/v1"
)

response = client.chat.completions.create(
    model="google/gemini-2.0-flash",
    messages=[{"role": "user", "content": "Hello!"}]
)

print(response.choices[0].message.content)`,
  },
  {
    label: 'Vercel AI SDK',
    lang: 'typescript',
    code: `import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'

const keyhub = createOpenAI({
  apiKey: '${YOUR_KEY}',
  baseURL: '${BASE_URL}/api/v1'
})

const { text } = await generateText({
  model: keyhub('anthropic/claude-3-5-sonnet-20241022'),
  prompt: 'Hello!'
})

console.log(text)`,
  },
]

// Fallback — replaced dynamically from /api/models on mount
const FALLBACK_MODELS = [
  { provider: 'KeyHub Free', key: 'keyhub', models: ['keyhub/free'] },
  { provider: 'OpenAI', key: 'openai', models: ['openai/gpt-4o', 'openai/gpt-4o-mini'] },
  { provider: 'Anthropic', key: 'anthropic', models: ['anthropic/claude-3-5-sonnet-20241022'] },
  { provider: 'Google', key: 'google', models: ['google/gemini-2.0-flash'] },
  { provider: 'Mistral', key: 'mistral', models: ['mistral/mistral-large-latest'] },
]

interface SetupStatus {
  providerKeyCount: number
  platformKeyCount: number
  requestCount: number
}

export default function DocsPage() {
  const { activeOrgId } = useOrgs()
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [activeProviders, setActiveProviders] = useState<Set<string>>(new Set())
  const [models, setModels] = useState(FALLBACK_MODELS)
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null)
  const [setupLoading, setSetupLoading] = useState(true)
  const { addToast } = useToast()

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller

    async function loadData() {
      try {
        const [providerRes, setupRes, modelsRes] = await Promise.all([
          fetch('/api/keys/provider', { signal }),
          fetch('/api/setup-status', { signal }),
          fetch('/api/models', { signal }),
        ])

        if (providerRes.ok) {
          const data = await providerRes.json()
          const keys: { provider: string; isActive: boolean }[] = data.keys ?? data
          setActiveProviders(new Set(keys.filter((k) => k.isActive).map((k) => k.provider)))
        }

        if (setupRes.ok) {
          setSetupStatus(await setupRes.json())
        }

        if (modelsRes.ok) {
          const data: { providers: { key: string; label: string; models: string[] }[] } | null = await modelsRes.json()
          if (data?.providers?.length) {
            setModels(data.providers.map((p) => ({ provider: p.label, key: p.key, models: p.models })))
          }
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
        addToast({ title: 'Could not load setup status', description: 'Some sections may be incomplete', variant: 'destructive' })
      } finally {
        setSetupLoading(false)
      }
    }

    loadData()
    return () => controller.abort()
  }, [addToast, activeOrgId])

  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
    }
  }, [])

  async function copyCode(code: string, index: number) {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedIndex(index)
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
      copiedTimerRef.current = setTimeout(() => setCopiedIndex(null), 2000)
    } catch {
      // Clipboard API not available
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">API Documentation</h1>
        <p className="text-muted-foreground">How to connect your apps to KeyHub</p>
      </div>

      {/* Quick Start */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-foreground">Quick Start</CardTitle>
              <CardDescription>
                KeyHub is OpenAI-compatible. Use any OpenAI SDK by changing the base URL and API key.
              </CardDescription>
            </div>
            {setupLoading ? (
              <Skeleton className="h-5 w-20" />
            ) : setupStatus && (
              <Badge className={
                setupStatus.providerKeyCount > 0 && setupStatus.platformKeyCount > 0 && setupStatus.requestCount > 0
                  ? 'bg-primary/10 text-primary'
                  : 'bg-card text-muted-foreground'
              }>
                {[setupStatus.providerKeyCount > 0, setupStatus.platformKeyCount > 0, setupStatus.requestCount > 0].filter(Boolean).length}/3 complete
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          {setupLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border border-border p-3">
                  <Skeleton className="h-5 w-5 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : (() => {
            const steps = [
              {
                done: setupStatus ? setupStatus.providerKeyCount > 0 : false,
                label: 'Add your provider API keys',
                detail: setupStatus && setupStatus.providerKeyCount > 0
                  ? `${setupStatus.providerKeyCount} provider${setupStatus.providerKeyCount > 1 ? 's' : ''} configured`
                  : 'Connect at least one AI provider',
                href: '/provider-keys',
                linkText: 'Provider Keys',
              },
              {
                done: setupStatus ? setupStatus.platformKeyCount > 0 : false,
                label: 'Create a platform key',
                detail: setupStatus && setupStatus.platformKeyCount > 0
                  ? `${setupStatus.platformKeyCount} key${setupStatus.platformKeyCount > 1 ? 's' : ''} created`
                  : 'Generate an API key for your applications',
                href: '/platform-keys',
                linkText: 'Platform Keys',
              },
              {
                done: setupStatus ? setupStatus.requestCount > 0 : false,
                label: 'Make your first API request',
                detail: setupStatus && setupStatus.requestCount > 0
                  ? `${setupStatus.requestCount.toLocaleString()} request${setupStatus.requestCount > 1 ? 's' : ''} made`
                  : 'Use the base URL and platform key below',
                href: undefined,
                linkText: undefined,
              },
            ]

            return steps.map((step, i) => (
              <div key={i} className={`flex items-start gap-3 rounded-lg border p-3 ${
                step.done
                  ? 'border-lime-400/20 bg-primary/5'
                  : 'border-border bg-muted/50'
              }`}>
                {step.done ? (
                  <CircleCheckIcon size={20} className="text-primary mt-0.5 shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${step.done ? 'text-primary' : 'text-foreground'}`}>
                      {i + 1}. {step.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{step.detail}</p>
                </div>
                {step.href && !step.done && (
                  <a
                    href={step.href}
                    className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0 mt-0.5"
                  >
                    {step.linkText}
                    <ArrowRightIcon size={12} />
                  </a>
                )}
              </div>
            ))
          })()}

          <div className="mt-2 rounded-lg border border-border bg-muted p-4">
            <p className="text-xs text-muted-foreground mb-1">Base URL</p>
            <code className="text-primary">{BASE_URL}/api/v1</code>
          </div>
          <div className="rounded-lg border border-border bg-muted p-4">
            <p className="text-xs text-muted-foreground mb-1">Model Format</p>
            <code className="text-primary">provider/model-name</code>
            <p className="text-xs text-muted-foreground mt-1">e.g. openai/gpt-4o, anthropic/claude-3-5-sonnet-20241022</p>
          </div>
        </CardContent>
      </Card>

      {/* Code Examples */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Code Examples</h2>
        {codeExamples.map((example, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm text-foreground">{example.label}</CardTitle>
                <Badge variant="outline">{example.lang}</Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyCode(example.code, i)}
                className="text-muted-foreground"
              >
                {copiedIndex === i ? (
                  <CheckIcon size={16} className="text-primary" />
                ) : (
                  <CopyIcon size={16} />
                )}
              </Button>
            </CardHeader>
            <CardContent>
              <pre className="rounded-lg bg-muted border border-border p-4 text-xs text-muted-foreground overflow-x-auto">
                <code>{example.code}</code>
              </pre>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Available Models */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Available Models</CardTitle>
          <CardDescription>
            Models are available based on which provider keys you have added. The KeyHub Free model is available to all users at no cost.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {models.map((group) => {
              const isFree = group.key === 'keyhub'
              const isActive = isFree || activeProviders.has(group.key)
              return (
                <div key={group.provider}>
                  <div className="flex items-center gap-2 mb-2">
                    {isActive ? (
                      <CircleCheckIcon size={16} className="text-primary" />
                    ) : (
                      <BadgeAlertIcon size={16} className="text-muted-foreground" />
                    )}
                    <h3 className="text-sm font-medium text-muted-foreground">{group.provider}</h3>
                    {isFree ? (
                      <Badge className="bg-lime-400/10 text-lime-400 text-[10px]">Free</Badge>
                    ) : isActive ? (
                      <Badge className="bg-primary/10 text-primary text-[10px]">Configured</Badge>
                    ) : (
                      <a href="/provider-keys" className="text-[10px] text-muted-foreground hover:text-primary transition-colors">
                        Add key →
                      </a>
                    )}
                  </div>
                  {isFree && (
                    <p className="text-xs text-muted-foreground mb-2 max-w-2xl">
                      Free AI model powered by KeyHub. Routes requests to available free models with smart filtering based on your needs — supports text, image understanding, tool calling, and structured outputs. 200K context window. Zero cost.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {group.models.map((model) => (
                      <code
                        key={model}
                        className={`rounded px-2 py-1 text-xs ${
                          isActive
                            ? 'bg-card text-muted-foreground'
                            : 'bg-muted/50 text-muted-foreground'
                        }`}
                      >
                        {model}
                      </code>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Endpoints */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">API Endpoints</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <div className="flex items-start gap-3">
              <Badge>POST</Badge>
              <div>
                <code className="text-foreground">/api/v1/chat/completions</code>
                <p className="text-muted-foreground mt-1">OpenAI-compatible chat completions endpoint. Supports streaming.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Badge className="bg-primary/10 text-primary">GET</Badge>
              <div>
                <code className="text-foreground">/api/v1/models</code>
                <p className="text-muted-foreground mt-1">List available models based on your provider keys.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
