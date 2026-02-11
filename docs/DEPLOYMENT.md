# Deployment Guide

All deployment options use **Claude Code** as the sole runtime.
The only external dependency is the Anthropic API.

## Prerequisites

- Node.js 22+
- Claude Code CLI (`claude`)
- Anthropic subscription (`claude login`) or API key (`ANTHROPIC_API_KEY`)

## Deployment Options

### 1. Local Workstation

```bash
# macOS / Linux
./scripts/setup.sh
claude login                 # authenticate with subscription (one-time)
claude --relay --config ~/.cortex/config.yaml
```

```powershell
# Windows
.\scripts\setup.ps1
claude login                 # authenticate with subscription (one-time)
claude --relay --config "$HOME\.cortex\config.yaml"
```

For SAP environment:

```bash
./scripts/setup.sh --sap
```

```powershell
.\scripts\setup.ps1 -Sap
```

### 2. Docker Container

```dockerfile
FROM node:22-slim

WORKDIR /app
COPY . .

RUN npm install -g @anthropic-ai/claude-code
RUN chmod +x scripts/*.sh

EXPOSE 18789

HEALTHCHECK --interval=30s --timeout=10s \
  CMD ./scripts/health-check.sh || exit 1

CMD ["claude", "--relay", "--config", "/app/configs/enterprise-config.yaml"]
```

```bash
# Build
docker build -t cortex-enterprise .

# Run
docker run -d \
  -p 18789:18789 \
  -e ANTHROPIC_API_KEY=sk-ant-... \    # API key needed in containers
  -v ~/workspace:/root/workspace \
  cortex-enterprise
```

### 3. Kubernetes / BTP Kyma

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cortex-enterprise
spec:
  replicas: 1
  selector:
    matchLabels:
      app: cortex
  template:
    metadata:
      labels:
        app: cortex
    spec:
      containers:
      - name: cortex
        image: your-registry/cortex-enterprise:latest
        ports:
        - containerPort: 18789
        env:
        - name: ANTHROPIC_API_KEY
          valueFrom:
            secretKeyRef:
              name: cortex-secrets
              key: anthropic-key
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 18789
          initialDelaySeconds: 30
          periodSeconds: 10
```

```bash
# Create the secret (API key needed for headless/container environments)
kubectl create secret generic cortex-secrets \
  --from-literal=anthropic-key=sk-ant-...
```

> **Note:** Container/headless deployments (Docker, K8s, CF) require an API key
> since `claude login` (browser OAuth) is not available.  For local workstation
> use, subscription auth via `claude login` is recommended.

### 4. Cloud Foundry (SAP BTP)

```yaml
# manifest.yaml
applications:
- name: cortex-enterprise
  memory: 1G
  instances: 1
  buildpacks:
    - nodejs_buildpack
  command: claude --relay --config configs/sap-config.yaml
  env:
    NODE_ENV: production
  services:
    - xsuaa-instance
```

## Monitoring

### Health Check

```bash
./scripts/health-check.sh
./scripts/health-check.sh --json
```

```powershell
.\scripts\health-check.ps1
.\scripts\health-check.ps1 -Json
```

### Relay Logs

The relay writes structured JSON logs (configured in `logging.consoleStyle: json`).
Forward these to your enterprise log aggregation system (ELK, Splunk, etc.).

## Troubleshooting

### Relay won't start
- Check authentication: run `claude auth status` or verify `ANTHROPIC_API_KEY`
- If not logged in, run `claude login`
- Verify config file exists at the expected path
- Check port 18789 is available

### Channel connection issues
- Verify bot tokens are set in environment variables
- Check the channel is `enabled: true` in config
- Review relay logs for connection errors

### Agent not responding
- Check Anthropic API status
- Verify the model `claude-opus-4-6-20250219` is available on your plan
- Check `contextTokens` is within your API limits
