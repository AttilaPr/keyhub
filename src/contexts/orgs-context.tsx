"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"

export interface UserOrg {
  id: string
  name: string
  slug: string
  role: string
}

interface OrgsContextValue {
  orgs: UserOrg[]
  refreshOrgs: () => void
}

const OrgsContext = createContext<OrgsContextValue>({
  orgs: [],
  refreshOrgs: () => {},
})

export function OrgsProvider({ children }: { children: React.ReactNode }) {
  const [orgs, setOrgs] = useState<UserOrg[]>([])

  const refreshOrgs = useCallback(async () => {
    try {
      const res = await fetch("/api/orgs")
      const data = res.ok ? await res.json() : []
      setOrgs(Array.isArray(data) ? data : [])
    } catch {
      setOrgs([])
    }
  }, [])

  useEffect(() => {
    refreshOrgs()
  }, [refreshOrgs])

  return (
    <OrgsContext.Provider value={{ orgs, refreshOrgs }}>
      {children}
    </OrgsContext.Provider>
  )
}

export function useOrgs() {
  return useContext(OrgsContext)
}
