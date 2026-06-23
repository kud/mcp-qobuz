#!/usr/bin/env node
import {
  createKeychainStore,
  createMemoryStore,
  createQobuzClient,
  type QobuzClient,
} from "@kud/qobuz"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"

// ─── Auth ───

const resolveStore = () => {
  const token = process.env["QOBUZ_TOKEN"]
  const appId = process.env["QOBUZ_APP_ID"]
  if (token && appId) {
    return createMemoryStore({ token, appId })
  }
  return createKeychainStore()
}

const buildClient = async (): Promise<QobuzClient> => {
  const store = resolveStore()
  try {
    return await createQobuzClient({ store })
  } catch (e: unknown) {
    const isAuthError =
      e instanceof Error &&
      "kind" in e &&
      (e as { kind: string }).kind === "auth"
    if (isAuthError) {
      console.error(
        "No Qobuz credentials found. Set QOBUZ_TOKEN + QOBUZ_APP_ID env vars, " +
          "or run `qobuz login` to save credentials to macOS Keychain.",
      )
    } else {
      console.error("Failed to initialise Qobuz client:", e)
    }
    return process.exit(1)
  }
}

// ─── Response helpers ───

export const ok = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
})

export const err = (msg: string) => ({
  content: [{ type: "text" as const, text: `Error: ${msg}` }],
})

// ─── Tool handlers ───

