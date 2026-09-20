import { randomUUID } from "crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { spawn, type ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import puppeteer, {
  type Browser,
  type HTTPRequest,
  type HTTPResponse,
  type Page,
} from "puppeteer";

const REQUEST_TIMEOUT_MS = 60_000;
const IDLE_TIMEOUT_MS = 30_000;
const M3U8_SELECTION_GRACE_MS = 2_000;
const DEFAULT_SEGMENT_DURATION_SECONDS = 5;
const MAX_SEGMENTS = 6;
const INTERNAL_PORT = Number(process.env.BROWSER_INTERNAL_PORT) || 8787;
const OUTPUT_DIR = path.resolve(
  process.env.BROWSER_OUTPUT_DIR || path.join(process.cwd(), "dist/src/public"),
);
const FFMPEG_BIN = process.env.FFMPEG_BIN || "ffmpeg";

type BrowserSession = { id: string; url: string };
type MediaMode = "m3u8" | "segments";
type Segment = { filename: string; duration: number; sequence: number };
type SegmentState = {
  outputPath: string;
  segments: Segment[];
  firstSegmentReady: boolean;
  firstSegment: Promise<void>;
  resolveFirstSegment: () => void;
  rejectFirstSegment: (error: Error) => void;
};
type ActiveStream = {
  session: BrowserSession;
  page: Page;
  mode: MediaMode;
  outputPath: string;
  ffmpeg?: ChildProcess;
  segmentState?: SegmentState;
};

const sessions = new Map<string, BrowserSession>();
const activeStreams = new Map<string, Promise<ActiveStream>>();
const idleTimers = new Map<string, NodeJS.Timeout>();
const playbackTimers = new Map<string, NodeJS.Timeout>();
let browserPromise: Promise<Browser> | undefined;

const PLAY_MEDIA_SCRIPT = `(() => {
  for (const video of document.querySelectorAll("video")) {
    video.muted = true;
    video.autoplay = true;
    if (video.paused) {
      const playback = video.play();
      if (playback) playback.catch(() => undefined);
    }
  }
})()`;

const getBrowser = () => {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: false,
      acceptInsecureCerts: true,
      args: [
        "--ignore-certificate-errors",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--autoplay-policy=no-user-gesture-required",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
      ],
    });
  }
  return browserPromise;
};

const keepPagePlaying = async (page: Page) => {
  await Promise.all(
    page.frames().map((frame) => frame.evaluate(PLAY_MEDIA_SCRIPT).catch(() => undefined)),
  );
};

const startPlaybackKeepAlive = (sessionId: string, page: Page) => {
  const streamKey = `browser-${sessionId}`;
  const existing = playbackTimers.get(streamKey);
  if (existing) clearInterval(existing);
  void keepPagePlaying(page);
  playbackTimers.set(streamKey, setInterval(() => void keepPagePlaying(page), 2_000));
};

const stopPlaybackKeepAlive = (sessionId: string) => {
  const streamKey = `browser-${sessionId}`;
  const timer = playbackTimers.get(streamKey);
  if (timer) clearInterval(timer);
  playbackTimers.delete(streamKey);
};

const validateBrowserUrl = (value: unknown) => {
  if (typeof value !== "string") throw new Error("url is required");
  const url = new URL(value);
  if (!(["http:", "https:"] as string[]).includes(url.protocol)) {
    throw new Error("url must use http or https");
  }
  if (["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
    throw new Error("local URLs are not allowed");
  }
  return url.toString();
};

const readJsonBody = async (req: IncomingMessage) => {
  let body = "";
  for await (const chunk of req) {
    body += chunk.toString();
    if (body.length > 100_000) throw new Error("Request body too large");
  }
  return JSON.parse(body || "{}") as Record<string, unknown>;
};

const sendJson = (res: ServerResponse, status: number, value: unknown) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(value));
};

const sendText = (res: ServerResponse, status: number, message: string) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end(message);
};

const outputPrefix = (sessionId: string) => `browser-${sessionId}`;

const cleanupFiles = (sessionId: string) => {
  const prefix = outputPrefix(sessionId);
  for (const filename of fs.readdirSync(OUTPUT_DIR)) {
    if (
      filename === `${prefix}.m3u8` ||
      filename.startsWith(`${prefix}-`) ||
      filename.startsWith(`${prefix}.m3u8.tmp-`)
    ) {
      fs.rmSync(path.join(OUTPUT_DIR, filename), { force: true });
    }
  }
};

