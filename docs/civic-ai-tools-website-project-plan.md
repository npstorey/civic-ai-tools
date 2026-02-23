# civic-ai-tools-website Project Plan

A demo website that showcases the value of MCP (Model Context Protocol) servers for civic data queries by showing side-by-side comparisons of LLM responses with and without MCP.

---

## Immediate Next Steps

### Before Creating the Website Repo

1. **Finish opengov-mcp edge case fix** (in progress in separate terminal)
   - Fix `type=metadata` parameter issue
   - Investigate `type=metrics` 404 error

2. **Create accounts/credentials:**
   - [ ] Create OpenRouter account at [openrouter.ai](https://openrouter.ai)
   - [ ] Add ~$20 credits to start
   - [ ] Create GitHub OAuth application at [github.com/settings/developers](https://github.com/settings/developers)
     - Homepage URL: `http://localhost:3000` (update for production later)
     - Callback URL: `http://localhost:3000/api/auth/callback/github`

3. **Create the civic-ai-tools-website repo:**
   ```bash
   # Create new repo on GitHub, then:
   cd ~/Code
   git clone https://github.com/npstorey/civic-ai-tools-website.git
   cd civic-ai-tools-website

   # Copy this plan
   cp ~/Code/civic-ai-tools/docs/civic-ai-tools-website-project-plan.md ./PROJECT_PLAN.md
   ```

4. **Initialize the project:**
   ```bash
   npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
   npm install next-auth @vercel/kv openai
   ```

### After Website MVP is Working

5. **(Optional) Add stdio transport to opengov-mcp-server**
   - Currently only supports HTTP transport
   - Claude Code and Cursor may need stdio for local use
   - Could add a CLI flag: `--transport=stdio|http`

---

## Project Goals

### Primary Goal
Demonstrate the tangible value of MCP by letting users see the difference between:
- **Without MCP:** LLM responding to civic data questions with only its training data
- **With MCP:** Same LLM + opengov-mcp-server accessing live Socrata open data

### Secondary Goals
- Drive interested developers to the civic-ai-tools GitHub repo to set up MCP locally
- Provide a succinct technical explanation of MCP and how it works
- Serve as a proof-of-concept for the civic-ai-tools ecosystem

### Non-Goals
- This is NOT meant for heavy production use
- Not trying to replace local MCP setups (Claude Code, Cursor, etc.)
- Not a general-purpose LLM chat interface

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    civic-ai-tools-website                    │
│                    (Next.js on Vercel)                       │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    Frontend                           │   │
│  │  - Homepage with query input + demo video            │   │
│  │  - Model selector dropdown                           │   │
│  │  - Side-by-side comparison display                   │   │
│  │  - Technical explainer page                          │   │
│  └──────────────────────────────────────────────────────┘   │
│                            │                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              API Routes (Serverless)                  │   │
│  │  POST /api/compare     - Run comparison               │   │
│  │  GET  /api/models      - List available models        │   │
│  │  GET  /api/rate-limit  - Check user's remaining quota │   │
│  │  /api/auth/[...nextauth] - GitHub OAuth               │   │
│  └──────────────────────────────────────────────────────┘   │
│                            │                                 │
└────────────────────────────┼─────────────────────────────────┘
                             │
           ┌─────────────────┼─────────────────┐
           │                 │                 │
           ▼                 ▼                 ▼
    ┌─────────────┐  ┌─────────────────┐  ┌─────────────┐
    │ OpenRouter  │  │ opengov-mcp     │  │ Vercel KV   │
    │ (LLM API)   │  │ (Render.com)    │  │ (Rate Limit)│
    │             │  │                 │  │             │
    │ 300+ models │  │ Socrata portal  │  │ Redis store │
    │ One API     │  │ access          │  │             │
    └─────────────┘  └─────────────────┘  └─────────────┘
```

---

## Technical Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Frontend | Next.js 14+ (App Router) | Best DX, Vercel integration, React Server Components |
| Hosting | Vercel (free tier) | Generous free tier, serverless functions included |
| LLM API | OpenRouter | Single API for 300+ models, user can select model, pay-as-you-go |
| MCP Server | opengov-mcp-server on Render.com ($7/mo) | Already deployed and working |
| Auth | NextAuth.js + GitHub OAuth | Simple, developer-friendly, no password management |
| Rate Limiting | Vercel KV (Upstash Redis) | Serverless-compatible, generous free tier |
| Styling | Tailwind CSS | Fast development, consistent design |

---

## Core Feature: The Comparison Flow

### How It Works

1. **User enters a civic data question**
   - Example: "What are the most common 311 complaints in San Francisco this year?"

2. **User selects a model**
   - Curated list: Claude 3.5 Sonnet, GPT-4o, GPT-4o-mini, Llama 3.1 70B
   - Same model used for both comparisons (fair comparison)

3. **Website makes two parallel API calls:**

   **Call A: Without MCP**
   ```
   POST to OpenRouter
   - model: user-selected
   - messages: [{ role: "user", content: user_query }]
   - tools: [] (none)
   ```

   **Call B: With MCP**
   ```
   POST to OpenRouter
   - model: user-selected
   - messages: [{ role: "user", content: user_query }]
   - tools: [opengov-mcp tool definitions]

   If model calls a tool:
   → Backend calls opengov-mcp-server
   → Returns tool result to model
   → Model generates final response
   ```

4. **Display results side-by-side**
   - Left panel: "Without MCP" response
   - Right panel: "With MCP" response
   - Show which tools were called (if any)
   - Show response time for each

### Expected Behavior

| Query Type | Without MCP | With MCP |
|------------|-------------|----------|
| Current data question | "I don't have access to current data..." or hallucinated/outdated info | Actual data from Socrata portal |
| Historical question | May have training data | Fresh data from API |
| Specific dataset query | Cannot access | Searches and returns real results |

---

## API Design

### POST /api/compare

**Request:**
```json
{
  "query": "What are the top 10 most common 311 complaints in San Francisco?",
  "model": "anthropic/claude-3.5-sonnet",
  "portal": "data.sfgov.org"
}
```

**Response:**
```json
{
  "withoutMcp": {
    "content": "I don't have access to real-time 311 data...",
    "duration_ms": 1200,
    "tokens_used": 150
  },
  "withMcp": {
    "content": "Based on current 311 data from San Francisco...",
    "duration_ms": 3400,
    "tokens_used": 450,
    "tools_called": [
      {
        "name": "search_datasets",
        "args": { "query": "311 complaints" }
      },
      {
        "name": "query_dataset",
        "args": { "dataset_id": "abc123", "query": "..." }
      }
    ]
  }
}
```

### GET /api/models

**Response:**
```json
{
  "models": [
    {
      "id": "anthropic/claude-3.5-sonnet",
      "name": "Claude 3.5 Sonnet",
      "provider": "Anthropic",
      "supports_tools": true
    },
    {
      "id": "openai/gpt-4o",
      "name": "GPT-4o",
      "provider": "OpenAI",
      "supports_tools": true
    }
  ]
}
```

### GET /api/rate-limit

**Response:**
```json
{
  "remaining": 3,
  "limit": 5,
  "resets_at": "2026-01-15T00:00:00Z",
  "authenticated": false
}
```

---

## Rate Limiting Strategy

| User Type | Daily Limit | Tracking Method |
|-----------|-------------|-----------------|
| Anonymous | 5 requests | IP address + localStorage fingerprint |
| GitHub authenticated | 25 requests | GitHub user ID |

### Implementation Details

- Use Vercel KV (Upstash Redis) for atomic counters
- Key format: `rate:{user_id_or_ip}:{YYYY-MM-DD}`
- TTL: 48 hours (auto-cleanup)
- Check rate limit BEFORE making expensive API calls

### Cost Protection

- Set monthly budget cap in OpenRouter: $30
- When budget exhausted: Show maintenance message or fallback to free models only
- Monitor usage via OpenRouter dashboard

---

## Authentication

### GitHub OAuth Flow

1. User clicks "Sign in with GitHub"
2. Redirect to GitHub authorization
3. GitHub redirects back with code
4. Exchange code for access token
5. Create session, store in cookie

### Why GitHub?

- Target audience is developers
- No password management needed
- Simple NextAuth.js integration
- Free

### Session Data

```typescript
interface Session {
  user: {
    id: string;        // GitHub user ID
    name: string;
    email: string;
    image: string;     // GitHub avatar
  }
}
```

---

## File Structure

```
civic-ai-tools-website/
├── app/
│   ├── page.tsx                      # Homepage
│   ├── layout.tsx                    # Root layout with nav
│   ├── compare/
│   │   └── page.tsx                  # Comparison results (could be same page)
│   ├── about/
│   │   └── page.tsx                  # Technical explainer
│   ├── api/
│   │   ├── compare/
│   │   │   └── route.ts              # Main comparison endpoint
│   │   ├── models/
│   │   │   └── route.ts              # Available models
│   │   ├── rate-limit/
│   │   │   └── route.ts              # Rate limit status
│   │   └── auth/
│   │       └── [...nextauth]/
│   │           └── route.ts          # NextAuth handlers
│   └── globals.css
├── components/
│   ├── Header.tsx                    # Navigation + auth status
│   ├── QueryForm.tsx                 # Query input + model selector
│   ├── ComparisonDisplay.tsx         # Side-by-side results
│   ├── ResponsePanel.tsx             # Single response with metadata
│   ├── ToolCallsList.tsx             # Show which MCP tools were used
│   ├── RateLimitBanner.tsx           # Show remaining requests
│   ├── DemoVideo.tsx                 # Embedded demo video
│   └── LoadingSpinner.tsx
├── lib/
│   ├── openrouter.ts                 # OpenRouter API client
│   ├── mcp/
│   │   ├── client.ts                 # MCP client for opengov-mcp
│   │   └── tools.ts                  # Tool definitions for OpenRouter
│   ├── rate-limit.ts                 # Rate limiting helpers
│   └── auth.ts                       # NextAuth configuration
├── public/
│   ├── demo-video.mp4                # Demo video (or YouTube embed)
│   └── og-image.png                  # Social sharing image
├── .env.example
├── .env.local                        # Local secrets (gitignored)
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

---

## Environment Variables

```bash
# .env.example

# OpenRouter
OPENROUTER_API_KEY=sk-or-...

# opengov-mcp-server
OPENGOV_MCP_URL=https://opengov-mcp-server.onrender.com

# GitHub OAuth (create at github.com/settings/developers)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# NextAuth
NEXTAUTH_SECRET=       # Generate with: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000   # Update for production

# Vercel KV (auto-populated if using Vercel KV)
KV_URL=
KV_REST_API_URL=
KV_REST_API_TOKEN=
KV_REST_API_READ_ONLY_TOKEN=
```

---

## Phased Implementation

### Phase 1: MVP (Core Comparison)

**Goal:** Working comparison with minimal features

**Tasks:**
1. Initialize Next.js project with TypeScript and Tailwind
2. Create basic homepage with query input form
3. Implement `/api/compare` endpoint
   - OpenRouter integration (without MCP)
   - OpenRouter + tool calling (with MCP)
   - Connect to opengov-mcp-server
4. Build side-by-side comparison display
5. Add simple IP-based rate limiting (5/day)
6. Deploy to Vercel
7. Test end-to-end flow

**Models for MVP:**
- Start with just GPT-4o-mini (cheaper for testing)
- Expand to full list in Phase 2

**Deliverable:** Working demo at civic-ai-tools-website.vercel.app

---

### Phase 2: Authentication & Polish

**Goal:** Add auth, model selection, better UX

**Tasks:**
1. Set up NextAuth.js with GitHub provider
2. Implement tiered rate limiting (5 anon / 25 auth)
3. Add model selector dropdown
4. Create rate limit status banner
5. Build "About MCP" explainer page
6. Add loading states and error handling
7. Record and embed demo video
8. Add social sharing metadata (OG tags)

**Deliverable:** Polished demo ready for sharing

---

### Phase 3: Enhancements (Future)

**Goal:** Extended functionality

**Tasks:**
1. Add datacommons-mcp support (second MCP server)
2. Add portal selector (SF, Chicago, NYC, etc.)
3. Query history for authenticated users
4. Analytics dashboard (internal)
5. Mobile responsiveness improvements

---

## Key Implementation Details

### OpenRouter Tool Calling

OpenRouter supports function/tool calling with an OpenAI-compatible API:

```typescript
// lib/openrouter.ts
import OpenAI from 'openai';

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Without MCP
async function queryWithoutMcp(query: string, model: string) {
  const response = await openrouter.chat.completions.create({
    model,
    messages: [{ role: 'user', content: query }],
  });
  return response.choices[0].message.content;
}

// With MCP (tool calling)
async function queryWithMcp(query: string, model: string) {
  const response = await openrouter.chat.completions.create({
    model,
    messages: [{ role: 'user', content: query }],
    tools: opengovMcpTools, // Tool definitions
  });

  // Handle tool calls if any
  if (response.choices[0].message.tool_calls) {
    // Execute tools via opengov-mcp-server
    // Return results to model for final response
  }

  return response.choices[0].message.content;
}
```

### MCP Tool Definitions

Map opengov-mcp-server tools to OpenRouter function schemas:

```typescript
// lib/mcp/tools.ts
export const opengovMcpTools = [
  {
    type: 'function',
    function: {
      name: 'search_datasets',
      description: 'Search for datasets on a Socrata open data portal',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          portal: { type: 'string', description: 'Portal domain' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_dataset',
      description: 'Fetch data from a specific dataset',
      parameters: {
        type: 'object',
        properties: {
          dataset_id: { type: 'string' },
          portal: { type: 'string' },
          limit: { type: 'number' },
        },
        required: ['dataset_id'],
      },
    },
  },
  // ... other tools from opengov-mcp
];
```

### Calling opengov-mcp-server

The opengov-mcp-server already supports HTTP transport via the `/mcp` endpoint using SSE (Server-Sent Events). It uses the MCP SDK's `StreamableHTTPServerTransport`.

**Available tools on the server:**
- `get_data` - Unified Socrata access (search, fetch, query, metadata)
- `search` - Search NYC Open Data
- `fetch` - Fetch a specific dataset document

**Option A: Use OpenRouter's tool calling (Recommended)**

Let OpenRouter handle the tool calling flow. When the model decides to call a tool, intercept and execute it:

```typescript
// lib/mcp/client.ts
const MCP_URL = process.env.OPENGOV_MCP_URL; // e.g., https://opengov-mcp-server.onrender.com

export async function callMcpTool(name: string, args: object) {
  // The server expects JSON-RPC format via the /mcp endpoint
  const response = await fetch(`${MCP_URL}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name, arguments: args }
    }),
  });

  // Parse SSE response
  const text = await response.text();
  // Extract JSON from SSE format: "event: message\ndata: {...}\n\n"
  const match = text.match(/data:\s*(.+)/);
  if (match) {
    return JSON.parse(match[1]);
  }
  throw new Error('Failed to parse MCP response');
}
```

**Option B: MCP SDK Client (Alternative)**

Use the official MCP SDK for a cleaner integration:

```typescript
// lib/mcp/client.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

