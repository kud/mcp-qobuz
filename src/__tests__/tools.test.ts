import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Set env vars before module import so buildClient uses memory store
vi.hoisted(() => {
  process.env["QOBUZ_TOKEN"] = "test-token"
  process.env["QOBUZ_APP_ID"] = "test-app-id"
})

import { err, makeHandlers, ok } from "../index.js"

// ─── Mock @kud/qobuz ───

const mockSearch = vi.fn()
const mockTrackGet = vi.fn()
const mockAlbumGet = vi.fn()
const mockArtistGet = vi.fn()
const mockPlaylistGet = vi.fn()
const mockPlaylistListForUser = vi.fn()
const mockPlaylistCreate = vi.fn()
const mockPlaylistAddTracks = vi.fn()
const mockPlaylistUpdate = vi.fn()
const mockFavouritesList = vi.fn()
const mockNowPlaying = vi.fn()

const mockDeepLink = {
  album: (id: string) => `https://open.qobuz.com/album/${id}`,
  track: (id: number) => `https://open.qobuz.com/track/${id}`,
  artist: (id: number) => `https://open.qobuz.com/artist/${id}`,
  playlist: (id: number) => `https://open.qobuz.com/playlist/${id}`,
}

const mockClient = {
  search: { search: mockSearch },
  tracks: { get: mockTrackGet },
  albums: { get: mockAlbumGet },
  artists: { get: mockArtistGet },
  playlists: {
    get: mockPlaylistGet,
    listForUser: mockPlaylistListForUser,
    create: mockPlaylistCreate,
    addTracks: mockPlaylistAddTracks,
    update: mockPlaylistUpdate,
  },
  favourites: { list: mockFavouritesList },
  nowPlaying: mockNowPlaying,
  deepLink: mockDeepLink,
  appLink: mockDeepLink,
  appId: "test-app-id",
  signOut: vi.fn(),
}

// ─── Fixtures ───

const track = {
  id: 1,
  title: "Creep",
  album: { id: "abc", title: "Pablo Honey" },
  artist: { id: 10, name: "Radiohead" },
}
const album = {
  id: "abc123",
  title: "Pablo Honey",
  artist: { id: 10, name: "Radiohead" },
}
const artist = { id: 10, name: "Radiohead", albumsCount: 9 }
const playlist = { id: 42, name: "My Mix", tracksCount: 10 }

// ─── Helpers ───

const text = (result: { content: Array<{ text: string }> }) =>
  result.content[0].text
const parsed = (result: { content: Array<{ text: string }> }) =>
  JSON.parse(text(result))

// ─── Tests ───

describe("ok / err helpers", () => {
  it("ok serialises data as JSON", () => {
    const result = ok({ foo: "bar" })
    expect(text(result)).toBe(JSON.stringify({ foo: "bar" }, null, 2))
  })

  it("err prefixes message", () => {
    expect(text(err("something broke"))).toBe("Error: something broke")
  })
})

describe("search", () => {
  let handlers: ReturnType<typeof makeHandlers>

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = makeHandlers(mockClient as never)
  })

  it("returns albums, artists, and tracks with deep links on success", async () => {
    mockSearch.mockResolvedValue({
      query: "radiohead",
      albums: [album],
      artists: [artist],
      tracks: [track],
    })

    const result = await handlers.search({ query: "radiohead" })
    const data = parsed(result)

    expect(data.query).toBe("radiohead")
    expect(data.albums[0].url).toContain("/album/abc123")
    expect(data.artists[0].url).toContain("/artist/10")
    expect(data.tracks[0].url).toContain("/track/1")
  })

  it("filters to only albums when type=albums", async () => {
    mockSearch.mockResolvedValue({
      query: "q",
      albums: [album],
      artists: [artist],
      tracks: [track],
    })
    const result = await handlers.search({ query: "q", type: "albums" })
    const data = parsed(result)
    expect(data.albums).toHaveLength(1)
    expect(data.artists).toHaveLength(0)
    expect(data.tracks).toHaveLength(0)
  })

  it("returns error when search throws", async () => {
    mockSearch.mockRejectedValue(new Error("network error"))
    const result = await handlers.search({ query: "radiohead" })
    expect(text(result)).toContain("Error:")
  })
})

describe("getTrack", () => {
  let handlers: ReturnType<typeof makeHandlers>

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = makeHandlers(mockClient as never)
  })

  it("returns track with deep link on success", async () => {
    mockTrackGet.mockResolvedValue(track)
    const result = await handlers.getTrack({ id: 1 })
    const data = parsed(result)
    expect(data.title).toBe("Creep")
    expect(data.url).toContain("/track/1")
  })

  it("returns error when track is not found", async () => {
    mockTrackGet.mockRejectedValue(new Error("404"))
    const result = await handlers.getTrack({ id: 999 })
    expect(text(result)).toContain("Error:")
    expect(text(result)).toContain("999")
  })
})

