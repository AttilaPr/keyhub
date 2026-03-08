"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

interface AnimatedIconHandle {
  startAnimation: () => void
  stopAnimation: () => void
}

function NavItem({
  item,
  isActive,
}: {
  item: { title: string; url: string; icon?: React.ReactNode }
  isActive: boolean
}) {
  const iconRef = React.useRef<AnimatedIconHandle | null>(null)

  const iconWithRef = React.isValidElement(item.icon)
    ? React.cloneElement(item.icon as React.ReactElement<any>, { ref: iconRef })
    : item.icon

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip={item.title}
        isActive={isActive}
        render={<Link href={item.url} />}
        onMouseEnter={() => iconRef.current?.startAnimation?.()}
        onMouseLeave={() => iconRef.current?.stopAnimation?.()}
      >
        {iconWithRef}
        <span>{item.title}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: React.ReactNode
  }[]
}) {
  const pathname = usePathname()

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          {items.map((item) => (
            <NavItem
              key={item.title}
              item={item}
              isActive={
                pathname === item.url || pathname.startsWith(item.url + "/")
              }
            />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
