import Link from "next/link"
import { ZapIcon } from "@/components/ui/zap"

export function MarketingFooter() {
  return (
    <footer className="border-t border-border/50 py-12">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="flex flex-col items-center gap-6 md:flex-row md:justify-between">
          <Link href="/" className="flex items-center gap-2 font-medium">
            <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ZapIcon size={16} />
            </div>
            KeyHub
          </Link>
          <nav className="flex items-center gap-6">
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Register
            </Link>
            <Link
              href="/docs"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Documentation
            </Link>
          </nav>
        </div>
        <div className="mt-8 flex flex-col items-center gap-2 border-t border-border/50 pt-8 md:flex-row md:justify-between w-full">
          <p className="text-sm text-muted-foreground">
            Powered by{" "}
            <a
              href="https://www.amaplabs.tech/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground hover:text-primary transition-colors"
            >
              AMAP Labs
            </a>
          </p>
          <p className="text-sm text-muted-foreground">
            &copy; 2026 KeyHub. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