describe("getAlbum", () => {
  let handlers: ReturnType<typeof makeHandlers>

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = makeHandlers(mockClient as never)
  })

  it("returns album with deep link on success", async () => {
    mockAlbumGet.mockResolvedValue(album)
    const result = await handlers.getAlbum({ id: "abc123" })
    const data = parsed(result)
    expect(data.title).toBe("Pablo Honey")
    expect(data.url).toContain("/album/abc123")
  })

  it("returns error when album fetch fails", async () => {
    mockAlbumGet.mockRejectedValue(new Error("404"))
    const result = await handlers.getAlbum({ id: "missing" })
    expect(text(result)).toContain("Error:")
    expect(text(result)).toContain("missing")
  })
})

describe("getArtist", () => {
  let handlers: ReturnType<typeof makeHandlers>

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = makeHandlers(mockClient as never)
  })

  it("returns artist with deep link on success", async () => {
    mockArtistGet.mockResolvedValue(artist)
    const result = await handlers.getArtist({ id: 10 })
    const data = parsed(result)
    expect(data.name).toBe("Radiohead")
    expect(data.url).toContain("/artist/10")
  })

  it("returns error when artist fetch fails", async () => {
    mockArtistGet.mockRejectedValue(new Error("404"))
    const result = await handlers.getArtist({ id: 999 })
    expect(text(result)).toContain("Error:")
  })
})

describe("getPlaylist", () => {
  let handlers: ReturnType<typeof makeHandlers>

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = makeHandlers(mockClient as never)
  })

  it("returns playlist with deep link on success", async () => {
    mockPlaylistGet.mockResolvedValue(playlist)
    const result = await handlers.getPlaylist({ id: 42 })
    const data = parsed(result)
    expect(data.name).toBe("My Mix")
    expect(data.url).toContain("/playlist/42")
  })

  it("returns error when playlist fetch fails", async () => {
    mockPlaylistGet.mockRejectedValue(new Error("404"))
    const result = await handlers.getPlaylist({ id: 999 })
    expect(text(result)).toContain("Error:")
  })
})

describe("listPlaylists", () => {
  let handlers: ReturnType<typeof makeHandlers>

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = makeHandlers(mockClient as never)
  })

  it("returns playlists with deep links", async () => {
    mockPlaylistListForUser.mockResolvedValue([playlist])
    const result = await handlers.listPlaylists({})
    const data = parsed(result)
    expect(data).toHaveLength(1)
    expect(data[0].url).toContain("/playlist/42")
  })

  it("returns error when list fails", async () => {
    mockPlaylistListForUser.mockRejectedValue(new Error("api error"))
    const result = await handlers.listPlaylists({})
    expect(text(result)).toContain("Error:")
  })
})

describe("listFavourites", () => {
  let handlers: ReturnType<typeof makeHandlers>

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = makeHandlers(mockClient as never)
  })

  it("returns albums favourites with deep links", async () => {
    mockFavouritesList.mockResolvedValue({
      albums: [album],
      artists: [],
      tracks: [],
    })
    const result = await handlers.listFavourites({ type: "albums" })
    const data = parsed(result)
    expect(data.type).toBe("albums")
    expect(data.albums[0].url).toContain("/album/abc123")
  })

  it("returns tracks favourites with deep links", async () => {
    mockFavouritesList.mockResolvedValue({
      albums: [],
      artists: [],
      tracks: [track],
    })
    const result = await handlers.listFavourites({ type: "tracks" })
    const data = parsed(result)
    expect(data.tracks[0].url).toContain("/track/1")
  })

  it("returns error when list fails", async () => {
    mockFavouritesList.mockRejectedValue(new Error("api error"))
    const result = await handlers.listFavourites({ type: "albums" })
    expect(text(result)).toContain("Error:")
  })
})

