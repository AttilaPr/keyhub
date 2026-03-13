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
  return (
    <section id="how-it-works" className="py-24 md:py-32 border-t border-border/50">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <h2 className="text-center text-3xl font-bold tracking-tight md:text-4xl">
          Get started in minutes
        </h2>
        <p className="mx-auto mt-4 text-center text-lg text-muted-foreground max-w-2xl">
          Three simple steps to unify your AI stack.
        </p>
        <ol className="mt-16 grid gap-8 md:grid-cols-3 list-none p-0 m-0">
          {steps.map((step) => (
            <li key={step.number}>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold" aria-hidden="true">
                {step.number}
              </div>
              <h3 className="mt-4 text-xl font-semibold">{step.title}</h3>
              <p className="mt-2 text-muted-foreground">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
