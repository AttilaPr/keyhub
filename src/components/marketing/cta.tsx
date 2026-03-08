import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export function CTASection() {
  return (
    <section className="py-24 md:py-32 border-t border-border/50">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <Card className="p-12 md:p-16 text-center bg-primary/5 border-primary/20">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Ready to unify your AI stack?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Deploy KeyHub in minutes and start managing all your AI providers
            through a single API gateway.
          </p>
          <div className="mt-8">
            <Button size="lg" render={<Link href="/register" />}>
              Create Free Account
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            No credit card required
          </p>
        </Card>
      </div>
    </section>
  )
}
