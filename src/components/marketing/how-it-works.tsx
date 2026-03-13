"use client"

import { useScrollAnimation } from "@/hooks/use-scroll-animation"

const steps = [
  {
    number: 1,
    title: "Add Provider Keys",
    description:
      "Connect your API keys from OpenAI, Anthropic, Google, Mistral, or any OpenAI-compatible provider.",
  },
  {
    number: 2,
    title: "Create Platform Keys",
    description:
      "Generate virtual API keys with custom rate limits, budgets, model scoping, and expiration dates.",
  },
  {
    number: 3,
    title: "Start Making Requests",
    description:
      "Point your application to KeyHub's endpoint and let it handle routing, logging, and billing automatically.",
  },
]

export function HowItWorksSection() {
  const sectionRef = useScrollAnimation()

  return (
    <section id="how-it-works" className="py-32 md:py-40">
      <div ref={sectionRef} className="mx-auto max-w-6xl px-6 lg:px-8">
        <h2 className="text-center text-3xl font-bold tracking-tight md:text-4xl hero-gradient-text">
          Get started in minutes
        </h2>
        <p className="mx-auto mt-4 text-center text-lg text-white/50 max-w-2xl">
          Three simple steps to unify your AI stack.
        </p>
        <ol className="mt-16 grid gap-8 md:grid-cols-3 list-none p-0 m-0 relative">
          {/* Connecting line on desktop */}
          <div className="hidden md:block absolute top-5 left-[calc(16.67%+20px)] right-[calc(16.67%+20px)] h-[1px] border-t border-dashed border-white/15" />

          {steps.map((step) => (
            <li key={step.number} className="relative">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 border border-white/20 text-white font-bold"
                aria-hidden="true"
              >
                {step.number}
              </div>
              <h3 className="mt-4 text-xl font-semibold text-white">{step.title}</h3>
              <p className="mt-2 text-white/50">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
