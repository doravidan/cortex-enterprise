# OpenClaw Enterprise

Enterprise-ready configuration for OpenClaw AI Agent Platform. Optimized for corporate environments with focus on security, compliance, and productivity.

## 🎯 Features

### What's Included ✅
- **Core AI Agent Functionality** - Full Claude/GPT agent capabilities
- **Enterprise Channels** - Slack, Microsoft Teams, Google Chat
- **Code Automation** - GitHub integration, Codex CLI, automated PRs
- **Browser Automation** - Headless browser for web tasks
- **Memory & Context** - Vector search, knowledge retention
- **Cron Jobs** - Scheduled tasks and workflows
- **Webhooks** - Integration with CI/CD pipelines
- **Security** - TLS, token auth, audit logging

### What's Removed ❌
- Telegram, WhatsApp, Signal, iMessage (consumer messaging)
- Voice calls (Twilio/Telnyx integration)
- Discord, Twitch (gaming platforms)
- Personal notification features

## 🚀 Quick Start

### Prerequisites
- Node.js 22+
- OpenClaw CLI installed (`npm install -g openclaw`)
- Claude/OpenAI API access

### Installation

```bash
# Clone this repository
git clone https://github.com/your-org/openclaw-enterprise.git
cd openclaw-enterprise

# Copy enterprise config to OpenClaw
cp configs/enterprise-config.yaml ~/.openclaw/config.yaml

# Set your API token
openclaw setup-token anthropic

# Start the gateway
openclaw gateway start
```

### SAP-Specific Setup

```bash
# Use SAP-optimized config
cp configs/sap-config.yaml ~/.openclaw/config.yaml

# Verify SAP tools are available
cf --version
cds --version
```

## 📁 Project Structure

```
openclaw-enterprise/
├── configs/
│   ├── enterprise-config.yaml  # Base enterprise configuration
│   └── sap-config.yaml         # SAP-specific extensions
├── docs/
│   ├── DEPLOYMENT.md           # Deployment guide
│   ├── SECURITY.md             # Security considerations
│   └── CHANNELS.md             # Channel setup guides
├── scripts/
│   ├── health-check.sh         # Health monitoring
│   └── deploy.sh               # Deployment automation
└── skills/
    └── sap-helpers/            # SAP-specific skills
```

## 🔧 Configuration

### Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...     # Claude API
OPENAI_API_KEY=sk-...            # OpenAI (for embeddings)

# Enterprise Channels (optional)
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
MSTEAMS_APP_ID=...
MSTEAMS_APP_PASSWORD=...

# SAP Tools (optional)
CF_API_ENDPOINT=https://api.cf.sap.hana.ondemand.com
```

### Minimal Config Example

```yaml
gateway:
  port: 18789
  auth:
    mode: token

agents:
  defaults:
    workspace: ~/workspace
    
channels:
  slack:
    enabled: true
    botToken: ${SLACK_BOT_TOKEN}
    appToken: ${SLACK_APP_TOKEN}

plugins:
  deny:
    - telegram
    - whatsapp
    - voice-call
```

## 🔒 Security

### Hardening Checklist

- [ ] TLS enabled with valid certificates
- [ ] Token authentication configured
- [ ] Loopback-only binding (or VPN/tailnet)
- [ ] Sensitive data redaction in logs
- [ ] Exec allowlist configured
- [ ] Consumer channels disabled

### Audit Logging

Enterprise config includes JSON-formatted logs suitable for:
- Splunk
- ELK Stack
- Azure Monitor
- SAP Cloud Logging

## 📡 Enterprise Channels

### Slack Setup

1. Create Slack App at api.slack.com
2. Enable Socket Mode
3. Add Bot Token Scopes:
   - `chat:write`
   - `channels:history`
   - `groups:history`
   - `im:history`
   - `users:read`
4. Install to workspace
5. Add tokens to config

### Microsoft Teams Setup

1. Register app in Azure AD
2. Create Bot Channel Registration
3. Configure messaging endpoint
4. Add credentials to config

## 🛠 SAP Integration

### Supported SAP Tools

| Tool | Purpose |
|------|---------|
| `cf` | Cloud Foundry deployments |
| `cds` | CAP development |
| `hdbsql` | HANA database queries |
| `kubectl` | BTP Kyma runtime |
| `mvn` | Java-based SAP projects |

### Example Workflows

```bash
# Deploy CAP application
cds build && cf push

# Check HANA status
hdbsql -i 00 -n localhost:30015 -u SYSTEM -p secret "SELECT * FROM M_SERVICES"

# Kubernetes deployment
kubectl apply -f k8s/deployment.yaml
```

## 📊 Monitoring

### Health Check

```bash
# Check gateway status
curl http://localhost:18789/health

# Via CLI
openclaw gateway status
```

### Metrics (with OTEL)

Enable in config:
```yaml
diagnostics:
  otel:
    enabled: true
    endpoint: https://your-collector:4318
    protocol: http/protobuf
```

## 🤝 Contributing

1. Fork this repository
2. Create feature branch
3. Submit PR with tests

## 📄 License

MIT License - See LICENSE file

---

**Built for SAP Labs Israel Skills Challenge 2026**
