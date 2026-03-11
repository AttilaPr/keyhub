"use client"

import { useMemo } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

function buildCodeExamples(host: string) {
  return [
    {
      id: "curl",
      label: "cURL",
      code: `curl ${host}/api/v1/chat/completions \\
  -H "Authorization: Bearer pk_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`,
    },
    {
      id: "python",
      label: "Python",
      code: `from openai import OpenAI

client = OpenAI(
    base_url="${host}/api/v1",
    api_key="pk_your_key",
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(response.choices[0].message.content)`,
    },
    {
      id: "node",
      label: "Node.js",
      code: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${host}/api/v1",
  apiKey: "pk_your_key",
});

const response = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello!" }],
});
console.log(response.choices[0].message.content);`,
    },
    {
      id: "go",
      label: "Go",
      code: `package main

import (
  "context"
  "fmt"
  openai "github.com/sashabaranov/go-openai"
)

func main() {
  config := openai.DefaultConfig("pk_your_key")
  config.BaseURL = "${host}/api/v1"
  client := openai.NewClientWithConfig(config)

  resp, _ := client.CreateChatCompletion(
    context.Background(),
    openai.ChatCompletionRequest{
      Model: "gpt-4o",
      Messages: []openai.ChatCompletionMessage{
        {Role: "user", Content: "Hello!"},
      },
    },
  )
  fmt.Println(resp.Choices[0].Message.Content)
}`,
    },
    {
      id: "ruby",
      label: "Ruby",
      code: `require "openai"

client = OpenAI::Client.new(
  access_token: "pk_your_key",
  uri_base: "${host}/api/v1",
)

response = client.chat(
  parameters: {
    model: "gpt-4o",
    messages: [{ role: "user", content: "Hello!" }],
  },
)
puts response.dig("choices", 0, "message", "content")`,
    },
  ]
}

export function HeroSection() {
  const codeExamples = useMemo(
    () => buildCodeExamples(typeof window !== "undefined" ? window.location.origin : "https://your-keyhub.com"),
    [],
  )

  return (
    <section className="py-24 md:py-32 lg:py-40">
      <div className="mx-auto max-w-6xl px-6 lg:px-8 text-center">
        <Badge variant="secondary">Self-hosted AI API Gateway</Badge>
        <h1 className="mt-6 text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
          One API. Every AI Provider.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Route requests across OpenAI, Anthropic, Google, and Mistral through a
          single, unified endpoint. Track costs, manage keys, and monitor usage
          in real time.
        </p>
        <div className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full border border-lime-400/20 bg-lime-400/5 px-4 py-2 text-sm text-lime-400">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-lime-400" />
          </span>
          Free AI models included — start building with zero cost
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Button size="lg" nativeButton={false} render={<Link href="/register" />}>
            Get Started
          </Button>
          <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/docs" />}>
            View Documentation
          </Button>
        </div>
        <div className="mx-auto mt-16 max-w-3xl">
          <Card className="overflow-hidden bg-zinc-950 p-0 ring-1 ring-white/10">
            <Tabs defaultValue="curl">
              <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2">
                <div className="size-3 rounded-full bg-red-500/80" />
                <div className="size-3 rounded-full bg-yellow-500/80" />
                <div className="size-3 rounded-full bg-green-500/80" />
                <TabsList className="ml-2 h-auto bg-transparent p-0 gap-0">
                  {codeExamples.map((ex) => (
                    <TabsTrigger
                      key={ex.id}
                      value={ex.id}
                      className="rounded-md px-2.5 py-1 text-xs text-zinc-500 data-active:bg-white/10 data-active:text-zinc-200 hover:text-zinc-300"
                    >
                      {ex.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              {codeExamples.map((ex) => (
                <TabsContent key={ex.id} value={ex.id}>
                  <pre className="overflow-x-auto p-6 text-left text-sm leading-relaxed">
                    <code className="font-mono text-zinc-300">{ex.code}</code>
                  </pre>
                </TabsContent>
              ))}
            </Tabs>
          </Card>
        </div>
      </div>
    </section>
  )
}
