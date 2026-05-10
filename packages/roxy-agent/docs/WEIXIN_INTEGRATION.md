# Weixin Integration

This integration is for a single-user personal assistant scenario only.

## Current Flow

The Weixin bot token is no longer created or stored by `roxy-agent`.

The current production flow is:

1. The user opens the WeChat config page in the app frontend.
2. The frontend asks Electron for a QR login session.
3. The frontend renders the QR code and polls the QR status.
4. After scan confirmation, the frontend saves `weixin_bot_token` and `weixin_bot_base_url` to backend RoxyClaw config.
5. Electron reads that backend config when starting RoxyClaw and injects:
   - `WEIXIN_BOT_ENABLE`
   - `WEIXIN_BOT_TOKEN`
   - `WEIXIN_BOT_BASE_URL`
6. `roxy-agent` starts the Weixin adapter only when the injected token is present.

## Important Constraints

- Personal chat only.
- No group chat handling.
- No multi-user routing.
- Replies are final-message only.
- No streaming output to Weixin.

## Environment Variables

These values are expected to be injected by Electron at startup:

```bash
ENABLE_IM=true
ROXY_MODE=im
WEIXIN_BOT_ENABLE=true
WEIXIN_BOT_TOKEN=...
WEIXIN_BOT_BASE_URL=https://ilinkai.weixin.qq.com
```

## What `roxy-agent` Does

The adapter:

- polls `ilink/bot/getupdates`
- accepts direct messages only
- sends a single final reply through `ilink/bot/sendmessage`
- supports `/new`, `/clear`, and `/status`

The adapter does not:

- generate QR codes
- perform QR login
- persist token or cursor to local files as source of truth

## Troubleshooting

### Frontend can get QR code but cannot finish binding

- Check Electron IPC:
  - `mcp:getWeixinBotQrcode`
  - `mcp:getWeixinBotQrcodeStatus`
- Check whether backend config save succeeded.
- Check whether backend actually stores `weixin_bot_token` / `weixin_bot_base_url` or compatible aliases.

### RoxyClaw starts but Weixin adapter does not start

- Check that backend config has a non-empty token.
- Check Electron startup env includes `WEIXIN_BOT_TOKEN`.
- Check `WEIXIN_BOT_ENABLE=true` is being injected.

### Weixin receives no reply

- Check `context_token` from inbound message is being passed back unchanged.
- Check token is still valid.
- Check the reply length is within adapter split limits.
