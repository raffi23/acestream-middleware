# Browser Relay Handoff Guide

This is the project handoff/runbook for the browser-backed HLS relay. It is intentionally written for the next agent or maintainer who needs to debug or extend the relay without reconstructing the architecture from chat history.

## Purpose

The relay turns web pages that play live streams in a browser into HLS resources consumable by IPTV/HLS clients. It supports two source behaviors:

1. Pages that expose a usable `.m3u8` playlist. The relay starts FFmpeg against the browser-captured playlist URL.
2. Pages that request MPEG-TS (`.ts`) files directly. The relay captures the browser responses, writes authenticated TS files to the shared volume, and generates its own rolling HLS playlist.

The browser relay is separate from the Express API because it needs Chromium, Xvfb, and FFmpeg. The API remains the public-facing service and proxies browser-relay assets internally.

## Main files

- `apps/api/src/scripts/capture.ts` — browser relay server and all capture/relay logic.
- `apps/api/src/routes/browser-stream-route.ts` — public API routes that create sessions and proxy manifests/segments.
- `apps/api/src/config/browser-streams.ts` — browser-backed channel definitions appended to generated playlists.
- `apps/api/src/index.ts` — mounts `/browser-stream` and `/browser`, and appends browser channels to `/live.m3u8` and `/live-remote.m3u8`.
- `apps/api/Dockerfile.relay` — Chromium/FFmpeg/Xvfb relay image.
- `apps/api/relay-entrypoint.sh` — starts Xvfb on display `:99`, then runs `yarn relay:browser`.
- `docker-compose.yaml` — API/relay services and the shared `acestream-api-public` volume.

## Request flow

The public flow is:

```text
HLS client
  -> GET /live.m3u8
  -> GET /browser-stream?url=<source page>
  -> API POST http://browser-relay:8787/sessions
  -> 302 /browser/<session-id>.m3u8
  -> API GET /browser/<asset>
  -> relay GET /browser/<asset>
  -> shared file in /app/dist/src/public
```

### Playlist generation

`apps/api/src/index.ts` reads the generated local playlist and appends one `#EXTINF` entry per `DEFAULT_BROWSER_STREAMS` item. Each entry points to `/browser-stream?url=...`, not directly to the source site.

The API trusts proxy headers when constructing public URLs:

- `x-forwarded-proto` or `req.protocol`
- `x-forwarded-host` or `req.host`

This matters behind Coolify’s reverse proxy. If those headers are wrong, redirects can point to an internal or incorrect origin.

### Session creation

`GET /browser-stream?url=...` validates only that the query value is present, then POSTs it to the relay. The relay validates that the URL is HTTP(S) and rejects `localhost`, `127.0.0.1`, and `::1`. It stores the URL in an in-memory `sessions` map and returns a UUID.

Sessions are in-memory. A relay restart loses all sessions, which is expected; clients must request the public source URL again.

## Relay startup and media-mode selection

`captureSource()` opens a new Puppeteer page and attaches request/response listeners before navigation.

### Direct TS mode

When a request URL ends with `.ts` (with an optional query string), the relay immediately selects `segments` mode. This is deliberate: pages using HLS.js may request the first TS file while the M3U8 response is slow, and choosing FFmpeg prematurely causes startup failures.

For every TS request:

1. The request is assigned a sequence number based on request order.
2. Exact repeated request URLs reuse the same sequence number. This handles high-quality HLS retries and prefetches.
3. The response is accepted only for HTTP `200` or `206` and only if its first byte is the MPEG-TS sync byte `0x47`.
4. The complete response is written atomically to `browser-<id>-<sequence>.ts`.
5. The rolling playlist is sorted by sequence, not response-completion order.
6. The playlist is written atomically after the segment file exists.

The first sequence is held until its response completes. If later requests finish first, they are buffered rather than being exposed as the first segment. The initial segment wait has a 60-second timeout.

The relay keeps up to `MAX_SEGMENTS` (currently six) after startup. Old files are deleted only after the initial segment is ready. Do not change this to response-order numbering: high-bitrate streams commonly complete retries out of order.

Segment duration is normally five seconds. A five-digit suffix is treated as a duration only when it decodes to a plausible value between one and thirty seconds. This prevents names such as `...-00001.ts` from becoming `0.001`-second HLS entries.

### M3U8/FFmpeg mode

If no TS request wins, a successful response containing `#EXTM3U` is considered an M3U8 candidate. The relay waits `M3U8_SELECTION_GRACE_MS` (currently two seconds) to allow a TS request to appear. If none does, it starts FFmpeg using the captured request URL and browser-derived headers:

- `accept`
- `accept-language`
- `origin`
- `referer`
- `user-agent`
- cookies from the request or page

FFmpeg uses stream copy and HLS output with a six-segment list. It also uses enlarged probe settings:

- `-analyzeduration 10M`
- `-probesize 50M`

Startup waits for the generated M3U8 file. If FFmpeg exits before creating it, startup fails immediately. On any startup failure, FFmpeg, the page, and generated files are cleaned up.

## Browser playback keep-alive

Some source pages load a player in nested/cross-origin iframes and fetch only the first one or two segments unless playback is actively started. The relay therefore:

