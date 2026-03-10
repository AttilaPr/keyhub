# KeyHub - Features

## Authentication & User Management

- **User Registration** — Create account with email, name, and password (bcrypt hashed, 12 rounds)
- **User Login** — Credentials-based authentication with JWT sessions (NextAuth v5)
- **Login Rate Limiting** — In-memory rate limiter blocks login attempts after 5 failures per 15 minutes per email
- **Route Protection** — Middleware redirects unauthenticated users to login; logged-in users skip auth pages
- **Settings Page** — View profile info and security details
- **Edit Profile** — Update display name from settings; saves to database and refreshes JWT session immediately without re-login
- **Change Password** — Update account password with current password verification, client-side validation (min 8 chars, match confirmation), and bcrypt hashing; invalidates all existing sessions via `sessionInvalidatedAt`
- **Delete Account** — Permanently delete account and all associated data; requires password confirmation via AlertDialog; transaction-based cascade deletion; auto sign-out and redirect to login

## Two-Factor Authentication (TOTP)

- **TOTP Setup** — Generate TOTP secret with QR code via `/api/auth/totp/setup`; uses `otpauth` library for standards-compliant OTP generation
- **TOTP Verification** — Verify 6-digit code to enable MFA via `/api/auth/totp/verify-setup`; stored as `totpSecret` on User model
- **TOTP Challenge Page** — Dedicated challenge page at `/(auth)/totp` for login flow; middleware redirects users with `requiresTotp` flag
- **Backup Codes** — 10 single-use backup codes generated on setup; bcrypt hashed in `TotpBackupCode` model; displayed once at setup time
- **Brute-Force Protection** — Failed attempt counter (`totpFailedAttempts`) with lockout (`totpLockedUntil`); auto-lock after repeated failures
- **Disable MFA** — Remove TOTP from account via `/api/auth/totp/disable` with password confirmation
- **Status Check** — `/api/auth/totp/status` endpoint for checking MFA enrollment state

## Key Management

### Provider Keys (Real AI API Keys)

- **Add/Update** provider API keys for OpenAI, Anthropic, Google, Mistral, Groq
- **Provider Validation** — Server-side whitelist restricts to allowed providers only
- **AES-256-GCM Encryption** — Keys are encrypted at rest, never stored in plaintext
- **One Key Per Provider** per user (upsert behavior)
- **Toggle Active/Inactive** status with loading spinner and error handling; reverts on failure
- **Delete** provider keys with confirmation dialog; disabled button prevents double-click
- **Test Connection** — Verify API key validity by pinging the provider's models endpoint; shows success/failure with response latency
- **Key Rotation Tracking** — `rotationReminderDays` and `lastRotatedAt` fields for rotation reminder support
- **Usage Stats Per Key** — Each provider key card displays total request count, total cost, and last used date
- **Load Balancing Weight** — Configurable weight (1-10) per key for weighted round-robin distribution
- **Latency Tracking** — Exponential moving average latency (`latencyEma`) tracked per provider key

### Platform Keys (Virtual API Keys)

- **Generate** virtual API keys (`ak-user-` prefix + 24 random chars) with server-side input validation
- **Shown Once** — Only the bcrypt hash and prefix are stored
- **Toggle Active/Inactive** status with loading spinner and error handling
- **Delete** platform keys with confirmation dialog
- **Edit Key Settings** — Update label, rate limit, and expiration date via edit dialog
- **Usage Tracking** — Request count and last used timestamp per key
- **Rate Limiting** — Optional per-key requests-per-minute (RPM) limit; returns HTTP 429 with `Retry-After` header
- **Key Expiration** — Optional expiration date; expired keys return HTTP 403 and are visually marked in red; keys expiring within 7 days show yellow warning badge with countdown
- **Key Revocation** — Admin can revoke keys via `revokedAt` timestamp; revoked keys return 401

## AI Completions Proxy

### Chat Completions (`POST /api/v1/chat/completions`)

