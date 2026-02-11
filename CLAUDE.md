# Cortex Enterprise — Setup Guide

> Claude Code reads this file automatically.  Walk the user through setup
> one phase at a time.  Ask for what you need, configure everything yourself,
> and confirm each step works before moving on.

## How This Works

This project is an enterprise AI relay powered by Claude Code.
It connects Slack, Teams, and webhooks to Claude Opus 4.6 via team agents.

```
Channel (Slack / Teams / Webhook)
        │
        ▼
  Cortex Relay (src/relay.ts)
        │
        ├─ Router → Team Agent (code, devops, sap, security, research)
        │
        ▼
  Claude Code CLI (Opus 4.6) → Response → Channel
        │
  Supabase (persistent memory — optional)
```

The user cloned this repo.  Your job: guide them through setup conversationally.
Do NOT dump all phases at once.  Start with Phase 1.  When it works, move to Phase 2.

If this is a fresh clone, run `npm run setup` first.

---

## Phase 1: Prerequisites (~2 min)

**Check these automatically:**
1. Node.js 22+ — `node -v`
2. Claude Code CLI — `claude --version`
3. npm installed — `npm -v`

**If Claude Code CLI is missing:**
```
npm install -g @anthropic-ai/claude-code
```

**What you do:**
1. Run `npm run setup` to install dependencies and create `.env`
2. Verify prerequisites pass

**Done when:** All prerequisites pass.

---

## Phase 2: Authentication (~1 min)

Claude Code uses the user's **Anthropic subscription** (Claude Max / Team / Enterprise).
No API key is needed — authentication is handled by Claude Code internally.

**Check if already authenticated:**
1. The user likely already authenticated when they installed Claude Code
2. Test with: `claude -p "Say hello" --output-format text` in an interactive terminal

**If not authenticated:**
1. Run `claude` interactively — it will prompt for login on first use
2. Or run `claude setup-token` to set up a long-lived auth token

**If the user prefers API key auth instead:**
1. Ask for their API key (starts with `sk-ant-`)
2. Save `ANTHROPIC_API_KEY` to `.env`

**Done when:** Claude responds to the test prompt.

---

## Phase 3: Enterprise Profile (~2 min)

**Ask the user:**
- Company / team name
- Tech stack (languages, frameworks, infrastructure)
- Timezone
- Preferred communication style (brief/detailed, formal/casual)
- Any coding conventions (PR naming, branch strategy, etc.)

**What you do:**
1. Copy `config/profile.example.md` to `config/profile.md`
2. Fill in their answers
3. The relay loads this on every message for personalisation

**Done when:** `config/profile.md` exists with their details.

---

## Phase 4: Test the Relay (~2 min)

**What you do:**
1. Run `npm start`
2. In another terminal, send a test webhook:
   ```bash
   curl -X POST http://localhost:18789/message \
     -H "Content-Type: application/json" \
     -d '{"text": "Hello, what teams are available?", "sender": "test"}'
   ```
3. Verify the response includes the team list
4. Test the health endpoint: `curl http://localhost:18789/health`
5. Press Ctrl+C to stop

**Troubleshooting:**
- Port in use → change `PORT` in `.env`
- Claude CLI error → check `ANTHROPIC_API_KEY`
- Module not found → run `npm install`

**Done when:** Relay responds to test message and health check returns OK.

---

## Phase 5: Channels (Optional, ~5 min each)

### Slack

**You need from the user:**
- Slack Bot Token (`SLACK_BOT_TOKEN`, starts with `xoxb-`)
- Slack App Token (`SLACK_APP_TOKEN`, starts with `xapp-`)

**What to tell them:**
1. Go to api.slack.com/apps → Create New App
2. Enable Socket Mode
3. Add bot scopes: `chat:write`, `app_mentions:read`, `im:history`, `channels:history`
4. Install to workspace
5. Copy the Bot Token and App Token

**What you do:**
1. Save tokens to `.env`
2. Restart the relay → Slack should connect

### Microsoft Teams

**You need from the user:**
- Teams App ID (`MSTEAMS_APP_ID`)
- Teams App Password (`MSTEAMS_APP_PASSWORD`)

**What to tell them:**
1. Go to Azure Portal → Bot Services → Create
2. Note the App ID and generate a password
3. Add the Teams channel

**What you do:**
1. Save credentials to `.env`
2. Restart the relay → Teams listener starts on PORT+1

**Done when:** At least one channel responds to messages.

---

## Phase 6: Persistent Memory — Supabase (Optional, ~10 min)

This gives the bot persistent memory across sessions.

### Step 1: Create Supabase Project

**You need from the user:**
- Supabase URL
- Supabase anon key

**What to tell them:**
1. Go to supabase.com, create a free account
2. Create a new project
3. Go to Project Settings > API
4. Copy: Project URL and anon public key

**What you do:**
1. Save `SUPABASE_URL` and `SUPABASE_ANON_KEY` to `.env`

### Step 2: Create Tables

1. Read `db/schema.sql`
2. Tell the user to run it in Supabase SQL Editor
3. Or if Supabase MCP is available, execute it directly

### Step 3: Verify

Run `npm run setup:verify` to confirm:
- Tables exist (messages, memory, logs)
- Connectivity works

**Done when:** Verify script shows Supabase tables as OK.

---

## Phase 7: Proactive Features (Optional, ~3 min)

### Smart Check-ins
`examples/smart-checkin.ts` — Claude decides if the team needs a check-in.

**Schedule:**
```bash
# Every 30 minutes during work hours (cron)
*/30 9-17 * * 1-5 cd /path/to/cortex-enterprise && npx tsx examples/smart-checkin.ts
```

### Morning Briefing
`examples/morning-briefing.ts` — Daily team summary.

**Schedule:**
```bash
# 9:00 AM weekdays
0 9 * * 1-5 cd /path/to/cortex-enterprise && npx tsx examples/morning-briefing.ts
```

**What you do:**
1. Set `SLACK_CHECKIN_WEBHOOK` or `TEAMS_CHECKIN_WEBHOOK` in `.env`
2. Help schedule with cron (Linux/macOS) or Task Scheduler (Windows)

---

## Phase 8: Verify Everything (~1 min)

Run the full health check:
```
npm run setup:verify
```

Summarise what was set up:
- Model: Opus 4.6
- Active channels
- Memory: persistent or session-only
- Team agents available
- Proactive features configured

Remind the user:
- Start with `npm start` or `npm run dev` (with auto-reload)
- Use `/team code`, `/team devops`, etc. to route to specific teams
- Come back to this folder and type `claude` anytime to make changes

---

## Architecture Reference

### Team Agents

| ID | Name | Skills | Handles |
|----|------|--------|---------|
| orchestrator | Cortex | enterprise-research | Routes requests |
| code | Cortex Coder | code-review | Coding, PRs |
| devops | Cortex DevOps | devops | Deployments, CI/CD |
| sap | Cortex SAP | sap-helpers | CAP, HANA, BTP |
| security | Cortex Security | security-audit | Audits, scanning |
| research | Cortex Research | enterprise-research | Investigation |

### Key Files

| File | Purpose |
|------|---------|
| `src/relay.ts` | Core relay — spawns Claude CLI |
| `src/router.ts` | Team agent routing |
| `src/memory.ts` | Persistent memory (Supabase) |
| `src/channels/slack.ts` | Slack adapter |
| `src/channels/teams.ts` | Teams adapter |
| `src/channels/webhook.ts` | Webhook server |
| `configs/enterprise-config.yaml` | Gateway configuration |
| `db/schema.sql` | Database schema |
