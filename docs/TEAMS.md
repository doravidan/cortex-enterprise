# Team Agents

## Overview

Cortex Enterprise uses a **team-of-agents** architecture.  Instead of a single
monolithic bot, specialised agents handle different types of work.  An
orchestrator receives every inbound message and delegates to the right team.

```
                          ┌─────────────────────┐
                          │   Orchestrator      │
           ┌──────────────┤   (default agent)   ├──────────────┐
           │              │   Routes requests    │              │
           │              └──────────┬──────────┘              │
           │                         │                          │
     ┌─────▼─────┐  ┌──────▼──────┐  ┌──────▼──────┐  ┌───────▼───────┐
     │   Code    │  │   DevOps   │  │    SAP     │  │   Security   │
     │   Team    │  │   Team     │  │    Team    │  │   Team       │
     │ 💻        │  │ 🚀         │  │ 💎         │  │ 🔒           │
     └───────────┘  └────────────┘  └────────────┘  └──────────────┘
           │              │                │                │
     ┌─────▼─────┐  ┌────▼────┐   ┌──────▼──────┐  ┌─────▼──────┐
     │code-review│  │ devops  │   │ sap-helpers │  │security-   │
     │ skill     │  │ skill   │   │ skill       │  │audit skill │
     └───────────┘  └─────────┘   └─────────────┘  └────────────┘
```

## How It Works

### 1. Message Arrives

A user sends a message via Slack, Teams, or a webhook.  The relay routes
it to the **orchestrator** (the agent marked `default: true`).

### 2. Orchestrator Analyses

The orchestrator reads the message and decides:
- **Small/conversational task** → handle it directly
- **Coding task** → delegate to the Code team
- **Infrastructure task** → delegate to the DevOps team
- **SAP-specific task** → delegate to the SAP team
- **Security concern** → delegate to the Security team
- **Investigation** → delegate to the Research team

### 3. Team Agent Executes

The delegated team agent:
1. Activates its specialised skills
2. Uses its allowed tools
3. Executes the task
4. Returns the result to the orchestrator

### 4. Orchestrator Responds

The orchestrator forwards the team's result back to the user via the
original channel.

## Enterprise Config Teams

| Agent ID      | Name              | Skills              | Focus                          |
|---------------|-------------------|----------------------|--------------------------------|
| `orchestrator`| Cortex            | enterprise-research  | Routing, conversation          |
| `code`        | Cortex Coder      | code-review, github  | Code, PRs, refactoring         |
| `devops`      | Cortex DevOps     | devops               | Deploy, CI/CD, Docker, K8s     |
| `sap`         | Cortex SAP        | sap-helpers          | CAP, CF, HANA, BTP             |
| `security`    | Cortex Security   | security-audit       | Audits, compliance, scanning   |
| `research`    | Cortex Research   | enterprise-research  | Investigation, documentation   |

## SAP Config Teams

The SAP-focused configuration adds domain-specific teams:

| Agent ID      | Name              | Skills                    | Focus                      |
|---------------|-------------------|---------------------------|----------------------------|
| `orchestrator`| Cortex SAP        | sap-helpers, research     | Routing                    |
| `cap`         | Cortex CAP        | sap-helpers, code-review  | CAP projects               |
| `hana`        | Cortex HANA       | sap-helpers               | Database, SQL, HDI         |
| `btp`         | Cortex BTP        | sap-helpers, devops       | CF, BTP services, Kyma     |
| `code`        | Cortex Coder      | code-review               | General coding             |
| `security`    | Cortex Security   | security-audit            | XSUAA, compliance          |

## Concurrency

Teams can run in parallel:

```yaml
agents:
  defaults:
    subagents:
      maxConcurrent: 5           # up to 5 teams working at once
      archiveAfterMinutes: 60    # clean up idle agents after 1h
```

This means the orchestrator can delegate to Code *and* Security
simultaneously (e.g., "review this PR and check for vulnerabilities").

## Webhook Routing to Teams

Webhooks skip the orchestrator and go directly to a team:

```yaml
hooks:
  mappings:
    - id: ci-webhook
      match:
        path: /hooks/ci
      action: agent
      agentId: devops            # CI events → DevOps team directly
```

This reduces latency for automated events that always go to the same team.

## Customising Teams

### Adding a New Team

Add an entry to `agents.list` in your config:

```yaml
agents:
  list:
    - id: data
      name: "Data Team"
      workspace: ~/workspace
      
      identity:
        name: "Cortex Data"
        emoji: "📊"
      
      description: >
        You are the data team. You build data pipelines,
        write ETL jobs, and manage data quality.
      
      tools:
        profile: full
        deny: [voice_call]
      
      skills:
        - data-engineering    # create a matching skill
      
      groupChat:
        historyLimit: 30
```

### Adding a Matching Skill

Create `skills/data-engineering/SKILL.md` with triggers, instructions,
and examples following the skill format used by the other teams.

### Adding a Webhook for the Team

```yaml
hooks:
  mappings:
    - id: data-pipeline-webhook
      match:
        path: /hooks/data/pipeline
      action: agent
      agentId: data
      messageTemplate: "Pipeline {{body.status}}: {{body.pipeline_name}}"
```

## Model Configuration

All teams use Opus 4.6 by default (inherited from `agents.defaults.model`).
Override per-team if needed:

```yaml
agents:
  list:
    - id: research
      model: claude-opus-4-6-20250219    # explicit model per agent
```