- launches Chromium with autoplay enabled;
- disables background/occluded-tab throttling;
- brings the page to the front after navigation;
- every two seconds evaluates a script in all current frames that mutes paused `<video>` elements and calls `play()`;
- clears that timer when the stream stops or fails.

Do not remove this keep-alive without testing a source page that uses a nested HLS.js/Clappr player, such as the Sportsbite `/247/beinar2` source.

## File and state lifecycle

The relay uses these maps:

- `sessions` — UUID to source page URL.
- `activeStreams` — `browser-<id>` to the in-flight/active stream promise.
- `idleTimers` — stops a stream after 30 seconds without a manifest/segment request.
- `playbackTimers` — keeps browser video playback active while the stream is in use.

The 30-second idle message is normal cleanup, not a stream error. `touchStream()` runs whenever the relay serves a manifest or segment. Stopping a stream kills FFmpeg if present, closes the page, stops the playback keep-alive, and removes generated files.

FFmpeg’s later unexpected exit also removes the active stream and generated files so a stale playlist is not reused.

The relay writes through the shared `acestream-api-public` volume. The API container reads/proxies those files; the relay container writes them. Do not make the public API depend on a relay-local filesystem path.

## Docker and Coolify

`Dockerfile.relay` is based on `node:22-bookworm-slim` and installs:

- FFmpeg
- Chromium runtime libraries
- Xvfb
- Puppeteer-managed Chrome
- global `tsx`

The relay listens on `BROWSER_INTERNAL_PORT` (default `8787`) on `0.0.0.0`. It is intentionally not published in the compose file; the API reaches it by Docker service name `browser-relay`.

Important container settings:

- `BROWSER_OUTPUT_DIR=/app/dist/src/public`
- `PUPPETEER_NO_SANDBOX=true`
- `DISPLAY=:99` is set by `relay-entrypoint.sh`

After changing relay code, Coolify must rebuild/redeploy the `browser-relay` image. A restart of an old image does not include source changes. If a named volume is reused, stale files should still be session-prefixed and are normally cleaned when a stream stops.

## Debugging checklist

Start with the relay logs and identify the UUID.

Successful direct-TS startup looks like:

```text
[browser-relay] POST /sessions
[browser-relay] GET /browser/<id>.m3u8
[browser-<id>] Browser-segment relay is ready.
```

Then there should be repeated manifest requests and requests for increasing local TS filenames. If only `000000.ts` and `000001.ts` appear, determine whether the source page stopped requesting upstream TS files or whether the relay generated a bad playlist.

Useful failure patterns:

- `Stopped after 30s idle` — expected when the client stops polling.
- `First TS segment` timeout — the source page requested TS but never completed a valid first response.
- no `.m3u8`/`.ts` request captured — page/player did not initialize or navigation failed.
- `Could not find codec parameters ... unspecified size` — FFmpeg could not probe the selected M3U8/H.264 input; inspect the captured URL and prefer a browser-captured TS path when available.
- repeated retries of the same upstream TS URL — verify URL deduplication and replacement ordering before changing playlist sequence logic.
- API `502` after roughly 60 seconds — relay startup is waiting for the first segment or FFmpeg output and eventually timed out.

When investigating a new source, log or inspect:

1. source page URL;
2. every upstream `.m3u8` candidate;
3. TS request URLs and their assigned sequence numbers;
4. response status and byte length;
5. generated playlist contents and the existence of every referenced file.

The public API asset route proxies with a 70-second Axios timeout. Keep relay startup timeouts below or near that boundary so Coolify does not terminate the outer request first.

## Safe change rules

- Preserve exact-URL sequence deduplication for TS retries.
- Never number segments by response-completion order.
- Never delete a replacement file after writing it; remove old state first, then replace atomically.
- Keep playlist writes atomic.
- Keep the request listener active for the entire page lifetime in TS mode.
- Test both a normal/low-quality source and a high-bitrate source with delayed/retried segments.
- Keep the relay internal; do not expose port `8787` publicly.
- Do not commit unrelated working-tree changes. At the time this document was created, `apps/api/src/config/browser-streams.ts` had uncommitted Sportsbite URL changes and `.claude/` was untracked.

## Current source configuration

`DEFAULT_BROWSER_STREAMS` currently contains:

- NTV channels `91` through `99`, using `https://ntv.cx/channel/phoenix/<number>`.
- Sportsbite channels 1 through 9. The working tree currently uses direct `/247/beinar...` URLs rather than the `/watch/channel/...` pages; verify that this local configuration change is intentional before committing it.

The source URLs are page URLs, not guaranteed playlist URLs. The relay must continue to discover the actual media requests from the rendered page.

## Relevant history

- `2a41caf` — added the generic browser stream endpoint.
- `11403e3` — added M3U8 and direct TS handling; this introduced the two-mode relay behavior.
- `8ba6e81` — fixed FFmpeg startup cleanup and playlist probing.
- `42cd408` — fixed initial TS relay stalls, request-order handling, and browser background playback behavior.
- `f9cc1fc` — added browser playback keep-alive.
- `7c597ce` — fixed retried TS segment replacement and atomic file/playlist updates.

The most important regression pattern was a high-quality stream freezing after its first segment. The cause was retry handling: a delayed segment retry reused the same logical sequence but the old implementation wrote and then deleted the same file. Any future change to segment storage should preserve the replacement behavior described above.
