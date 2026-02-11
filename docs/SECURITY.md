# Security Guide

## Security Architecture

Cortex Enterprise uses a single-provider architecture (Claude Code / Anthropic).
All AI traffic goes to one API endpoint, simplifying security auditing.

```
┌─────────────────────────────────────────────────────────────────┐
│                     Enterprise Network                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │   Slack     │    │  MS Teams   │    │   Webhooks (CI/CD)  │ │
│  └──────┬──────┘    └──────┬──────┘    └──────────┬──────────┘ │
│         │                  │                       │            │
│         ▼                  ▼                       ▼            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │          Claude Code Relay (TLS + Token Auth)             │  │
│  │  ┌───────────┐ ┌──────────┐ ┌────────┐ ┌─────────────┐  │  │
│  │  │Orchestrator│ │  Team   │ │ Memory │ │  Exec       │  │  │
│  │  │  Agent    │ │ Agents  │ │ Store  │ │  Sandbox    │  │  │
│  │  └───────────┘ └──────────┘ └────────┘ └─────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Anthropic API (Opus 4.6)                     │  │
│  │              Single provider — single audit trail         │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Single Provider Advantage

By using only Anthropic / Claude Code:
- **Subscription auth** — no API keys to manage for local use (`claude login`)
- **One vendor** for data processing agreements
- **One audit trail** for all AI interactions
- **No data leakage** to secondary providers (no OpenAI embeddings, no Brave search)
- **API key option** available for headless/container deployments

## Authentication

### Token Auth

```yaml
gateway:
  auth:
    mode: token
```

Generate a strong token:

```bash
openssl rand -base64 32
```

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Max 256 }) -as [byte[]])
```

## Network Security

### Localhost Only (Recommended for Development)

```yaml
gateway:
  bind: loopback
```

### With TLS (Production)

```yaml
gateway:
  bind: lan
  tls:
    enabled: true
    certFile: /etc/ssl/cortex/cert.pem    # use a real cert
    keyFile: /etc/ssl/cortex/key.pem
```

## Execution Security

### Allowlist Mode

Only explicitly listed binaries can be executed:

```yaml
tools:
  exec:
    security: allowlist
    safeBins:
      - cat
      - ls
      - git
      - npm
      - node
      - claude
      - cf
      - cds
      - kubectl
      - docker
      - trivy
```

Anything not on the list is blocked.  The `ask: "on-miss"` setting
prompts the user for approval when an unlisted binary is requested.

## Data Protection

### Log Redaction

Sensitive values are automatically redacted from logs:

```yaml
logging:
  redactSensitive: tools
  redactPatterns:
    - "password"
    - "token"
    - "api[_-]?key"
    - "secret"
    - "credential"
```

### Memory Security

Claude Code's built-in memory is local to the relay instance.
No data is sent to third-party embedding services.

## Disabled Features

Consumer features are permanently disabled:

```yaml
plugins:
  deny:
    - voice-call
    - telegram
    - whatsapp
    - signal
    - imessage
    - discord
    - nostr
    - twitch
```

## Compliance Checklist

### GDPR
- [ ] Data processing agreement with Anthropic
- [ ] User consent for AI processing
- [ ] Right to deletion (clear memory store)
- [ ] Data export capability

### SOC 2
- [ ] Access logging enabled (JSON logs)
- [ ] Token authentication enforced
- [ ] TLS encryption in transit
- [ ] Regular token rotation
- [ ] Exec command allowlisting

### SAP Specific
- [ ] XSUAA integration for BTP
- [ ] Audit log service forwarding
- [ ] Role-based access via channel allowlists
- [ ] Network security groups configured

## Incident Response

### API Key Compromise (if using API key auth)

1. Revoke the key immediately in the Anthropic dashboard
2. Generate a new `ANTHROPIC_API_KEY`
3. Update the relay environment variable
4. Restart the relay
5. Review logs for unauthorized usage

> **Subscription auth** (`claude login`) does not store API keys locally,
> reducing the risk of key exposure.  Recommended for local workstation use.

### Token Compromise

1. Generate a new gateway token:
   ```bash
   openssl rand -base64 32
   ```
2. Update the relay configuration
3. Restart the relay
4. Update all channel configurations with the new token

### Unexpected Command Execution

1. Check the exec allowlist in config
2. Review audit logs for the executed command
3. If `ask: "on-miss"` was bypassed, check for config tampering
4. Tighten the allowlist and restart
