#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const KEYHUB_URL = (process.env.KEYHUB_URL ?? "http://localhost:3000").replace(
  /\/$/,
  ""
);
const KEYHUB_API_KEY = process.env.KEYHUB_API_KEY ?? "";
const KEYHUB_SESSION_TOKEN = process.env.KEYHUB_SESSION_TOKEN ?? "";

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

/** Call the KeyHub OpenAI-compatible proxy (uses platform API key). */
async function proxyFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${KEYHUB_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${KEYHUB_API_KEY}`,
      ...(options.headers as Record<string, string> | undefined),
    },
  });
}

/** Call an internal KeyHub dashboard/management API (uses session cookie). */
async function dashboardFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${KEYHUB_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Cookie: `authjs.session-token=${KEYHUB_SESSION_TOKEN}`,
      ...(options.headers as Record<string, string> | undefined),
    },
  });
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "keyhub",
  version: "0.1.0",
});

// ---- Tool: chat ----
server.tool(
  "keyhub_chat",
  "Send a chat completion through KeyHub's multi-provider AI gateway. Supports OpenAI, Anthropic, Google, and Mistral models. Use provider/model format (e.g. openai/gpt-4o, anthropic/claude-3-5-sonnet-20241022).",
  {
    model: z
      .string()
      .describe(
        'Model ID in provider/model format, e.g. "openai/gpt-4o" or "anthropic/claude-3-5-sonnet-20241022"'
      ),
    messages: z
      .array(
        z.object({
          role: z.enum(["system", "user", "assistant"]),
          content: z.string(),
        })
      )
      .describe("Array of chat messages"),
    temperature: z
      .number()
      .min(0)
      .max(2)
      .optional()
      .describe("Sampling temperature (0-2)"),
    max_tokens: z
      .number()
      .optional()
      .describe("Maximum tokens to generate"),
    tag: z
      .string()
      .optional()
      .describe("Optional tag for analytics grouping (max 64 chars)"),
  },
  async ({ model, messages, temperature, max_tokens, tag }) => {
    try {
      const headers: Record<string, string> = {};
      if (tag) headers["X-KeyHub-Tag"] = tag;

      const body: Record<string, unknown> = { model, messages };
      if (temperature !== undefined) body.temperature = temperature;
      if (max_tokens !== undefined) body.max_tokens = max_tokens;

      const res = await proxyFetch("/api/v1/chat/completions", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        return { content: [{ type: "text" as const, text: `Error ${res.status}: ${err}` }] };
      }

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content ?? "(no content)";
      const usage = data.usage;

      let text = reply;
      if (usage) {
        text += `\n\n---\nTokens: ${usage.prompt_tokens ?? 0} in / ${usage.completion_tokens ?? 0} out | Model: ${data.model}`;
      }

      return { content: [{ type: "text" as const, text }] };
    } catch (e: unknown) {
      return {
        content: [{ type: "text" as const, text: `Request failed: ${e instanceof Error ? e.message : String(e)}` }],
      };
    }
  }
);

// ---- Tool: list_models ----
server.tool(
  "keyhub_list_models",
  "List all AI models available through your KeyHub instance, grouped by provider.",
  {},
  async () => {
    try {
      const res = await proxyFetch("/api/v1/models");
      if (!res.ok) {
        return { content: [{ type: "text" as const, text: `Error ${res.status}: ${await res.text()}` }] };
      }
      const data = await res.json();
      const models = (data.data ?? []) as Array<{ id: string; owned_by?: string }>;

      if (models.length === 0) {
        return { content: [{ type: "text" as const, text: "No models available. Add provider keys in KeyHub first." }] };
      }

      const grouped: Record<string, string[]> = {};
      for (const m of models) {
        const provider = m.owned_by ?? "unknown";
        if (!grouped[provider]) grouped[provider] = [];
        grouped[provider].push(m.id);
      }

      let text = "# Available Models\n\n";
      for (const [provider, ids] of Object.entries(grouped)) {
        text += `## ${provider}\n`;
        for (const id of ids) text += `- ${id}\n`;
        text += "\n";
      }
      return { content: [{ type: "text" as const, text }] };
    } catch (e: unknown) {
      return {
        content: [{ type: "text" as const, text: `Request failed: ${e instanceof Error ? e.message : String(e)}` }],
      };
    }
  }
);

