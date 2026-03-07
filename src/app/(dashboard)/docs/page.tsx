'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Copy, Check } from 'lucide-react'

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

const models = [
  { provider: 'OpenAI', models: ['openai/gpt-4o', 'openai/gpt-4o-mini', 'openai/gpt-4-turbo', 'openai/o1', 'openai/o1-mini'] },
  { provider: 'Anthropic', models: ['anthropic/claude-3-5-sonnet-20241022', 'anthropic/claude-3-5-haiku-20241022', 'anthropic/claude-3-opus-20240229'] },
  { provider: 'Google', models: ['google/gemini-1.5-pro', 'google/gemini-1.5-flash', 'google/gemini-2.0-flash'] },
  { provider: 'Mistral', models: ['mistral/mistral-large-latest', 'mistral/mistral-small-latest', 'mistral/codestral-latest'] },
]

export default function DocsPage() {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  function copyCode(code: string, index: number) {
    navigator.clipboard.writeText(code)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">API Documentation</h1>
        <p className="text-zinc-400">How to connect your apps to KeyHub</p>
      </div>

      {/* Quick Start */}
      <Card>
        <CardHeader>
          <CardTitle className="text-zinc-100">Quick Start</CardTitle>
          <CardDescription>
            KeyHub is OpenAI-compatible. Use any OpenAI SDK by changing the base URL and API key.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-zinc-300">
          <p><strong className="text-zinc-100">1.</strong> Add your provider API keys in <a href="/provider-keys" className="text-blue-500 hover:underline">Provider Keys</a></p>
          <p><strong className="text-zinc-100">2.</strong> Create a platform key in <a href="/platform-keys" className="text-blue-500 hover:underline">Platform Keys</a></p>
          <p><strong className="text-zinc-100">3.</strong> Use the platform key as your API key with the base URL below</p>
          <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs text-zinc-400 mb-1">Base URL</p>
            <code className="text-blue-400">{BASE_URL}/api/v1</code>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs text-zinc-400 mb-1">Model Format</p>
            <code className="text-blue-400">provider/model-name</code>
            <p className="text-xs text-zinc-500 mt-1">e.g. openai/gpt-4o, anthropic/claude-3-5-sonnet-20241022</p>
          </div>
        </CardContent>
      </Card>

      {/* Code Examples */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Code Examples</h2>
        {codeExamples.map((example, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm text-zinc-100">{example.label}</CardTitle>
                <Badge variant="outline">{example.lang}</Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyCode(example.code, i)}
                className="text-zinc-400"
              >
                {copiedIndex === i ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </CardHeader>
            <CardContent>
              <pre className="rounded-lg bg-zinc-900 border border-zinc-800 p-4 text-xs text-zinc-300 overflow-x-auto">
                <code>{example.code}</code>
              </pre>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Available Models */}
      <Card>
        <CardHeader>
          <CardTitle className="text-zinc-100">Available Models</CardTitle>
          <CardDescription>
            Models are available based on which provider keys you have added.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {models.map((group) => (
              <div key={group.provider}>
                <h3 className="text-sm font-medium text-zinc-300 mb-2">{group.provider}</h3>
                <div className="flex flex-wrap gap-2">
                  {group.models.map((model) => (
                    <code
                      key={model}
                      className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
                    >
                      {model}
                    </code>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Endpoints */}
      <Card>
        <CardHeader>
          <CardTitle className="text-zinc-100">API Endpoints</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <div className="flex items-start gap-3">
              <Badge>POST</Badge>
              <div>
                <code className="text-zinc-100">/api/v1/chat/completions</code>
                <p className="text-zinc-400 mt-1">OpenAI-compatible chat completions endpoint. Supports streaming.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="success">GET</Badge>
              <div>
                <code className="text-zinc-100">/api/v1/models</code>
                <p className="text-zinc-400 mt-1">List available models based on your provider keys.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
