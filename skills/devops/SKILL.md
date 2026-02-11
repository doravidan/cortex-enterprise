# DevOps

CI/CD pipelines, deployment automation, containerisation, and infrastructure management.

## Triggers

Activate this skill when the user asks you to:
- Deploy an application or service
- Set up or modify CI/CD pipelines
- Work with Docker, Kubernetes, Helm, or Cloud Foundry
- Manage infrastructure, environments, or secrets
- Troubleshoot a deployment or build failure
- Set up monitoring or health checks

## Instructions

### Deployments

1. **Always check the current target/context first:**
   ```bash
   # Kubernetes
   kubectl config current-context
   kubectl get ns

   # Cloud Foundry
   cf target

   # Docker
   docker context ls
   ```
2. **Validate before deploying:**
   - Run tests locally
   - Check the diff against the deployed version
   - Verify environment variables and secrets are set
3. **Use staged rollouts:**
   - Blue-green or canary deployments for production
   - Deploy to staging/dev first
   - Verify health checks pass before cutting traffic
4. **Never deploy directly to production without explicit user confirmation.**

### Docker

Build images following these practices:
```dockerfile
# Multi-stage build for smaller images
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --production=false
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package*.json ./
EXPOSE 8080
USER node
CMD ["node", "dist/server.js"]
```

Key rules:
- Use specific base image tags, not `latest`
- Run as non-root user
- Use `.dockerignore` to exclude unnecessary files
- Use multi-stage builds to reduce image size

### Kubernetes

```bash
# Validate manifests before applying
kubectl apply --dry-run=client -f manifests/

# Apply with rollout tracking
kubectl apply -f manifests/
kubectl rollout status deployment/<name> --timeout=300s

# Quick rollback if needed
kubectl rollout undo deployment/<name>
```

### Cloud Foundry (SAP BTP)

```bash
# Verify target
cf target -o <org> -s <space>

# Blue-green deploy
cf push <app>-green -f manifest.yaml
cf map-route <app>-green <domain> --hostname <app>
cf unmap-route <app>-blue <domain> --hostname <app>
cf rename <app>-blue <app>-old
cf rename <app>-green <app>
```

### CI/CD Pipelines

When creating pipeline configs:
1. Include linting, testing, security scanning, and deployment stages
2. Cache dependencies between runs
3. Use secrets management — never hardcode credentials
4. Add manual approval gates for production deployments
5. Include rollback steps

### Troubleshooting Deployments

Follow this sequence:
1. Check pod/app status and events
2. Read container logs
3. Verify resource limits (CPU, memory)
4. Check service bindings and environment variables
5. Validate network policies and ingress
6. Check image pull status and registry access

## Examples

```
User: Deploy the app to staging
Agent: I'll check the current CF/K8s target, verify the build is clean,
       and deploy to the staging environment with health check verification.
```

```
User: The pod keeps crashing
Agent: I'll check pod events, read container logs, verify resource limits,
       and inspect the liveness/readiness probe configuration.
```
