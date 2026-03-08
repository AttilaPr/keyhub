"use client"

import { SignupForm } from "@/components/signup-form"
import { ZapIcon } from "@/components/ui/zap"

export default function RegisterPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="/" className="flex items-center gap-2 font-medium">
            <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ZapIcon size={16} />
            </div>
            KeyHub
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <SignupForm />
          </div>
        </div>
      </div>
      <div className="relative hidden bg-muted lg:block">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-muted-foreground">
            <ZapIcon size={64} />
            <p className="text-lg font-medium">AI API Gateway</p>
            <p className="max-w-xs text-center text-sm">
              Manage provider keys, generate virtual API keys, and track usage across AI providers.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
