# Cortex Enterprise v3.0

Enterprise-grade AI relay + integrations + security controls + portable **Markdown Skills**.

- Channels: **Slack**, **Microsoft Teams**, **Webhooks**
- Integrations (optional): **Jira**, **GitHub**, **Confluence**, **SharePoint (Graph)**
- Security: **RBAC**, **audit logging**, **approvals**, **classification + PII masking**
- Skills: scan a repo and generate **SKILL.md** instructions (SAP-first, works anywhere)

---

## Architecture

```
                 +-----------------------------+
                 |   Slack / Teams / Webhook   |
                 +--------------+--------------+
                                |
                                v
                 +-----------------------------+
                 |     Cortex Relay (Node)     |
                 |   src/relay.ts + router     |
                 +------+----------+-----------+
                        |          |
                        |          +-------------------------+
                        |                                    |
                        v                                    v
         +---------------------------+          +---------------------------+
         |   Skills (Markdown)       |          |  Integrations (Optional)  |
         |  scan -> SKILL.md         |          | Jira / GitHub / Docs / LLM|
         +---------------------------+          +---------------------------+
                        |
                        v
         +---------------------------+
         | Security Controls         |
         | RBAC / Audit / Approval   |
         | Classification + PII mask |
         +---------------------------+
```

---

## Quick Start (Local)

### 1) Install

```bash
npm ci
```

### 2) Configure

Copy `.env.example` to `.env` and fill what you need.

```bash
cp .env.example .env
```

At minimum, you can run **webhooks-only** with no tokens.

### 3) Run

```bash
npm run dev
# or
npm start
```

Health check:

- `GET http://localhost:3120/health`

---

## Commands

Slack: `/cortex ...`

Teams: send a message starting with `/cortex ...` (or `cortex ...`).

Supported (starter set):

- `/cortex skills scan <path>` → generates `SKILL.md` in the repo and registers it
- `/cortex skills list`
- `/cortex skills install <id|name> <destDir>`

---

## Webhooks

New endpoints:

- `POST /webhooks/github` (HMAC via `GITHUB_WEBHOOK_SECRET`)
- `POST /webhooks/jira` (optional HMAC via `JIRA_WEBHOOK_SECRET`)
- `POST /webhooks/generic` (optional shared secret via `GENERIC_WEBHOOK_SECRET`)

Legacy endpoints (kept for compatibility):

- `POST /message`
- `POST /hooks/*`

---

## Security Model

### RBAC

Roles:

- `admin`, `manager`, `developer`, `viewer`

Use `assertPermission()` for privileged flows.

### Audit Logging

- Local JSONL log (append-only)
- Optional Supabase sink
- Redaction helpers for tokens/credentials

### Approvals

A lightweight approval manager provides:

- `createApproval()` → Promise resolves with approved/rejected/timeout
- Slack Block Kit buttons for approve/reject

### Classification + PII Masking

Classification levels:

- `public`, `internal`, `confidential`, `restricted`

Use external LLM providers only when policy allows, optionally masking PII.

---

## Skill Generator

Skills are **portable Markdown instructions**.

1. Scan a repository (detect stack, SAP patterns, CI/CD, schemas)
2. Generate `SKILL.md` with:
   - tech stack
   - architecture heuristics
   - common tasks
   - debugging playbook
   - SAP-specific guidance (CAP/BTP/HANA/UI5)

---

## SAP Skills Challenge 2026

This repo treats SAP patterns as **first-class signals**:

- CAP (`.cds`, `@sap/cds`)
- BTP / Cloud Foundry (`mta.yaml`, `manifest.yml`, `xs-security.json`)
- Fiori/UI5 (`ui5.yaml`, `webapp/manifest.json`)
- HANA / HDI (`.hdb*`, `.hdiconfig`)
- Integration Suite / Cloud Connector (heuristics)

---

## Docker

Build + run Cortex with a Postgres container (minimal Supabase-compatible DB):

```bash
docker compose up --build
```

For a full Supabase API stack, use the Supabase CLI (`supabase start`) or extend `docker-compose.yml`.

---

## Development

Typecheck:

```bash
npm run typecheck
```

---

## License

Proprietary / internal (adjust as needed).
