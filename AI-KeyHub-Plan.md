# AI KeyHub — Complete Technical Plan

## Vision

A self-hosted OpenRouter alternative. Users register, store their provider API keys securely, generate virtual platform keys, and use a single OpenAI-compatible endpoint to access any AI model. Full usage tracking, cost metrics, and prompt logs per user.

---

## Architecture Overview

```
User's App / curl / SDK
        ↓
  POST /api/v1/chat/completions
  Authorization: Bearer ak-user-xxxxxxxx  ← Virtual Platform Key
        ↓
  ┌─────────────────────────────────────┐
  │           AI KeyHub Proxy           │
  │  1. Verify platform key (hash)      │
  │  2. Parse model: "openai/gpt-4o"    │
  │  3. Look up user's provider key     │
  │  4. Decrypt key (AES-256)           │
  │  5. Forward via Vercel AI SDK       │
  │  6. Stream response back            │
  │  7. Log: tokens, cost, latency      │
  └─────────────────────────────────────┘
        ↓
  Real Provider (OpenAI / Anthropic / etc.)
```

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| AI Proxy | Vercel AI SDK (`ai` package) |
| Auth | NextAuth v5 (credentials) |
| Database | PostgreSQL 16 (Docker) |
| ORM | Prisma |
| Encryption | AES-256-GCM (Node crypto) |
| Key Hashing | bcrypt |
| UI | shadcn/ui + Tailwind CSS |
| Charts | Recharts |
| DevOps | Docker Compose + Makefile |

---

## Project Structure

```
ai-keyhub/
├── Makefile
├── docker-compose.yml
├── Dockerfile
├── .env.example
│
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
│
└── src/
    ├── app/
    │   │
    │   ├── (auth)/
    │   │   ├── login/page.tsx
    │   │   └── register/page.tsx
    │   │
    │   ├── (dashboard)/
    │   │   ├── layout.tsx
    │   │   ├── dashboard/page.tsx       ← Overview + metrics
    │   │   ├── provider-keys/page.tsx   ← Add/manage real API keys
    │   │   ├── platform-keys/page.tsx   ← Virtual keys for your apps
    │   │   ├── logs/page.tsx            ← Prompt logs (pass/fail)
    │   │   ├── usage/page.tsx           ← Spend charts
    │   │   ├── docs/page.tsx            ← Personalized usage docs
    │   │   └── settings/page.tsx
    │   │
    │   └── api/
    │       ├── auth/[...nextauth]/route.ts
    │       │
    │       ├── v1/                        ← PUBLIC PROXY (uses platform key)
    │       │   ├── chat/completions/route.ts   ← OpenAI-compatible
    │       │   ├── stream/route.ts
    │       │   └── models/route.ts
    │       │
    │       ├── keys/
    │       │   ├── provider/route.ts     ← CRUD provider keys
    │       │   └── platform/route.ts     ← CRUD platform keys
    │       │
    │       └── logs/route.ts
    │
    ├── lib/
    │   ├── prisma.ts
    │   ├── encryption.ts          ← AES-256 encrypt/decrypt
    │   ├── platform-key.ts        ← generate + hash virtual keys
    │   ├── providers.ts           ← provider SDK map
    │   ├── model-routing.ts       ← parse "openai/gpt-4o"
    │   └── cost-calculator.ts     ← tokens → USD
    │
    └── components/
        ├── dashboard/
        ├── keys/
        ├── logs/
        └── ui/                    ← shadcn components
```

---

## Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Users ────────────────────────────────────────

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  name         String?
  createdAt    DateTime @default(now())

  providerKeys ProviderKey[]
  platformKeys PlatformKey[]
  logs         RequestLog[]
  usageSummary UsageSummary[]
}

// ─── Provider Keys (real API keys stored encrypted) ──

model ProviderKey {
  id           String   @id @default(cuid())
  userId       String
  provider     String   // "openai" | "anthropic" | "gemini" | "mistral" | "groq"
  label        String   // "My OpenAI key"
  encryptedKey String   // AES-256-GCM encrypted
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())

  user User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  logs RequestLog[]

  @@unique([userId, provider])   // one active key per provider per user
}

// ─── Platform Keys (virtual keys user gives to their apps) ──

model PlatformKey {
  id         String    @id @default(cuid())
  userId     String
  label      String              // "Production App", "Staging"
  keyHash    String    @unique   // bcrypt hash — plaintext never stored
  keyPrefix  String              // "ak-user-xK9m" — shown for identification
  isActive   Boolean   @default(true)
  lastUsedAt DateTime?
  createdAt  DateTime  @default(now())

  user User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  logs RequestLog[]
}

