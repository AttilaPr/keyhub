"use client"

import * as React from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { apiFetch } from "@/lib/fetch"
import { useOrgs } from "@/contexts/orgs-context"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LayoutPanelTopIcon } from "@/components/ui/layout-panel-top"
import { KeyIcon } from "@/components/ui/key"
import { ShieldCheckIcon } from "@/components/ui/shield-check"
import { ScanTextIcon } from "@/components/ui/scan-text"
import { ChartColumnIncreasingIcon } from "@/components/ui/chart-column-increasing"
import { BookTextIcon } from "@/components/ui/book-text"
import { MessageSquareIcon } from "@/components/ui/message-square"
import { UsersIcon } from "@/components/ui/users"
import { ZapIcon } from "@/components/ui/zap"
import { FileTextIcon } from "@/components/ui/file-text"
import { WebhookIcon } from "@/components/ui/webhook"
import { ClipboardCheckIcon } from "@/components/ui/clipboard-check"
import { ActivityIcon } from "@/components/ui/activity"
import { ChevronsUpDownIcon } from "@/components/ui/chevrons-up-down"
import { CheckIcon } from "@/components/ui/check"
import { PlusIcon } from "@/components/ui/plus"

const navMain = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: <LayoutPanelTopIcon size={16} className="shrink-0" />,
  },
  {
    title: "Provider Keys",
    url: "/provider-keys",
    icon: <KeyIcon size={16} className="shrink-0" />,
  },
  {
    title: "Platform Keys",
    url: "/platform-keys",
    icon: <ShieldCheckIcon size={16} className="shrink-0" />,
  },
  {
    title: "Logs",
    url: "/logs",
    icon: <ScanTextIcon size={16} className="shrink-0" />,
  },
  {
    title: "Usage",
    url: "/usage",
    icon: <ChartColumnIncreasingIcon size={16} className="shrink-0" />,
  },
  {
    title: "Playground",
    url: "/playground",
    icon: <MessageSquareIcon size={16} className="shrink-0" />,
  },
  {
    title: "Status",
    url: "/status",
    icon: <ActivityIcon size={16} className="shrink-0" />,
  },
  {
    title: "Organizations",
    url: "/settings/organizations",
    icon: <UsersIcon size={16} className="shrink-0" />,
  },
]

const navSecondary = [
  {
    title: "Templates",
    url: "/settings/templates",
    icon: <FileTextIcon size={16} className="shrink-0" />,
  },
  {
    title: "Webhooks",
    url: "/settings/webhooks",
    icon: <WebhookIcon size={16} className="shrink-0" />,
  },
  {
    title: "Audit Log",
    url: "/settings/audit-log",
    icon: <ClipboardCheckIcon size={16} className="shrink-0" />,
  },
  {
    title: "Docs",
    url: "/docs",
    icon: <BookTextIcon size={16} className="shrink-0" />,
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: session, update: updateSession } = useSession()
  const { orgs } = useOrgs()
  const [activeOrgId, setActiveOrgId] = React.useState<string>(
    session?.activeOrgId || "personal"
  )

  const user = {
    name: session?.user?.name || "User",
    email: session?.user?.email || "",
    avatar: "",
  }

  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN"

  // Sync with session on mount
  React.useEffect(() => {
    if (session?.activeOrgId) {
      setActiveOrgId(session.activeOrgId)
    }
  }, [session?.activeOrgId])

  async function handleOrgSwitch(value: string | null) {
    const orgId = value || "personal"
    setActiveOrgId(orgId)
    try {
      const res = await apiFetch("/api/orgs/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: orgId === "personal" ? null : orgId }),
      })
      if (res.ok) {
        const data = await res.json()
        await updateSession({ activeOrgId: data.activeOrgId || null })
      }
    } catch {
      // Silent fail — keep local state
    }
  }

  const secondaryItems = isSuperAdmin
    ? [
        ...navSecondary,
        {
          title: "Admin Panel",
          url: "/admin",
          icon: <ShieldCheckIcon size={16} className="shrink-0" />,
        },
      ]
    : navSecondary

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    className="data-[slot=sidebar-menu-button]:!p-1.5"
                  />
                }
              >
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <ZapIcon size={16} />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">
                    {activeOrgId === "personal"
                      ? user.name
                      : orgs.find((o) => o.id === activeOrgId)?.name || user.name}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {activeOrgId === "personal" ? "Personal" : "Organization"}
                  </span>
                </div>
                <ChevronsUpDownIcon size={16} className="ml-auto" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="min-w-56"
                side="bottom"
                align="start"
                sideOffset={4}
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Teams
                  </DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => handleOrgSwitch("personal")}>
                    <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                      <ZapIcon size={14} />
                    </div>
                    <span className="ml-2">Personal</span>
                    {activeOrgId === "personal" && (
                      <CheckIcon size={16} className="ml-auto" />
                    )}
                  </DropdownMenuItem>
                  {orgs.map((org) => (
                    <DropdownMenuItem
                      key={org.id}
                      onClick={() => handleOrgSwitch(org.id)}
                    >
                      <div className="flex size-6 items-center justify-center rounded-md bg-muted text-muted-foreground text-xs font-medium">
                        {org.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="ml-2">{org.name}</span>
                      {activeOrgId === org.id && (
                        <CheckIcon size={16} className="ml-auto" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  render={<Link href="/organizations" />}
                >
                  <PlusIcon size={16} />
                  <span>Create Organization</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        <NavSecondary items={secondaryItems} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
