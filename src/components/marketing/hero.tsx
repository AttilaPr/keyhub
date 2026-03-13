"use client"

import { useMemo } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { MarketingNav } from "@/components/marketing/nav"

const VIDEO_URL = "/assets/hero-video.mp4"

function buildCodeExamples(host: string) {
  return [
    {
      id: "curl",
      label: "cURL",
      code: `curl ${host}/api/v1/chat/completions \\
  -H "Authorization: Bearer ak-user-YOUR_PLATFORM_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "keyhub/free",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`,
    },
    {
      id: "python",
      label: "Python",
      code: `from openai import OpenAI

client = OpenAI(
    base_url="${host}/api/v1",
    api_key="ak-user-YOUR_PLATFORM_KEY",
)

response = client.chat.completions.create(
    model="keyhub/free",
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
  apiKey: "ak-user-YOUR_PLATFORM_KEY",
});

const response = await client.chat.completions.create({
  model: "keyhub/free",
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
  config := openai.DefaultConfig("ak-user-YOUR_PLATFORM_KEY")
  config.BaseURL = "${host}/api/v1"
  client := openai.NewClientWithConfig(config)

  resp, _ := client.CreateChatCompletion(
    context.Background(),
    openai.ChatCompletionRequest{
      Model: "keyhub/free",
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
  access_token: "ak-user-YOUR_PLATFORM_KEY",
  uri_base: "${host}/api/v1",
)

response = client.chat(
  parameters: {
    model: "keyhub/free",
    messages: [{ role: "user", content: "Hello!" }],
  },
)
puts response.dig("choices", 0, "message", "content")`,
    },
  ]
}

function HeroPillButton({
  children,
  href,
}: {
  children: React.ReactNode
  href: string
}) {
  return (
    <Link href={href} className="relative rounded-full p-[0.6px] group cursor-pointer inline-block">
      {/* Outer border */}
      <div className="absolute inset-0 rounded-full border border-white/60" />
      {/* Glow streak on top */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px] bg-gradient-to-r from-transparent via-white/80 to-transparent animate-glow-pulse" />
      {/* Inner pill — white bg, black text */}
      <div className="relative rounded-full px-[29px] py-[11px] text-[14px] font-medium bg-white text-black transition-all duration-300 group-hover:bg-white/90">
        {children}
      </div>
    </Link>
  )
}

export function HeroSection() {
  const codeExamples = useMemo(
    () =>
      buildCodeExamples(
        typeof window !== "undefined"
          ? window.location.origin
          : "https://your-keyhub.com"
      ),
    []
  )

  return (
    <section className="relative min-h-screen bg-black overflow-hidden">
      {/* Video Background */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      >
        <source src={VIDEO_URL} type="video/mp4" />
      </video>

      {/* Black overlay — 50% opacity */}
      <div className="absolute inset-0 bg-black/50" />

      {/* All content on top of video */}
      <div className="relative z-10">
        {/* Navbar */}
        <MarketingNav />

        {/* Hero Content */}
        <div className="flex flex-col items-center text-center pt-[200px] md:pt-[280px] pb-[102px] px-6 gap-[40px]">
          {/* Heading with gradient text */}
          <h1 className="animate-fade-in-up delay-100 max-w-[613px] text-[36px] md:text-[56px] font-medium leading-[1.28] tracking-tight hero-gradient-text">
            One API. Every AI Provider.
          </h1>

          {/* Subtitle */}
          <p className="animate-fade-in-up delay-300 max-w-[680px] text-[15px] font-normal text-white/70 leading-relaxed -mt-4">
            Route requests across OpenAI, Anthropic, Google, and Mistral through a
            single, unified endpoint. Track costs, manage keys, and monitor usage
            in real time.
          </p>

          {/* Free models indicator */}
          <div className="animate-fade-in-up delay-400 inline-flex items-center gap-2 rounded-[20px] bg-white/10 border border-white/20 px-4 py-2 -mt-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-lime-400" />
            </span>
            <span className="text-[13px] font-medium text-white/80">
              Free AI models included — start building with zero cost
            </span>
          </div>

          {/* CTA Buttons */}
          <div className="animate-fade-in-up delay-500 flex flex-wrap items-center justify-center gap-4">
            <HeroPillButton href="/register">Get Started</HeroPillButton>
            <Link
              href="/docs"
              className="text-[14px] font-medium text-white/70 hover:text-white transition-colors cursor-pointer px-4 py-[11px]"
            >
              View Documentation
            </Link>
          </div>

          {/* Code Examples Card */}
          <div className="animate-fade-in-up delay-600 w-full max-w-3xl mt-4">
            <Card className="overflow-hidden bg-black/60 backdrop-blur-xl p-0 ring-1 ring-white/10 border-0">
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
                        className="rounded-md px-2.5 py-1 text-xs text-zinc-500 data-active:bg-white/10 data-active:text-zinc-200 hover:text-zinc-300 cursor-pointer"
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
      </div>

      {/* Bottom gradient fade to page background */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent z-10 pointer-events-none" />
    </section>
  )
}
