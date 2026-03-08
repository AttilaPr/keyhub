"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Building } from "lucide-react"
import { SearchIcon } from "@/components/ui/search"
import { UserIcon } from "@/components/ui/user"
import { KeyIcon } from "@/components/ui/key"
import { LoaderPinwheelIcon } from "@/components/ui/loader-pinwheel"

const pageTitles: Record<string, string> = {
  "/admin": "Admin Dashboard",
  "/admin/users": "User Management",
  "/admin/keys": "Key Management",
  "/admin/logs": "Global Logs",
  "/admin/system": "System Configuration",
  "/admin/settings": "Admin Settings",
  "/admin/orgs": "Organizations",
  "/admin/audit": "Audit Trail",
  "/admin/flags": "Feature Flags",
  "/admin/announcements": "Announcements",
}

interface SearchResults {
  users: Array<{ id: string; email: string; name: string | null; role: string; suspended: boolean }>
  organizations: Array<{ id: string; name: string; slug: string; suspended: boolean }>
  keys: Array<{ id: string; label: string; keyPrefix: string; isActive: boolean; ownerEmail: string }>
}

export function AdminHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const title = pageTitles[pathname] || "Admin"

  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResults | null>(null)
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults(null)
      setOpen(false)
      return
    }
    setSearching(true)
    try {
      const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json()
        setResults(data)
        setOpen(true)
      }
    } catch {
      // silent
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, search])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  function navigate(path: string) {
    setOpen(false)
    setQuery("")
    setResults(null)
    router.push(path)
  }

  const hasResults = results && (results.users.length > 0 || results.organizations.length > 0 || results.keys.length > 0)

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 h-4 data-vertical:self-auto"
        />
        <h1 className="text-base font-medium">{title}</h1>
        <Badge className="ml-2 bg-red-500/10 text-red-400 text-[10px]">SUPER ADMIN</Badge>

        {/* Global search */}
        <div className="relative ml-auto" ref={dropdownRef}>
          <div className="relative">
            <SearchIcon size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            {searching && (
              <LoaderPinwheelIcon size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            )}
            <Input
              ref={inputRef}
              placeholder="Search users, orgs, keys..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => { if (results) setOpen(true) }}
              className="w-64 pl-8 h-8 text-sm"
            />
          </div>

          {/* Dropdown results */}
          {open && results && (
            <div className="absolute right-0 top-full mt-1 w-80 rounded-md border border-border bg-background shadow-xl z-50 max-h-80 overflow-y-auto">
              {!hasResults ? (
                <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                  No results found
                </div>
              ) : (
                <div className="py-1">
                  {results.users.length > 0 && (
                    <div>
                      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Users
                      </div>
                      {results.users.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => navigate(`/admin/users/${u.id}`)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50"
                        >
                          <UserIcon size={14} className="text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="truncate text-foreground/80">{u.name || u.email}</p>
                            <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                          </div>
                          {u.suspended && (
                            <Badge className="ml-auto shrink-0 bg-red-500/10 text-red-400 text-[10px]">Suspended</Badge>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {results.organizations.length > 0 && (
                    <div>
                      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Organizations
                      </div>
                      {results.organizations.map((o) => (
                        <button
                          key={o.id}
                          onClick={() => navigate(`/admin/orgs/${o.id}`)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50"
                        >
                          <Building className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="truncate text-foreground/80">{o.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{o.slug}</p>
                          </div>
                          {o.suspended && (
                            <Badge className="ml-auto shrink-0 bg-red-500/10 text-red-400 text-[10px]">Suspended</Badge>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {results.keys.length > 0 && (
                    <div>
                      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Platform Keys
                      </div>
                      {results.keys.map((k) => (
                        <button
                          key={k.id}
                          onClick={() => navigate(`/admin/keys`)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50"
                        >
                          <KeyIcon size={14} className="text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="truncate text-foreground/80">{k.label}</p>
                            <p className="truncate text-xs text-muted-foreground">{k.keyPrefix}... ({k.ownerEmail})</p>
                          </div>
                          {!k.isActive && (
                            <Badge className="ml-auto shrink-0 bg-zinc-500/10 text-muted-foreground text-[10px]">Inactive</Badge>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