// ─── Request Logs ────────────────────────────────────

model RequestLog {
  id               String   @id @default(cuid())
  userId           String
  platformKeyId    String
  providerKeyId    String
  provider         String   // "openai"
  model            String   // "gpt-4o"
  promptTokens     Int      @default(0)
  completionTokens Int      @default(0)
  totalTokens      Int      @default(0)
  costUsd          Float    @default(0)
  status           String   // "success" | "failed"
  errorMessage     String?
  latencyMs        Int      @default(0)
  prompt           String   @db.Text
  response         String?  @db.Text
  createdAt        DateTime @default(now())

  user        User        @relation(fields: [userId], references: [id])
  platformKey PlatformKey @relation(fields: [platformKeyId], references: [id])
  providerKey ProviderKey @relation(fields: [providerKeyId], references: [id])

  @@index([userId, createdAt])
  @@index([userId, provider])
  @@index([userId, status])
}

// ─── Usage Aggregation (daily rollup) ────────────────

model UsageSummary {
  id        String   @id @default(cuid())
  userId    String
  provider  String
  model     String
  date      DateTime @db.Date
  requests  Int      @default(0)
  tokens    Int      @default(0)
  costUsd   Float    @default(0)
  failedReqs Int     @default(0)

  user User @relation(fields: [userId], references: [id])

  @@unique([userId, provider, model, date])
  @@index([userId, date])
}
```

---

## Platform Key System

### Generation
```typescript
// lib/platform-key.ts
import { randomBytes } from 'crypto'
import bcrypt from 'bcrypt'

export function generatePlatformKey(): { raw: string; prefix: string; hash: string } {
  const raw = 'ak-user-' + randomBytes(24).toString('base64url')
  const prefix = raw.slice(0, 16) + '…'   // "ak-user-xK9mP2…" shown in dashboard
  const hash = bcrypt.hashSync(raw, 12)
  return { raw, prefix, hash }
}

export async function verifyPlatformKey(raw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(raw, hash)
}
```

### Key shown ONCE on creation
- Generated → shown to user once in modal: **"Copy this key — it won't be shown again"**
- Only `keyHash` + `keyPrefix` stored in DB
- Identical behavior to GitHub Personal Access Tokens

---

## Provider Key Encryption

```typescript
// lib/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const SECRET = Buffer.from(process.env.KEY_ENCRYPTION_SECRET!, 'hex') // 32 bytes

export function encryptKey(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, SECRET, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return JSON.stringify({
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    data: encrypted.toString('hex')
  })
}

export function decryptKey(ciphertext: string): string {
  const { iv, tag, data } = JSON.parse(ciphertext)
  const decipher = createDecipheriv(ALGORITHM, SECRET, Buffer.from(iv, 'hex'))
  decipher.setAuthTag(Buffer.from(tag, 'hex'))
  return decipher.update(Buffer.from(data, 'hex')) + decipher.final('utf8')
}
```

---

## Model Routing

```typescript
// lib/model-routing.ts
// User sends model: "anthropic/claude-3-5-sonnet"

export function parseModel(model: string): { provider: string; modelId: string } {
  const [provider, ...rest] = model.split('/')
  if (!rest.length) throw new Error(`Invalid model format. Use "provider/model-name"`)
  return { provider, modelId: rest.join('/') }
}
```

---

## Provider SDK Map

```typescript
// lib/providers.ts
import { createOpenAI }              from '@ai-sdk/openai'
import { createAnthropic }           from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI }  from '@ai-sdk/google'
import { createMistral }             from '@ai-sdk/mistral'
import { createGroq }                from '@ai-sdk/groq'

export const PROVIDERS = {
  openai:    (key: string) => createOpenAI({ apiKey: key }),
  anthropic: (key: string) => createAnthropic({ apiKey: key }),
  google:    (key: string) => createGoogleGenerativeAI({ apiKey: key }),
  mistral:   (key: string) => createMistral({ apiKey: key }),
  groq:      (key: string) => createGroq({ apiKey: key }),
} as const

export type ProviderName = keyof typeof PROVIDERS
```

---

## The Proxy Route (Core)

```typescript
// app/api/v1/chat/completions/route.ts
import { streamText } from 'ai'
import { parseModel } from '@/lib/model-routing'
import { decryptKey } from '@/lib/encryption'
import { PROVIDERS } from '@/lib/providers'
import { calculateCost } from '@/lib/cost-calculator'
import prisma from '@/lib/prisma'

