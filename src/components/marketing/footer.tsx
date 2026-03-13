import Link from "next/link"
import { ZapIcon } from "@/components/ui/zap"

export function MarketingFooter() {
  return (
    <footer className="py-12">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="flex flex-col items-center gap-6 md:flex-row md:justify-between">
          <Link href="/" className="flex items-center gap-2 font-medium text-white">
            <div className="flex size-6 items-center justify-center rounded-md bg-white text-black">
              <ZapIcon size={16} />
            </div>
            KeyHub
          </Link>
          <nav className="flex items-center gap-6">
            <Link
              href="/login"
              className="text-sm text-white/40 hover:text-white/70 transition-colors"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="text-sm text-white/40 hover:text-white/70 transition-colors"
            >
              Register
            </Link>
            <Link
              href="/docs"
              className="text-sm text-white/40 hover:text-white/70 transition-colors"
            >
              Documentation
            </Link>
          </nav>
        </div>
        <div className="mt-8 flex flex-col items-center gap-2 border-t border-white/[0.08] pt-8 md:flex-row md:justify-between w-full">
          <p className="text-sm text-white/40">
            Powered by{" "}
            <a
              href="https://www.amaplabs.tech/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-white/70 hover:text-lime-400 transition-colors"
            >
              AMAP Labs
            </a>
          </p>
          <p className="text-sm text-white/40">
            &copy; 2026 KeyHub. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
