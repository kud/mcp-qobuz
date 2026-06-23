<div align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js&logoColor=white)
![npm](https://img.shields.io/npm/v/@kud/mcp-qobuz?style=flat-square&color=CB3837)
![MIT](https://img.shields.io/badge/licence-MIT-22C55E?style=flat-square)

**MCP server for Qobuz — search, browse, and explore your music library via AI.**

<a href="https://kud.io/projects/mcp-qobuz">Website</a> · <a href="https://kud.io/projects/mcp-qobuz/docs">Documentation</a>

</div>

## Features

- **Eleven tools out of the box** — search tracks, albums, artists, and playlists; fetch detail pages; list your favourites; and manage playlists, all from any MCP client.
- **Two auth paths** — macOS Keychain via `createKeychainStore()` (shared with `qobuz-cli` and the Raycast extension) or `QOBUZ_TOKEN` + `QOBUZ_APP_ID` env vars for headless and remote use; env vars take precedence when present.
- **Safety-gated writes** — `create-playlist`, `add-to-playlist`, and `update-playlist-description` require `confirm: true` to prevent accidental mutations.
- **Now-playing from the desktop app** — reads `~/Library/Application Support/Qobuz/player-0.json` written by the Qobuz desktop app; returns a graceful error when the file is absent or on non-macOS platforms.
- **Deep links on every result** — every tool response includes an `open.qobuz.com` URL so results are one click away from the player.
- **Powered by @kud/qobuz** — built on the same `@kud/qobuz` core library used across the kud music toolchain.

## Install

```sh
npm install -g @kud/mcp-qobuz
```

## Configuration

### Keychain auth (local Mac — shared credentials with qobuz-cli)

Add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "mcp-qobuz": {
      "command": "npx",
      "args": ["tsx", "/path/to/mcp-qobuz/src/index.ts"]
    }
  }
}
```

Credentials are read automatically from the macOS Keychain. Log in once with `qobuz-cli` or the Raycast extension and this server picks them up.

### Env var auth (headless / remote)

```json
{
  "mcpServers": {
    "mcp-qobuz": {
      "command": "npx",
      "args": ["tsx", "/path/to/mcp-qobuz/src/index.ts"],
      "env": {
        "QOBUZ_TOKEN": "your-token",
        "QOBUZ_APP_ID": "your-app-id"
      }
    }
  }
}
```

Env vars take precedence over the Keychain when both are present.

## Tools

| Tool                          | Description                                                       |
| ----------------------------- | ----------------------------------------------------------------- |
| `search`                      | Search Qobuz for tracks, albums, artists, or playlists            |
| `get-track`                   | Fetch full track details by ID                                    |
| `get-album`                   | Fetch full album details by ID                                    |
| `get-artist`                  | Fetch artist biography and discography by ID                      |
| `get-playlist`                | Fetch a playlist and its tracks by ID                             |
| `list-playlists`              | List your Qobuz playlists                                         |
| `list-favourites`             | List your favourited tracks, albums, and artists                  |
| `now-playing`                 | Show what the Qobuz desktop app is currently playing (macOS only) |
| `create-playlist`             | Create a new playlist — requires `confirm: true`                  |
| `add-to-playlist`             | Add a track to a playlist — requires `confirm: true`              |
| `update-playlist-description` | Update a playlist's description — requires `confirm: true`        |

## Development

```sh
git clone https://github.com/kud/mcp-qobuz.git
cd mcp-qobuz
npm install
npm run dev
```

| Command               | Description                                   |
| --------------------- | --------------------------------------------- |
| `npm run dev`         | Run the server with `tsx` (no build step)     |
| `npm run build`       | Compile TypeScript to `dist/`                 |
| `npm test`            | Run the Vitest test suite                     |
| `npm run inspect:dev` | Open the MCP Inspector against the dev server |

📚 **Full documentation → [mcp-qobuz/docs](https://kud.io/projects/mcp-qobuz/docs)**
