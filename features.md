# KeyHub - Features

## Authentication & User Management

- **User Registration** — Create account with email, name, and password (bcrypt hashed, 12 rounds)
- **User Login** — Credentials-based authentication with JWT sessions (NextAuth v5)
- **Route Protection** — Middleware redirects unauthenticated users to login; logged-in users skip auth pages
- **Settings Page** — View profile info and security details
- **Edit Profile** — Update display name from settings; saves to database and refreshes JWT session immediately without re-login; save button disabled when unchanged; network errors caught with toast feedback and loading state always resets via finally block *(additionally upgraded)*
- **Change Password** — Update account password from settings with current password verification, client-side validation (min 8 chars, match confirmation), and bcrypt hashing (12 rounds); network errors caught with toast feedback; safe JSON parse on error responses prevents crash on non-JSON server errors *(additionally upgraded)*
- **Delete Account** — Permanently delete account and all associated data (provider keys, platform keys, request logs, usage history) from settings; requires password confirmation via AlertDialog; transaction-based cascade deletion respects FK constraints; auto sign-out and redirect to login on success; network errors caught with toast feedback and button re-enabled on failure *(additionally upgraded)*

## Key Management

### Provider Keys (Real AI API Keys)

- **Add/Update** provider API keys for OpenAI, Anthropic, Google, Mistral
- **AES-256-GCM encryption** — Keys are encrypted at rest, never stored in plaintext
- **One key per provider** per user (upsert behavior)
- **Toggle active/inactive** status with loading spinner and error handling; shows toast on network or server errors; reverts on failure *(additionally upgraded)*
- **Delete** provider keys with response validation and loading spinner on confirmation button; error toast on failure; disabled button prevents double-click *(additionally upgraded)*
- **Test connection** — Verify API key validity by pinging the provider's models endpoint; shows success/failure with response latency *(additionally upgraded)*
- **Key rotation tracking** — `rotationReminderDays` and `lastRotatedAt` fields on provider keys for rotation reminder support *(additionally upgraded)*
- **Usage stats per key** — Each provider key card displays total request count, total cost, and last used date; helps identify which provider keys drive the most spend *(additionally upgraded)*

### Platform Keys (Virtual API Keys)

- **Generate** virtual API keys (`ak-user-` prefix + 24 random chars) with server-side input validation: labels are trimmed (rejects whitespace-only), rate limit must be >= 1 RPM (rejects zero/negative/NaN), expiration date must be in the future and valid (rejects past dates and invalid formats); PATCH also validates rate limit positivity; descriptive 400 error messages for each field *(additionally upgraded)*
- **Shown once** — Only the bcrypt hash and prefix are stored
- **Toggle active/inactive** status with loading spinner and error handling; shows toast on network or server errors; reverts on failure *(additionally upgraded)*
- **Delete** platform keys with response validation and loading spinner on confirmation button; error toast on failure; disabled button prevents double-click *(additionally upgraded)*
- **Edit key settings** — Update label, rate limit, and expiration date on existing platform keys via edit dialog; supports removing rate limit or expiration by clearing the field *(additionally upgraded)*
- **Usage tracking** — Request count and last used timestamp per key
- **Rate limiting** — Optional per-key requests-per-minute (RPM) limit; returns HTTP 429 with `Retry-After` header when exceeded *(additionally upgraded)*
- **Key expiration** — Optional expiration date per platform key; expired keys return HTTP 403 and are visually marked in red; keys expiring within 7 days show yellow warning badge with countdown (e.g. "3d left") and AlertTriangle icon for proactive renewal *(additionally upgraded)*

## AI Completions Proxy

### Chat Completions (`POST /api/v1/chat/completions`)

- **OpenAI-compatible** API endpoint — drop-in replacement for OpenAI SDK
- **Bearer token auth** — Authenticate with platform keys
- **Multi-provider routing** — Model format: `provider/model-name`
- **Streaming responses** — Real-time token streaming via Vercel AI SDK
- **Supported providers:**
  - OpenAI (gpt-4o, gpt-4o-mini, gpt-4-turbo, o1, o1-mini)
  - Anthropic (claude-3-5-sonnet, claude-3-5-haiku, claude-3-opus)
  - Google (gemini-1.5-pro, gemini-1.5-flash, gemini-2.0-flash)
  - Mistral (mistral-large-latest, mistral-small-latest, codestral-latest)
