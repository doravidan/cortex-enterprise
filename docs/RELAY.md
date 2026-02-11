# Relay Gateway Architecture

## Overview

The relay is Claude Code's built-in server process that acts as the single entry
point for all communication with Cortex Enterprise.  It replaces the need for
any external API gateway, reverse proxy, or custom server code.

```
                         ┌──────────────────────────────────────────────────┐
                         │              Claude Code Relay                    │
                         │              (port 18789, TLS)                    │
                         │                                                  │
  ┌────────┐  WebSocket  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
  │ Slack  ├────────────►│  │  Auth    │  │ Session  │  │   Agent      │  │
  └────────┘             │  │  Layer   ├──► Manager  ├──►  Router      │  │
                         │  │ (token)  │  │          │  │              │  │
  ┌────────┐  WebSocket  │  └──────────┘  └──────────┘  └──────┬───────┘  │
  │ Teams  ├────────────►│                                      │          │
  └────────┘             │        ┌─────────────────────────────┘          │
                         │        ▼                                        │
  ┌────────┐   HTTPS     │  ┌──────────────────────────────────────────┐   │
  │ Google ├────────────►│  │            Team Agents                    │   │
  │ Chat   │             │  │  ┌────────┐ ┌────────┐ ┌──────┐ ┌─────┐ │   │
  └────────┘             │  │  │ Code   │ │ DevOps │ │ SAP  │ │ ... │ │   │
                         │  │  └────────┘ └────────┘ └──────┘ └─────┘ │   │
  ┌────────┐   HTTPS     │  └──────────────────────────────────────────┘   │
  │Webhooks├────────────►│                      │                          │
  │ CI/CD  │             │                      ▼                          │
  └────────┘             │             ┌─────────────────┐                 │
                         │             │  Anthropic API   │                 │
                         │             │ (Opus 4.6)       │                 │
                         │             └─────────────────┘                 │
                         └──────────────────────────────────────────────────┘
```

## How the Relay Works

### 1. Startup

```bash
# Authenticate (one-time — uses your Anthropic subscription)
claude login

# Start the relay
claude --relay --config ~/.cortex/config.yaml
```

If using API key auth instead:
```bash
ANTHROPIC_API_KEY=sk-ant-... claude --relay --config ~/.cortex/config.yaml
```

The relay process:
1. Reads `~/.cortex/config.yaml`
2. Generates a TLS certificate (if `tls.autoGenerate: true`)
3. Starts listening on `gateway.port` (default 18789)
4. Initialises channel plugins (Slack, Teams, Google Chat)
5. Loads skills from the `skills/` directory
6. Prints the gateway URL and auth token to stdout

### 2. Authentication

Every request must include a bearer token:

```
Authorization: Bearer <token>
```

The token is generated on first startup and stored in the config directory.
Channel plugins handle token injection automatically.

### 3. Session Management

The relay creates one session per sender (configurable):

| Setting | Behaviour |
|---------|-----------|
| `session.scope: per-sender` | One session per user across all channels |
| `session.dmScope: per-channel-peer` | Separate sessions per channel |
| `session.reset.mode: daily` | Sessions reset daily at `atHour` |

### 4. Agent Routing

When a message arrives, the relay:
1. Authenticates the request
2. Finds or creates the sender's session
3. Routes to the **default agent** (orchestrator)
4. The orchestrator may delegate to a team agent (code, devops, sap, etc.)
5. Streams the response back to the channel

### 5. Webhook Routing

Webhooks bypass the orchestrator and route directly to a specific agent:

```yaml
hooks:
  mappings:
    - id: ci-webhook
      match:
        path: /hooks/ci
      action: agent
      agentId: devops         # goes straight to the DevOps team
```

## Configuration Reference

```yaml
gateway:
  port: 18789                # listening port
  mode: relay                # "relay" for server mode, "local" for CLI
  bind: loopback             # "loopback" (localhost) or "lan" (0.0.0.0)
  
  auth:
    mode: token              # authentication mode
  
  tls:
    enabled: true            # enable HTTPS
    autoGenerate: true       # auto-generate self-signed cert
    certFile: /path/cert.pem # or provide your own
    keyFile: /path/key.pem
  
  controlUi:
    enabled: true            # web UI for monitoring
    allowInsecureAuth: false  # require TLS for auth
```

## Network Security

### Localhost Only (Development)

```yaml
gateway:
  bind: loopback
```

Only accepts connections from `127.0.0.1`.  Channel plugins connect
outbound to Slack/Teams APIs and receive messages via their own WebSocket.

### LAN Binding (Production)

```yaml
gateway:
  bind: lan
  tls:
    enabled: true
    certFile: /etc/ssl/cortex/cert.pem
    keyFile: /etc/ssl/cortex/key.pem
```

Accepts connections from the local network.  Use a proper TLS certificate
(not self-signed) and restrict access with firewall rules.

## Health Check

The relay exposes a health endpoint:

```
GET https://localhost:18789/health
→ 200 OK  { "status": "healthy" }
```

Use this for load balancer health checks, Kubernetes liveness probes,
and monitoring systems.

## Troubleshooting

### Relay won't start
1. Check auth: run `claude auth status` (or verify `ANTHROPIC_API_KEY` is set)
2. If not logged in: run `claude login`
3. Verify port 18789 is not in use: `netstat -an | findstr 18789`
4. Check the config file exists at `~/.cortex/config.yaml`

### Channel not connecting
1. Verify the channel's bot tokens are set in environment variables
2. Check the channel is `enabled: true` in config
3. Review relay logs for connection errors

### WebSocket disconnects
1. Check network timeouts (some proxies kill idle connections)
2. Verify TLS certificate is valid
3. Increase keep-alive interval if behind a load balancer