- **OpenAI-Compatible** API endpoint — drop-in replacement for OpenAI SDK
- **Bearer Token Auth** — Authenticate with platform keys
- **Multi-Provider Routing** — Model format: `provider/model-name`
- **Streaming Responses** — Real-time token streaming via Vercel AI SDK
- **Supported Providers:**
  - OpenAI (gpt-4o, gpt-4o-mini, gpt-4-turbo, o1, o1-mini)
  - Anthropic (claude-3-5-sonnet, claude-3-5-haiku, claude-3-opus)
  - Google (gemini-1.5-pro, gemini-1.5-flash, gemini-2.0-flash)
  - Mistral (mistral-large-latest, mistral-small-latest, codestral-latest)
- **Request Body Validation** — Validates model, messages array (max 256), message roles (user, assistant, system, tool), and content; returns 400 with descriptive error messages
- **Per-Request Cost Calculation** based on token pricing
- **Full Request Logging** — Provider, model, tokens, cost, latency, prompt, response
- **Pre-Flight Cost Estimation** — Estimates cost before sending; rejects requests exceeding per-key `maxCostPerRequest` ceiling
- **Budget Enforcement** — Checks account-level and per-key budgets before forwarding; returns HTTP 429 with reset date
- **Fallback Routing** — Automatic failover to alternative providers on error; uses model mapping for cross-provider equivalence
- **Retry with Backoff** — Configurable retries with exponential backoff and jitter on transient errors; per-key `maxRetries` override
- **Load Balancing** — Routes to provider keys using round-robin, least-latency, or random strategy
- **Rate Limit Headers** — Returns X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset on every response
- **Request Tracing** — X-Request-ID header for end-to-end request tracing; stored in request logs
- **Per-Request Tagging** — X-KeyHub-Tag header for categorizing requests (e.g. by feature or team)
- **Template Injection** — X-KeyHub-Template header to inject a saved prompt template as system message
- **IP Enforcement** — CIDR-aware IP allowlist check per platform key
- **Key Scoping Enforcement** — Provider restrictions, model restrictions checked before routing
- **Anomaly Detection** — Post-request anomaly checks trigger alerts on volume/cost spikes

### Models List (`GET /api/v1/models`)

- **OpenAI-Compatible** response format
- Returns available models based on user's active provider keys

## Dashboard & Analytics

### Dashboard Page

- **Error Handling with Retry** — Validates API response, displays error card with retry button; AbortController cancels in-flight requests on unmount
- **SQL-Level Aggregation** — Dashboard API uses `$queryRaw` for daily chart aggregation, latency percentiles (`PERCENTILE_CONT`), and monthly costs — prevents OOM on large datasets
- **Time Range Selector** — 7d, 14d, 30d, and 90d views; dynamically updates all KPI cards, charts, and provider breakdown
- **Monthly Spend** — Total cost from start of current month
- **Today's Requests** — Request count since midnight
- **Total Requests** — Request count for selected time range
- **Success Rate** — Percentage of successful requests
- **Avg Latency** — Average response latency in milliseconds with cyan accent
- **Requests per Day** — Bar chart
- **Daily Cost** — Line chart
- **Avg Latency per Day** — Line chart (cyan)
- **Cost by Provider** — Horizontal bar chart
- **Cost Forecasting** — Linear regression on daily cost data to project future spending trends
- **Recent Activity** — Last 5 API requests with model, provider, status badge, token count, cost, and relative timestamp; "View all" links to Logs page

### Usage Page

- **Error Handling with Retry** — AbortController + error card with retry button
- **Time Range Selector** — 7d, 14d, 30d, and 90d views
- **Spend Over Time** — Line chart
- **Requests Per Day** — Bar chart
- **Cost by Provider** — Donut chart
- **Requests by Provider** — Bar chart
- **Provider Summary Table** — Request count, total cost, avg cost per request
- **Cost by Model** — Horizontal bar chart + summary table with provider, requests, tokens, and cost per model
- **Model Performance Comparison** — Per-model table showing average latency, error rate, average cost per request, and total cost
- **Tokens Per Day** — Stacked area chart showing daily input (cyan) and output (lime) token consumption
- **Latency Percentiles** — P50, P90, P95, P99 response times with proportional horizontal bar visualization
- **Usage by API Key** — Horizontal bar chart + summary table with requests, tokens, and cost per key
- **What-If Cost Comparison** — `/api/usage/what-if` analyzes how costs would change if requests were routed to different models