// ---- Tool: get_dashboard ----
server.tool(
  "keyhub_dashboard",
  "Get KeyHub dashboard metrics: total spend, request count, average latency, active keys, cost forecasting, and provider breakdown.",
  {
    days: z
      .number()
      .min(1)
      .max(90)
      .optional()
      .default(30)
      .describe("Number of days to look back (default: 30)"),
  },
  async ({ days }) => {
    try {
      const res = await dashboardFetch(`/api/dashboard?days=${days}`);
      if (!res.ok) {
        return { content: [{ type: "text" as const, text: `Error ${res.status}: ${await res.text()}` }] };
      }
      const d = await res.json();

      let text = `# KeyHub Dashboard (${days} days)\n\n`;
      text += `| Metric | Value |\n|---|---|\n`;
      text += `| Total Spend | $${Number(d.totalSpend ?? 0).toFixed(4)} |\n`;
      text += `| Total Requests | ${d.totalRequests ?? 0} |\n`;
      text += `| Avg Latency | ${d.avgLatency ?? 0}ms |\n`;
      text += `| P95 Latency | ${d.p95Latency ?? 0}ms |\n`;
      text += `| Active Keys | ${d.activeKeys ?? 0} |\n`;
      text += `| Error Rate | ${Number(d.errorRate ?? 0).toFixed(1)}% |\n`;

      if (d.costForecast) {
        text += `\n## Cost Forecast\n`;
        text += `- Projected monthly: $${Number(d.costForecast.projected ?? 0).toFixed(4)}\n`;
        text += `- Daily avg: $${Number(d.costForecast.dailyAvg ?? 0).toFixed(4)}\n`;
        if (d.costForecast.budgetLimit) {
          text += `- Budget limit: $${d.costForecast.budgetLimit}\n`;
          text += `- Budget used: ${Number(d.costForecast.budgetPct ?? 0).toFixed(1)}%\n`;
        }
      }

      if (d.providerBreakdown?.length > 0) {
        text += `\n## Cost by Provider\n`;
        for (const p of d.providerBreakdown) {
          text += `- ${p.provider}: $${Number(p.cost ?? 0).toFixed(4)} (${p.requests ?? 0} requests)\n`;
        }
      }

      if (d.modelBreakdown?.length > 0) {
        text += `\n## Cost by Model\n`;
        for (const m of d.modelBreakdown) {
          text += `- ${m.model}: $${Number(m.cost ?? 0).toFixed(4)} (${m.requests ?? 0} requests)\n`;
        }
      }

      return { content: [{ type: "text" as const, text }] };
    } catch (e: unknown) {
      return {
        content: [{ type: "text" as const, text: `Request failed: ${e instanceof Error ? e.message : String(e)}` }],
      };
    }
  }
);

// ---- Tool: get_logs ----
server.tool(
  "keyhub_logs",
  "Get recent API request logs from KeyHub with filtering. Shows model, status, tokens, cost, and latency per request.",
  {
    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(20)
      .describe("Number of logs to return (default: 20)"),
    status: z
      .enum(["all", "success", "error"])
      .optional()
      .default("all")
      .describe("Filter by status"),
    model: z
      .string()
      .optional()
      .describe("Filter by model name (partial match)"),
    search: z
      .string()
      .optional()
      .describe("Full-text search across prompts and responses"),
  },
  async ({ limit, status, model, search }) => {
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (status && status !== "all") params.set("status", status);
      if (model) params.set("model", model);
      if (search) params.set("search", search);

      const res = await dashboardFetch(`/api/logs?${params}`);
      if (!res.ok) {
        return { content: [{ type: "text" as const, text: `Error ${res.status}: ${await res.text()}` }] };
      }
      const data = await res.json();
      const logs = data.logs ?? data ?? [];

      if (logs.length === 0) {
        return { content: [{ type: "text" as const, text: "No logs found matching your criteria." }] };
      }

      let text = `# Request Logs (${logs.length} results)\n\n`;
      text += `| Time | Model | Status | Tokens | Cost | Latency |\n`;
      text += `|---|---|---|---|---|---|\n`;

      for (const log of logs) {
        const time = new Date(log.createdAt).toLocaleString();
        const tokens = `${log.promptTokens ?? 0}/${log.completionTokens ?? 0}`;
        const cost = `$${Number(log.costUsd ?? 0).toFixed(6)}`;
        const latency = `${log.latencyMs ?? 0}ms`;
        text += `| ${time} | ${log.model ?? "?"} | ${log.status ?? "?"} | ${tokens} | ${cost} | ${latency} |\n`;
      }

      return { content: [{ type: "text" as const, text }] };
    } catch (e: unknown) {
      return {
        content: [{ type: "text" as const, text: `Request failed: ${e instanceof Error ? e.message : String(e)}` }],
      };
    }
  }
);

// ---- Tool: get_usage ----
server.tool(
  "keyhub_usage",
  "Get usage analytics from KeyHub — spending trends, top models, and request patterns over time.",
  {
    days: z
      .number()
      .min(1)
      .max(90)
      .optional()
      .default(30)
      .describe("Number of days to look back (default: 30)"),
  },
  async ({ days }) => {
    try {
      const res = await dashboardFetch(`/api/usage?days=${days}`);
      if (!res.ok) {
        return { content: [{ type: "text" as const, text: `Error ${res.status}: ${await res.text()}` }] };
      }
      const data = await res.json();

      let text = `# Usage Analytics (${days} days)\n\n`;

      if (data.summary) {
        text += `## Summary\n`;
        text += `- Total requests: ${data.summary.totalRequests ?? 0}\n`;
        text += `- Total cost: $${Number(data.summary.totalCost ?? 0).toFixed(4)}\n`;
        text += `- Total tokens: ${Number(data.summary.totalTokens ?? 0).toLocaleString()}\n`;
      }

      if (data.daily?.length > 0) {
        text += `\n## Daily Breakdown\n`;
        text += `| Date | Requests | Cost | Tokens |\n|---|---|---|---|\n`;
        for (const d of data.daily.slice(-14)) {
          text += `| ${d.date} | ${d.requests ?? 0} | $${Number(d.cost ?? 0).toFixed(4)} | ${Number(d.tokens ?? 0).toLocaleString()} |\n`;
        }
      }

      return { content: [{ type: "text" as const, text }] };
    } catch (e: unknown) {
      return {
        content: [{ type: "text" as const, text: `Request failed: ${e instanceof Error ? e.message : String(e)}` }],
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  if (!KEYHUB_API_KEY && !KEYHUB_SESSION_TOKEN) {
    console.error(
      "Warning: Neither KEYHUB_API_KEY nor KEYHUB_SESSION_TOKEN is set.\n" +
        "Set KEYHUB_API_KEY for chat/models tools, KEYHUB_SESSION_TOKEN for dashboard/logs/usage tools.\n" +
        "See https://github.com/your-org/keyhub#mcp-server for setup instructions."
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
