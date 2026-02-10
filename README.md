# Cortex Enterprise

AI-powered development assistant for enterprise environments. Built for productivity, security, and seamless integration with corporate workflows.

## 🎯 Features

### Core Capabilities ✅
- **AI Agent Engine** - Claude/GPT powered intelligent assistant
- **Enterprise Channels** - Slack, Microsoft Teams, Google Chat
- **Code Automation** - GitHub integration, automated PRs, code review
- **Browser Automation** - Headless browser for web tasks
- **Knowledge Retention** - Vector search, context memory
- **Scheduled Tasks** - Cron jobs and automated workflows
- **Webhooks** - CI/CD pipeline integration
- **Security First** - TLS, token auth, audit logging

### Enterprise Focus
- No consumer messaging (personal chat apps)
- No voice calls
- Designed for corporate security requirements
- SAP development tools integration

## 🚀 Quick Start

### Prerequisites
- Node.js 22+
- API access (Claude/OpenAI)

### Installation

```bash
# Clone this repository
git clone https://github.com/your-org/cortex-enterprise.git
cd cortex-enterprise

# Run setup
./scripts/setup.sh

# For SAP-specific setup
./scripts/setup.sh --sap
```

## 📁 Project Structure

```
cortex-enterprise/
├── configs/
│   ├── enterprise-config.yaml  # Base enterprise configuration
│   └── sap-config.yaml         # SAP-specific extensions
├── docs/
│   ├── DEPLOYMENT.md           # Deployment guide
│   ├── SECURITY.md             # Security considerations
│   └── CHANNELS.md             # Channel setup guides
├── scripts/
│   ├── setup.sh                # Installation script
│   └── health-check.sh         # Health monitoring
└── skills/
    └── sap-helpers/            # SAP development skills
```

## 🔧 Configuration

### Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...     # AI Provider
OPENAI_API_KEY=sk-...            # Embeddings

# Enterprise Channels (optional)
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
```

## 🔒 Security

- TLS encryption by default
- Token-based authentication
- Localhost binding (configurable)
- Audit logging in JSON format
- Exec command allowlisting
- Sensitive data redaction

## 📡 Supported Channels

| Channel | Status |
|---------|--------|
| Slack | ✅ Supported |
| Microsoft Teams | ✅ Supported |
| Google Chat | ✅ Supported |

## 🛠 SAP Integration

Built-in support for:
- Cloud Foundry CLI (`cf`)
- CAP Development (`cds`)
- HANA Database (`hdbsql`)
- Kubernetes/Kyma (`kubectl`)
- Maven/Gradle builds

## 📊 Monitoring

```bash
# Health check
./scripts/health-check.sh

# JSON output for monitoring systems
./scripts/health-check.sh --json
```

## 📄 License

MIT License

---

**SAP Labs Israel Skills Challenge 2026**