## Request Logs

- **Error Handling with Retry** — AbortController + error card with retry button
- **Paginated Log Table** with provider and status filters
- **Sortable Columns** — Click any column header to sort ascending/descending; server-side sorting with whitelisted fields
- **Advanced Filtering** — Filter by model, date range (from/to), and API key; clear-all button resets all filters
- **Full-Text Search** — Search through prompt and response content with debounced input (400ms); case-insensitive matching
- **Detail Modal** — Full request metadata, prompt, and response; copy-to-clipboard buttons with visual confirmation; JSON auto-formatting
- **CSV Export (Full)** — Server-side export of all matching logs (up to 10k rows); respects all active filters
- **Request Replay** — Replay any logged request via `/api/logs/[id]/replay`

## In-App Playground

- **Interactive Chat** — Test any model directly inside KeyHub at `/playground`
- **Model Selector** — Grouped by provider, only configured providers enabled
- **System Prompt** — Collapsible textarea, persisted to localStorage
- **Streaming Responses** — Token-by-token rendering with stop button
- **Platform Key Selector** — Choose which key to charge requests to
- **Temperature & Max Tokens** — Adjustable parameters
- **Template Selector** — Load saved prompt templates directly into system prompt
- **Chat Sessions** — Persist conversation history to localStorage
- **Ctrl+Enter** to send, clear conversation button

## API Documentation Page

- **Quick Start Checklist** — Dynamic 3-step onboarding checklist showing real-time completion status; green checkmark when done, action link when pending; progress badge shows "X/3 complete"
- **Code Examples** — curl, Node.js (OpenAI SDK), Python (OpenAI SDK), Vercel AI SDK
- **Available Models (Dynamic)** — Grouped by provider with live status indicators; green checkmark for configured providers
- **API Endpoint Reference**

## Key Scoping

- **Provider Restrictions** — Restrict platform keys to specific providers; enforced in proxy with 403
- **Model Restrictions** — Restrict platform keys to specific models; enforced in proxy with 403
- **Max Cost Per Request** — Optional per-key cost ceiling; pre-flight estimation rejects exceeding requests
- **IP Allowlisting** — Restrict to specific IP addresses or CIDR ranges; "Detect my IP" auto-fill button via `/api/my-ip`
- **Restrictions Edit Dialog** — Multi-select checkboxes for providers, combobox for models, cost input; active restrictions shown as badge chips

## Budget Limits

- **Monthly Budget** — Set account-level monthly spending limit in Settings
- **Hard Cap Mode** — Toggle between hard cap (blocks requests at limit) and soft warning; soft cap dispatches webhook alert
- **Budget Alert Threshold** — Configurable alert threshold (default 80%); budget check API at `/api/budget/check`
- **Budget Progress Bar** — Dashboard shows color-coded progress: green -> yellow (75%) -> red (95%)
- **Per-Key Budget** — Each platform key supports its own budget with configurable period (daily/weekly/monthly)
- **Proxy Enforcement** — Budget check integrated before forwarding; returns HTTP 429 with reset date

## Anomaly Detection

- **Statistical Detection Engine** — Rolling 7-day mean and standard deviation; configurable sigma threshold per user (default 3.0)
- **Request Volume Spikes** — Alert when hourly requests exceed mean + N sigma
- **Cost Spikes** — Alert when hourly cost exceeds mean + N sigma
- **Error Rate Monitoring** — Alert when error rate exceeds 50% over last 100 requests
- **Key Dominance Detection** — Alert when a single key accounts for >90% of requests in an hour
- **Event Persistence** — Events stored with deduplication (1hr window)
- **Notification Preferences** — Per-user toggles for email and webhook notifications; unread anomaly count badge in sidebar
- **Admin Alert Channels** — Admin-level alerts via email and optional Slack webhook (`SLACK_WEBHOOK_URL`)

## Retry Logic

- **Exponential Backoff with Jitter** — Configurable max retries, base delay, max delay
- **Smart Retry** — Only retries on transient errors (429, 500, 502, 503, 504); never on 400, 401, 403
- **Network Error Handling** — Retries on ECONNRESET and ETIMEDOUT
- **Per-Key Retry Override** — `maxRetries` field on PlatformKey
- **Retry Count Tracking** — `retryCount` field on RequestLog