export async function POST(req: Request) {
  const start = Date.now()

  // 1. Extract + verify platform key
  const authHeader = req.headers.get('Authorization')
  const rawKey = authHeader?.replace('Bearer ', '')
  if (!rawKey) return Response.json({ error: 'Missing API key' }, { status: 401 })

  // Find key by prefix, then verify hash
  const prefix = rawKey.slice(0, 16)
  const platformKey = await prisma.platformKey.findFirst({
    where: { keyPrefix: { startsWith: prefix }, isActive: true },
    include: { user: true }
  })
  if (!platformKey || !(await verifyPlatformKey(rawKey, platformKey.keyHash))) {
    return Response.json({ error: 'Invalid API key' }, { status: 401 })
  }

  const { model, messages } = await req.json()

  // 2. Parse model string "openai/gpt-4o"
  const { provider, modelId } = parseModel(model)

  // 3. Get user's provider key
  const providerKey = await prisma.providerKey.findFirst({
    where: { userId: platformKey.userId, provider, isActive: true }
  })
  if (!providerKey) {
    return Response.json(
      { error: `No ${provider} key found. Add one in your dashboard.` },
      { status: 400 }
    )
  }

  // 4. Decrypt
  const apiKey = decryptKey(providerKey.encryptedKey)

  // 5. Build provider instance
  const createProvider = PROVIDERS[provider as keyof typeof PROVIDERS]
  const providerInstance = createProvider(apiKey)

  // 6. Stream via Vercel AI SDK
  let promptTokens = 0, completionTokens = 0, status = 'success', errorMessage = null

  try {
    const result = await streamText({
      model: providerInstance(modelId),
      messages,
      onFinish: ({ usage }) => {
        promptTokens = usage.promptTokens
        completionTokens = usage.completionTokens
      }
    })

    // 7. Log (fire and forget)
    result.text.then(async (responseText) => {
      const costUsd = calculateCost(modelId, promptTokens, completionTokens)
      await prisma.requestLog.create({
        data: {
          userId: platformKey.userId,
          platformKeyId: platformKey.id,
          providerKeyId: providerKey.id,
          provider, model: modelId,
          promptTokens, completionTokens,
          totalTokens: promptTokens + completionTokens,
          costUsd, status: 'success',
          latencyMs: Date.now() - start,
          prompt: JSON.stringify(messages),
          response: responseText,
        }
      })
      await prisma.platformKey.update({
        where: { id: platformKey.id },
        data: { lastUsedAt: new Date() }
      })
    })

    return result.toDataStreamResponse()

  } catch (err: any) {
    await prisma.requestLog.create({
      data: {
        userId: platformKey.userId,
        platformKeyId: platformKey.id,
        providerKeyId: providerKey.id,
        provider, model: modelId,
        promptTokens: 0, completionTokens: 0, totalTokens: 0,
        costUsd: 0, status: 'failed',
        errorMessage: err.message,
        latencyMs: Date.now() - start,
        prompt: JSON.stringify(messages),
      }
    })
    return Response.json({ error: err.message }, { status: 500 })
  }
}
```

---

## Cost Calculator

```typescript
// lib/cost-calculator.ts
// Prices in USD per 1M tokens
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI
  'gpt-4o':               { input: 2.50,  output: 10.00 },
  'gpt-4o-mini':          { input: 0.15,  output: 0.60  },
  'gpt-4-turbo':          { input: 10.00, output: 30.00 },
  'o1':                   { input: 15.00, output: 60.00 },
  'o1-mini':              { input: 3.00,  output: 12.00 },
  // Anthropic
  'claude-3-5-sonnet-20241022': { input: 3.00,  output: 15.00 },
  'claude-3-5-haiku-20241022':  { input: 0.80,  output: 4.00  },
  'claude-3-opus-20240229':     { input: 15.00, output: 75.00 },
  // Google
  'gemini-1.5-pro':       { input: 1.25,  output: 5.00  },
  'gemini-1.5-flash':     { input: 0.075, output: 0.30  },
  'gemini-2.0-flash':     { input: 0.10,  output: 0.40  },
  // Mistral
  'mistral-large-latest': { input: 2.00,  output: 6.00  },
  'mistral-small-latest': { input: 0.20,  output: 0.60  },
  'codestral-latest':     { input: 0.20,  output: 0.60  },
  // Groq (inference cost, not model cost)
  'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },
  'mixtral-8x7b-32768':      { input: 0.24, output: 0.24 },
}

