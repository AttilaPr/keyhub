"use client"

import Link from "next/link"
import { useScrollAnimation } from "@/hooks/use-scroll-animation"

function CTAPillButton({
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
      {/* Inner pill */}
      <div className="relative rounded-full px-8 py-3 text-[15px] font-medium bg-white text-black transition-all duration-300 group-hover:bg-white/90">
        {children}
      </div>
    </Link>
  )
}

export function CTASection() {
  const sectionRef = useScrollAnimation()

  return (
    <section className="py-32 md:py-40">
      <div ref={sectionRef} className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="relative rounded-2xl p-12 md:p-16 text-center bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] overflow-hidden">
          {/* Subtle lime radial glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-lime-400/[0.04] rounded-full blur-3xl pointer-events-none" />

          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl hero-gradient-text">
              Ready to unify your AI stack?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-white/50">
              Deploy KeyHub in minutes and start managing all your AI providers
              through a single API gateway.
            </p>
            <div className="mt-8">
              <CTAPillButton href="/register">Create Free Account</CTAPillButton>
            </div>
            <p className="mt-4 text-sm text-white/40">
              No credit card required
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
