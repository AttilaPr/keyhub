"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

const SEGMENT_LABELS: Record<string, string> = {
  admin: "Admin",
  users: "Users",
  orgs: "Organizations",
  keys: "Keys",
  logs: "Logs",
  audit: "Audit Trail",
  flags: "Feature Flags",
  announcements: "Announcements",
  system: "System",
  settings: "Settings",
}

export function AdminBreadcrumb() {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)

  // Don't show breadcrumb if we're on the admin root
  if (segments.length <= 1) return null

  const items: Array<{ label: string; href: string }> = []
  let currentPath = ""

  for (const segment of segments) {
    currentPath += `/${segment}`
    const label = SEGMENT_LABELS[segment] || decodeURIComponent(segment)
    items.push({ label, href: currentPath })
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <React.Fragment key={item.href}>
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink render={<Link href={item.href} />}>
                    {item.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </React.Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
