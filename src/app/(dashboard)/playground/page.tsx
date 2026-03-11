'use client'

import { useEffect, useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { useToast } from '@/components/ui/toast'
import { Save, ExternalLink } from 'lucide-react'
import { DeleteIcon } from '@/components/ui/delete'
import { ChevronDownIcon } from '@/components/ui/chevron-down'
import { ChevronUpIcon } from '@/components/ui/chevron-up'
import { DownloadIcon } from '@/components/ui/download'
import { FileTextIcon } from '@/components/ui/file-text'
import { FolderOpenIcon } from '@/components/ui/folder-open'
import { apiFetch } from '@/lib/fetch'

// AI Elements
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message'
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTools,
  PromptInputSelect,
  PromptInputSelectTrigger,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectValue,
} from '@/components/ai-elements/prompt-input'

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface SavedSession {
  id: string
  name: string
  messages: ChatMessage[]
  model: string
  systemPrompt: string
  temperature: number
  maxTokens: string
  savedAt: string
}

interface RawExchange {
  request: Record<string, unknown>
  response: string
}

interface ModelGroup {
  provider: string
  key: string
  models: string[]
}

// Models fetched dynamically from /api/models
const FALLBACK_MODELS: ModelGroup[] = [
  { provider: 'KeyHub Free', key: 'keyhub', models: ['keyhub/free'] },
  { provider: 'OpenAI', key: 'openai', models: ['openai/gpt-4o', 'openai/gpt-4o-mini'] },
  { provider: 'Anthropic', key: 'anthropic', models: ['anthropic/claude-3-5-sonnet-20241022'] },
  { provider: 'Google', key: 'google', models: ['google/gemini-2.0-flash'] },
  { provider: 'Mistral', key: 'mistral', models: ['mistral/mistral-large-latest'] },
]

interface PromptTemplate {
  id: string
  name: string
  description: string | null
  systemPrompt: string
}

const SESSIONS_KEY = 'keyhub-playground-sessions'

function loadSessions(): SavedSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function persistSessions(sessions: SavedSession[]) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
}