export function calculateCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = MODEL_PRICING[model]
  if (!pricing) return 0
  return (promptTokens / 1_000_000) * pricing.input
       + (completionTokens / 1_000_000) * pricing.output
}
```

---

## GET /api/v1/models

Returns all models available based on which provider keys the user has added:

```typescript
// app/api/v1/models/route.ts
const PROVIDER_MODELS = {
  openai:    ['openai/gpt-4o', 'openai/gpt-4o-mini', 'openai/gpt-4-turbo', 'openai/o1', 'openai/o1-mini'],
  anthropic: ['anthropic/claude-3-5-sonnet', 'anthropic/claude-3-5-haiku', 'anthropic/claude-3-opus'],
  google:    ['google/gemini-1.5-pro', 'google/gemini-1.5-flash', 'google/gemini-2.0-flash'],
  mistral:   ['mistral/mistral-large', 'mistral/mistral-small', 'mistral/codestral'],
  groq:      ['groq/llama-3.3-70b', 'groq/mixtral-8x7b'],
}

// Returns only models for providers the user has an active key for
```

---

## Supported Providers

| Provider | Models | Vercel AI SDK Package |
|---|---|---|
| OpenAI | gpt-4o, gpt-4o-mini, gpt-4-turbo, o1, o1-mini | `@ai-sdk/openai` |
| Anthropic | claude-3-5-sonnet, claude-3-5-haiku, claude-3-opus | `@ai-sdk/anthropic` |
| Google | gemini-1.5-pro, gemini-1.5-flash, gemini-2.0-flash | `@ai-sdk/google` |
| Mistral | mistral-large, mistral-small, codestral | `@ai-sdk/mistral` |
| Groq | llama-3.3-70b, mixtral-8x7b | `@ai-sdk/groq` |
| Ollama | any local model | `@ai-sdk/ollama` *(Phase 2)* |

---

## Dashboard Pages

### `/dashboard` — Overview
- Total spend this month
- Total requests today
- Success rate (%)
- Requests per day — last 30 days chart
- Cost per provider — breakdown
- Top models used (by request count)

### `/provider-keys` — Real API Keys
- List per provider: label, masked key (`sk-...xxxx`), status
- Add key: pick provider → paste key → save (encrypted immediately)
- Toggle active/inactive
- Delete key
- Warning if no key for a provider

### `/platform-keys` — Virtual Keys for Your Apps
- List: label, prefix, created, last used, status
- Create new key → **shown once modal** → copy + confirm
- Revoke / delete
- Each key has its own usage stats (requests, spend)

### `/logs` — Prompt Logs
- Table: timestamp, provider, model, tokens, cost ($), status, latency
- Status badge: ✅ success / ❌ failed
- Filter by: provider, model, status, platform key, date range
- Click row → drawer with full prompt + response
- Export as CSV

### `/usage` — Metrics & Charts
- Spend by provider (bar chart)
- Spend over time (line chart, daily)
- Token usage per model (pie)
- Requests per day
- Daily / weekly / monthly toggle
- Cost table: model → requests, tokens, total spend

### `/docs` — Built-in Usage Docs
- Personalized with user's platform key pre-filled
- Code examples in: Node.js, Python, curl, Vercel AI SDK
- Model list (only models they have keys for)
- Copy button on all snippets

---

## How Users Connect

### Base URL
```
https://yourapp.com/api/v1
```

### Authentication
Users create a **Platform Key** in the dashboard, then use it as `Bearer` token:
```
Authorization: Bearer ak-user-xK9mP2nR8qLvBt...
```

### OpenAI SDK (Node.js) — zero code change needed
```javascript
import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: 'ak-user-YOUR_PLATFORM_KEY',
  baseURL: 'https://yourapp.com/api/v1'
})

const res = await client.chat.completions.create({
  model: 'anthropic/claude-3-5-sonnet',  // ← provider/model
  messages: [{ role: 'user', content: 'Hello!' }]
})
```

### OpenAI SDK (Python)
```python
from openai import OpenAI

client = OpenAI(
  api_key="ak-user-YOUR_PLATFORM_KEY",
  base_url="https://yourapp.com/api/v1"
)

response = client.chat.completions.create(
  model="google/gemini-1.5-pro",
  messages=[{"role": "user", "content": "Hello!"}]
)
```

### Vercel AI SDK
```typescript
import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'

