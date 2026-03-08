"use client"

import { Card } from "@/components/ui/card"
import { useAnimatedIcon } from "@/hooks/use-animated-icon"
import { WorkflowIcon } from "@/components/ui/workflow"
import { DollarSignIcon } from "@/components/ui/dollar-sign"
import { ShieldCheckIcon } from "@/components/ui/shield-check"
import { ChartColumnIncreasingIcon } from "@/components/ui/chart-column-increasing"
import { LayersIcon } from "@/components/ui/layers"
import { LockIcon } from "@/components/ui/lock"
import { TerminalIcon } from "@/components/ui/terminal"

const features = [
  {
    key: "routing",
    title: "Multi-Provider Routing",
    description:
      "Route requests to OpenAI, Anthropic, Google, and Mistral through a single endpoint with automatic fallback.",
  },
  {
    key: "cost",
    title: "Cost Tracking",
    description:
      "Per-request cost calculation with budget limits, alerts, and month-end forecasting.",
  },
  {
    key: "keys",
    title: "API Key Management",
    description:
      "Create virtual API keys with rate limits, IP allowlists, model scoping, and expiration dates.",
  },
  {
    key: "analytics",
    title: "Real-time Analytics",
    description:
      "Live dashboards with request volume, latency tracking, and provider breakdown charts.",
  },
  {
    key: "loadbalancing",
    title: "Smart Load Balancing",
    description:
      "Automatic failover between providers with round-robin, least-latency, and weighted routing.",
  },
  {
    key: "mcp",
    title: "MCP Protocol",
    description:
      "Built-in MCP server lets AI assistants like Claude use your KeyHub gateway for chat, usage monitoring, and log analysis.",
  },
  {
    key: "security",
    title: "Enterprise Security",
    description:
      "AES-256 encryption, two-factor authentication, IP allowlisting, and full audit logging.",
  },
] as const

function FeatureRouting() {
  const { iconRef, handlers } = useAnimatedIcon()
  return (
    <Card className="p-6" {...handlers}>
      <div className="px-4">
        <WorkflowIcon ref={iconRef} size={24} />
        <h3 className="mt-4 text-base font-semibold">{features[0].title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{features[0].description}</p>
      </div>
    </Card>
  )
}

function FeatureCost() {
  const { iconRef, handlers } = useAnimatedIcon()
  return (
    <Card className="p-6" {...handlers}>
      <div className="px-4">
        <DollarSignIcon ref={iconRef} size={24} />
        <h3 className="mt-4 text-base font-semibold">{features[1].title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{features[1].description}</p>
      </div>
    </Card>
  )
}

function FeatureKeys() {
  const { iconRef, handlers } = useAnimatedIcon()
  return (
    <Card className="p-6" {...handlers}>
      <div className="px-4">
        <ShieldCheckIcon ref={iconRef} size={24} />
        <h3 className="mt-4 text-base font-semibold">{features[2].title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{features[2].description}</p>
      </div>
    </Card>
  )
}

function FeatureAnalytics() {
  const { iconRef, handlers } = useAnimatedIcon()
  return (
    <Card className="p-6" {...handlers}>
      <div className="px-4">
        <ChartColumnIncreasingIcon ref={iconRef} size={24} />
        <h3 className="mt-4 text-base font-semibold">{features[3].title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{features[3].description}</p>
      </div>
    </Card>
  )
}

function FeatureLoadBalancing() {
  const { iconRef, handlers } = useAnimatedIcon()
  return (
    <Card className="p-6" {...handlers}>
      <div className="px-4">
        <LayersIcon ref={iconRef} size={24} />
        <h3 className="mt-4 text-base font-semibold">{features[4].title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{features[4].description}</p>
      </div>
    </Card>
  )
}

function FeatureMCP() {
  const { iconRef, handlers } = useAnimatedIcon()
  return (
    <Card className="p-6" {...handlers}>
      <div className="px-4">
        <TerminalIcon ref={iconRef} size={24} />
        <h3 className="mt-4 text-base font-semibold">{features[5].title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{features[5].description}</p>
      </div>
    </Card>
  )
}

function FeatureSecurity() {
  const { iconRef, handlers } = useAnimatedIcon()
  return (
    <Card className="p-6" {...handlers}>
      <div className="px-4">
        <LockIcon ref={iconRef} size={24} />
        <h3 className="mt-4 text-base font-semibold">{features[6].title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{features[6].description}</p>
      </div>
    </Card>
  )
}

export function FeaturesSection() {
  return (
    <section className="py-24 md:py-32 border-t border-border/50">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
          Everything you need to manage AI APIs
        </h2>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
          A complete toolkit for routing, monitoring, and controlling your AI
          provider integrations.
        </p>
        <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          <FeatureRouting />
          <FeatureCost />
          <FeatureKeys />
          <FeatureAnalytics />
          <FeatureLoadBalancing />
          <FeatureMCP />
          <FeatureSecurity />
        </div>
      </div>
    </section>
  )
}
