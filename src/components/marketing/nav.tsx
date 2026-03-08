"use client"

import Link from "next/link"
import { useSession } from "next-auth/react"
import { ZapIcon } from "@/components/ui/zap"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"

export function MarketingNav() {
  const { data: session } = useSession()

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/60 border-b border-border/50">
      <nav aria-label="Main navigation" className="mx-auto max-w-6xl px-6 lg:px-8 flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2 font-medium">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ZapIcon size={16} />
          </div>
          KeyHub
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {session ? (
            <Button render={<Link href="/dashboard" />}>
              Dashboard
            </Button>
          ) : (
            <>
              <Button variant="ghost" render={<Link href="/login" />}>
                Log in
              </Button>
              <Button render={<Link href="/register" />}>
                Sign Up
              </Button>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}
