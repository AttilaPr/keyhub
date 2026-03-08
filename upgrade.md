# KeyHub — Upgrade Roadmap

> Detailed implementation checklist for all planned features and improvements.
> Tasks are grouped by area and ordered by dependency where relevant.

---

## Legend

- `[ ]` Not started
- `[x]` Completed
- _(P0)_ — Critical / revenue-blocking
- _(P1)_ — High value, ship next
- _(P2)_ — Medium priority
- _(P3)_ — Nice to have
- _(SA)_ — Super Admin only — never exposed to regular users

---

## 1. 👥 Teams & Organizations _(P0)_

> Multi-user workspaces with shared keys and role-based access control.

### 1.1 Data Model

- [x] Create `Organization` table (`id`, `name`, `slug`, `createdAt`)
- [x] Create `OrganizationMember` table (`orgId`, `userId`, `role`: owner | admin | member, `joinedAt`)
- [x] Create `OrganizationInvite` table (`id`, `orgId`, `email`, `token`, `role`, `expiresAt`, `usedAt`)
- [x] Add `orgId` (nullable FK) to `ProviderKey`, `PlatformKey`, `RequestLog`
- [x] Write and run Prisma migration
- [ ] Seed script: migrate existing personal keys to `orgId = null` (personal context)

### 1.2 Organization Management API