describe("nowPlaying", () => {
  let handlers: ReturnType<typeof makeHandlers>
  const originalPlatform = process.platform

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = makeHandlers(mockClient as never)
  })

  afterEach(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform })
  })

  it("returns current track with deep link when playing (macOS)", async () => {
    Object.defineProperty(process, "platform", { value: "darwin" })
    mockNowPlaying.mockResolvedValue(track)
    const result = await handlers.nowPlaying()
    const data = parsed(result)
    expect(data.playing).toBe(true)
    expect(data.track.title).toBe("Creep")
    expect(data.track.url).toContain("/track/1")
  })

  it("returns not-playing message when nothing is playing (macOS)", async () => {
    Object.defineProperty(process, "platform", { value: "darwin" })
    mockNowPlaying.mockResolvedValue(undefined)
    const result = await handlers.nowPlaying()
    const data = parsed(result)
    expect(data.playing).toBe(false)
  })

  it("returns error on non-macOS platform", async () => {
    Object.defineProperty(process, "platform", { value: "linux" })
    const result = await handlers.nowPlaying()
    expect(text(result)).toContain("Error:")
    expect(text(result)).toContain("macOS")
  })

  it("returns graceful error when player file is absent", async () => {
    Object.defineProperty(process, "platform", { value: "darwin" })
    mockNowPlaying.mockRejectedValue(
      Object.assign(new Error("ENOENT: no such file"), { code: "ENOENT" }),
    )
    const result = await handlers.nowPlaying()
    expect(text(result)).toContain("Error:")
    expect(text(result)).toContain("Qobuz desktop")
  })
})

describe("createPlaylist", () => {
  let handlers: ReturnType<typeof makeHandlers>

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = makeHandlers(mockClient as never)
  })

  it("blocks creation when confirm is false", async () => {
    const result = await handlers.createPlaylist({
      name: "Test",
      confirm: false,
    })
    expect(text(result)).toContain("Error:")
    expect(mockPlaylistCreate).not.toHaveBeenCalled()
  })

  it("creates playlist when confirm is true", async () => {
    mockPlaylistCreate.mockResolvedValue(playlist)
    const result = await handlers.createPlaylist({
      name: "My Mix",
      confirm: true,
    })
    const data = parsed(result)
    expect(data.name).toBe("My Mix")
    expect(data.url).toContain("/playlist/42")
    expect(mockPlaylistCreate).toHaveBeenCalledWith({
      name: "My Mix",
      description: undefined,
      isPublic: undefined,
    })
  })

  it("returns error when create fails", async () => {
    mockPlaylistCreate.mockRejectedValue(new Error("api error"))
    const result = await handlers.createPlaylist({
      name: "Test",
      confirm: true,
    })
    expect(text(result)).toContain("Error:")
  })
})

describe("addToPlaylist", () => {
  let handlers: ReturnType<typeof makeHandlers>

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = makeHandlers(mockClient as never)
  })

  it("blocks addition when confirm is false", async () => {
    const result = await handlers.addToPlaylist({
      playlistId: 42,
      trackIds: [1],
      confirm: false,
    })
    expect(text(result)).toContain("Error:")
    expect(mockPlaylistAddTracks).not.toHaveBeenCalled()
  })

  it("adds tracks when confirm is true", async () => {
    mockPlaylistAddTracks.mockResolvedValue(playlist)
    const result = await handlers.addToPlaylist({
      playlistId: 42,
      trackIds: [1, 2],
      confirm: true,
    })
    const data = parsed(result)
    expect(data.name).toBe("My Mix")
    expect(mockPlaylistAddTracks).toHaveBeenCalledWith(42, [1, 2])
  })

  it("returns error when addTracks fails", async () => {
    mockPlaylistAddTracks.mockRejectedValue(new Error("api error"))
    const result = await handlers.addToPlaylist({
      playlistId: 42,
      trackIds: [1],
      confirm: true,
    })
    expect(text(result)).toContain("Error:")
  })
})

describe("updatePlaylistDescription", () => {
  let handlers: ReturnType<typeof makeHandlers>

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = makeHandlers(mockClient as never)
  })

  it("blocks update when confirm is false", async () => {
    const result = await handlers.updatePlaylistDescription({
      playlistId: 42,
      description: "new desc",
      confirm: false,
    })
    expect(text(result)).toContain("Error:")
    expect(mockPlaylistUpdate).not.toHaveBeenCalled()
  })

  it("updates description when confirm is true", async () => {
    mockPlaylistUpdate.mockResolvedValue({
      ...playlist,
      description: "new desc",
    })
    const result = await handlers.updatePlaylistDescription({
      playlistId: 42,
      description: "new desc",
      confirm: true,
    })
    const data = parsed(result)
    expect(data.description).toBe("new desc")
    expect(mockPlaylistUpdate).toHaveBeenCalledWith(42, {
      description: "new desc",
    })
  })

  it("returns error when update fails", async () => {
    mockPlaylistUpdate.mockRejectedValue(new Error("api error"))
    const result = await handlers.updatePlaylistDescription({
      playlistId: 42,
      description: "x",
      confirm: true,
    })
    expect(text(result)).toContain("Error:")
  })
})
