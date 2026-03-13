"use client"

import Link from "next/link"
import { useSession } from "next-auth/react"
import { ZapIcon } from "@/components/ui/zap"

function PillButton({
  children,
  href,
  variant = "dark",
}: {
  children: React.ReactNode
  href: string
  variant?: "dark" | "light"
}) {
  const isDark = variant === "dark"
  return (
    <Link href={href} className="relative rounded-full p-[0.6px] group cursor-pointer">
      {/* Outer border */}
      <div className="absolute inset-0 rounded-full border border-white/60" />
      {/* Glow streak on top */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px] bg-gradient-to-r from-transparent via-white/80 to-transparent animate-glow-pulse" />
      {/* Inner pill */}
      <div
        className={`relative rounded-full px-[29px] py-[11px] text-[14px] font-medium transition-all duration-300 ${
          isDark
            ? "bg-black text-white group-hover:bg-white/10"
            : "bg-white text-black group-hover:bg-white/90"
        }`}
      >
        {children}
      </div>
    </Link>
  )
}

export function MarketingNav() {
  const { data: session } = useSession()

  return (
    <header className="absolute top-0 left-0 right-0 z-50 animate-fade-in">
      <nav
        aria-label="Main navigation"
        className="flex items-center justify-between px-6 md:px-[120px] py-[20px]"
      >
        {/* Left side: Logo + Nav links */}
        <div className="flex items-center gap-[30px]">
          <Link href="/" className="flex items-center gap-2 text-white">
            <div className="flex size-6 items-center justify-center rounded-md bg-white text-black">
              <ZapIcon size={16} />
            </div>
            <span className="text-[18px] font-semibold tracking-tight">
              KeyHub
            </span>
          </Link>
        </div>

        {/* Right side: CTA buttons */}
        <div className="flex items-center gap-3">
          {session ? (
            <PillButton href="/dashboard" variant="dark">
              Dashboard
            </PillButton>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden md:inline-flex text-white text-[14px] font-medium hover:text-white/80 transition-colors cursor-pointer px-2"
              >
                Log in
              </Link>
              <PillButton href="/register" variant="dark">
                Sign Up
              </PillButton>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}