- **Request body validation** — Validates model is a non-empty string; messages must be a non-empty array (max 256); each message must be an object with a valid role (user, assistant, system, tool) and non-null content; returns 400 with descriptive per-field error messages including array index; prevents malformed requests from reaching providers *(additionally upgraded)*
- **Per-request cost calculation** based on token pricing
- **Full request logging** — Provider, model, tokens, cost, latency, prompt, response
- **Pre-flight cost estimation** — Estimates request cost before sending to provider; rejects requests exceeding per-key `maxCostPerRequest` ceiling *(additionally upgraded)*
- **Budget enforcement** — Checks account-level and per-key budgets before forwarding; returns HTTP 429 with reset date when exceeded *(additionally upgraded)*
- **Fallback routing** — Automatic failover to alternative providers on error; uses model mapping for cross-provider equivalence *(additionally upgraded)*
- **Retry with backoff** — Configurable retries with exponential backoff and jitter on transient errors; per-key `maxRetries` override *(additionally upgraded)*
- **Load balancing** — Routes to provider keys using round-robin, least-latency, or random strategy based on platform key config *(additionally upgraded)*
- **Rate limit headers** — Returns X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset headers on every response *(additionally upgraded)*
- **Request tracing** — X-Request-ID header for end-to-end request tracing; stored in request logs *(additionally upgraded)*
- **Per-request tagging** — X-KeyHub-Tag header for categorizing requests (e.g. by feature or team) *(additionally upgraded)*
- **Template injection** — X-KeyHub-Template header to inject a saved prompt template as system message *(additionally upgraded)*
- **IP enforcement** — CIDR-aware IP allowlist check per platform key *(additionally upgraded)*
- **Key scoping enforcement** — Provider restrictions, model restrictions checked before routing *(additionally upgraded)*
- **Anomaly detection** — Post-request anomaly checks trigger alerts on volume/cost spikes *(additionally upgraded)*

### Models List (`GET /api/v1/models`)

- **OpenAI-compatible** response format
- Returns available models based on user's active provider keys

## Dashboard & Analytics

### Dashboard Page

- **Error handling with retry** — Validates API response status, catches network errors, and displays a centered error card with message and retry button instead of a blank page; time range selector remains accessible during error state for quick recovery *(additionally upgraded)*
- **Time Range Selector** — Dropdown to switch between 7d, 14d, 30d, and 90d views; dynamically updates all KPI cards, charts, and provider breakdown; KPI labels reflect the selected range *(additionally upgraded)*
- **Monthly Spend** — Total cost from start of current month
- **Today's Requests** — Request count since midnight
- **Total Requests** — 30-day request count
- **Success Rate** — Percentage of successful requests (30d)
- **Avg Latency** — Average response latency across all requests (30d), displayed in milliseconds with cyan accent; "Avg Latency per Day" line chart shows daily latency trends *(additionally upgraded)*
- **Requests per Day** — Bar chart
- **Daily Cost** — Line chart
- **Avg Latency per Day** — Line chart (cyan) showing daily average latency trends
- **Cost by Provider** — Horizontal bar chart
- **Recent Activity** — Compact table showing the last 5 API requests with model, provider, status badge, token count, cost, and relative timestamp (e.g. "3h ago"); "View all" link navigates to the full Logs page; always shows the most recent requests regardless of the time range selector *(additionally upgraded)*

### Usage Page