## Fallback Routing

- **Fallback Rules** — Per-platform-key rules defining primary -> fallback provider routing; configurable trigger status codes
- **Model Mapping** — Cross-provider equivalence table (e.g. GPT-4o -> Claude 3.5 Sonnet)
- **Fallback Tracking** — `fallbackUsed`, `originalProvider`, `fallbackProvider` fields on RequestLog
- **Priority Ordering** — Multiple rules per key with priority for ordered evaluation

## Load Balancing

- **Routing Strategies** — round-robin, least-latency, random per platform key
- **Weighted Selection** — Provider keys have configurable weight (1-10) for weighted distribution
- **Latency Tracking** — Exponential moving average latency per provider key for least-latency routing
- **Load Balancer Engine** — `src/lib/load-balancer.ts` implements all three strategies

## Request Tracing

- **X-Request-ID** — Unique request ID per proxy request; stored in RequestLog; returned in response headers
- **X-RateLimit Headers** — Limit, Remaining, Reset headers on every proxy response
- **Per-Request Tagging** — `X-KeyHub-Tag` header for categorizing requests; filterable in logs
- **X-KeyHub-Template** — Pass prompt template ID via header for automatic template loading

## Teams & Organizations

- **Organization CRUD** — Create, read, update, delete organizations via `/api/orgs`; unique slug per org
- **Role-Based Membership** — OWNER, ADMIN, MEMBER with hierarchy-based permission checks
- **Member Management** — Add/remove members, change roles; owners cannot be demoted
- **Invite System** — Token-based invites with expiration; accept at `/api/invites/[token]/accept`
- **Org Context Switching** — Switch active org via `/api/orgs/switch`; org-scoped provider keys, platform keys, and logs
- **Organization Pages** — List view at `/organizations`, detail/settings at `/organizations/[id]`
- **Org Suspension** — Admin can suspend/unsuspend organizations

## Prompt Templates

- **CRUD API** — Create, read, update, delete prompt templates via `/api/templates`
- **System Prompt Storage** — Save reusable system prompts with name and description
- **Settings Page** — Manage templates at `/settings/templates` with create/edit/delete dialogs

## Webhooks

- **Webhook Endpoints** — Register URLs for event notifications; management page at `/settings/webhooks`
- **HMAC-SHA256 Signatures** — Every delivery signed with endpoint secret in `X-KeyHub-Signature` header
- **SSRF Protection** — Blocks private/reserved IP ranges (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16, localhost, ::1, fc00::/7)
- **Event Types** — budget.threshold, budget.exhausted, key.expired, key.expiring_soon, anomaly.detected, request.error, admin.impersonation.started, admin.impersonation.ended
- **Auto-Disable** — Endpoints disabled after 10 consecutive failures
- **Delivery Logging** — Status codes and response bodies stored per delivery; history viewable in settings
- **Retry with Backoff** — Failed deliveries retried up to 3 attempts with exponential backoff

## Audit Log

- **Audit Event Table** — Records all security-relevant actions with actor, target, metadata, IP, and user-agent
- **Append-Only** — No UPDATE or DELETE routes; audit records are immutable
- **API Access** — Paginated query with action type filtering
- **User Audit Log Page** — Personal audit trail at `/settings/audit-log` with filters and CSV export
- **Admin Audit Log** — Platform-wide audit trail at `/admin/audit` with CSV export

## Provider Status Page

- **Status Dashboard** — Real-time provider status at `/status` showing connectivity and latency
- **Status API** — `/api/status` returns provider health data based on recent request logs

## Email Infrastructure

- **Resend Integration** — Email sending via Resend SDK; falls back to console logging when `RESEND_API_KEY` is not set
- **Dark-Themed HTML Templates** — 7 templates for budget alerts, anomaly alerts, key rotation reminders, key expiry warnings, welcome emails, password change confirmation, and account deletion notice
- **Notification Preferences** — Per-user email toggles for budget alerts, anomaly alerts, key rotation, and key expiry; managed at `/api/settings/notifications`

