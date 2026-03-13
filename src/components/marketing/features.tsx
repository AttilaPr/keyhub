"use client"

import { useAnimatedIcon } from "@/hooks/use-animated-icon"
import { useScrollAnimation } from "@/hooks/use-scroll-animation"
import { WorkflowIcon } from "@/components/ui/workflow"
import { DollarSignIcon } from "@/components/ui/dollar-sign"
import { ShieldCheckIcon } from "@/components/ui/shield-check"
import { ChartColumnIncreasingIcon } from "@/components/ui/chart-column-increasing"
import { LayersIcon } from "@/components/ui/layers"
import { LockIcon } from "@/components/ui/lock"
import { SparklesIcon } from "@/components/ui/sparkles"

const features = [
  {
    key: "free",
    title: "Free AI Models",
    description:
      "Every account includes access to free AI models out of the box — no provider keys needed. Start building immediately at zero cost with 200K context, image understanding, and tool calling.",
  },
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
    key: "security",
    title: "Enterprise Security",
    description:
      "AES-256 encryption, two-factor authentication, IP allowlisting, and full audit logging.",
  },
] as const

const featureByKey = Object.fromEntries(features.map((f) => [f.key, f]))

function GlassCard({
  children,
  featured = false,
  ...handlers
}: {
  children: React.ReactNode
  featured?: boolean
} & Record<string, unknown>) {
  return (
    <div
      className={`rounded-xl p-6 backdrop-blur-sm transition-all duration-300 hover:bg-white/[0.08] ${
        featured
          ? "bg-lime-400/[0.06] border border-lime-400/15"
          : "bg-white/[0.04] border border-white/[0.08]"
      }`}
      {...handlers}
    >
      {children}
    </div>
  )
}

function FeatureFree() {
  const { iconRef, handlers } = useAnimatedIcon()
  const f = featureByKey.free
  return (
    <GlassCard featured {...handlers}>
      <div className="px-4">
        <SparklesIcon ref={iconRef} size={24} className="text-lime-400" />
        <h3 className="mt-4 text-base font-semibold text-white">{f.title}</h3>
        <p className="mt-2 text-sm text-white/50">{f.description}</p>
      </div>
    </GlassCard>
  )
}

function FeatureRouting() {
  const { iconRef, handlers } = useAnimatedIcon()
  const f = featureByKey.routing
  return (
    <GlassCard {...handlers}>
      <div className="px-4">
        <WorkflowIcon ref={iconRef} size={24} className="text-white/70" />
        <h3 className="mt-4 text-base font-semibold text-white">{f.title}</h3>
        <p className="mt-2 text-sm text-white/50">{f.description}</p>
      </div>
    </GlassCard>
  )
}

function FeatureCost() {
  const { iconRef, handlers } = useAnimatedIcon()
  const f = featureByKey.cost
  return (
    <GlassCard {...handlers}>
      <div className="px-4">
        <DollarSignIcon ref={iconRef} size={24} className="text-white/70" />
        <h3 className="mt-4 text-base font-semibold text-white">{f.title}</h3>
        <p className="mt-2 text-sm text-white/50">{f.description}</p>
      </div>
    </GlassCard>
  )
}

function FeatureKeys() {
  const { iconRef, handlers } = useAnimatedIcon()
  const f = featureByKey.keys
  return (
    <GlassCard {...handlers}>
      <div className="px-4">
        <ShieldCheckIcon ref={iconRef} size={24} className="text-white/70" />
        <h3 className="mt-4 text-base font-semibold text-white">{f.title}</h3>
        <p className="mt-2 text-sm text-white/50">{f.description}</p>
      </div>
    </GlassCard>
  )
}

function FeatureAnalytics() {
  const { iconRef, handlers } = useAnimatedIcon()
  const f = featureByKey.analytics
  return (
    <GlassCard {...handlers}>
      <div className="px-4">
        <ChartColumnIncreasingIcon ref={iconRef} size={24} className="text-white/70" />
        <h3 className="mt-4 text-base font-semibold text-white">{f.title}</h3>
        <p className="mt-2 text-sm text-white/50">{f.description}</p>
      </div>
    </GlassCard>
  )
}

function FeatureLoadBalancing() {
  const { iconRef, handlers } = useAnimatedIcon()
  const f = featureByKey.loadbalancing
  return (
    <GlassCard {...handlers}>
      <div className="px-4">
        <LayersIcon ref={iconRef} size={24} className="text-white/70" />
        <h3 className="mt-4 text-base font-semibold text-white">{f.title}</h3>
        <p className="mt-2 text-sm text-white/50">{f.description}</p>
      </div>
    </GlassCard>
  )
}

function FeatureSecurity() {
  const { iconRef, handlers } = useAnimatedIcon()
  const f = featureByKey.security
  return (
    <GlassCard {...handlers}>
      <div className="px-4">
        <LockIcon ref={iconRef} size={24} className="text-white/70" />
        <h3 className="mt-4 text-base font-semibold text-white">{f.title}</h3>
        <p className="mt-2 text-sm text-white/50">{f.description}</p>
      </div>
    </GlassCard>
  )
}

export function FeaturesSection() {
  const sectionRef = useScrollAnimation()

  return (
    <section id="features" className="relative py-32 md:py-40">
      {/* Subtle radial glow behind grid */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-lime-400/[0.03] rounded-full blur-3xl pointer-events-none" />

      <div ref={sectionRef} className="relative mx-auto max-w-6xl px-6 lg:px-8">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl hero-gradient-text">
          Everything you need to manage AI APIs
        </h2>
        <p className="mt-4 text-lg text-white/50 max-w-2xl">
          A complete toolkit for routing, monitoring, and controlling your AI
          provider integrations.
        </p>
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <FeatureFree />
          <FeatureRouting />
          <FeatureCost />
          <FeatureKeys />
          <FeatureAnalytics />
          <FeatureLoadBalancing />
          <FeatureSecurity />
        </div>
      </div>
    </section>
  )
}
