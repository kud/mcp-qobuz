# mcp-qobuz

## API Reference

Official API docs: https://www.qobuz.com/api.json/0.2 (unofficial — Qobuz has no public docs)

Core client: `@kud/qobuz` v0.5.5 — see `/Users/kud/Projects/qobuz-cli` and `/Users/kud/Projects/raycast-extensions/extensions/qobuz` for sibling surfaces using the same client.

## Architecture

This server is one of six surfaces in the `@kud/qobuz` ecosystem:

- `@kud/qobuz` — core client library (auth, API transport, types)
- `qobuz-cli` — terminal surface
- `raycast-extensions/qobuz` — Raycast surface
- `mcp-qobuz` — MCP surface (this repo)

## Auth

Two auth paths (both supported simultaneously):

1. **Keychain** (`createKeychainStore()`) — for local Mac use, shares credentials with the CLI and Raycast extension via the `"qobuz"/"default"` keychain entry.
2. **Env vars** (`QOBUZ_TOKEN` + `QOBUZ_APP_ID`) — for headless/remote use where macOS Keychain is unavailable.

Env vars take precedence over Keychain when present.

## now-playing macOS constraint

`client.nowPlaying()` reads `~/Library/Application Support/Qobuz/player-0.json` written by the Qobuz desktop app. This only works when the MCP server and Qobuz desktop app run on the same Mac. Return a graceful error on any other platform or when the file is absent.

## TODO: convert-link

The `convert-link` tool (Spotify/YouTube Music ↔ Qobuz via ISRC) is intentionally absent. The resolve logic is currently duplicated in:

- `/Users/kud/Projects/qobuz-cli/src/resolve.ts`
- `/Users/kud/Projects/raycast-extensions/extensions/qobuz/src/lib/resolve.ts`

The plan is to extract a shared `@kud/song-match` package first, then add `convert-link` here as a consumer of that shared lib. Do NOT copy `resolve.ts` into this repo.