## Key Rotation Reminders

- **Cron Endpoint** — `/api/cron/key-rotation` checks provider keys with `rotationReminderDays` set and sends email reminders
- **Rotation Tracking** — `lastRotatedAt` updated on each key upsert; `rotationReminderDays` configurable per key

## Security

- **AES-256-GCM** encryption for provider API keys (IV + auth tag + ciphertext)
- **bcrypt** hashing for platform keys and user passwords (12 rounds)
- **Keys Never Appear in Logs** — Only hashes and prefixes stored; admin key list uses explicit `select` to exclude `encryptedKey`
- **JWT Sessions** — Stateless auth with role (USER/SUPER_ADMIN); `issuedAt` claim for session invalidation
- **Middleware Route Protection** — Dashboard routes require auth; admin routes return 404 to non-admins
- **Session Invalidation** — `sessionInvalidatedAt` field on User; JWT issued before this timestamp is rejected (force-logout on password change)
- **CSRF Protection** — Double-submit cookie pattern (`__keyhub_csrf` cookie + `x-csrf-token` header) on all mutation API routes
- **Security Headers** — X-Frame-Options (DENY), X-Content-Type-Options (nosniff), Referrer-Policy, X-XSS-Protection, Permissions-Policy, HSTS
- **Provider Whitelist** — Only allowed providers accepted in provider key creation
- **GDPR Data Export** — Download all personal data as JSON via `/api/settings/export`

## User Suspension

- **Suspend Users** — Admin can suspend users with optional reason
- **Unsuspend Users** — Restore access via admin panel
- **Login Blocking** — Suspended users rejected at login with "Account suspended" error
- **Force Logout** — Admin can force-logout any user by setting `sessionInvalidatedAt`
- **Password Reset** — Admin can reset user password

## Admin Impersonation

- **Start Impersonation** — Admin can impersonate any non-suspended user; creates 15-minute scoped JWT
- **Exit Impersonation** — Return to admin session; restores original admin JWT
- **Visual Indicator** — Yellow impersonation banner with exit button
- **Write Protection** — Middleware blocks destructive operations during impersonation (read-only mode)
- **Audit Trail** — Both start and end events logged with actor, target, and metadata
- **Webhook Events** — `admin.impersonation.started` and `admin.impersonation.ended` dispatched

## Feature Flags

- **Flag Management** — CRUD API at `/api/admin/flags`
- **Rollout Controls** — Per-flag `enabled` toggle, `rolloutPercent` (0-100), `allowedUserIds` and `allowedPlanIds`
- **Hash-Based Bucketing** — Deterministic user bucketing via hash of userId + flag key
- **Seed Endpoint** — `/api/admin/flags/seed` bootstraps default flags
- **Feature Gate Constants** — Predefined flag keys in `src/lib/feature-gates.ts`
- **Admin UI** — Flag management at `/admin/flags` with toggle switches and rollout configuration

## Announcements

- **Announcement CRUD** — Title, body, type (info/warning/critical), target role (all/admin)
- **User-Facing Banners** — Dismissible announcement banners in dashboard layout
- **Dismissal Tracking** — Per-user dismissals; dismissed announcements don't reappear
- **Expiration** — Optional `expiresAt`; expired announcements auto-hidden
- **Admin UI** — Management at `/admin/announcements`

## System Configuration

- **Key-Value Config Store** — `SystemConfig` model for runtime configuration
- **Default Values** — Typed defaults for maintenance mode, rate limits, and other settings
- **Admin UI** — Configuration at `/admin/system`

## Finance Controls

- **Finance Dashboard** — Admin overview at `/admin/finance` with revenue summary
- **Credit System** — `CreditTransaction` model tracks credit additions/deductions per user
- **Pricing Multiplier** — Per-user `pricingMultiplier` (default 1.0) for custom pricing tiers
- **Finance Summary** — Platform-wide revenue metrics
- **User Finance List** — Per-user spend, credits, and plan info

## Plan Management

