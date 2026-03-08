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
  item: { title: string; url: string; icon: React.ReactNode }
  isActive: boolean
}) {
  const iconRef = React.useRef<AnimatedIconHandle | null>(null)

  const iconWithRef = React.isValidElement(item.icon)
    ? React.cloneElement(item.icon as React.ReactElement<any>, { ref: iconRef })
    : item.icon

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
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

export function NavSecondary({
  items,
  ...props
}: {
  items: {
    title: string
    url: string
    icon: React.ReactNode
  }[]
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const pathname = usePathname()

  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <NavItem
              key={item.title}
              item={item}
              isActive={
                pathname === item.url ||
                (item.url !== "/" && pathname.startsWith(item.url + "/"))
              }
            />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