const writeAtomically = (filePath: string, contents: string | Buffer, tempPrefix: string) => {
  const tempPath = path.join(path.dirname(filePath), `${tempPrefix}${randomUUID()}`);
  try {
    fs.writeFileSync(tempPath, contents);
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    fs.rmSync(tempPath, { force: true });
    throw error;
  }
};

const writeSegmentPlaylist = (sessionId: string, state: SegmentState) => {
  const firstSequence = state.segments[0]?.sequence || 0;
  const targetDuration = Math.max(
    1,
    Math.ceil(
      Math.max(
        ...state.segments.map((segment) => segment.duration),
        DEFAULT_SEGMENT_DURATION_SECONDS,
      ),
    ),
  );
  const playlist = [
    "#EXTM3U",
    "#EXT-X-VERSION:3",
    `#EXT-X-TARGETDURATION:${targetDuration}`,
    `#EXT-X-MEDIA-SEQUENCE:${firstSequence}`,
    ...state.segments.flatMap((segment) => [
      `#EXTINF:${segment.duration.toFixed(3)},`,
      segment.filename,
    ]),
    "",
  ].join("\n");
  writeAtomically(
    path.join(OUTPUT_DIR, `${outputPrefix(sessionId)}.m3u8`),
    playlist,
    `${outputPrefix(sessionId)}.m3u8.tmp-`,
  );
};

const toFfmpegHeaders = (headers: Record<string, string>) =>
  `${Object.entries(headers).map(([name, value]) => `${name}: ${value}`).join("\r\n")}\r\n`;

const startFfmpeg = (
  sessionId: string,
  m3u8Url: string,
  headers: Record<string, string>,
) => {
  const prefix = outputPrefix(sessionId);
  const outputPath = path.join(OUTPUT_DIR, `${prefix}.m3u8`);
  const segmentPattern = path.join(OUTPUT_DIR, `${prefix}-%06d.ts`);
  const ffmpeg = spawn(FFMPEG_BIN, [
    "-hide_banner", "-loglevel", "warning", "-y",
    "-headers", toFfmpegHeaders(headers),
    "-analyzeduration", "10M", "-probesize", "50M",
    "-i", m3u8Url,
    "-map", "0", "-c", "copy", "-f", "hls",
    "-hls_time", "4", "-hls_list_size", "6",
    "-hls_flags", "delete_segments+append_list",
    "-hls_segment_filename", segmentPattern, outputPath,
  ], { stdio: ["ignore", "ignore", "pipe"] });

  ffmpeg.stderr?.on("data", (chunk: Buffer) => {
    const message = chunk.toString().trim();
    if (message) console.error(`[browser-${sessionId}] ${message}`);
  });
  ffmpeg.once("error", (error) => console.error(`[browser-${sessionId}] FFmpeg failed:`, error));
  ffmpeg.once("close", (code, signal) => {
    console.warn(`[browser-${sessionId}] FFmpeg stopped (code=${code}, signal=${signal})`);
  });
  return { ffmpeg, outputPath };
};

const createSegmentState = (sessionId: string): SegmentState => {
  let resolveFirstSegment!: () => void;
  let rejectFirstSegment!: (error: Error) => void;
  const firstSegment = new Promise<void>((resolve, reject) => {
    resolveFirstSegment = resolve;
    rejectFirstSegment = reject;
  });
  return {
    outputPath: path.join(OUTPUT_DIR, `${outputPrefix(sessionId)}.m3u8`),
    segments: [],
    firstSegmentReady: false,
    firstSegment,
    resolveFirstSegment,
    rejectFirstSegment,
  };
};

