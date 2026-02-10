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
│  │              OpenClaw Gateway (TLS + Token Auth)          │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐  │  │
│  │  │  Agent  │  │ Memory  │  │  Exec   │  │  Webhooks   │  │  │
│  │  │  Loop   │  │ Search  │  │ Sandbox │  │  Handler    │  │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   AI Provider APIs                        │  │
│  │     (Anthropic / OpenAI / Bedrock - External)            │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Authentication

### Gateway Token Auth

```yaml
gateway:
  auth:
    mode: token
    # Set via: openclaw config set gateway.auth.token <your-token>
```

Generate strong token:
```bash
openssl rand -base64 32
```

### Channel Authentication

Each channel uses its own auth mechanism:

| Channel | Auth Method |
|---------|------------|
| Slack | Bot Token + App Token (OAuth) |
| MS Teams | Azure AD App Registration |
| Google Chat | Service Account |

## Network Security

### Recommended: Localhost Only

```yaml
gateway:
  bind: loopback
```

Expose via:
- Reverse proxy (nginx/traefik) with TLS termination
- SSH tunnel
- Tailscale/VPN

### With TLS

```yaml
gateway:
  bind: lan  # or custom IP
  tls:
    enabled: true
    autoGenerate: true  # Self-signed for internal
    # Or use real certs:
    # certPath: /path/to/cert.pem
    # keyPath: /path/to/key.pem
```

## Execution Security

### Allowlist Mode (Recommended)

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

### Approval Mode

```yaml
tools:
  exec:
    ask: always  # Require approval for all commands
```

### Sandboxing

```yaml
agents:
  defaults:
    sandbox:
      mode: all
      docker:
        image: node:22-slim
        network: none
        readOnlyRoot: true
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
    - "credential"
    - "bearer"
```

### Memory Protection

- Memory files stored locally (not sent to AI providers)
- Session data encrypted at rest (optional)
- Automatic cleanup of old sessions

```yaml
session:
  reset:
    mode: daily
    atHour: 3
```

## Disabled Features

Consumer features disabled by default:

```yaml
plugins:
  deny:
    - voice-call      # No phone calls
    - telegram        # No consumer messaging
    - whatsapp
    - signal
    - imessage
    - discord         # No gaming platforms
    - nostr
    - twitch
```

## Compliance Checklist

### GDPR
- [ ] Data processing agreement with AI provider
- [ ] User consent for AI processing
- [ ] Right to deletion (session purge)
- [ ] Data export capability

### SOC 2
- [ ] Access logging enabled
- [ ] Authentication enforced
- [ ] Encryption in transit (TLS)
- [ ] Regular security reviews

### SAP Specific
- [ ] XSUAA integration for BTP
- [ ] Cloud Connector for on-premise
- [ ] Audit log forwarding
- [ ] Role-based access control

## Incident Response

### Suspected Breach

1. **Immediate**
   ```bash
   openclaw gateway stop
   ```

2. **Rotate Credentials**
   ```bash
   openclaw setup-token anthropic --force
   ```

3. **Review Logs**
   ```bash
   openclaw gateway logs --since "24h" > incident.log
   ```

4. **Audit Sessions**
   ```bash
   openclaw sessions list --all
   ```

### Token Compromise

1. Revoke old token:
   ```bash
   openclaw config set gateway.auth.token ""
   ```

2. Generate new token:
   ```bash
   NEW_TOKEN=$(openssl rand -base64 32)
   openclaw config set gateway.auth.token "$NEW_TOKEN"
   ```

3. Update all clients

## Regular Maintenance

### Weekly
- Review session logs for anomalies
- Check for OpenClaw updates
- Verify channel connections

### Monthly
- Rotate gateway token
- Audit exec commands used
- Review memory index size

### Quarterly
- Full security assessment
- Update dependencies
- Review access permissions
