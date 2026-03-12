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
  /** Currently active org ID — null means "Personal" scope */
  activeOrgId: string | null
  /** Call after a successful org switch (session already updated) to trigger page re-fetches */
  setActiveOrgId: (id: string | null) => void
}

const OrgsContext = createContext<OrgsContextValue>({
  orgs: [],
  refreshOrgs: () => {},
  activeOrgId: null,
  setActiveOrgId: () => {},
})

export function OrgsProvider({ children }: { children: React.ReactNode }) {
  const [orgs, setOrgs] = useState<UserOrg[]>([])
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null)

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
    <OrgsContext.Provider value={{ orgs, refreshOrgs, activeOrgId, setActiveOrgId }}>
      {children}
    </OrgsContext.Provider>
  )
}

export function useOrgs() {
  return useContext(OrgsContext)
}