export const makeHandlers = (client: QobuzClient) => {
  // ─── Search ───

  const search = async ({
    query,
    type,
    limit,
  }: {
    query: string
    type?: "albums" | "artists" | "tracks" | "all"
    limit?: number
  }) => {
    try {
      const results = await client.search.search(query, { limit: limit ?? 20 })
      const deepLink = client.deepLink

      const albums =
        !type || type === "all" || type === "albums"
          ? results.albums.map((a) => ({
              ...a,
              url: deepLink.album(a.id),
            }))
          : []

      const artists =
        !type || type === "all" || type === "artists"
          ? results.artists.map((a) => ({
              ...a,
              url: deepLink.artist(a.id),
            }))
          : []

      const tracks =
        !type || type === "all" || type === "tracks"
          ? results.tracks.map((t) => ({
              ...t,
              url: deepLink.track(t.id),
            }))
          : []

      return ok({ query: results.query, albums, artists, tracks })
    } catch (e) {
      console.error("search error:", e)
      return err("search failed")
    }
  }

  // ─── Tracks ───

  const getTrack = async ({ id }: { id: number }) => {
    try {
      const track = await client.tracks.get(id)
      return ok({ ...track, url: client.deepLink.track(track.id) })
    } catch (e) {
      console.error("get-track error:", e)
      return err(`track ${id} not found`)
    }
  }

  // ─── Albums ───

  const getAlbum = async ({ id }: { id: string }) => {
    try {
      const album = await client.albums.get(id)
      return ok({ ...album, url: client.deepLink.album(album.id) })
    } catch (e) {
      console.error("get-album error:", e)
      return err(`album ${id} not found`)
    }
  }

  // ─── Artists ───

  const getArtist = async ({ id }: { id: number }) => {
    try {
      const artist = await client.artists.get(id)
      return ok({ ...artist, url: client.deepLink.artist(artist.id) })
    } catch (e) {
      console.error("get-artist error:", e)
      return err(`artist ${id} not found`)
    }
  }

  // ─── Playlists ───

  const getPlaylist = async ({ id }: { id: number }) => {
    try {
      const playlist = await client.playlists.get(id)
      return ok({ ...playlist, url: client.deepLink.playlist(playlist.id) })
    } catch (e) {
      console.error("get-playlist error:", e)
      return err(`playlist ${id} not found`)
    }
  }

  const listPlaylists = async ({ limit }: { limit?: number }) => {
    try {
      const playlists = await client.playlists.listForUser({
        limit: limit ?? 50,
      })
      const deepLink = client.deepLink
      return ok(playlists.map((p) => ({ ...p, url: deepLink.playlist(p.id) })))
    } catch (e) {
      console.error("list-playlists error:", e)
      return err("failed to list playlists")
    }
  }

  // ─── Favourites ───

  const listFavourites = async ({
    type,
    limit,
  }: {
    type: "albums" | "artists" | "tracks"
    limit?: number
  }) => {
    try {
      const favourites = await client.favourites.list(type, {
        limit: limit ?? 50,
      })
      const deepLink = client.deepLink

      const albums = favourites.albums.map((a) => ({
        ...a,
        url: deepLink.album(a.id),
      }))
      const artists = favourites.artists.map((a) => ({
        ...a,
        url: deepLink.artist(a.id),
      }))
      const tracks = favourites.tracks.map((t) => ({
        ...t,
        url: deepLink.track(t.id),
      }))

      return ok({ type, albums, artists, tracks })
    } catch (e) {
      console.error("list-favourites error:", e)
      return err("failed to list favourites")
    }
  }

  // ─── Now Playing (macOS-only) ───

  const nowPlaying = async () => {
    if (process.platform !== "darwin") {
      return err(
        "now-playing is only available on macOS — it reads the Qobuz desktop app's local player state file.",
      )
    }
    try {
      const track = await client.nowPlaying()
      if (!track) {
        return ok({
          playing: false,
          message: "Nothing is currently playing in Qobuz.",
        })
      }
      return ok({
        playing: true,
        track: { ...track, url: client.deepLink.track(track.id) },
      })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes("ENOENT") || msg.includes("no such file")) {
        return err(
          "Qobuz desktop player state file not found. Make sure the Qobuz desktop app is running on this Mac.",
        )
      }
      console.error("now-playing error:", e)
      return err("failed to read now-playing state")
    }
  }

  // ─── Write tools ───

  const createPlaylist = async ({
    name,
    description,
    isPublic,
    confirm,
  }: {
    name: string
    description?: string
    isPublic?: boolean
    confirm: boolean
  }) => {
    if (!confirm) {
      return err(
        "Set confirm: true to create a playlist. This will create a new playlist on your Qobuz account.",
      )
    }
    try {
      const playlist = await client.playlists.create({
        name,
        description,
        isPublic,
      })
      return ok({ ...playlist, url: client.deepLink.playlist(playlist.id) })
    } catch (e) {
      console.error("create-playlist error:", e)
      return err("failed to create playlist")
    }
  }

  const addToPlaylist = async ({
    playlistId,
    trackIds,
    confirm,
  }: {
    playlistId: number
    trackIds: number[]
    confirm: boolean
  }) => {
    if (!confirm) {
      return err(
        `Set confirm: true to add ${trackIds.length} track(s) to playlist ${playlistId}.`,
      )
    }
    try {
      const playlist = await client.playlists.addTracks(playlistId, trackIds)
      return ok({ ...playlist, url: client.deepLink.playlist(playlist.id) })
    } catch (e) {
      console.error("add-to-playlist error:", e)
      return err("failed to add tracks to playlist")
    }
  }

  const updatePlaylistDescription = async ({
    playlistId,
    description,
    confirm,
  }: {
    playlistId: number
    description: string
    confirm: boolean
  }) => {
    if (!confirm) {
      return err(
        `Set confirm: true to update the description of playlist ${playlistId}.`,
      )
    }
    try {
      const playlist = await client.playlists.update(playlistId, {
        description,
      })
      return ok({ ...playlist, url: client.deepLink.playlist(playlist.id) })
    } catch (e) {
      console.error("update-playlist-description error:", e)
      return err("failed to update playlist description")
    }
  }

  return {
    search,
    getTrack,
    getAlbum,
    getArtist,
    getPlaylist,
    listPlaylists,
    listFavourites,
    nowPlaying,
    createPlaylist,
    addToPlaylist,
    updatePlaylistDescription,
  }
}

// ─── Server ───