- [x] `POST /api/orgs` — Create organization (auto-assign creator as owner)
- [x] `GET /api/orgs` — List organizations for current user
- [x] `PATCH /api/orgs/[id]` — Update org name/slug (owner/admin only)
- [x] `DELETE /api/orgs/[id]` — Delete org and cascade all data (owner only)
- [x] `GET /api/orgs/[id]/members` — List members with roles
- [x] `PATCH /api/orgs/[id]/members/[userId]` — Change member role (owner only)
- [x] `DELETE /api/orgs/[id]/members/[userId]` — Remove member (owner/admin; can't remove owner)

### 1.3 Invite System

- [x] `POST /api/orgs/[id]/invites` — Generate invite (sends email with token link)
- [x] `GET /api/invites/[token]` — Validate invite token (check expiry, not yet used)
- [x] `POST /api/invites/[token]/accept` — Accept invite (creates membership, marks invite used)
- [x] `DELETE /api/orgs/[id]/invites/[inviteId]` — Revoke pending invite (admin/owner)
- [x] Email template: invite email with CTA button and expiry notice
- [x] Invite expiry: 7 days default; expired invites return 410

### 1.4 Frontend — Org Switcher

- [x] Org context stored in session (active org ID)
- [x] Org switcher dropdown in sidebar/header (Personal + org list)
- [x] "Create organization" flow: name input → slug auto-generated → confirm
- [x] Organization settings page (`/settings/org/[id]`)
  - [x] Rename org
  - [x] Member list with role badges
  - [x] Role change dropdown per member (owner only)
  - [x] Remove member button with confirmation dialog
  - [x] Pending invites list with revoke button
  - [x] Invite by email form (email + role selector)
  - [x] Danger zone: delete organization (owner only, type-to-confirm)
- [ ] All key pages (Provider Keys, Platform Keys, Logs, Dashboard, Usage) scope to active org context

### 1.5 Permission Guards

- [x] Server-side org membership check on every org-scoped API route
- [x] `member` role: read keys, make completions, view logs
- [x] `admin` role: create/delete keys, invite members
- [x] `owner` role: all admin actions + delete org, change member roles
- [x] Return 403 with descriptive message on permission violation

---

## 2. 🔒 Key Scoping _(P1)_

> Restrict what a platform key is allowed to do.

### 2.1 Data Model

- [x] Add `allowedProviders` (string array) to `PlatformKey`
- [x] Add `allowedModels` (string array) to `PlatformKey` (empty = all)
- [x] Add `maxCostPerRequest` (Decimal, nullable) to `PlatformKey`

### 2.2 Proxy Enforcement

- [x] On `POST /api/v1/chat/completions`: extract provider from model string
- [x] Check `allowedProviders` — return 403 if provider not in list
- [x] Check `allowedModels` — return 403 if model not in list
- [x] After cost estimation (pre-flight): reject request if estimated cost > `maxCostPerRequest`
- [x] Include descriptive error: `"This key is not permitted to use provider: anthropic"`

### 2.3 Frontend — Edit Dialog

- [x] Add "Restrictions" section to platform key edit dialog
- [x] Multi-select checkboxes for allowed providers (OpenAI, Anthropic, Google, Mistral)
- [x] Combobox for allowed models (filtered by selected providers)
- [x] Numeric input for max cost per request (optional, with $ prefix)
- [x] Show active restrictions as badge chips on the key card

---

## 3. 💰 Budget Limits _(P0)_

> Prevent runaway spend at the key and account level.

### 3.1 Data Model

- [x] Add `monthlyBudgetUsd` (Decimal, nullable) to `User` and `Organization`
- [x] Add `budgetUsd` (Decimal, nullable) to `PlatformKey` (rolling period)
- [x] Add `budgetPeriod` (enum: `monthly` | `weekly` | `daily`, default `monthly`) to `PlatformKey`
- [x] Add `budgetAlertThreshold` (float, default 0.8) — alert at 80% of budget
- [x] Add `budgetHardCap` (boolean, default false) — hard block vs soft warn

### 3.2 Budget Check Logic

- [x] Create `lib/budget.ts` — `checkBudget(userId, orgId?, platformKeyId?)` utility
- [x] Query sum of costs for the current period from `RequestLog`
- [x] Return `{ used, limit, percent, exceeded, alerting }`
- [x] Integrate budget check into completions proxy (before forwarding to provider)
- [x] Hard cap: return HTTP 429 with body `{"error": "Budget limit reached", "reset": "<ISO date>"}`
- [x] Soft cap: allow request, queue background alert notification

### 3.3 Budget Dashboard UI

- [x] Budget progress bar on Dashboard — shows current period spend vs limit
- [x] Color: green → yellow (>75%) → red (>95%)
- [x] "Set Budget" button opens dialog (amount + period + hard/soft toggle)
- [x] Per-key budget indicator on Platform Keys page (small progress bar under key card)
- [x] Budget exceeded state: platform key card shows red warning banner

### 3.4 Budget Alerts

- [x] Background job (cron or after each request): check thresholds
- [x] Send email when spend crosses `budgetAlertThreshold`
- [x] Send email when budget is fully exhausted (hard or soft)
- [x] Email includes: current spend, limit, period reset date, link to usage page
- [x] Avoid duplicate alerts: track `lastBudgetAlertSentAt` on model

---

## 4. 🔄 Key Rotation Reminders _(P2)_

### 4.1 Data Model

- [x] Add `rotationReminderDays` (integer, nullable) to `ProviderKey`
- [x] Add `lastRotatedAt` (DateTime, nullable) to `ProviderKey` — updated on each upsert

### 4.2 Reminder Logic

- [x] Daily cron: find all provider keys where `lastRotatedAt < now - rotationReminderDays`
- [x] Send reminder email with key provider name and days since last rotation
- [ ] Snooze option in email (7d / 30d) via signed token link

### 4.3 Frontend

- [x] "Rotation reminder" toggle + day input on provider key card (e.g. "Remind me every 90 days")
- [x] Badge on provider key card: "Last rotated 45d ago" (yellow if >80% of interval, red if overdue)

---

## 5. 🚨 Anomaly Detection _(P1)_

> Alert on unusual activity — leaked keys, runaway loops, provider outages.

### 5.1 Detection Engine

- [x] Create `lib/anomaly.ts`
- [x] Compute rolling 7-day mean and standard deviation per metric (requests/hr, cost/hr, error rate)
- [x] Anomaly triggers:
  - [x] Request volume > mean + 3σ in any 1-hour window
  - [x] Cost spike > mean + 3σ in any 1-hour window
  - [x] Error rate > 50% over last 100 requests
  - [x] Single platform key accounts for >90% of requests in 1 hour
- [x] Persist anomaly events to `AnomalyEvent` table (`id`, `userId`, `type`, `severity`, `description`, `detectedAt`, `acknowledgedAt`)

### 5.2 Notifications

- [x] Email alert on anomaly detection with: metric, threshold, actual value, time, link to logs
- [x] Webhook dispatch (see Section 9) on anomaly event
- [x] In-app notification bell icon in header with unread count badge
- [x] Notification drawer: list of recent anomaly events with acknowledge button

### 5.3 Anomaly Settings

- [x] Settings page section: "Anomaly Detection"
- [x] Toggle anomaly detection on/off globally
- [x] Customize thresholds per metric (or use "Auto" based on σ)
- [x] Notification channel preference: email | webhook | both

---

## 6. 🔁 Reliability & Routing _(P1)_

### 6.1 Fallback Routing

- [x] Data model: `FallbackRule` table (`id`, `platformKeyId`, `primaryProvider`, `fallbackProvider`, `fallbackOnStatus`: int array e.g. `[429, 500, 503]`)
- [x] In completions proxy: catch provider error, check if fallback rule exists
- [x] Retry request with fallback provider's key
- [x] Log fallback event: `fallbackUsed: true`, `originalProvider`, `fallbackProvider` on `RequestLog`
- [x] UI: "Fallback routing" section in platform key edit dialog
  - [x] Add fallback rule: primary provider → fallback provider → trigger codes
  - [x] Multiple fallback rules per key (ordered priority list)

### 6.2 Retry Logic

- [x] Create `lib/retry.ts` — exponential backoff with jitter
- [x] Config: `maxRetries` (default 2), `baseDelayMs` (default 500), `maxDelayMs` (default 5000)
- [x] Retry on: 429, 500, 502, 503, 504 from provider
- [x] Do NOT retry on: 400, 401, 403 (non-transient)
- [x] Add `retryCount` field to `RequestLog`
- [x] Per-platform-key retry override in edit dialog

### 6.3 Load Balancing

- [x] Allow multiple provider keys for the same provider (remove unique constraint on `userId + provider`)
- [x] Add `weight` (integer, default 1) to `ProviderKey` for weighted round-robin
- [x] Routing strategies (per platform key): `round-robin` | `least-latency` | `random`
- [x] Track per-key latency EMA (exponential moving average) updated after each request
- [x] UI: weight slider on provider key card; routing strategy dropdown on platform key

### 6.4 Semantic Caching

- [ ] Install `pgvector` extension; add `embedding` vector column to a new `CacheEntry` table
- [ ] On incoming request: embed system+user message, cosine similarity search (threshold 0.97)
- [ ] Cache hit: return stored response, mark `RequestLog.cacheHit = true`, cost = $0
- [ ] Cache miss: forward to provider, store response + embedding asynchronously
- [ ] TTL: configurable per platform key (default 1 hour); cache eviction cron
- [ ] Cache stats on Usage page: hit rate, estimated savings

---

## 7. 💬 In-App Playground _(P1)_

> Test models directly inside KeyHub without leaving the app.

### 7.1 Core Chat UI

- [x] New page: `/playground`
- [x] Sidebar navigation item: "Playground"
- [x] Model selector dropdown (grouped by provider, only active/configured providers shown)
- [x] System prompt textarea (collapsible, persists in localStorage)
- [x] Chat message thread (user / assistant bubbles with markdown rendering)
- [x] Message input with Send button + `Ctrl+Enter` shortcut
- [x] Streaming response rendering (token-by-token)
- [x] Stop generation button during streaming
- [x] Clear conversation button with confirmation

### 7.2 Configuration Panel

- [x] Temperature slider (0.0 – 2.0)
- [x] Max tokens input
- [x] Platform key selector (which key to charge the request to)
- [x] "Show raw request/response" toggle — displays JSON in expandable code block

### 7.3 Prompt Management

- [x] Save current conversation as a named session
- [x] Load previous sessions from a sessions list drawer
- [x] Delete session
- [x] Export conversation as Markdown or JSON

---

## 8. 📝 Prompt Templates _(P2)_

### 8.1 Data Model

- [x] Create `PromptTemplate` table (`id`, `userId`, `orgId`, `name`, `description`, `systemPrompt`, `createdAt`, `updatedAt`)

### 8.2 API

- [x] `GET /api/templates` — List templates (personal + org)
- [x] `POST /api/templates` — Create template
- [x] `PATCH /api/templates/[id]` — Update template
- [x] `DELETE /api/templates/[id]` — Delete template

### 8.3 Proxy Integration

- [x] Accept `X-KeyHub-Template: <templateId>` header on completions endpoint
- [x] Resolve template, prepend system prompt to messages array
- [x] Validate template belongs to key's owner/org

### 8.4 Frontend

- [x] Templates management page (`/settings/templates`)
- [x] Create/edit template dialog: name, description, system prompt textarea with syntax highlighting
- [x] Template selector in Playground sidebar
- [x] Template usage count shown on each card (from logs)

---

## 9. 🔔 Webhooks _(P1)_

### 9.1 Data Model

- [x] Create `WebhookEndpoint` table (`id`, `userId`, `orgId`, `url`, `secret`, `events`: string array, `active`, `createdAt`)
- [x] Create `WebhookDelivery` table (`id`, `endpointId`, `event`, `payload`, `statusCode`, `responseBody`, `attemptCount`, `deliveredAt`, `failedAt`)

### 9.2 Event Types

- [x] `budget.threshold` — spend crossed alert threshold
- [x] `budget.exhausted` — hard cap reached
- [x] `key.expired` — platform key passed expiration date
- [x] `key.expiring_soon` — platform key expiring within 7 days
- [x] `anomaly.detected` — anomaly event triggered
- [x] `request.error` — upstream provider returned 5xx

### 9.3 Delivery Engine

- [x] `lib/webhooks.ts` — `dispatchWebhook(event, payload)` utility
- [x] HMAC-SHA256 signature in `X-KeyHub-Signature` header (using endpoint secret)
- [x] Retry failed deliveries: 3 attempts with exponential backoff (1s, 3s, 10s)
- [x] Mark endpoint inactive after 10 consecutive failures
- [x] Delivery log: last 100 deliveries per endpoint with status and response body

### 9.4 Frontend

- [x] Webhook endpoints page (`/settings/webhooks`)
- [x] Add endpoint form: URL + event multi-select + auto-generated secret (shown once)
- [x] Test button: sends `ping` event to verify endpoint is reachable
- [x] Delivery history drawer per endpoint (status badges, response body preview, retry button)
- [x] Toggle endpoint active/inactive
- [x] Delete endpoint with confirmation

---

## 10. 🔁 Request Replay _(P2)_

- [x] "Replay" button in request log detail modal
- [x] POST same `messages`, `model`, `provider` to `/api/v1/chat/completions` using the same platform key
- [x] Open Playground with pre-filled messages from the log
- [x] Compare original vs replay response side-by-side in modal
- [x] Show diff: token count delta, cost delta, latency delta

---

## 11. 🌐 IP Allowlisting _(P2)_

### 11.1 Data Model

- [x] Add `ipAllowlist` (string array, nullable) to `PlatformKey`

### 11.2 Proxy Enforcement

- [x] Extract request IP from `x-forwarded-for` (trust first hop only)
- [x] If `ipAllowlist` is non-empty and IP not in list: return 403 `{"error": "IP not allowed"}`
- [x] Support CIDR notation (use `ip-range-check` or equivalent)

### 11.3 Frontend

- [x] "IP Allowlist" section in platform key edit dialog
- [x] Tag input for CIDR ranges / IPs with validation
- [x] "Detect my IP" button to auto-fill current IP

---

## 12. 📋 Audit Log _(P1)_

### 12.1 Data Model

- [x] Create `AuditEvent` table (`id`, `userId`, `orgId`, `actorId`, `action`, `targetType`, `targetId`, `metadata` JSON, `ip`, `userAgent`, `createdAt`)
- [x] Action enum values: `user.login`, `user.logout`, `user.password_changed`, `user.deleted`, `provider_key.created`, `provider_key.deleted`, `platform_key.created`, `platform_key.deleted`, `platform_key.toggled`, `org.member_invited`, `org.member_removed`, `org.member_role_changed`

### 12.2 Instrumentation

- [x] Wrap all mutating API routes with `logAuditEvent(...)` calls
- [x] Include IP (from request headers) and user-agent in every event
- [x] Audit events are append-only — no UPDATE or DELETE on this table

### 12.3 Frontend

- [x] Audit log page (`/settings/audit-log`)
- [x] Filterable by action type, actor, date range
- [x] Paginated table: timestamp, actor, action, target, IP
- [x] Export to CSV (same filter logic as request logs export)

---

## 13. 🛡️ MFA / TOTP _(P1)_

### 13.1 Data Model

- [x] Add `totpSecret` (encrypted string, nullable) to `User`
- [x] Add `totpEnabled` (boolean, default false) to `User`
- [x] Create `TotpBackupCode` table (`id`, `userId`, `codeHash`, `usedAt`)

### 13.2 Enrollment Flow

- [x] `POST /api/auth/totp/setup` — Generate TOTP secret, return QR code data URL + manual entry key
- [x] `POST /api/auth/totp/verify-setup` — Verify first TOTP code to confirm enrollment; generate 10 backup codes (bcrypt hashed)
- [x] `POST /api/auth/totp/disable` — Disable MFA (requires current password + TOTP code)
- [x] Backup codes shown once at enrollment, downloadable as `.txt`

### 13.3 Login Integration

- [x] NextAuth credentials flow: after password check, if `totpEnabled`, return partial session state
- [x] Redirect to `/auth/totp` challenge page
- [x] `POST /api/auth/totp/challenge` — Validate TOTP or backup code, complete session
- [x] Rate limit TOTP attempts: 5 failures → 15-minute lockout

### 13.4 Frontend

- [x] MFA section in Settings > Security
- [x] "Enable MFA" button → QR code modal → verification input → backup codes display
- [x] "Disable MFA" button with confirmation (password + current TOTP)
- [x] Backup codes: "View backup codes" (requires re-auth), "Regenerate" button
- [x] Login page: TOTP challenge step with numeric input + "Use backup code" link

---

## 14. 📊 Advanced Analytics _(P2)_

### 14.1 Cost Forecasting

- [x] Dashboard card: "Projected Month-End Spend"
- [x] Algorithm: linear regression on daily costs for current month
- [x] Show confidence interval (±X%) based on variance
- [x] Indicator: on-track / over-budget projection with delta vs monthly limit

### 14.2 Per-Tag Analytics

- [x] Accept `X-KeyHub-Tag` header in completions proxy (max 64 chars, alphanumeric + hyphens)
- [x] Store `tag` field on `RequestLog`
- [x] Usage page: "By Tag" breakdown — cost, requests, avg latency per tag
- [x] Tag filter in Logs page and CSV export

### 14.3 Prompt & Response Full-Text Search (Archive)

- [x] Add GIN index on `RequestLog.prompt` and `RequestLog.response` in Postgres
- [x] Update logs search API to use `to_tsvector / tsquery` for full archive search
- [x] Highlight matching terms in log detail modal

### 14.4 Cost Comparison Report

- [x] New Usage sub-section: "What-if Analysis"
- [x] For last N requests, show: actual cost vs cost if all requests used the cheapest model
- [x] Bar chart: "Potential savings by switching to X"

---

## 15. 📧 Email Infrastructure _(P0 — required by other features)_

- [x] Choose and configure transactional email provider (Resend / Postmark / SES)
- [x] Set `EMAIL_FROM`, `EMAIL_API_KEY` env vars
- [x] Create `lib/email.ts` with `sendEmail(to, subject, html)` wrapper
- [x] Email templates (React Email or plain HTML):
  - [x] Welcome / verify email
  - [x] Org invite
  - [x] Budget threshold alert
  - [x] Budget exhausted alert
  - [x] Anomaly detection alert
  - [x] Key rotation reminder
  - [x] Key expiry warning
- [x] Unsubscribe link on all non-critical emails (per CAN-SPAM)
- [x] Email preferences page (`/settings/notifications`)
  - [x] Toggle each email category on/off
  - [x] Persist preferences to `UserNotificationPrefs` table

---

## 16. 🧹 Misc Improvements _(P3)_

- [x] **Dark/Light mode toggle** — System default + manual override, persisted in cookie
- [ ] **Onboarding tour** — Step-by-step tooltip tour for new users (first login only)
- [x] **Rate limit headers** — Return `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` on all completions responses
- [x] **Response streaming improvements** — Return `X-Request-ID` header for tracing; client can poll `/api/logs?requestId=` for final metadata
- [x] **Pagination on all list endpoints** — Provider keys, platform keys, templates all currently return unbounded lists
- [ ] **OpenAPI spec** — Auto-generate `openapi.json` from routes; serve Swagger UI at `/api/docs`
- [ ] **CLI tool** — `npx keyhub` for generating and managing platform keys from terminal
- [ ] **Stripe integration** — Billing page for SaaS monetization: usage-based pricing, plan limits, invoice history
- [x] **Status page** — `/status` showing uptime and latency per provider over last 24h (using own request logs as data source)
- [x] **Export account data** — GDPR-compliant data export: all keys (metadata only, no secrets), all logs, all settings as JSON

---

---

## 17. 🛠️ Super Admin Panel _(P0 / SA)_

> A fully isolated control plane for the platform operator. Accessible only to users with `role: SUPER_ADMIN` in the database. Never reachable through standard user flows. Every action is audit-logged with mandatory justification.

---

### 17.1 Access Control & Bootstrap

- [x] Add `role` enum to `User`: `USER` (default) | `SUPER_ADMIN`
- [x] Seed script: promote first user by email via `pnpm admin:promote <email>`
- [x] CLI command: `pnpm admin:demote <email>` — removes super admin privileges
- [x] Middleware: all `/admin/*` routes check `session.user.role === SUPER_ADMIN` — return 404 (not 403) to non-admins to avoid revealing the panel exists
- [x] Super admin session flag stored in JWT (`isSuperAdmin: true`), verified server-side on every admin API call
- [x] Separate NextAuth callback: on super admin login, require TOTP even if MFA not globally enforced
- [x] IP restriction: optionally lock `/admin/*` to a CIDR allowlist via env var `ADMIN_IP_ALLOWLIST`
- [x] Inactivity auto-logout: super admin sessions expire after 30 minutes of inactivity (separate from user session TTL)
- [x] All admin API routes wrapped in `withSuperAdmin(handler)` HOF that validates role, logs access attempt (success and failure), and rejects with 404 on failure

---

### 17.2 Admin Navigation & Layout

- [x] Dedicated layout: `/admin` — completely separate from main app layout, no shared nav
- [x] Admin sidebar sections: Dashboard · Users · Organizations · Keys · Logs · Finance · System · Audit Trail · Settings
- [x] Admin header: logged-in admin name, role badge, last login time, logout button
- [x] Environment banner: `DEVELOPMENT` / `STAGING` / `PRODUCTION` pill always visible to prevent accidental prod actions
- [x] Breadcrumb trail on every admin page
- [x] Global admin search bar: search across users, orgs, keys by ID/email/name

---

### 17.3 Admin Dashboard (Overview)

- [x] Platform-wide KPI cards:
  - [x] Total registered users (+ delta last 7d)
  - [ ] Total organizations (+ delta last 7d)
  - [x] Total API requests today / this month
  - [x] Total platform revenue (cost billed to users) this month
  - [ ] Total provider cost (actual cost paid to AI providers) this month
  - [ ] Gross margin % (revenue − provider cost)
  - [x] Active platform keys count
  - [x] Active provider keys count
- [x] Requests per day — bar chart (platform-wide, last 30d)
- [x] New user signups per day — line chart (last 30d)
- [x] Provider cost breakdown — donut chart (OpenAI / Anthropic / Google / Mistral)
- [x] Top 10 users by spend — table (user, requests, cost, last active)
- [x] Top 10 organizations by spend — table
- [x] Error rate by provider — horizontal bar chart
- [x] System health panel: DB connection status, Redis status, email provider status, each AI provider reachability (live ping)

---

### 17.4 User Management

- [x] `GET /api/admin/users` — Paginated user list with search (email, name, ID), sort (created, last login, spend), filter (active, suspended, admin)
- [x] `GET /api/admin/users/[id]` — Full user profile: account info, stats, keys, orgs, recent logs
- [x] `PATCH /api/admin/users/[id]` — Update user fields: name, email, role
- [x] `POST /api/admin/users/[id]/suspend` — Suspend account (all API calls return 403 immediately); requires written justification (stored in audit log)
- [x] `POST /api/admin/users/[id]/unsuspend` — Re-activate suspended account
- [x] `POST /api/admin/users/[id]/force-logout` — Invalidate all active sessions (rotate JWT secret salt for user)
- [x] `POST /api/admin/users/[id]/reset-password` — Send password reset email to user without knowing current password
- [x] `POST /api/admin/users/[id]/promote` — Grant `SUPER_ADMIN` role (only performable by existing super admin; logged with actor ID)
- [x] `POST /api/admin/users/[id]/demote` — Remove `SUPER_ADMIN` role
- [x] `DELETE /api/admin/users/[id]` — Hard delete user and all associated data; requires two-factor confirmation (type email + current TOTP)
- [x] `POST /api/admin/users/[id]/impersonate` — Start impersonation session (see 17.5)
- [x] **Frontend — User list page:**
  - [x] Table: avatar, name, email, plan, status badge, request count, total spend, created date, actions menu
  - [x] Inline status toggle (active ↔ suspended) with justification dialog
  - [ ] Bulk actions: suspend selected, export selected to CSV
  - [x] User detail drawer/page: all stats, key list, org memberships, last 20 logs, full audit trail for that user
  - [ ] Activity timeline: visual log of account events (signup, logins, key creations, password changes)

---

### 17.5 Impersonation

- [x] `POST /api/admin/impersonate/[userId]` — Creates impersonation token (short-lived JWT, 15 min, non-renewable)
- [x] Impersonation session stored separately; original admin session preserved
- [x] Impersonated session has a persistent yellow banner: `"You are viewing as [user@email.com] — [Exit impersonation]"`
- [x] All actions taken during impersonation are tagged `impersonatedBy: adminId` in audit log
- [x] Impersonated session is **read-only by default** — write actions require explicit `allowImpersonationWrites: true` flag in env (off by default)
- [x] `POST /api/admin/impersonate/exit` — End impersonation, restore admin session
- [x] Impersonation events always emit webhook event `admin.impersonation.started` and `admin.impersonation.ended`

---

### 17.6 Organization Management

- [x] `GET /api/admin/orgs` — Paginated org list with search and filters (active, suspended, size)
- [x] `GET /api/admin/orgs/[id]` — Full org detail: members, keys, spend, request volume
- [x] `PATCH /api/admin/orgs/[id]` — Update org name, slug, plan, custom limits
- [x] `POST /api/admin/orgs/[id]/suspend` — Suspend entire org (blocks all member API calls); justification required
- [x] `POST /api/admin/orgs/[id]/unsuspend` — Re-activate org
- [x] `DELETE /api/admin/orgs/[id]` — Hard delete org and all data; two-factor confirmation
- [x] `POST /api/admin/orgs/[id]/members` — Add any user to org with any role (bypass invite flow)
- [x] `DELETE /api/admin/orgs/[id]/members/[userId]` — Force-remove member from org
- [x] **Frontend — Org detail page:**
  - [x] Member table with force-remove button
  - [x] Key list (provider + platform) with individual disable buttons
  - [ ] Monthly spend chart
  - [x] Danger zone: suspend / delete org

---

### 17.7 Key Management (Platform-wide)

- [x] `GET /api/admin/provider-keys` — List all provider keys across all users/orgs; filter by provider, user, status
- [x] `POST /api/admin/provider-keys/[id]/disable` — Force-disable any provider key (e.g. compromised key report)
- [x] `DELETE /api/admin/provider-keys/[id]` — Hard delete provider key with justification
- [x] `GET /api/admin/platform-keys` — List all platform keys; filter by user, org, status, expiry
- [x] `POST /api/admin/platform-keys/[id]/disable` — Force-disable any platform key
- [x] `POST /api/admin/platform-keys/[id]/revoke` — Immediately revoke key (returns 401 on all future requests)
- [x] `DELETE /api/admin/platform-keys/[id]` — Hard delete platform key
- [x] **Leaked key response workflow:**
  - [x] `POST /api/admin/incident/leaked-key` — Accepts key prefix; searches all platform keys by prefix; disables all matches; creates incident record (audit events)
  - [ ] Incident table: `id`, `type`, `affectedKeyId`, `reportedBy`, `resolvedAt`, `notes`
  - [x] Frontend: "Leaked Key" quick action button on admin keys page; form: enter key prefix, shows matching keys, confirm to disable all

---

### 17.8 Global Request Logs

- [x] `GET /api/admin/logs` — Platform-wide request log with all user/org filters plus user-level filters (provider, model, status, date range, search)
- [x] Adds `user` and `org` columns to log table
- [x] Admin can open any log detail modal (same as user-facing, plus: user ID, user email, platform key owner ID)
- [x] `GET /api/admin/logs/export` — CSV export of full platform log (up to 100k rows)
- [x] Real-time log stream: live-updating log feed (polling every 5s) for monitoring active traffic
- [x] **Frontend — Admin logs page:**
  - [x] All standard log filters + user/org filter dropdowns
  - [x] "Live" toggle: auto-refresh every 5s
  - [ ] Anomaly highlight: rows with flagged anomaly events shown in amber

---

### 17.9 Finance & Billing Controls

- [x] `GET /api/admin/finance/summary` — Platform revenue, provider costs, margin for any date range
- [x] `GET /api/admin/finance/users` — Per-user revenue breakdown (what each user has been billed via usage)
- [x] `POST /api/admin/finance/credits/[userId]` — Add or subtract balance credits to a user account (e.g. for refunds or promotions); requires justification
- [x] `GET /api/admin/finance/credits` — Full credit transaction history platform-wide
- [x] `POST /api/admin/finance/override-pricing/[userId]` — Apply custom per-user pricing multiplier (e.g. 0.8x for enterprise discount)
- [ ] Pricing management:
  - [x] `GET /api/admin/pricing` — List current token pricing table (mirrors `Cost Tracking` section)
  - [ ] `PATCH /api/admin/pricing/[provider]/[model]` — Update input/output price per 1M tokens; change takes effect immediately for new requests; historical logs retain original price at time of request
  - [ ] Frontend pricing editor: editable table with per-cell inputs; save button; "Reset to defaults" option; last-updated timestamp per row
- [x] **Frontend — Finance page:**
  - [ ] Revenue vs cost line chart (daily, selectable range)
  - [x] Margin % gauge
  - [x] Top spenders table
  - [x] Credit ledger per user (searchable)
  - [ ] Pricing table editor

---

### 17.10 Plan & Quota Management

- [x] Create `Plan` table (`id`, `name`, `monthlyPriceUsd`, `requestsPerMonth`, `platformKeysLimit`, `providerKeysLimit`, `teamMembersLimit`, `logsRetentionDays`, `apiRateLimit`)
- [x] Seed default plans: `free`, `pro`, `team`, `enterprise`
- [x] Add `planId` FK to `User` and `Organization`
- [x] Enforce plan limits in relevant API routes (key creation, member invites, etc.)
- [x] `GET /api/admin/plans` — List all plans
- [x] `POST /api/admin/plans` — Create custom plan
- [x] `PATCH /api/admin/plans/[id]` — Update plan limits (changes apply to all users on that plan)
- [x] `POST /api/admin/users/[id]/assign-plan` — Assign plan to user (override Stripe subscription if applicable)
- [x] `POST /api/admin/orgs/[id]/assign-plan` — Assign plan to org
- [x] **Frontend — Plans page:**
  - [x] Plan cards with all limits editable inline
  - [x] User count per plan
  - [x] "Assign plan" action on user/org detail pages

---

### 17.11 System Configuration

- [x] `GET /api/admin/system/config` — Read current feature flags and system settings
- [x] `PATCH /api/admin/system/config` — Update settings (changes reflected immediately without redeploy)
- [x] Configurable settings:
  - [x] `maintenanceMode` (boolean) — Returns 503 on all `/api/v1/*` and app routes with custom message; admin panel remains accessible
  - [x] `signupsEnabled` (boolean) — Disable new user registration globally
  - [x] `defaultPlan` (string) — Plan assigned to new signups
  - [x] `maxUsersTotal` (integer) — Hard cap on total registered users (0 = unlimited)
  - [x] `globalRateLimitRpm` (integer) — Platform-wide RPM ceiling across all keys
  - [x] `allowedEmailDomains` (string array) — If non-empty, only these domains can register (e.g. `["company.com"]`)
  - [x] `providerTimeoutMs` (integer) — Global timeout for upstream provider calls
  - [x] `logRetentionDays` (integer) — Auto-purge `RequestLog` rows older than N days
  - [x] `semanticCacheEnabled` (boolean) — Global toggle for semantic caching
  - [x] `anomalyDetectionEnabled` (boolean) — Global toggle
  - [x] `customBannerMessage` (string) — Displays a dismissible info banner to all logged-in users
- [x] **Frontend — System Settings page:**
  - [x] Toggle switches for boolean flags
  - [x] Numeric inputs with validation for limits
  - [x] Tag inputs for array values
  - [ ] "Save changes" with confirmation dialog showing diff of what changed
  - [ ] Live preview of maintenance mode banner

---

### 17.12 Feature Flags

- [x] Create `FeatureFlag` table (`id`, `key`, `description`, `enabled`, `rolloutPercent`, `allowedUserIds`: array, `allowedPlanIds`: array, `updatedAt`, `updatedBy`)
- [x] `lib/flags.ts` — `isEnabled(flagKey, userId?)` utility; checks global toggle, rollout %, and allowlists
- [x] `GET /api/admin/flags` — List all flags
- [x] `PATCH /api/admin/flags/[key]` — Update flag state
- [x] Wrap every major new feature in a flag (Teams, Playground, Semantic Cache, etc.)
- [x] **Frontend — Feature Flags page:**
  - [x] Table: flag name, description, status badge, rollout %, override user count, last updated by
  - [x] Toggle on/off per flag
  - [x] Rollout % slider (0–100)
  - [x] User allowlist: search and add specific users for early access
  - [ ] Plan allowlist: enable flag only for certain plans

---

### 17.13 Announcements & Communication

- [x] Create `Announcement` table (`id`, `title`, `body`, `type`: `info` | `warning` | `critical`, `targetRole`: `all` | `admin`, `publishedAt`, `expiresAt`, `createdBy`)
- [x] `GET /api/announcements` — Returns active announcements for current user's role
- [x] `POST /api/admin/announcements` — Create announcement
- [x] `PATCH /api/admin/announcements/[id]` — Edit or expire announcement
- [x] `DELETE /api/admin/announcements/[id]` — Delete announcement
- [x] Frontend: announcements shown as dismissible banners at the top of the main app (per-user dismissal stored in DB)
- [x] **Frontend — Announcements page (admin):**
  - [x] List of active/expired announcements
  - [x] Create/edit dialog: title, body (markdown), type, target audience, expiry date
  - [x] Preview exactly how it appears to users
  - [ ] "Send as email" toggle — also dispatches to all target users via email

---

### 17.14 Platform-wide Audit Trail

- [x] All admin actions extend the existing `AuditEvent` table with `actorRole: SUPER_ADMIN`
- [x] Additional admin-only action types: `admin.user.suspended`, `admin.user.impersonated`, `admin.key.force_disabled`, `admin.pricing.updated`, `admin.config.changed`, `admin.flag.toggled`, `admin.plan.assigned`, `admin.credits.adjusted`
- [x] `GET /api/admin/audit` — Platform-wide audit log (includes all user-level events + all admin events)
- [x] Filters: actor, target user, action type, date range
- [x] **Immutability guarantee:** audit records have no UPDATE/DELETE routes even for super admins
- [x] **Frontend — Audit Trail page (admin):**
  - [x] Full-width table with all filters
  - [x] Actor column distinguishes `USER` vs `SUPER_ADMIN` with badge
  - [x] "Justification" column (expandable) for actions that required written reason
  - [x] Export to CSV (up to 100k rows)
  - [ ] Integrity check button: verifies sequential hash chain on audit records

---

### 17.15 Admin Notifications & Alerts

- [x] Dedicated admin alert channel (separate from user-facing alerts)
- [x] Alert triggers:
  - [x] New user signup (optional, toggleable)
  - [x] User account suspended (always)
  - [x] Anomaly detected on any user account
  - [x] Provider key reported as leaked
  - [x] Any super admin login (always — with IP and user-agent)
  - [x] Failed admin login attempt (always)
  - [x] Maintenance mode toggled (always)
  - [ ] Database disk usage > 80% (if metric available)
  - [x] Any audit integrity check failure (critical — immediate)
- [x] Delivery channels: email to `ADMIN_ALERT_EMAIL` env var, optional Slack webhook (`ADMIN_SLACK_WEBHOOK`)
- [x] Admin notification preferences page: toggle each alert type, configure delivery channels

---

### 17.16 Admin Security Hardening

- [x] All admin routes log request metadata (IP, user-agent, timestamp, route, HTTP method) regardless of success/failure
- [x] Failed admin auth attempts (wrong role, expired session, bad TOTP) tracked in-memory per IP; block after 3 failures in 10 minutes from same IP for 15 minutes
- [x] Admin session bound to IP: if IP changes mid-session, force re-authentication
- [x] CSRF protection on all admin mutation endpoints (double-submit cookie pattern or `SameSite=Strict`)
- [x] Rate limit all admin API routes: 60 req/min per admin user; 10 req/min for sensitive actions (delete, impersonate, promote)
- [x] Admin routes excluded from public OpenAPI spec — never documented externally
- [x] `ADMIN_SECRET_KEY` env var check at startup; if missing in production, logs critical warning
- [x] Penetration test checklist item: verify `/admin/*` returns 404 (not 401/403) to unauthenticated users

---

## Implementation Order (Recommended)

| Phase       | Features                                                                   | Goal                                        |
| ----------- | -------------------------------------------------------------------------- | ------------------------------------------- |
| **Phase 0** | Super Admin Bootstrap (#17.1, #17.2, #17.16)                               | Secure operator access before anything else |
| **Phase 1** | Email Infrastructure (#15), Budget Limits (#3), Audit Log (#12), MFA (#13) | Security & safety baseline                  |
| **Phase 2** | Admin User/Org/Key Management (#17.4–17.7), Admin Logs (#17.8)             | Full operator visibility                    |
| **Phase 3** | Teams & Orgs (#1), Key Scoping (#2), Webhooks (#9)                         | B2B readiness                               |
| **Phase 4** | Plans & Quotas (#17.10), Finance Controls (#17.9), Feature Flags (#17.12)  | Monetization infrastructure                 |
| **Phase 5** | Anomaly Detection (#5), Fallback Routing (#6.1), Retry Logic (#6.2)        | Reliability                                 |
| **Phase 6** | Playground (#7), Prompt Templates (#8), Request Replay (#10)               | Developer experience                        |
| **Phase 7** | System Config (#17.11), Announcements (#17.13), Admin Alerts (#17.15)      | Operator tooling                            |
| **Phase 8** | Load Balancing (#6.3), Semantic Caching (#6.4), Advanced Analytics (#14)   | Performance & insights                      |
| **Phase 9** | Key Rotation (#4), IP Allowlisting (#11), Misc (#16)                       | Polish & enterprise                         |