const captureSource = async (session: BrowserSession): Promise<ActiveStream> => {
  const page = await (await getBrowser()).newPage();
  const state = createSegmentState(session.id);
  let selectedMode: MediaMode | undefined;
  let m3u8Request: HTTPRequest | undefined;
  let m3u8SelectionTimer: NodeJS.Timeout | undefined;
  let nextSegmentSequence = 0;
  const segmentSequences = new Map<HTTPRequest, number>();
  const segmentUrlSequences = new Map<string, number>();
  let resolveFirstRequest!: (value: { mode: MediaMode; request: HTTPRequest }) => void;
  let rejectFirstRequest!: (error: Error) => void;
  const firstRequest = new Promise<{ mode: MediaMode; request: HTTPRequest }>((resolve, reject) => {
    resolveFirstRequest = resolve;
    rejectFirstRequest = reject;
  });
  const requestTimeout = setTimeout(
    () => rejectFirstRequest(new Error("No M3U8 or TS request was captured")),
    REQUEST_TIMEOUT_MS,
  );

  const selectMode = (mode: MediaMode, request: HTTPRequest) => {
    if (selectedMode) return;
    selectedMode = mode;
    if (m3u8SelectionTimer) clearTimeout(m3u8SelectionTimer);
    clearTimeout(requestTimeout);
    resolveFirstRequest({ mode, request });
  };

  const onRequest = (request: HTTPRequest) => {
    const requestUrl = request.url();
    const url = requestUrl.toLowerCase();
    if (/\.ts(?:\?|$)/i.test(url)) {
      let sequence = segmentUrlSequences.get(requestUrl);
      if (sequence === undefined) {
        sequence = nextSegmentSequence;
        nextSegmentSequence += 1;
        segmentUrlSequences.set(requestUrl, sequence);
      }
      segmentSequences.set(request, sequence);
      if (!selectedMode) selectMode("segments", request);
    }
    if (!m3u8Request && url.includes("m3u8")) m3u8Request = request;
  };

  page.on("request", onRequest);
  page.on("response", async (response: HTTPResponse) => {
    const responseUrl = response.url();
    const isSuccessful = [200, 206].includes(response.status());

    if (/\.ts(?:\?|$)/i.test(responseUrl)) {
      if (!isSuccessful) return;
      if (selectedMode === "m3u8") return;
      try {
        const buffer = await response.buffer();
        if (buffer[0] !== 0x47) return;
        if (selectedMode !== "segments") return;
        const sequence = segmentSequences.get(response.request())
          ?? segmentUrlSequences.get(responseUrl)
          ?? nextSegmentSequence++;
        const durationMatch = responseUrl.match(/-(\d{5})\.ts(?:\?|$)/i);
        const encodedDuration = durationMatch ? Number(durationMatch[1]) / 1000 : NaN;
        const duration = Number.isFinite(encodedDuration) && encodedDuration >= 1 && encodedDuration <= 30
          ? encodedDuration
          : DEFAULT_SEGMENT_DURATION_SECONDS;
        const filename = `${outputPrefix(session.id)}-${String(sequence).padStart(6, "0")}.ts`;
        const isFirstSegment = sequence === 0;
        const shouldTrimWindow = state.firstSegmentReady;
        const existingIndex = state.segments.findIndex((segment) => segment.sequence === sequence);
        if (existingIndex >= 0) {
          const existing = state.segments.splice(existingIndex, 1)[0];
          if (existing && existing.filename !== filename) {
            fs.rmSync(path.join(OUTPUT_DIR, existing.filename), { force: true });
          }
        }
        writeAtomically(
          path.join(OUTPUT_DIR, filename),
          buffer,
          `${filename}.tmp-`,
        );
        state.segments.push({ filename, duration, sequence });
        state.segments.sort((left, right) => left.sequence - right.sequence);
        if (shouldTrimWindow) {
          while (state.segments.length > MAX_SEGMENTS) {
            const removed = state.segments.shift();
            if (removed) fs.rmSync(path.join(OUTPUT_DIR, removed.filename), { force: true });
          }
        }
        writeSegmentPlaylist(session.id, state);
        if (isFirstSegment && !state.firstSegmentReady) {
          state.firstSegmentReady = true;
          state.resolveFirstSegment();
        }
      } catch (error) {
        state.rejectFirstSegment(error instanceof Error ? error : new Error(String(error)));
      }
      return;
    }

    if (!isSuccessful || !responseUrl.toLowerCase().includes("m3u8") || selectedMode) return;
    let playlistBody: string;
    try {
      playlistBody = await response.text();
    } catch {
      return;
    }
    if (!playlistBody.includes("#EXTM3U")) return;
    m3u8Request = response.request();
    if (m3u8SelectionTimer) return;
    m3u8SelectionTimer = setTimeout(() => {
      if (m3u8Request) selectMode("m3u8", m3u8Request);
    }, M3U8_SELECTION_GRACE_MS);
  });

  let ffmpeg: ChildProcess | undefined;
  try {
    console.log(`[browser-${session.id}] Opening ${session.url}`);
    await page.goto(session.url, { waitUntil: "domcontentloaded", timeout: REQUEST_TIMEOUT_MS });
    await page.bringToFront().catch(() => undefined);
    startPlaybackKeepAlive(session.id, page);
    const first = await firstRequest;

    if (first.mode === "m3u8") {
      const requestHeaders = first.request.headers();
      const cookies = await page.cookies(first.request.url());
      const cookieHeader = cookies.map(({ name, value }) => `${name}=${value}`).join("; ");
      const headers: Record<string, string> = {};
      for (const headerName of ["accept", "accept-language", "origin", "referer", "user-agent"]) {
        const value = requestHeaders[headerName];
        if (value) headers[headerName] = value;
      }
      if (requestHeaders.cookie || cookieHeader) headers.cookie = requestHeaders.cookie || cookieHeader;
      console.log(`[browser-${session.id}] Starting FFmpeg for ${first.request.url()}`);
      const relay = startFfmpeg(session.id, first.request.url(), headers);
      ffmpeg = relay.ffmpeg;
      await waitForFile(relay.outputPath, relay.ffmpeg);
      console.log(`[browser-${session.id}] M3U8 relay is ready.`);
      return { session, page, mode: "m3u8", outputPath: relay.outputPath, ffmpeg: relay.ffmpeg };
    }

    await waitForFirstSegment(state.firstSegment);
    console.log(`[browser-${session.id}] Browser-segment relay is ready.`);
    return { session, page, mode: "segments", outputPath: state.outputPath, segmentState: state };
  } catch (error) {
    clearTimeout(requestTimeout);
    if (m3u8SelectionTimer) clearTimeout(m3u8SelectionTimer);
    stopPlaybackKeepAlive(session.id);
    if (ffmpeg && !ffmpeg.killed) ffmpeg.kill("SIGTERM");
    await page.close().catch(() => undefined);
    cleanupFiles(session.id);
    throw error;
  }
};