export default function PlaygroundPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [model, setModel] = useState('keyhub/free')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [showSystemPrompt, setShowSystemPrompt] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [activeProviders, setActiveProviders] = useState<Set<string>>(new Set())
  const [allModels, setAllModels] = useState<ModelGroup[]>(FALLBACK_MODELS)
  const [platformKeys, setPlatformKeys] = useState<{ id: string; label: string; keyPrefix: string }[]>([])
  const [selectedKeyId, setSelectedKeyId] = useState<string>('')
  const abortRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { addToast } = useToast()

  // Configuration panel state
  const [temperature, setTemperature] = useState(1.0)
  const [maxTokens, setMaxTokens] = useState('')
  const [showRaw, setShowRaw] = useState(false)
  const [rawExchanges, setRawExchanges] = useState<RawExchange[]>([])
  const [expandedRaw, setExpandedRaw] = useState<number | null>(null)

  // Template state
  const [templates, setTemplates] = useState<PromptTemplate[]>([])

  // Session management state
  const [sessions, setSessions] = useState<SavedSession[]>([])
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [sessionsDialogOpen, setSessionsDialogOpen] = useState(false)
  const [sessionName, setSessionName] = useState('')
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null)

  // Flat list of all model IDs for the prompt input selector
  const flatModels = allModels.flatMap((group) => {
    const isFree = group.key === 'keyhub'
    const isActive = isFree || activeProviders.has(group.key)
    return group.models.map((m) => ({ id: m, disabled: !isActive, isFree }))
  })

  useEffect(() => {
    const saved = localStorage.getItem('keyhub-playground-system-prompt')
    if (saved) {
      setSystemPrompt(saved)
      setShowSystemPrompt(true)
    }

    setSessions(loadSessions())

    const controller = new AbortController()
    const { signal } = controller

    async function loadInitialData() {
      try {
        const [providerRes, modelsRes, platformRes, templatesRes] = await Promise.all([
          fetch('/api/keys/provider', { signal }),
          fetch('/api/models', { signal }),
          fetch('/api/keys/platform', { signal }),
          fetch('/api/templates', { signal }),
        ])

        if (providerRes.ok) {
          const keys: { provider: string; isActive: boolean }[] = await providerRes.json()
          setActiveProviders(new Set(keys.filter((k) => k.isActive).map((k) => k.provider)))
        }

        if (modelsRes.ok) {
          const data: { providers: ModelGroup[] } | null = await modelsRes.json()
          if (data?.providers?.length) setAllModels(data.providers)
        }

        if (platformRes.ok) {
          const keys: { id: string; label: string; keyPrefix: string; isActive: boolean }[] = await platformRes.json()
          const active = keys.filter((k) => k.isActive)
          setPlatformKeys(active.map((k) => ({ id: k.id, label: k.label, keyPrefix: k.keyPrefix })))
        }

        if (templatesRes.ok) {
          const data: PromptTemplate[] = await templatesRes.json()
          setTemplates(data)
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
      }
    }

    loadInitialData()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    localStorage.setItem('keyhub-playground-system-prompt', systemPrompt)
  }, [systemPrompt])

  async function handleSend(text?: string) {
    const msg = text ?? input
    if (!msg.trim() || streaming) return

    const isFree = model === 'keyhub/free'
    if (!isFree && !selectedKeyId) {
      addToast({ title: 'No key selected', description: 'Select a platform key to use', variant: 'destructive' })
      return
    }

    const userMessage: ChatMessage = { role: 'user', content: msg.trim() }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setStreaming(true)

    const apiMessages = systemPrompt
      ? [{ role: 'system' as const, content: systemPrompt }, ...newMessages]
      : newMessages

    const controller = new AbortController()
    abortRef.current = controller

    const requestBody: Record<string, unknown> = {
      model,
      messages: apiMessages,
      platformKeyId: selectedKeyId,
      temperature,
    }
    if (maxTokens && parseInt(maxTokens, 10) > 0) {
      requestBody.maxTokens = parseInt(maxTokens, 10)
    }

    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
    try {
      const res = await apiFetch('/api/playground/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }))
        addToast({ title: 'Error', description: err.error, variant: 'destructive' })
        setStreaming(false)
        return
      }

      reader = res.body?.getReader()
      if (!reader) {
        setStreaming(false)
        return
      }

      const decoder = new TextDecoder()
      let assistantContent = ''
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        assistantContent += decoder.decode(value, { stream: true })
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: assistantContent }
          return updated
        })
      }

      // Store raw exchange for the raw view
      if (showRaw) {
        setRawExchanges((prev) => [...prev, {
          request: requestBody,
          response: assistantContent,
        }])
      }
    } catch (err: unknown) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        addToast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to send message', variant: 'destructive' })
      }
    } finally {
      reader?.cancel().catch(() => {})
      setStreaming(false)
      abortRef.current = null
    }
  }

  function handleStop() {
    abortRef.current?.abort()
    setStreaming(false)
  }

  function handleClear() {
    setMessages([])
    setRawExchanges([])
    setExpandedRaw(null)
  }

  // Session management
  function handleSaveSession() {
    if (!sessionName.trim()) return
    const session: SavedSession = {
      id: crypto.randomUUID(),
      name: sessionName.trim(),
      messages,
      model,
      systemPrompt,
      temperature,
      maxTokens,
      savedAt: new Date().toISOString(),
    }
    const updated = [session, ...sessions]
    setSessions(updated)
    persistSessions(updated)
    setSessionName('')
    setSaveDialogOpen(false)
    addToast({ title: 'Session saved', description: `"${session.name}" has been saved.`, variant: 'success' })
  }

  function handleLoadSession(session: SavedSession) {
    setMessages(session.messages)
    setModel(session.model)
    setSystemPrompt(session.systemPrompt)
    if (session.systemPrompt) setShowSystemPrompt(true)
    setTemperature(session.temperature)
    setMaxTokens(session.maxTokens)
    setRawExchanges([])
    setExpandedRaw(null)
    setSessionsDialogOpen(false)
    addToast({ title: 'Session loaded', description: `"${session.name}" has been loaded.`, variant: 'success' })
  }

  function handleDeleteSession() {
    if (!deleteSessionId) return
    const updated = sessions.filter((s) => s.id !== deleteSessionId)
    setSessions(updated)
    persistSessions(updated)
    setDeleteSessionId(null)
    addToast({ title: 'Session deleted', variant: 'default' })
  }

  function handleExportMarkdown() {
    if (messages.length === 0) {
      addToast({ title: 'Nothing to export', description: 'Start a conversation first.', variant: 'destructive' })
      return
    }

    let md = `# Playground Conversation\n\n`
    md += `**Model:** ${model}\n`
    md += `**Temperature:** ${temperature}\n`
    if (maxTokens) md += `**Max Tokens:** ${maxTokens}\n`
    if (systemPrompt) md += `**System Prompt:** ${systemPrompt}\n`
    md += `**Date:** ${new Date().toLocaleString()}\n\n---\n\n`

    for (const msg of messages) {
      const label = msg.role === 'user' ? 'User' : 'Assistant'
      md += `### ${label}\n\n${msg.content}\n\n`
    }

    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `keyhub-conversation-${new Date().toISOString().slice(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(url)
    addToast({ title: 'Exported', description: 'Conversation exported as Markdown.', variant: 'success' })
  }

  const chatStatus = streaming ? 'streaming' as const : 'ready' as const

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Playground</h1>
          <p className="text-muted-foreground">Test models interactively</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSessionsDialogOpen(true)}>
            <FolderOpenIcon size={16} className="mr-1" /> Sessions
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSaveDialogOpen(true)}
            disabled={messages.length === 0}
          >
            <Save className="h-4 w-4 mr-1" /> Save
          </Button>
          <Button variant="ghost" size="sm" onClick={handleExportMarkdown} disabled={messages.length === 0}>
            <DownloadIcon size={16} className="mr-1" /> Export
          </Button>
          <Button variant="ghost" size="sm" onClick={handleClear} disabled={messages.length === 0 || streaming}>
            <DeleteIcon size={16} className="mr-1" /> Clear
          </Button>
        </div>
      </div>

      {/* Config bar */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="w-48">
          <Label className="text-xs text-muted-foreground mb-1">API Key</Label>
          <Select value={selectedKeyId} onValueChange={(v) => v && setSelectedKeyId(v)}>
            <SelectTrigger>
              <SelectValue placeholder={model === 'keyhub/free' ? 'Not needed (free)' : 'Select key...'} />
            </SelectTrigger>
            <SelectContent>
              {platformKeys.map((k) => (
                <SelectItem key={k.id} value={k.id}>
                  {k.label} ({k.keyPrefix.slice(0, 8)}...)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Template selector */}
        {templates.length > 0 && (
          <div className="w-56">
            <Label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <FileTextIcon size={14} />
              Template
            </Label>
            <Select
              value=""
              onValueChange={(v) => {
                if (!v) return
                const template = templates.find((t) => t.id === v)
                if (template) {
                  setSystemPrompt(template.systemPrompt)
                  setShowSystemPrompt(true)
                  addToast({ title: 'Template applied', description: `"${template.name}" system prompt loaded.`, variant: 'success' })
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Apply template..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Temperature slider */}
        <div className="w-48">
          <Label className="text-xs text-muted-foreground mb-1">Temperature: {temperature.toFixed(1)}</Label>
          <Slider
            value={[temperature]}
            onValueChange={(value) => {
              const vals = Array.isArray(value) ? value : [value]
              setTemperature(vals[0])
            }}
            min={0}
            max={2}
            step={0.1}
          />
        </div>

        {/* Max tokens input */}
        <div className="w-32">
          <Label className="text-xs text-muted-foreground mb-1">Max Tokens</Label>
          <Input
            type="number"
            min="1"
            placeholder="Optional"
            value={maxTokens}
            onChange={(e) => setMaxTokens(e.target.value)}
            className="h-9"
          />
        </div>

        {/* Show raw toggle */}
        <div className="flex items-center gap-2 pb-0.5">
          <Switch
            checked={showRaw}
            onCheckedChange={setShowRaw}
            aria-label="Show raw request/response"
          />
          <Label className="text-xs text-muted-foreground">Raw</Label>
        </div>

        <div className="flex items-end pb-0.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSystemPrompt(!showSystemPrompt)}
            className="text-muted-foreground"
          >
            {showSystemPrompt ? <ChevronUpIcon size={16} className="mr-1" /> : <ChevronDownIcon size={16} className="mr-1" />}
            System Prompt
          </Button>
        </div>
      </div>

      {showSystemPrompt && (
        <div>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="You are a helpful assistant..."
            className="w-full min-h-[80px] rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground placeholder:text-muted-foreground resize-y focus:outline-none focus:ring-1 focus:ring-lime-400/50"
          />
        </div>
      )}

      {/* Chat area with AI Elements */}
      <Card className="min-h-[400px] flex flex-col">
        <CardContent className="flex-1 overflow-y-auto p-6 space-y-6 max-h-[500px]">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground text-sm">
              <p>Send a message to start chatting</p>
              <p className="text-xs">Using <code className="text-lime-400">{model}</code></p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <Message key={i} from={msg.role}>
                <MessageContent>
                  {msg.role === 'assistant' ? (
                    <MessageResponse>{msg.content}</MessageResponse>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </MessageContent>
              </Message>
            ))
          )}
          <div ref={messagesEndRef} />
        </CardContent>

        {/* AI Elements Prompt Input */}
        <div className="border-t border-border p-4">
          <PromptInput
            onSubmit={({ text }) => {
              handleSend(text)
            }}
          >
            <PromptInputTextarea
              placeholder="Ask anything... (Enter to send, Shift+Enter for new line)"
              disabled={streaming}
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <PromptInputFooter>
              <PromptInputTools>
                <PromptInputSelect value={model} onValueChange={(v) => v && setModel(v)}>
                  <PromptInputSelectTrigger className="w-auto max-w-[200px]">
                    <PromptInputSelectValue />
                  </PromptInputSelectTrigger>
                  <PromptInputSelectContent>
                    {flatModels.map((m) => (
                      <PromptInputSelectItem key={m.id} value={m.id} disabled={m.disabled}>
                        {m.id}{m.isFree ? ' (free)' : m.disabled ? ' (no key)' : ''}
                      </PromptInputSelectItem>
                    ))}
                  </PromptInputSelectContent>
                </PromptInputSelect>
              </PromptInputTools>
              <PromptInputSubmit
                status={chatStatus}
                onStop={handleStop}
                disabled={!input.trim() || (model !== 'keyhub/free' && !selectedKeyId)}
              />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </Card>

      {/* Raw request/response blocks */}
      {showRaw && rawExchanges.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Raw Request / Response</h3>
          {rawExchanges.map((exchange, i) => (
            <Card key={i} className="overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedRaw(expandedRaw === i ? null : i)}
                aria-expanded={expandedRaw === i}
                className="w-full flex items-center justify-between p-3 text-left text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                <span>Exchange #{i + 1}</span>
                {expandedRaw === i ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />}
              </button>
              {expandedRaw === i && (
                <CardContent className="p-3 pt-0 space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1">Request</Label>
                    <pre className="rounded-lg border border-border bg-muted p-3 text-xs text-muted-foreground overflow-x-auto max-h-[300px] overflow-y-auto">
                      {JSON.stringify(exchange.request, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1">Response</Label>
                    <pre className="rounded-lg border border-border bg-muted p-3 text-xs text-muted-foreground overflow-x-auto max-h-[300px] overflow-y-auto whitespace-pre-wrap">
                      {exchange.response}
                    </pre>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* AI Elements Banner */}
      <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
        <span>KeyHub API is compatible with</span>
        <a
          href="https://vercel.com/changelog/introducing-ai-elements"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          Vercel AI Elements
          <ExternalLink className="h-3 w-3" />
        </a>
        <span>—</span>
        <code className="rounded bg-background px-1.5 py-0.5 font-mono text-primary">npx ai-elements@latest</code>
      </div>

      {/* Save Session Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Session</DialogTitle>
            <DialogDescription>
              Save the current conversation so you can load it later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="session-name">Session Name</Label>
              <Input
                id="session-name"
                placeholder="e.g. API testing session"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSaveSession()
                  }
                }}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setSaveDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveSession} disabled={!sessionName.trim()}>
                Save Session
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sessions List Dialog */}
      <Dialog open={sessionsDialogOpen} onOpenChange={setSessionsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Saved Sessions</DialogTitle>
            <DialogDescription>
              Load a previous conversation or delete saved sessions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No saved sessions yet.</p>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
                >
                  <button
                    type="button"
                    className="flex-1 text-left"
                    onClick={() => handleLoadSession(session)}
                  >
                    <div className="text-sm font-medium text-foreground/80">{session.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">{session.model}</span>
                      <span className="text-xs text-muted-foreground">-</span>
                      <span className="text-xs text-muted-foreground">{session.messages.length} messages</span>
                      <span className="text-xs text-muted-foreground">-</span>
                      <span className="text-xs text-muted-foreground">{new Date(session.savedAt).toLocaleDateString()}</span>
                    </div>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteSessionId(session.id)}
                    className="text-muted-foreground hover:text-red-400 shrink-0 ml-2"
                    aria-label={`Delete session ${session.name}`}
                  >
                    <DeleteIcon size={16} />
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Session Confirmation */}
      <AlertDialog open={!!deleteSessionId} onOpenChange={(open) => { if (!open) setDeleteSessionId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete session?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The saved conversation will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSession} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