- **Error handling with retry** — Validates API response status, catches network errors, and displays a centered error card with message and retry button instead of a blank page; time range selector remains accessible during error state *(additionally upgraded)*
- **Time Range Selector** — Dropdown to switch between 7d, 14d, 30d, and 90d views; dynamically updates all charts, tables, and breakdowns on the usage page; consistent with the dashboard time range selector *(additionally upgraded)*
- **Spend over time** — Line chart
- **Requests per day** — Bar chart
- **Cost by provider** — Donut chart
- **Requests by provider** — Bar chart
- **Provider summary table** — Request count, total cost, avg cost per request
- **Cost by model** — Horizontal bar chart of cost per model (color-coded) + summary table with provider, requests, tokens, and cost per model; helps identify most expensive models for cost optimization (30-day rolling window) *(additionally upgraded)*
- **Model performance comparison** — Per-model performance table showing average latency (cyan), error rate (red when non-zero), average cost per request, and total cost alongside request counts; helps users compare models on speed, reliability, and cost efficiency; respects time range selector *(additionally upgraded)*
- **Tokens per day** — Full-width stacked area chart showing daily input (cyan) and output (lime) token consumption over time; header displays aggregate totals (total, input, output) with color-coded labels; Y-axis uses `k` suffix for thousands; respects time range selector *(additionally upgraded)*
- **Latency percentiles** — Latency distribution card showing P50, P90, P95, and P99 response times with proportional horizontal bar visualization; computed from all requests in the selected time range using nearest-rank percentile method; color-coded bars (lime → yellow → cyan) indicate severity; sample count displayed in header *(additionally upgraded)*
- **Usage by API key** — Horizontal bar chart of cost per platform key + summary table with requests, tokens, and cost per key (30-day rolling window) *(additionally upgraded)*

## Request Logs

