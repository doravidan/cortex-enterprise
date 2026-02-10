# Deployment Guide

## Deployment Options

### 1. Local Workstation

Best for: Individual developers, testing

```bash
# Install globally
npm install -g openclaw

# Configure
openclaw wizard

# Apply enterprise config
cp configs/enterprise-config.yaml ~/.openclaw/config.yaml

# Start
openclaw gateway start
```

### 2. Docker Container

Best for: Team deployments, CI/CD

```dockerfile
FROM node:22-slim

# Install OpenClaw
RUN npm install -g openclaw

# Copy config
COPY configs/enterprise-config.yaml /root/.openclaw/config.yaml

# Set environment
ENV NODE_ENV=production

# Expose gateway port
EXPOSE 18789

# Health check
HEALTHCHECK --interval=30s --timeout=10s \
  CMD curl -f http://localhost:18789/health || exit 1

CMD ["openclaw", "gateway", "start"]
```

```bash
# Build
docker build -t openclaw-enterprise .

# Run
docker run -d \
  -p 18789:18789 \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -v ~/workspace:/root/workspace \
  openclaw-enterprise
```

### 3. Kubernetes / BTP Kyma

Best for: Enterprise scale, SAP BTP

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: openclaw-enterprise
spec:
  replicas: 1
  selector:
    matchLabels:
      app: openclaw
  template:
    metadata:
      labels:
        app: openclaw
    spec:
      containers:
      - name: openclaw
        image: your-registry/openclaw-enterprise:latest
        ports:
        - containerPort: 18789
        env:
        - name: ANTHROPIC_API_KEY
          valueFrom:
            secretKeyRef:
              name: openclaw-secrets
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
---
apiVersion: v1
kind: Service
metadata:
  name: openclaw-service
spec:
  selector:
    app: openclaw
  ports:
  - port: 18789
    targetPort: 18789
```

### 4. Cloud Foundry (SAP BTP)

```yaml
# manifest.yaml
applications:
- name: openclaw-enterprise
  memory: 1G
  instances: 1
  buildpacks:
    - nodejs_buildpack
  command: openclaw gateway start
  env:
    NODE_ENV: production
  services:
    - xsuaa-instance  # For authentication
```

```bash
cf push -f manifest.yaml
```

## Environment Configuration

### Required Secrets

```bash
# Create Kubernetes secret
kubectl create secret generic openclaw-secrets \
  --from-literal=anthropic-key=sk-ant-... \
  --from-literal=openai-key=sk-...
```

### Optional Integrations

```bash
# Slack
--from-literal=slack-bot-token=xoxb-... \
--from-literal=slack-app-token=xapp-...

# SAP tools
--from-literal=cf-password=... \
```

## Scaling Considerations

### Single Instance (Default)
- Stateful session storage
- Memory-based caching
- Suitable for most use cases

### Multi-Instance (Advanced)
- Requires shared session store
- Use Redis or PostgreSQL backend
- Configure load balancer with sticky sessions

```yaml
session:
  store: redis://redis-host:6379
```

## Monitoring & Alerts

### Prometheus Metrics

```yaml
diagnostics:
  otel:
    enabled: true
    endpoint: http://prometheus-pushgateway:9091
    metrics: true
```

### Log Aggregation

```yaml
logging:
  level: info
  consoleStyle: json
```

Parse JSON logs with Fluentd, Logstash, or similar.

## Backup & Recovery

### Session Data
```bash
# Backup sessions
cp -r ~/.openclaw/sessions ~/backup/

# Restore
cp -r ~/backup/sessions ~/.openclaw/
```

### Memory Index
```bash
# Backup memory
cp -r ~/.openclaw/memory ~/backup/

# Reindex after restore
openclaw memory rebuild
```

## Troubleshooting

### Gateway won't start
```bash
# Check logs
openclaw gateway logs

# Verify config
openclaw config validate

# Reset to defaults
openclaw wizard --force
```

### Channel connection issues
```bash
# Test Slack connection
curl -X POST https://slack.com/api/auth.test \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN"

# Check bot permissions
openclaw status --channels
```

### Memory issues
```bash
# Check memory usage
openclaw status --memory

# Compact sessions
openclaw sessions prune --older-than 7d
```