const keyhub = createOpenAI({
  apiKey: 'ak-user-YOUR_PLATFORM_KEY',
  baseURL: 'https://yourapp.com/api/v1'
})

const { text } = await generateText({
  model: keyhub('anthropic/claude-3-5-sonnet'),
  prompt: 'Hello!'
})
```

### Raw curl
```bash
curl https://yourapp.com/api/v1/chat/completions \
  -H "Authorization: Bearer ak-user-YOUR_PLATFORM_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

---

## Docker + Makefile Setup

### `docker-compose.yml`
```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: keyhub
      POSTGRES_PASSWORD: keyhub
      POSTGRES_DB: keyhub
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U keyhub"]
      interval: 5s
      timeout: 5s
      retries: 5

  app:
    build: .
    ports:
      - "3000:3000"
    env_file: .env
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - .:/app
      - /app/node_modules
      - /app/.next

volumes:
  pgdata:
```

### `Makefile`
```makefile
.PHONY: dev up down db-migrate db-reset db-studio db-seed install build logs help

help:
	@echo ""
	@echo "  make install      Install dependencies"
	@echo "  make dev          Start Postgres + run migrations + start Next.js"
	@echo "  make up           Start Docker services only"
	@echo "  make down         Stop Docker services"
	@echo "  make build        Build Docker image"
	@echo "  make db-migrate   Run Prisma migrations"
	@echo "  make db-reset     Reset DB (destructive!)"
	@echo "  make db-studio    Open Prisma Studio"
	@echo "  make db-seed      Seed DB with test data"
	@echo "  make logs         Tail Postgres logs"
	@echo ""

install:
	npm install

up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build

dev: up
	@echo "Waiting for Postgres..."
	@sleep 2
	npx prisma migrate dev
	npm run dev

db-migrate:
	npx prisma migrate dev

db-reset:
	npx prisma migrate reset --force

db-studio:
	npx prisma studio

db-seed:
	npx tsx prisma/seed.ts

logs:
	docker compose logs -f postgres

generate:
	npx prisma generate
```

### Developer onboarding (3 commands)
```bash
git clone https://github.com/you/ai-keyhub
cp .env.example .env        # fill in NEXTAUTH_SECRET and KEY_ENCRYPTION_SECRET
make dev                     # everything starts
```

---

## `.env.example`

```env
# Database
DATABASE_URL="postgresql://keyhub:keyhub@localhost:5432/keyhub"

# NextAuth
NEXTAUTH_SECRET=""          # openssl rand -base64 32
NEXTAUTH_URL="http://localhost:3000"

# AES-256 key for encrypting provider keys (64 hex chars = 32 bytes)
KEY_ENCRYPTION_SECRET=""    # openssl rand -hex 32
```

---

## Security Model

| Threat | Mitigation |
|---|---|
| Provider key leaked from DB | AES-256-GCM encryption at rest |
| Platform key stolen | bcrypt hashed — plaintext never stored |
| Unauthorized API access | Platform key verified on every request |
| Key exposure in logs | Keys never appear in request logs |
| Prompt injection | User's data sandboxed per account |
| DB dump | Provider keys useless without `KEY_ENCRYPTION_SECRET` |

---

## Build Phases

### Phase 1 — Foundation (Week 1–2)
- [ ] Docker Compose + Postgres + Makefile
- [ ] Prisma schema + migrations
- [ ] NextAuth register / login
- [ ] Provider key CRUD (add/list/delete/toggle, encrypted)
- [ ] Platform key generation (show once, hash stored)
- [ ] Proxy route: OpenAI only + logging

### Phase 2 — Full Proxy (Week 3)
- [ ] All 5 providers (Anthropic, Google, Mistral, Groq)
- [ ] `GET /api/v1/models` — returns models per user's keys
- [ ] Cost calculation per request
- [ ] Request log table with filters
- [ ] Full prompt/response viewer (click-to-expand)

### Phase 3 — Dashboard (Week 4)
- [ ] Overview page with KPIs
- [ ] Usage charts (Recharts): spend/time, tokens/model, requests/day
- [ ] Daily usage aggregation
- [ ] `/docs` page with personalized code examples

### Phase 4 — Polish (Week 5+)
- [ ] Export logs as CSV
- [ ] Budget alerts (email when spend > threshold)
- [ ] Per-platform-key usage breakdown
- [ ] Ollama support (local models)
- [ ] Rate limiting per platform key
