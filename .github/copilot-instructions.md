# Copilot Instructions — mcp-qobuz

## Project context

`@kud/mcp-qobuz` is a TypeScript MCP server that exposes the Qobuz music service
to AI assistants via the Model Context Protocol. It is one of four surfaces in the
`@kud/qobuz` ecosystem; all share the `@kud/qobuz` core client library.

**Stack:**

- Runtime: Node.js >=20, ESM-only (`"type": "module"`, NodeNext resolution)
- MCP layer: `@modelcontextprotocol/sdk` — tools registered with `server.registerTool()`
- Input validation: Zod v4 schemas passed directly to `registerTool` `inputSchema`
- Core client: `@kud/qobuz` (auth, API transport, types, deep-link helpers)
- Auth: macOS Keychain (`createKeychainStore`) or env vars (`QOBUZ_TOKEN` + `QOBUZ_APP_ID`)
- Tests: Vitest — unit tests mock `@kud/qobuz` via `vi.fn()`, export `makeHandlers` for
  testability
- Build: `tsc` → `dist/`, strict mode, no bundler

**Key architectural invariants:**

- All tool handlers live inside `makeHandlers(client)` and return `ok(data)` or
  `err(message)` — never throw out of a handler.
- Write tools (`create-playlist`, `add-to-playlist`, `update-playlist-description`)
  require `confirm: true` to execute; they return an `err()` message otherwise.
- `now-playing` is macOS-only and reads a local Qobuz desktop app state file; it
  must return a graceful `err()` on any other platform or when the file is absent.
- `console.error` is the correct logging channel (stdout is the MCP stdio transport).
- The `convert-link` tool is intentionally absent pending extraction of a shared
  `@kud/song-match` package. Do not copy the resolve logic into this repo.

---

## Content rules

Flag these patterns:

1. **Uncaught throws in tool handlers** — every handler must catch its own errors
   and return `err(msg)`. A throw propagating out of a handler crashes the MCP
   connection rather than returning a structured error to the client.

2. **console.log in server code** — only `console.error` is safe; `console.log`
   writes to stdout which is the MCP stdio transport and will corrupt the protocol
   stream.

3. **Missing `confirm` guard on write tools** — any tool that mutates Qobuz state
   (playlist create/update/delete, track additions) must gate behind `confirm: true`.
   A missing guard exposes the user's library to accidental writes from AI calls.

4. **Importing resolve/song-match logic directly** — the track conversion logic
   (ISRC-based cross-service lookup) must not be duplicated into this repo. It
   belongs in a future `@kud/song-match` package.

5. **Hardcoded platform checks using string literals other than `"darwin"`** — the
   macOS constraint for `now-playing` is documented; any new platform guard must
   also be tested with `Object.defineProperty(process, "platform", ...)` in vitest.

6. **Zod schema missing `.describe()`** — every Zod field in an `inputSchema` needs
   a `.describe()` call; this text surfaces as the parameter description in MCP
   inspector and AI tool cards.

7. **Breaking the `ok`/`err` response contract** — tool handlers must return the
   `{ content: [{ type: "text", text: string }] }` shape produced by `ok()` and
   `err()`. Never return a raw object or throw; the MCP client cannot parse it.

8. **Pinned dependency versions loosened** — all versions in `package.json` must be
   exact (no `^` or `~`). Ranges introduce non-deterministic builds in a published
   binary.

---

## Suppression rules

Do not flag:

- `as never` cast when passing `mockClient` to `makeHandlers` in tests — this is
  the established pattern for mocking the `QobuzClient` interface without a full
  implementation.
- `vi.hoisted()` block at the top of the test file — required by Vitest for hoisting
  env-var setup before module imports; not a code smell.
- `(e as { kind: string }).kind` cast in `buildClient` — `@kud/qobuz` error shapes
  are not exported as TypeScript types; the cast is intentional and documented.
- `process.exit(1)` in `buildClient` — correct startup-time behaviour for an MCP
  server that cannot authenticate; not a missing error boundary.
- `console.error("mcp-qobuz running")` startup log — intentional; MCP servers signal
  readiness via stderr.
- Verbose `describe` / `beforeEach` / `afterEach` boilerplate in tests — standard
  Vitest setup, not a refactoring opportunity.
- The `TODO: convert-link` comment in `src/index.ts` — tracked and intentional; do
  not suggest inlining the resolve logic.
- `chmod +x dist/index.js` in the build script — required so the published binary is
  directly executable; not a security issue.

---

## Review Format

Every Copilot review comment must carry a risk label, a motivation sentence, and a
concrete suggestion. No exceptions.

### Risk labels

```
🔥 blocking:  — must fix before merge (correctness, security, data integrity)
🌶️ concern:   — should fix, not a blocker (reliability, maintainability)
🧊 nitpick:   — optional (style, naming, minor improvement)
```

### Comment structure

```
<risk-label>: <one-line summary of the issue>

<One sentence explaining why this matters specifically in mcp-qobuz — not a generic
principle, but grounded in this codebase's architecture or constraints.>

<Concrete suggestion — what to change, not just what is wrong. Include a code
snippet when the fix is non-obvious.>
```

### Example

```
🔥 blocking: handler throws instead of returning err()

In mcp-qobuz every tool handler must catch its own errors and return err(msg);
an uncaught throw propagates out of registerTool and terminates the MCP stdio
connection, dropping all in-flight requests from the client.

Wrap the body in try/catch and replace `throw e` with
`return err("failed to fetch track")`.
```
