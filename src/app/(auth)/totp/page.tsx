"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ZapIcon } from "@/components/ui/zap"
import { LoaderPinwheelIcon } from "@/components/ui/loader-pinwheel"
import { ShieldCheckIcon } from "@/components/ui/shield-check"
import { KeyIcon } from "@/components/ui/key"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { cn } from "@/lib/utils"
import { apiFetch } from "@/lib/fetch"

export default function TotpChallengePage() {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [useBackupCode, setUseBackupCode] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await apiFetch("/api/auth/totp/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          isBackupCode: useBackupCode,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        router.push("/dashboard")
        router.refresh()
      } else {
        setError(data.error || "Verification failed")
        setLoading(false)
      }
    } catch {
      setError("Network error. Please try again.")
      setLoading(false)
    }
  }

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
            <form
              className={cn("flex flex-col gap-6")}
              onSubmit={handleSubmit}
            >
              <FieldGroup>
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                    <ShieldCheckIcon size={24} className="text-primary" />
                  </div>
                  <h1 className="text-2xl font-bold">Two-Factor Authentication</h1>
                  <p className="text-sm text-balance text-muted-foreground">
                    {useBackupCode
                      ? "Enter one of your backup codes"
                      : "Enter the 6-digit code from your authenticator app"}
                  </p>
                </div>

                <Field>
                  <FieldLabel htmlFor="totp-code">
                    {useBackupCode ? "Backup Code" : "Authentication Code"}
                  </FieldLabel>
                  {useBackupCode ? (
                    <Input
                      id="totp-code"
                      type="text"
                      placeholder="abcd1234"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      required
                      autoComplete="one-time-code"
                      autoFocus
                    />
                  ) : (
                    <Input
                      id="totp-code"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      placeholder="000000"
                      value={code}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "")
                        if (val.length <= 6) setCode(val)
                      }}
                      required
                      autoComplete="one-time-code"
                      autoFocus
                    />
                  )}
                </Field>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Field>
                  <Button type="submit" disabled={loading}>
                    {loading && <LoaderPinwheelIcon size={16} className="mr-2" />}
                    Verify
                  </Button>
                </Field>

                <Field>
                  <FieldDescription className="text-center">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 cursor-pointer"
                      onClick={() => {
                        setUseBackupCode(!useBackupCode)
                        setCode("")
                        setError("")
                      }}
                    >
                      <KeyIcon size={14} />
                      {useBackupCode
                        ? "Use authenticator app instead"
                        : "Use a backup code"}
                    </button>
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </form>
          </div>
        </div>
      </div>
      <div className="relative hidden bg-muted lg:block">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-muted-foreground">
            <ShieldCheckIcon size={64} />
            <p className="text-lg font-medium">Identity Verification</p>
            <p className="max-w-xs text-center text-sm">
              Verify your identity with two-factor authentication to complete sign in.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