const main = async () => {
  const client = await buildClient()
  const handlers = makeHandlers(client)

  const server = new McpServer({ name: "mcp-qobuz", version: "1.0.0" })

  // ─── Search ───

  server.registerTool(
    "search",
    {
      description:
        "Search Qobuz for albums, artists, and/or tracks. Returns results with Qobuz deep links.",
      inputSchema: {
        query: z.string().describe("Search query"),
        type: z
          .enum(["albums", "artists", "tracks", "all"])
          .default("all")
          .describe("Filter results to a specific entity type (default: all)"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("Max results per category (default: 20)"),
      },
    },
    handlers.search,
  )

  // ─── Entity lookups ───

  server.registerTool(
    "get-track",
    {
      description: "Fetch a single Qobuz track by its numeric ID.",
      inputSchema: {
        id: z.number().int().describe("Qobuz track ID (numeric)"),
      },
    },
    handlers.getTrack,
  )

  server.registerTool(
    "get-album",
    {
      description: "Fetch a single Qobuz album by its string ID.",
      inputSchema: {
        id: z
          .string()
          .describe("Qobuz album ID (string, e.g. '0060253786997')"),
      },
    },
    handlers.getAlbum,
  )

  server.registerTool(
    "get-artist",
    {
      description: "Fetch a single Qobuz artist by their numeric ID.",
      inputSchema: {
        id: z.number().int().describe("Qobuz artist ID (numeric)"),
      },
    },
    handlers.getArtist,
  )

  server.registerTool(
    "get-playlist",
    {
      description:
        "Fetch a single Qobuz playlist by its numeric ID, including its tracks.",
      inputSchema: {
        id: z.number().int().describe("Qobuz playlist ID (numeric)"),
      },
    },
    handlers.getPlaylist,
  )

  // ─── Browse ───

  server.registerTool(
    "list-playlists",
    {
      description: "List the authenticated user's Qobuz playlists.",
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .max(500)
          .optional()
          .describe("Max number of playlists to return (default: 50)"),
      },
    },
    handlers.listPlaylists,
  )

  server.registerTool(
    "list-favourites",
    {
      description:
        "List the authenticated user's Qobuz favourites (albums, artists, or tracks).",
      inputSchema: {
        type: z
          .enum(["albums", "artists", "tracks"])
          .describe("Which type of favourites to list"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(500)
          .optional()
          .describe("Max results to return (default: 50)"),
      },
    },
    handlers.listFavourites,
  )

  // ─── Now Playing ───

  server.registerTool(
    "now-playing",
    {
      description:
        "Returns the track currently playing in the Qobuz desktop app. " +
        "MACOS ONLY: reads ~/Library/Application Support/Qobuz/player-0.json written by the Qobuz desktop app. " +
        "This tool will return an error if the MCP server is not running on the same Mac as the Qobuz desktop app, " +
        "or if the Qobuz app is not open.",
      inputSchema: {},
    },
    handlers.nowPlaying,
  )

  // ─── Write tools ───

  server.registerTool(
    "create-playlist",
    {
      description:
        "Create a new Qobuz playlist. Requires confirm: true to prevent accidental creation.",
      inputSchema: {
        name: z.string().describe("Playlist name"),
        description: z.string().optional().describe("Playlist description"),
        isPublic: z
          .boolean()
          .default(false)
          .describe("Whether the playlist is public"),
        confirm: z
          .boolean()
          .default(false)
          .describe("Must be true to actually create the playlist"),
      },
    },
    handlers.createPlaylist,
  )

  server.registerTool(
    "add-to-playlist",
    {
      description:
        "Add one or more tracks to an existing Qobuz playlist. Requires confirm: true.",
      inputSchema: {
        playlistId: z.number().int().describe("Target playlist ID"),
        trackIds: z.array(z.number().int()).min(1).describe("Track IDs to add"),
        confirm: z
          .boolean()
          .default(false)
          .describe("Must be true to actually add tracks"),
      },
    },
    handlers.addToPlaylist,
  )

  server.registerTool(
    "update-playlist-description",
    {
      description:
        "Update the description of an existing Qobuz playlist. Requires confirm: true.",
      inputSchema: {
        playlistId: z.number().int().describe("Playlist ID to update"),
        description: z.string().describe("New description text"),
        confirm: z
          .boolean()
          .default(false)
          .describe("Must be true to actually update the description"),
      },
    },
    handlers.updatePlaylistDescription,
  )

  // TODO: convert-link — awaiting extraction of shared @kud/song-match package.
  // The resolve logic (ISRC-based Spotify/YouTube Music ↔ Qobuz conversion) is
  // currently duplicated across qobuz-cli and raycast-extensions/qobuz.
  // Once @kud/song-match is published, add a convert-link tool here as a consumer.

  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error("mcp-qobuz running")
}

main().catch((e) => {
  console.error("Fatal:", e)
  process.exit(1)
})
