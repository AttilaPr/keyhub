"use client"

import * as React from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"

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
import { Building, Flag, SlidersHorizontal, Megaphone, CreditCard } from "lucide-react"
import { LayoutPanelTopIcon } from "@/components/ui/layout-panel-top"
import { UsersIcon } from "@/components/ui/users"
import { KeyIcon } from "@/components/ui/key"
import { ScanTextIcon } from "@/components/ui/scan-text"
import { BadgeAlertIcon } from "@/components/ui/badge-alert"
import { SettingsIcon } from "@/components/ui/settings"
import { ArrowLeftIcon } from "@/components/ui/arrow-left"
import { ClipboardCheckIcon } from "@/components/ui/clipboard-check"
import { DollarSignIcon } from "@/components/ui/dollar-sign"

const navMain = [
  {
    title: "Admin Dashboard",
    url: "/admin",
    icon: <LayoutPanelTopIcon size={16} className="shrink-0" />,
  },
  {
    title: "Users",
    url: "/admin/users",
    icon: <UsersIcon size={16} className="shrink-0" />,
  },
  {
    title: "Organizations",
    url: "/admin/orgs",
    icon: <Building className="h-4 w-4 shrink-0" />,
  },
  {
    title: "Keys",
    url: "/admin/keys",
    icon: <KeyIcon size={16} className="shrink-0" />,
  },
  {
    title: "Logs",
    url: "/admin/logs",
    icon: <ScanTextIcon size={16} className="shrink-0" />,
  },
  {
    title: "Audit Trail",
    url: "/admin/audit",
    icon: <ClipboardCheckIcon size={16} className="shrink-0" />,
  },
  {
    title: "Feature Flags",
    url: "/admin/flags",
    icon: <Flag className="h-4 w-4 shrink-0" />,
  },
  {
    title: "Finance",
    url: "/admin/finance",
    icon: <DollarSignIcon size={16} className="shrink-0" />,
  },
  {
    title: "Plans",
    url: "/admin/plans",
    icon: <CreditCard className="h-4 w-4 shrink-0" />,
  },
  {
    title: "Announcements",
    url: "/admin/announcements",
    icon: <Megaphone className="h-4 w-4 shrink-0" />,
  },
  {
    title: "System",
    url: "/admin/system",
    icon: <SlidersHorizontal className="h-4 w-4 shrink-0" />,
  },
]

const navSecondary = [
  {
    title: "Admin Settings",
    url: "/admin/settings",
    icon: <SettingsIcon size={16} className="shrink-0" />,
  },
  {
    title: "Back to App",
    url: "/dashboard",
    icon: <ArrowLeftIcon size={16} className="shrink-0" />,
  },
]

export function AdminSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: session } = useSession()
  const user = {
    name: session?.user?.name || "Admin",
    email: session?.user?.email || "",
    avatar: "",
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link href="/admin" />}
            >
              <BadgeAlertIcon size={20} className="text-red-400" />
              <span className="text-base font-semibold">KeyHub Admin</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
