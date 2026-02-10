# Security Guide

## Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Enterprise Network                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │   Slack     │    │  MS Teams   │    │   Internal Apps     │ │
│  └──────┬──────┘    └──────┬──────┘    └──────────┬──────────┘ │
│         │                  │                       │            │
│         ▼                  ▼                       ▼            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Cortex Gateway (TLS + Token Auth)            │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐  │  │
│  │  │  Agent  │  │ Memory  │  │  Exec   │  │  Webhooks   │  │  │
│  │  │  Loop   │  │ Search  │  │ Sandbox │  │  Handler    │  │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   AI Provider APIs                        │  │
│  │           (Anthropic / OpenAI - External)                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Authentication

### Token Auth

```yaml
gateway:
  auth:
    mode: token
```

Generate strong token:
```bash
openssl rand -base64 32
```

## Network Security

### Localhost Only (Recommended)

```yaml
gateway:
  bind: loopback
```

### With TLS

```yaml
gateway:
  bind: lan
  tls:
    enabled: true
    autoGenerate: true
```

## Execution Security

### Allowlist Mode

```yaml
tools:
  exec:
    security: allowlist
    safeBins:
      - cat
      - ls
      - git
      - npm
      - cf
      - cds
```

## Data Protection

### Log Redaction

```yaml
logging:
  redactSensitive: tools
  redactPatterns:
    - "password"
    - "token"
    - "api[_-]?key"
    - "secret"
```

## Disabled Features

Consumer features disabled:

```yaml
plugins:
  deny:
    - voice-call
    - telegram
    - whatsapp
    - signal
    - imessage
    - discord
```

## Compliance Checklist

### GDPR
- [ ] Data processing agreement with AI provider
- [ ] User consent for AI processing
- [ ] Right to deletion
- [ ] Data export capability

### SOC 2
- [ ] Access logging enabled
- [ ] Authentication enforced
- [ ] Encryption in transit (TLS)
- [ ] Regular security reviews

### SAP Specific
- [ ] XSUAA integration for BTP
- [ ] Audit log forwarding
- [ ] Role-based access control

## Incident Response

### Token Compromise

1. Generate new token:
   ```bash
   NEW_TOKEN=$(openssl rand -base64 32)
   ```

2. Update configuration

3. Restart service

4. Update all clients
