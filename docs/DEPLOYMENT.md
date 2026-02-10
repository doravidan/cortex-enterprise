# Deployment Guide

## Deployment Options

### 1. Local Workstation

```bash
# Run setup
./scripts/setup.sh

# For SAP environment
./scripts/setup.sh --sap
```

### 2. Docker Container

```dockerfile
FROM node:22-slim

WORKDIR /app
COPY . .

RUN chmod +x scripts/*.sh

EXPOSE 18789

HEALTHCHECK --interval=30s --timeout=10s \
  CMD ./scripts/health-check.sh || exit 1

CMD ["./scripts/start.sh"]
```

```bash
# Build
docker build -t cortex-enterprise .

# Run
docker run -d \
  -p 18789:18789 \
  -e ANTHROPIC_API_KEY=sk-ant-... \
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

### 4. Cloud Foundry (SAP BTP)

```yaml
# manifest.yaml
applications:
- name: cortex-enterprise
  memory: 1G
  instances: 1
  buildpacks:
    - nodejs_buildpack
  env:
    NODE_ENV: production
  services:
    - xsuaa-instance
```

## Environment Configuration

### Required Secrets

```bash
kubectl create secret generic cortex-secrets \
  --from-literal=anthropic-key=sk-ant-...
```

## Monitoring

### Health Check

```bash
./scripts/health-check.sh

# JSON output
./scripts/health-check.sh --json
```

## Troubleshooting

### Gateway won't start
- Check configuration file exists
- Verify API keys are set
- Check port availability

### Channel connection issues
- Verify bot tokens
- Check network connectivity
- Review permissions