const waitForFirstSegment = async (firstSegment: Promise<void>) => {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Timed out waiting for the first TS segment after ${REQUEST_TIMEOUT_MS}ms`)),
      REQUEST_TIMEOUT_MS,
    );
  });
  try {
    await Promise.race([firstSegment, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const waitForFile = async (filePath: string, ffmpeg?: ChildProcess) => {
  const deadline = Date.now() + REQUEST_TIMEOUT_MS;
  let processFailure: Error | undefined;
  let onProcessError: ((error: Error) => void) | undefined;
  let onProcessClose: ((code: number | null, signal: NodeJS.Signals | null) => void) | undefined;
  if (ffmpeg) {
    onProcessError = (error) => {
      processFailure = error;
    };
    onProcessClose = (code, signal) => {
      processFailure = new Error(
        `FFmpeg exited before creating the HLS playlist (code=${code}, signal=${signal})`,
      );
    };
    ffmpeg.once("error", onProcessError);
    ffmpeg.once("close", onProcessClose);
    if (ffmpeg.exitCode !== null) {
      processFailure = new Error(
        `FFmpeg exited before creating the HLS playlist (code=${ffmpeg.exitCode})`,
      );
    }
  }

  try {
    while (Date.now() < deadline) {
      if (processFailure) throw processFailure;
      try {
        if (fs.statSync(filePath).size > 0) return;
      } catch {
        // The manifest is not ready yet.
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`Timed out waiting for ${filePath}`);
  } finally {
    if (ffmpeg && onProcessError) ffmpeg.off("error", onProcessError);
    if (ffmpeg && onProcessClose) ffmpeg.off("close", onProcessClose);
  }
};

const clearIdleTimer = (streamKey: string) => {
  const timer = idleTimers.get(streamKey);
  if (timer) clearTimeout(timer);
  idleTimers.delete(streamKey);
};

const stopStream = async (sessionId: string) => {
  const streamKey = `browser-${sessionId}`;
  const streamPromise = activeStreams.get(streamKey);
  if (!streamPromise) return;
  const stream = await streamPromise.catch(() => null);
  if (!stream || activeStreams.get(streamKey) !== streamPromise) return;
  activeStreams.delete(streamKey);
  clearIdleTimer(streamKey);
  stopPlaybackKeepAlive(sessionId);
  if (stream.ffmpeg && !stream.ffmpeg.killed) stream.ffmpeg.kill("SIGTERM");
  await stream.page.close().catch(() => undefined);
  cleanupFiles(sessionId);
  console.log(`[${streamKey}] Stopped after ${IDLE_TIMEOUT_MS / 1000}s idle.`);
};

const touchStream = (sessionId: string) => {
  const streamKey = `browser-${sessionId}`;
  clearIdleTimer(streamKey);
  idleTimers.set(streamKey, setTimeout(() => void stopStream(sessionId), IDLE_TIMEOUT_MS));
};

const ensureStream = async (sessionId: string) => {
  const session = sessions.get(sessionId);
  if (!session) throw new Error("Unknown browser stream session");
  const streamKey = `browser-${sessionId}`;
  const existing = activeStreams.get(streamKey);
  if (existing) return existing;
  const streamPromise = captureSource(session);
  activeStreams.set(streamKey, streamPromise);
  try {
    const stream = await streamPromise;
    if (stream.ffmpeg) {
      stream.ffmpeg.once("close", () => {
        if (activeStreams.get(streamKey) !== streamPromise) return;
        activeStreams.delete(streamKey);
        clearIdleTimer(streamKey);
        stopPlaybackKeepAlive(sessionId);
        cleanupFiles(sessionId);
        void stream.page.close().catch(() => undefined);
        console.warn(`[${streamKey}] FFmpeg stopped; stream cleaned up.`);
      });
    }
    return stream;
  } catch (error) {
    if (activeStreams.get(streamKey) === streamPromise) activeStreams.delete(streamKey);
    throw error;
  }
};

const serveFile = (res: ServerResponse, filePath: string, contentType: string) => {
  if (!fs.existsSync(filePath)) return sendText(res, 404, "HLS resource not found");
  res.statusCode = 200;
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  fs.createReadStream(filePath).on("error", () => res.destroy()).pipe(res);
};

const handleRequest = async (req: IncomingMessage, res: ServerResponse) => {
  const requestUrl = new URL(req.url || "/", "http://browser-relay");
  console.log(`[browser-relay] ${req.method || "GET"} ${requestUrl.pathname}`);

  if (req.method === "POST" && requestUrl.pathname === "/sessions") {
    try {
      const body = await readJsonBody(req);
      const session = { id: randomUUID(), url: validateBrowserUrl(body.url) };
      sessions.set(session.id, session);
      sendJson(res, 201, session);
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : "Invalid stream URL" });
    }
    return;
  }

  const manifestMatch = requestUrl.pathname.match(/^\/browser\/([a-f0-9-]+)\.m3u8$/i);
  const segmentMatch = requestUrl.pathname.match(/^\/browser\/browser-([a-f0-9-]+)-\d+\.ts$/i);
  if (manifestMatch?.[1]) {
    const sessionId = manifestMatch[1];
    try {
      await ensureStream(sessionId);
      touchStream(sessionId);
      serveFile(res, path.join(OUTPUT_DIR, `${outputPrefix(sessionId)}.m3u8`), "application/vnd.apple.mpegurl");
    } catch (error) {
      console.error(`[browser-${sessionId}] Start failed:`, error);
      sendText(res, 502, "Unable to start browser stream");
    }
    return;
  }
  if (segmentMatch?.[1]) {
    const sessionId = segmentMatch[1];
    try {
      await ensureStream(sessionId);
      touchStream(sessionId);
      serveFile(res, path.join(OUTPUT_DIR, path.basename(requestUrl.pathname)), "video/mp2t");
    } catch (error) {
      console.error(`[browser-${sessionId}] Segment failed:`, error);
      sendText(res, 502, "Unable to serve browser segment");
    }
    return;
  }
  if (requestUrl.pathname === "/health") return sendJson(res, 200, { ok: true, active: activeStreams.size });
  sendText(res, 404, "Not found");
};

const run = async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const server = createServer((req, res) => void handleRequest(req, res));
  const shutdown = async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const sessionId of sessions.keys()) await stopStream(sessionId);
    await browserPromise?.then((browser) => browser.close()).catch(() => undefined);
  };
  process.once("SIGINT", () => void shutdown().finally(() => process.exit(0)));
  process.once("SIGTERM", () => void shutdown().finally(() => process.exit(0)));
  server.listen(INTERNAL_PORT, "0.0.0.0", () => console.log(`[browser-relay] Listening on ${INTERNAL_PORT}`));
};

run().catch((error: unknown) => {
  console.error("Browser relay failed:", error);
  process.exitCode = 1;
});