- **Plan CRUD** — Define request limits, key limits, team member limits, log retention, and rate limits
- **Plan Assignment** — Assign plans to users or organizations
- **Plan Enforcement** — Quota checks before resource creation
- **Seed Endpoint** — `/api/admin/plans/seed` bootstraps Free/Pro/Enterprise plans
- **Admin UI** — Plan management at `/admin/plans`
- **Pricing View** — `/api/admin/pricing` returns current model pricing table

## Super Admin Panel

- **Role-Based Access** — `SUPER_ADMIN` role on User model; stored in JWT
- **Hidden Admin Routes** — All `/admin/*` routes return 404 (not 403) to non-admins
- **Dedicated Layout** — Environment banner (DEVELOPMENT/STAGING/PRODUCTION), admin sidebar, SUPER ADMIN badge
- **Admin Dashboard** — Platform-wide KPIs: total users, requests, cost, active keys; provider breakdown; top spenders
- **User Management** — Paginated user list with search, role toggle, user deletion with cascade; user detail at `/admin/users/[id]`
- **Key Management** — Platform-wide view of all keys with enable/disable toggle; key revocation
- **Global Logs** — Platform-wide request logs with filters; CSV export
- **CLI Tools** — `pnpm admin:promote <email>` and `pnpm admin:demote <email>`
- **Admin Link in Sidebar** — SUPER_ADMIN users see "Admin Panel" link
- **Admin Org Management** — View, suspend, unsuspend organizations at `/admin/orgs`
- **Global Search** — `/api/admin/search` searches users, keys, and orgs
- **Admin Rate Limiting** — In-memory rate limiter for admin API routes
- **Admin IP Restriction** — `ADMIN_IP_ALLOWLIST` env var restricts access; CIDR support
- **Admin Inactivity Timeout** — Middleware enforces session timeout
- **Health Check** — `/api/admin/health` and public `/api/health` endpoints
- **Incident Response** — `/api/admin/incident/leaked-key` for leaked key emergencies; revokes key and notifies user
- **Breadcrumb Navigation** — Contextual breadcrumbs on admin pages
- **Admin Settings** — Dedicated settings at `/admin/settings`

## Cost Tracking

Per-request cost calculation with pricing per 1M tokens:

| Provider | Model | Input | Output |
|----------|-------|-------|--------|
| OpenAI | gpt-4o | $2.50 | $10.00 |
| OpenAI | gpt-4o-mini | $0.15 | $0.60 |
| OpenAI | gpt-4-turbo | $10.00 | $30.00 |
| Anthropic | claude-3-5-sonnet | $3.00 | $15.00 |
| Anthropic | claude-3-5-haiku | $0.80 | $4.00 |
| Anthropic | claude-3-opus | $15.00 | $75.00 |
| Google | gemini-1.5-pro | $1.25 | $5.00 |
| Google | gemini-1.5-flash | $0.075 | $0.30 |
| Google | gemini-2.0-flash | $0.10 | $0.40 |
| Mistral | mistral-large-latest | $2.00 | $6.00 |
| Mistral | mistral-small-latest | $0.20 | $0.60 |
| Mistral | codestral-latest | $0.20 | $0.60 |

## Infrastructure

- **Error Boundaries** — Root and dashboard error boundaries catch and display errors gracefully
- **Loading Skeletons** — Dashboard loading skeleton shown during page transitions
- **Performance Indexes** — Database indexes on PlatformKey.keyPrefix, RequestLog(platformKeyId, createdAt), RequestLog(platformKeyId, costUsd)
- **Full-Text Search Indexes** — Database indexes on RequestLog prompt and response fields
- **Vercel Configuration** — `vercel.json` with maxDuration (60s for proxy), memory allocation (1024MB for dashboard/admin stats), cron schedule for key rotation

## Tech Stack

- Next.js 15 (App Router), TypeScript, Tailwind CSS v4
- Prisma ORM + PostgreSQL 16 (Docker locally, Neon serverless in production)
- NextAuth v5 (credentials provider, JWT sessions)
- Vercel AI SDK v4 (openai, anthropic, google, mistral)
- Recharts for charts
- shadcn/ui components (base-nova style, dark mode)
- Resend for transactional emails
- otpauth for TOTP/MFA
- Deployed on Vercel with Neon Postgres
