# Channel Setup Guide

Cortex Enterprise supports enterprise messaging channels only.
All channels connect through the Claude Code relay gateway.

## How Channels Work

```
  Channel (Slack/Teams/Chat)
           │
           ▼ WebSocket / HTTPS
  ┌────────────────────┐
  │  Claude Code Relay  │
  │  (port 18789)       │
  │                     │
  │  Auth → Session →   │
  │  Orchestrator →     │
  │  Team Agent →       │
  │  Response            │
  └────────────────────┘
```

The relay handles all channel communication.  You just need to provide
the bot tokens as environment variables and enable the channel in config.

## Supported Channels

| Channel | Config Key | Status |
|---------|-----------|--------|
| Slack | `channels.slack` | Supported |
| Microsoft Teams | `channels.msteams` | Supported |
| Google Chat | `channels.googlechat` | Supported |

## Slack

### 1. Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Create a new app from scratch
3. Enable Socket Mode
4. Add bot scopes: `chat:write`, `app_mentions:read`, `im:history`, `channels:history`
5. Install to workspace

### 2. Set Environment Variables

```bash
export SLACK_BOT_TOKEN=xoxb-...
export SLACK_APP_TOKEN=xapp-...
```

```powershell
$env:SLACK_BOT_TOKEN = "xoxb-..."
$env:SLACK_APP_TOKEN = "xapp-..."
```

### 3. Enable in Config

```yaml
channels:
  slack:
    enabled: true
    dmPolicy: allowlist
    groupPolicy: allowlist
```

## Microsoft Teams

### 1. Register a Bot

1. Go to the Azure Portal → Bot Services
2. Create a new Bot Channel Registration
3. Note the App ID and Password
4. Add the Teams channel

### 2. Set Environment Variables

```bash
export MSTEAMS_APP_ID=...
export MSTEAMS_APP_PASSWORD=...
```

### 3. Enable in Config

```yaml
channels:
  msteams:
    enabled: true
    dmPolicy: allowlist
    groupPolicy: allowlist
```

## Google Chat

### 1. Create a Chat App

1. Go to Google Cloud Console → APIs & Services
2. Enable the Google Chat API
3. Configure the Chat app (Bot URL = your relay endpoint)
4. Set authentication credentials

### 2. Set Environment Variables

```bash
export GOOGLE_CHAT_CREDENTIALS=/path/to/service-account.json
```

### 3. Enable in Config

```yaml
channels:
  googlechat:
    enabled: true
    dmPolicy: allowlist
    groupPolicy: allowlist
```

## Access Policies

Each channel supports `dmPolicy` and `groupPolicy`:

| Policy | Behaviour |
|--------|-----------|
| `allowlist` | Only approved users/groups can interact |
| `open` | Anyone in the workspace can interact |

For enterprise use, `allowlist` is recommended.

## Disabled Channels

Consumer messaging channels are permanently disabled:

- Telegram
- WhatsApp
- Signal
- iMessage
- Discord

These cannot be enabled — they are in the `plugins.deny` list.

## Security Recommendations

- Store tokens in a secret manager (never commit to git)
- Use `allowlist` policies to restrict access
- Rotate credentials regularly
- Monitor channel activity via relay logs
