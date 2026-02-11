# Cortex Enterprise

AI-powered enterprise assistant running entirely on **Claude Code** with **Opus 4.6**.
Same relay pattern as [claude-telegram-relay](https://github.com/godagoo/claude-telegram-relay)
but built for enterprise channels (Slack, Teams, Webhooks) with team-based agent routing.

## Architecture

```
  Slack / Teams / Webhooks
            │
            ▼
    ┌───────────────────┐
    │   Cortex Relay    │  src/relay.ts
    │   (port 18789)    │
    │                   │
    │   Router ─────────┤  src/router.ts
    │   │               │
    │   ├─ Code Team    │  /team code
    │   ├─ DevOps Team  │  /team devops
    │   ├─ SAP Team     │  /team sap
    │   ├─ Security     │  /team security
    │   └─ Research     │  /team research
    └────────┬──────────┘
             │
             ▼
    Claude Code CLI (Opus 4.6)
             │
    Supabase (persistent memory)
```

## How It Works

Same three-step pattern as the Telegram relay:

1. **Listen** for messages from enterprise channels (via Slack Bolt / Bot Framework / HTTP)
2. **Spawn** Claude Code CLI with enriched context (profile, memory, team prompt)
3. **Send** the response back to the channel

Claude Code gives you full power: tools, MCP servers, web search, file access, browser automation.
Not just a model — an AI with hands.

## Quick Start

### Prerequisites

- Node.js 22+
- Claude Code CLI (`npm install -g @anthropic-ai/claude-code`)
- Anthropic subscription (Claude Max / Team / Enterprise) — just run `claude login`

### Option A: Guided Setup (Recommended)

```bash
git clone https://github.com/your-org/cortex-enterprise.git
cd cortex-enterprise
claude
```

Claude Code reads `CLAUDE.md` and walks you through setup conversationally:
1. Install dependencies
2. Set API key
3. Configure enterprise profile
4. Test the relay
5. Connect channels (Slack, Teams)
6. Set up persistent memory (Supabase)
7. Enable proactive features (check-ins, briefings)

### Option B: Manual Setup

```bash
git clone https://github.com/your-org/cortex-enterprise.git
cd cortex-enterprise
npm run setup              # Install deps, create .env
# Edit .env with ANTHROPIC_API_KEY
npm start                  # Start the relay
```

## Commands

```bash
# Run
npm start                  # Start the relay
npm run dev                # Start with auto-reload

# Setup & Testing
npm run setup              # Install dependencies, create .env
npm run setup:verify       # Full health check

# Proactive Features
npm run checkin            # Smart check-in (schedule with cron)
npm run briefing           # Morning briefing (schedule with cron)
```

## Project Structure

```
cortex-enterprise/
├── CLAUDE.md                        # Guided setup (Claude Code reads this)
├── package.json                     # Dependencies and scripts
├── .env.example                     # Environment template
├── src/
│   ├── relay.ts                     # Core relay — spawns Claude CLI
│   ├── router.ts                    # Team agent routing
│   ├── memory.ts                    # Persistent memory (Supabase)
│   └── channels/
│       ├── slack.ts                 # Slack adapter (Bolt + Socket Mode)
│       ├── teams.ts                 # Teams adapter (Bot Framework)
│       └── webhook.ts               # Webhook HTTP server
├── configs/
│   ├── enterprise-config.yaml       # Enterprise gateway config
│   └── sap-config.yaml              # SAP-focused gateway config
├── config/
│   └── profile.example.md           # Enterprise profile template
├── db/
│   └── schema.sql                   # Supabase database schema
├── docs/
│   ├── CHANNELS.md                  # Channel setup guide
│   ├── DEPLOYMENT.md                # Deployment guide
│   ├── RELAY.md                     # Relay architecture
│   ├── SECURITY.md                  # Security guide
│   └── TEAMS.md                     # Team agents guide
├── examples/
│   ├── smart-checkin.ts             # Proactive team check-ins
│   └── morning-briefing.ts          # Daily team briefing
├── scripts/
│   ├── setup.sh / setup.ps1        # OS-level setup
│   └── health-check.sh / .ps1      # OS-level health check
├── setup/
│   ├── install.ts                   # Setup script
│   └── verify.ts                    # Health check script
└── skills/
    ├── code-review/SKILL.md         # Code review skill
    ├── devops/SKILL.md              # DevOps skill
    ├── enterprise-research/SKILL.md # Research skill
    ├── sap-helpers/SKILL.md         # SAP skill
    └── security-audit/SKILL.md      # Security skill
```

## Team Agents

Route messages to specialised teams with `/team <id>` or `@cortex-<id>`:

| Team | ID | Skills | Handles |
|------|----|--------|---------|
| Orchestrator | `orchestrator` | enterprise-research | Routes requests |
| Code | `code` | code-review, github | Coding, PRs, refactoring |
| DevOps | `devops` | devops | Deployments, CI/CD, Docker, K8s |
| SAP | `sap` | sap-helpers | CAP, Cloud Foundry, HANA, BTP |
| Security | `security` | security-audit | Audits, vulnerability scanning |
| Research | `research` | enterprise-research | Investigation, documentation |

## Webhook Endpoints

| Endpoint | Routes To | Use For |
|----------|-----------|---------|
| `POST /message` | Orchestrator | General messages |
| `POST /hooks/ci` | DevOps | CI/CD events |
| `POST /hooks/pr` | Code | Pull request events |
| `POST /hooks/security` | Security | Security alerts |
| `POST /hooks/sap/deploy` | SAP | SAP deployments |
| `POST /hooks/cap/build` | SAP/CAP | CAP build events |
| `POST /hooks/hana/alert` | HANA | Database alerts |
| `GET /health` | — | Health check |

## Authentication

Uses your **Anthropic subscription** — no API key needed:

```bash
claude login     # one-time browser login
npm start        # that's it
```

If you prefer API key auth, set `ANTHROPIC_API_KEY=sk-ant-...` in `.env`.

## Environment Variables

```bash
# Authentication: subscription (default) or API key (optional)
# ANTHROPIC_API_KEY=sk-ant-...     # only if not using subscription

# Optional channels
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
MSTEAMS_APP_ID=...
MSTEAMS_APP_PASSWORD=...

# Optional persistent memory
SUPABASE_URL=https://abc123.supabase.co
SUPABASE_ANON_KEY=eyJ...
```

No `OPENAI_API_KEY`.  No `BRAVE_API_KEY`.  Everything runs through your Anthropic subscription.

## Memory System

The bot remembers across sessions via Supabase (optional):

- **Facts** — project decisions, architecture choices, team preferences
- **Goals** — tracked with optional deadlines
- **Semantic search** — finds relevant past conversations

Claude manages memory automatically via intent tags:
```
[REMEMBER: The API uses JWT authentication with RS256]
[GOAL: Migrate to CAP v8 | DEADLINE: 2026-03-01]
[DONE: Migrate to CAP v8]
```

## Proactive Features

### Smart Check-ins
Claude periodically evaluates team context and decides if a check-in is warranted.
Only messages when there's a genuine reason (stale PR, approaching deadline, deployment issue).

### Morning Briefings
Daily team summary: deployment status, open PRs, active goals, security alerts, schedule.

## Documentation

- [Relay Architecture](docs/RELAY.md)
- [Team Agents](docs/TEAMS.md)
- [Channel Setup](docs/CHANNELS.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Security Guide](docs/SECURITY.md)

## License

MIT License

---

**SAP Labs Israel Skills Challenge 2026**