let client: Client | null = null;

export async function getMcpClient() {
  if (!client) {
    const transport = new SSEClientTransport(
      new URL(`${process.env.OPENGOV_MCP_URL}/mcp`)
    );
    client = new Client({ name: 'civic-ai-tools-website', version: '1.0.0' });
    await client.connect(transport);
  }
  return client;
}

export async function callMcpTool(name: string, args: object) {
  const c = await getMcpClient();
  return c.callTool({ name, arguments: args });
}
```

**Note:** The server currently only supports HTTP transport. For local Claude Code/Cursor usage, stdio transport would need to be added to opengov-mcp-server as a future enhancement.

---

## Cost Estimates

### Monthly Operating Costs

| Service | Cost | Notes |
|---------|------|-------|
| Vercel | $0 | Free tier (100GB bandwidth, 100 hours serverless) |
| OpenRouter | $20-50 | Budget cap; depends on usage |
| opengov-mcp (Render) | $7 | Already paid |
| Vercel KV | $0 | Free tier (30k requests/month) |
| **Total** | **~$30-60/month** | |

### Per-Comparison Cost (OpenRouter)

| Model | Approx. Cost per Comparison |
|-------|---------------------------|
| GPT-4o-mini | $0.001-0.005 |
| GPT-4o | $0.01-0.05 |
| Claude 3.5 Sonnet | $0.01-0.03 |
| Llama 3.1 70B | $0.002-0.01 |

At 5 free requests/day for anonymous users and 25/day for auth users:
- Worst case (all GPT-4o): ~$15/month for 500 comparisons
- Likely case (mixed models): ~$5-10/month

---

## Prerequisites Checklist

Before starting development:

- [x] Fix opengov-mcp get_data edge cases (in progress)
- [x] Verify opengov-mcp-server HTTP transport works - ✅ Confirmed! Uses `/mcp` endpoint with SSE
- [ ] Create OpenRouter account and add credits (~$20 to start)
- [ ] Create GitHub OAuth application (github.com/settings/developers)
- [ ] Create civic-ai-tools-website repo on GitHub
- [ ] Initialize Next.js project with TypeScript + Tailwind
- [ ] Set up Vercel project linked to repo
- [ ] (Optional) Set up Vercel KV for rate limiting (can use localStorage for MVP)

---

## Open Questions

1. ~~**opengov-mcp HTTP transport**~~ ✅ RESOLVED - Server already supports HTTP/SSE via `/mcp` endpoint

2. **Default portal** - Should queries default to a specific Socrata portal (e.g., data.sfgov.org) or require user to specify? (Server currently defaults to NYC Open Data - may want to make configurable)

3. **Demo video** - Record screencast or hire someone? What scenarios to demonstrate?

4. **Domain** - Use default Vercel subdomain or custom domain?

5. **stdio transport for local tools** - Claude Code and Cursor typically use stdio transport. The opengov-mcp-server currently only supports HTTP. Consider adding stdio support later so users can run the server locally with Claude Code. This is NOT a blocker for the website.

---

## Success Metrics

- Users complete a comparison (not just visit)
- Users click through to GitHub repo
- Low bounce rate on comparison results
- Positive feedback / shares

---

## References

- [OpenRouter Documentation](https://openrouter.ai/docs)
- [NextAuth.js](https://next-auth.js.org/)
- [Vercel KV](https://vercel.com/docs/storage/vercel-kv)
- [MCP SDK (TypeScript)](https://github.com/modelcontextprotocol/typescript-sdk)
- [civic-ai-tools repo](https://github.com/npstorey/civic-ai-tools)
