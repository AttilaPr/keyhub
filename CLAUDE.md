# KeyHub - Development Guidelines

## UI Components

- **Use shadcn/ui components and blocks** from https://ui.shadcn.com/blocks
- Install new components via `npx shadcn@latest add <component-name>`
- Install blocks via `npx shadcn@latest add <block-name>` (e.g. `dashboard-01`, `login-02`, `signup-02`)
- Components live in `src/components/ui/` — do not manually create UI primitives, use shadcn instead
- Shared app components live in `src/components/` (e.g. `app-sidebar.tsx`, `login-form.tsx`)

## shadcn Configuration

- Config file: `components.json`
- Style: `base-nova`
- Icon library: `lucide`
- Import alias: `@/components/ui/`
- Tailwind CSS v4 with CSS variables

## Layout

- Dashboard uses shadcn `SidebarProvider` + `AppSidebar` + `SidebarInset` pattern
- Auth pages use shadcn split-panel layout (login-02 / signup-02 blocks)
- Always use `dark` mode (set on `<html>` element)

## Stack

- Next.js 15 (App Router), TypeScript, Tailwind CSS v4
- Prisma ORM + PostgreSQL 16
- NextAuth v5 (credentials provider, JWT sessions)
- Recharts for charts
- Node 20+ required (`.nvmrc`)

## Dev Commands

- `make dev` — start Postgres + dev server
- `npx prisma generate` — regenerate Prisma client
- `npx prisma migrate dev` — run migrations

## Code Quality Skills

- **Every frontend task** must use `/senior-frontend` and `/ui-ux-pro-max` skills for code inspection and design quality
- **Every backend task** must use `/senior-backend` skill for code inspection and API quality
- **Never use `window.confirm()` or `window.alert()`** — always use shadcn AlertDialog for destructive confirmations and Dialog for informational prompts