- **Error handling with retry** — Validates API response status on log fetches, catches network errors, and displays a centered error card with message and retry button instead of crashing or showing infinite loading; platform key filter fetch also validates response and shows toast on failure *(additionally upgraded)*
- **Paginated log table** with provider and status filters
- **Sortable columns** — Click any column header (Time, Provider, Model, Tokens, Cost, Latency, Status) to sort ascending or descending; server-side sorting with whitelisted fields for security; active sort indicated by lime-green arrow; resets to page 1 on sort change; included in clear-all filter reset *(additionally upgraded)*
- **Advanced filtering** — Filter by model (context-aware based on selected provider), date range (from/to), and API key (dropdown populated from user's platform keys); clear-all button resets all filters; API key filter also applies to CSV export *(additionally upgraded)*
- **Detail modal** — Full request metadata (provider, model, status, latency, prompt/completion/total tokens, cost, API key label + prefix, timestamp), prompt, and response; copy-to-clipboard buttons on prompt and response with visual confirmation feedback; JSON prompts are auto-formatted for readability *(additionally upgraded)*
- **Full-text search** — Search through prompt and response content with debounced input (400ms); case-insensitive matching across both fields; integrates with all existing filters and CSV export *(additionally upgraded)*
- **CSV export (full)** — Server-side export of all logs matching current filters (up to 10k rows), not just the current page; includes prompt/completion token breakdown and API key label; respects all active filters (provider, model, status, date range, search) *(additionally upgraded)*

## API Documentation

- **Quick Start setup checklist** — Dynamic 3-step onboarding checklist that shows real-time completion status; each step displays a green checkmark and count when done (e.g. "2 providers configured"), or an action link to the relevant page when pending; progress badge shows "X/3 complete" at a glance; completed steps highlighted with lime green border; loading skeletons shown while fetching setup status and provider keys; validates API responses and shows toast on fetch failure; both fetches run in parallel via Promise.all for faster page load *(additionally upgraded)*
- **Code examples** — curl, Node.js (OpenAI SDK), Python (OpenAI SDK), Vercel AI SDK
- **Available models (dynamic)** — Grouped by provider with live status indicators; shows a green checkmark and "Configured" badge for providers with active keys, dims models for unconfigured providers, and links directly to "Add key" for missing providers *(additionally upgraded)*
- **API endpoint reference**

## Key Scoping *(additionally upgraded)*

- **Provider restrictions** — Restrict platform keys to specific providers (e.g. only OpenAI); enforced in proxy with 403 response
- **Model restrictions** — Restrict platform keys to specific models; enforced in proxy with 403 response
- **Max cost per request** — Optional per-key cost ceiling; pre-flight estimation rejects requests exceeding limit before sending to provider *(additionally upgraded)*
- **IP Allowlisting** — Restrict platform keys to specific IP addresses or CIDR ranges (full CIDR subnet matching via `src/lib/ip-utils.ts`); enforced in proxy with 403 response; "Detect my IP" auto-fill button via `/api/my-ip` *(additionally upgraded)*
- **Restrictions edit dialog** — Multi-select checkboxes for providers, combobox for models filtered by provider, cost input; active restrictions shown as badge chips on key cards *(additionally upgraded)*

## Budget Limits *(additionally upgraded)*

- **Monthly budget** — Set account-level monthly spending limit in Settings; stored in User model
- **Hard cap mode** — Toggle between hard cap (blocks requests at limit) and soft warning; soft cap dispatches webhook alert before allowing request *(additionally upgraded)*
- **Budget alert threshold** — Configurable alert threshold (default 80%) with `budgetAlertThreshold` field; budget check API at `/api/budget/check` *(additionally upgraded)*
- **Budget progress bar** — Dashboard shows color-coded progress: green → yellow (75%) → red (95%)
- **Per-key budget** — Each platform key supports its own budget with configurable period (daily/weekly/monthly); period-aware spend calculation (daily resets at midnight, weekly on Monday, monthly on 1st) *(additionally upgraded)*
- **Proxy enforcement** — Budget check integrated before forwarding to provider; returns HTTP 429 with reset date

## Anomaly Detection *(additionally upgraded)*

- **Statistical detection engine** — Rolling 7-day mean and standard deviation per metric; configurable sigma threshold per user (`anomalyThresholdSigma`, default 3.0) *(additionally upgraded)*
- **Request volume spikes** — Alert when hourly requests exceed mean + Nσ
- **Cost spikes** — Alert when hourly cost exceeds mean + Nσ
- **Error rate monitoring** — Alert when error rate exceeds 50% over last 100 requests
- **Key dominance detection** — Alert when a single key accounts for >90% of requests in an hour
- **Anomaly event persistence** — Events stored with deduplication (1hr window)
- **Notification preferences** — Per-user toggles for email and webhook anomaly notifications (`anomalyNotifyEmail`, `anomalyNotifyWebhook`); unread anomaly count badge in sidebar via `/api/notifications/count` *(additionally upgraded)*
- **Admin alert channels** — Admin-level anomaly alerts via email and optional Slack webhook (`SLACK_WEBHOOK_URL` env var) *(additionally upgraded)*

## Two-Factor Authentication (TOTP) *(additionally upgraded)*

- **TOTP setup** — Generate TOTP secret with QR code via `/api/auth/totp/setup`; uses `otpauth` library for standards-compliant OTP generation *(additionally upgraded)*
- **TOTP verification** — Verify 6-digit code to enable MFA via `/api/auth/totp/verify-setup`; stored as `totpSecret` on User model *(additionally upgraded)*
- **TOTP challenge page** — Dedicated challenge page at `/(auth)/totp` for login flow; middleware redirects users with `requiresTotp` flag *(additionally upgraded)*
- **Backup codes** — 10 single-use backup codes generated on setup; bcrypt hashed in `TotpBackupCode` model; displayed once at setup time *(additionally upgraded)*
- **Brute-force protection** — Failed attempt counter (`totpFailedAttempts`) with lockout (`totpLockedUntil`); auto-lock after repeated failures *(additionally upgraded)*
- **Disable MFA** — Remove TOTP from account via `/api/auth/totp/disable` with password confirmation *(additionally upgraded)*
- **Status check** — `/api/auth/totp/status` endpoint for checking MFA enrollment state *(additionally upgraded)*

## Teams & Organizations *(additionally upgraded)*

- **Organization CRUD** — Create, read, update, delete organizations via `/api/orgs`; unique slug per org *(additionally upgraded)*
- **Role-based membership** — Three roles: OWNER, ADMIN, MEMBER with hierarchy-based permission checks (`src/lib/org-permissions.ts`) *(additionally upgraded)*
- **Member management** — Add/remove members, change roles via `/api/orgs/[id]/members`; owners cannot be demoted *(additionally upgraded)*
- **Invite system** — Token-based invites with expiration via `/api/orgs/[id]/invites`; accept invites at `/api/invites/[token]/accept` *(additionally upgraded)*
- **Org context switching** — Switch active org context via `/api/orgs/switch`; org-scoped provider keys, platform keys, and request logs *(additionally upgraded)*
- **Organization pages** — List view at `/organizations`, detail/settings at `/organizations/[id]`; legacy settings pages at `/settings/organizations` *(additionally upgraded)*
- **Org suspension** — Admin can suspend/unsuspend organizations; suspended flag on Organization model *(additionally upgraded)*

## In-App Playground *(additionally upgraded)*

- **Interactive chat** — Test any model directly inside KeyHub at `/playground`
- **Model selector** — Grouped by provider, only configured providers enabled
- **System prompt** — Collapsible textarea, persisted to localStorage
- **Streaming responses** — Token-by-token rendering with stop button
- **Platform key selector** — Choose which key to charge requests to
- **Temperature & max tokens** — Adjustable parameters for fine-tuning model behavior *(additionally upgraded)*
- **Template selector** — Load saved prompt templates directly into playground system prompt *(additionally upgraded)*
- **Chat sessions** — Persist conversation history to localStorage *(additionally upgraded)*
- **Ctrl+Enter** to send, clear conversation button

## Prompt Templates *(additionally upgraded)*

- **CRUD API** — Create, read, update, delete prompt templates via `/api/templates`
- **System prompt storage** — Save reusable system prompts with name and description
- **Settings page** — Manage templates at `/settings/templates` with create/edit/delete dialogs *(additionally upgraded)*

## Webhooks *(additionally upgraded)*

- **Webhook endpoints** — Register URLs to receive event notifications; management page at `/settings/webhooks` *(additionally upgraded)*
- **HMAC-SHA256 signatures** — Every delivery signed with endpoint secret in `X-KeyHub-Signature` header
- **Event types** — budget.threshold, budget.exhausted, key.expired, key.expiring_soon, anomaly.detected, request.error, admin.impersonation.started, admin.impersonation.ended *(additionally upgraded)*
- **Auto-disable** — Endpoints automatically disabled after 10 consecutive failures
- **Delivery logging** — Status codes and response bodies stored per delivery; delivery history viewable in webhook settings *(additionally upgraded)*
- **Retry with backoff** — Failed deliveries retried up to 3 attempts with exponential backoff *(additionally upgraded)*

## Audit Log *(additionally upgraded)*

- **Audit event table** — Records all security-relevant actions with actor, target, metadata, IP, and user-agent
- **Append-only** — No UPDATE or DELETE routes; audit records are immutable
- **API access** — Paginated query with action type filtering
- **User audit log page** — Personal audit trail at `/settings/audit-log` with filters and CSV export *(additionally upgraded)*
- **Admin audit log** — Platform-wide audit trail at `/admin/audit` with CSV export via `/api/admin/audit/export` *(additionally upgraded)*

## Retry Logic *(additionally upgraded)*

- **Exponential backoff with jitter** — Configurable max retries, base delay, max delay
- **Smart retry** — Only retries on transient errors (429, 500, 502, 503, 504); never on 400, 401, 403
- **Network error handling** — Retries on ECONNRESET and ETIMEDOUT
- **Per-key retry override** — `maxRetries` field on PlatformKey allows per-key retry configuration *(additionally upgraded)*
- **Retry count tracking** — `retryCount` field on RequestLog tracks how many retries were needed *(additionally upgraded)*

## Fallback Routing *(additionally upgraded)*

- **Fallback rules** — Per-platform-key rules that define primary → fallback provider routing when errors occur; configurable trigger status codes *(additionally upgraded)*
- **Model mapping** — Cross-provider model equivalence table (`src/lib/model-mapping.ts`) maps models to equivalent models on other providers (e.g. GPT-4o → Claude 3.5 Sonnet) *(additionally upgraded)*
- **Fallback tracking** — `fallbackUsed`, `originalProvider`, and `fallbackProvider` fields on RequestLog for full traceability *(additionally upgraded)*
- **Priority ordering** — Multiple fallback rules per key with priority field for ordered evaluation *(additionally upgraded)*

## Load Balancing *(additionally upgraded)*

- **Routing strategies** — Three strategies per platform key: round-robin, least-latency, random; configured via `routingStrategy` field *(additionally upgraded)*
- **Weighted selection** — Provider keys have configurable weight (1-10) for weighted round-robin distribution *(additionally upgraded)*
- **Latency tracking** — Exponential moving average latency (`latencyEma`) tracked per provider key for least-latency routing *(additionally upgraded)*
- **Load balancer engine** — `src/lib/load-balancer.ts` implements all three strategies with weighted random and latency-based selection *(additionally upgraded)*

## Request Tracing *(additionally upgraded)*

- **X-Request-ID** — Unique request ID generated per proxy request; stored in `requestId` field on RequestLog; returned in response headers for end-to-end tracing *(additionally upgraded)*
- **X-RateLimit headers** — Rate limit status headers (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset) returned on every proxy response *(additionally upgraded)*
- **Per-request tagging** — `X-KeyHub-Tag` header support for categorizing requests; tag stored on RequestLog and filterable in logs *(additionally upgraded)*
- **X-KeyHub-Template** — Pass prompt template ID via header for automatic template loading in proxy *(additionally upgraded)*
- **Request replay** — Replay any logged request via `/api/logs/[id]/replay` to re-send the same prompt to the same model *(additionally upgraded)*

## Provider Status Page *(additionally upgraded)*

- **Status dashboard** — Real-time provider status at `/status` showing connectivity and latency per configured provider *(additionally upgraded)*
- **Status API** — `/api/status` endpoint returns provider health data based on recent request logs *(additionally upgraded)*

## Advanced Analytics *(additionally upgraded)*

- **What-if cost comparison** — `/api/usage/what-if` endpoint analyzes how costs would change if requests were routed to different models; helps optimize model selection *(additionally upgraded)*
- **Cost forecasting** — Linear regression on daily cost data to project future spending trends *(additionally upgraded)*

## Email Infrastructure *(additionally upgraded)*

- **Resend integration** — Email sending via Resend SDK (`src/lib/email.ts`); falls back to console logging in development when `RESEND_API_KEY` is not set *(additionally upgraded)*
- **Dark-themed HTML templates** — 7 email templates (`src/lib/email-templates.ts`) for budget alerts, anomaly alerts, key rotation reminders, key expiry warnings, welcome emails, password change confirmation, and account deletion notice *(additionally upgraded)*
- **Notification preferences** — Per-user email toggles for budget alerts, anomaly alerts, key rotation, and key expiry (`emailBudgetAlerts`, `emailAnomalyAlerts`, `emailKeyRotation`, `emailKeyExpiry`); managed at `/api/settings/notifications` *(additionally upgraded)*

## Key Rotation Reminders *(additionally upgraded)*

- **Cron endpoint** — `/api/cron/key-rotation` checks all provider keys with `rotationReminderDays` set and sends email reminders when rotation is due *(additionally upgraded)*
- **Rotation tracking** — `lastRotatedAt` timestamp updated on each key upsert; `rotationReminderDays` configurable per key *(additionally upgraded)*

## Security

- **AES-256-GCM** encryption for provider API keys (IV + auth tag + ciphertext)
- **bcrypt** hashing for platform keys and user passwords
- **Keys never appear in logs** — Only hashes and prefixes are stored
- **JWT sessions** — Stateless authentication with role (USER/SUPER_ADMIN); `issuedAt` claim for session invalidation *(additionally upgraded)*
- **Middleware route protection** — Dashboard routes require authentication; admin routes return 404 to non-admins *(additionally upgraded)*
- **Session invalidation** — `sessionInvalidatedAt` field on User; JWT issued before this timestamp is rejected (force-logout) *(additionally upgraded)*
- **CSRF protection** — Token generation and validation via `src/lib/csrf.ts` *(additionally upgraded)*
- **GDPR data export** — Download all personal data (profile, keys, logs, audit events) as JSON via `/api/settings/export` *(additionally upgraded)*

## User Suspension *(additionally upgraded)*

- **Suspend users** — Admin can suspend users via `/api/admin/users/[id]/suspend` with optional reason; sets `suspended`, `suspendedAt`, `suspendReason` fields *(additionally upgraded)*
- **Unsuspend users** — Restore access via `/api/admin/users/[id]/unsuspend` *(additionally upgraded)*
- **Login blocking** — Suspended users are rejected at login with "Account suspended" error *(additionally upgraded)*
- **Force logout** — Admin can force-logout any user via `/api/admin/users/[id]/force-logout` by setting `sessionInvalidatedAt` *(additionally upgraded)*
- **Password reset** — Admin can reset user password via `/api/admin/users/[id]/reset-password` *(additionally upgraded)*

## Admin Impersonation *(additionally upgraded)*

- **Start impersonation** — Admin can impersonate any non-suspended user via `/api/admin/impersonate/[userId]`; creates 15-minute scoped JWT with `impersonating` and `impersonatedBy` claims *(additionally upgraded)*
- **Exit impersonation** — Return to admin session via `/api/admin/impersonate/exit`; restores original admin JWT *(additionally upgraded)*
- **Visual indicator** — Yellow impersonation banner (`src/components/impersonation-banner.tsx`) shown when impersonating with exit button *(additionally upgraded)*
- **Write protection** — Middleware blocks destructive operations during impersonation (read-only mode) *(additionally upgraded)*
- **Audit trail** — Both impersonation start and end events are logged with actor, target, and metadata *(additionally upgraded)*
- **Webhook events** — `admin.impersonation.started` and `admin.impersonation.ended` webhook events dispatched *(additionally upgraded)*

## Feature Flags *(additionally upgraded)*

- **Flag management** — CRUD API at `/api/admin/flags` for creating and managing feature flags *(additionally upgraded)*
- **Rollout controls** — Per-flag `enabled` toggle, `rolloutPercent` (0-100) for gradual rollout, `allowedUserIds` and `allowedPlanIds` for targeted access *(additionally upgraded)*
- **Hash-based bucketing** — Deterministic user bucketing via hash of userId + flag key for consistent rollout (`src/lib/flags.ts`) *(additionally upgraded)*
- **Seed endpoint** — `/api/admin/flags/seed` to bootstrap default feature flags *(additionally upgraded)*
- **Feature gate constants** — Predefined flag keys in `src/lib/feature-gates.ts` for type-safe feature checking *(additionally upgraded)*
- **Admin UI** — Feature flag management page at `/admin/flags` with toggle switches and rollout configuration *(additionally upgraded)*

## Announcements *(additionally upgraded)*

- **Announcement CRUD** — Admin creates announcements via `/api/admin/announcements` with title, body, type (info/warning/critical), and target role (all/admin) *(additionally upgraded)*
- **User-facing banners** — Dismissible announcement banners (`src/components/announcement-banners.tsx`) shown in dashboard layout *(additionally upgraded)*
- **Dismissal tracking** — Per-user dismissals stored in `AnnouncementDismissal` model; dismissed announcements don't reappear *(additionally upgraded)*
- **Expiration** — Optional `expiresAt` field; expired announcements auto-hidden *(additionally upgraded)*
- **Admin UI** — Announcement management at `/admin/announcements` *(additionally upgraded)*

## System Configuration *(additionally upgraded)*

- **Key-value config store** — `SystemConfig` model for runtime configuration; GET/PATCH at `/api/admin/system/config` *(additionally upgraded)*
- **Default values** — `src/lib/system-config.ts` provides typed defaults for maintenance mode, rate limits, and other system settings *(additionally upgraded)*
- **Admin UI** — System configuration page at `/admin/system` *(additionally upgraded)*

## Finance Controls *(additionally upgraded)*

- **Finance dashboard** — Admin finance overview at `/admin/finance` with revenue summary, user list, and credit management *(additionally upgraded)*
- **Credit system** — `CreditTransaction` model tracks credit additions/deductions per user; ledger at `/api/admin/finance/credits` *(additionally upgraded)*
- **Pricing multiplier** — Per-user `pricingMultiplier` (default 1.0) for custom pricing tiers; managed via `/api/admin/finance/override-pricing/[userId]` *(additionally upgraded)*
- **Finance summary** — `/api/admin/finance/summary` returns platform-wide revenue metrics *(additionally upgraded)*
- **User finance list** — `/api/admin/finance/users` shows per-user spend, credits, and plan info *(additionally upgraded)*

## Plan Management *(additionally upgraded)*

- **Plan CRUD** — Create, read, update, delete plans via `/api/admin/plans`; each plan defines request limits, key limits, team member limits, log retention, and rate limits *(additionally upgraded)*
- **Plan assignment** — Assign plans to users via `/api/admin/users/[id]/assign-plan` or orgs via `/api/admin/orgs/[id]/assign-plan` *(additionally upgraded)*
- **Plan enforcement** — `src/lib/plan-limits.ts` checks plan quotas (platform keys, provider keys, team members, requests per month) before allowing resource creation *(additionally upgraded)*
- **Seed endpoint** — `/api/admin/plans/seed` bootstraps default Free/Pro/Enterprise plans *(additionally upgraded)*
- **Admin UI** — Plan management at `/admin/plans` with create/edit dialogs *(additionally upgraded)*
- **Pricing read-only view** — `/api/admin/pricing` returns current model pricing table *(additionally upgraded)*

## Super Admin Panel *(additionally upgraded)*

- **Role-based access** — `SUPER_ADMIN` role enum on User model; stored in JWT for server-side verification
- **Hidden admin routes** — All `/admin/*` routes return 404 (not 403) to non-admins
- **Dedicated layout** — Separate admin layout with environment banner (DEVELOPMENT/STAGING/PRODUCTION), admin sidebar, and SUPER ADMIN badge
- **Admin dashboard** — Platform-wide KPIs: total users, requests, cost, active keys; provider breakdown; top spenders
- **User management** — Paginated user list with search, role toggle (promote/demote), and user deletion with cascade; user detail page at `/admin/users/[id]` *(additionally upgraded)*
- **Key management** — Platform-wide view of all provider and platform keys with enable/disable toggle; key revocation via `/api/admin/keys/revoke` *(additionally upgraded)*
- **Global logs** — Platform-wide request logs with provider and status filters; CSV export via `/api/admin/logs/export` *(additionally upgraded)*
- **CLI tools** — `pnpm admin:promote <email>` and `pnpm admin:demote <email>` for managing admin access
- **Admin link in sidebar** — SUPER_ADMIN users see "Admin Panel" link in the main app sidebar
- **Admin org management** — View, suspend, unsuspend, and manage organizations at `/admin/orgs`; org detail at `/admin/orgs/[id]` *(additionally upgraded)*
- **Global search** — `/api/admin/search` searches users, keys, and orgs across the platform *(additionally upgraded)*
- **Admin rate limiting** — In-memory rate limiter (`src/lib/admin-rate-limit.ts`) for admin API routes to prevent abuse *(additionally upgraded)*
- **Admin IP restriction** — `ADMIN_IP_ALLOWLIST` env var restricts admin panel access to specific IPs; CIDR support *(additionally upgraded)*
- **Admin inactivity timeout** — Middleware enforces session timeout for admin routes *(additionally upgraded)*
- **Health check** — `/api/admin/health` endpoint for monitoring *(additionally upgraded)*
- **Incident response** — `/api/admin/incident/leaked-key` endpoint to handle leaked key emergencies; revokes key and notifies user *(additionally upgraded)*
- **Breadcrumb navigation** — Admin pages display contextual breadcrumbs (`src/components/admin-breadcrumb.tsx`) *(additionally upgraded)*
- **Admin settings** — Dedicated admin settings page at `/admin/settings` *(additionally upgraded)*

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

## Tech Stack

- Next.js 15 (App Router), TypeScript, Tailwind CSS v4
- Prisma ORM + PostgreSQL 16
- NextAuth v5 (credentials provider, JWT sessions)
- Vercel AI SDK v4 (openai, anthropic, google, mistral)
- Recharts for charts
- shadcn/ui components (base-nova style, dark mode)
- Resend for transactional emails *(additionally upgraded)*
- otpauth for TOTP/MFA *(additionally upgraded)*
