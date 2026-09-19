import { randomUUID } from "crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { spawn, type ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import puppeteer, {
  type Browser,
  type Frame,
  type HTTPRequest,
  type HTTPResponse,
  type Page,
} from "puppeteer";

const NAVIGATION_TIMEOUT_MS = 30_000;
const REQUEST_TIMEOUT_MS = 60_000;
const IDLE_TIMEOUT_MS = 30_000;
const INTERNAL_PORT = Number(process.env.BROWSER_INTERNAL_PORT) || 8787;
const OUTPUT_DIR = path.resolve(
  process.env.BROWSER_OUTPUT_DIR || path.join(process.cwd(), "dist/src/public"),
);
const FFMPEG_BIN = process.env.FFMPEG_BIN || "ffmpeg";

type CapturedStream = {
  channelId: string;
  page: Page;
  m3u8Url: string;
  headers: Record<string, string>;
  filePrefix: string;
};

type ActiveStream = CapturedStream & {
  ffmpeg: ChildProcess;
  outputPath: string;
};

const activeStreams = new Map<string, Promise<ActiveStream>>();
const idleTimers = new Map<string, NodeJS.Timeout>();
const browserSessions = new Map<string, { id: string; url: string }>();
let browserPromise: Promise<Browser> | undefined;

const clearIdleTimer = (channelId: string) => {
  const timer = idleTimers.get(channelId);
  if (timer) clearTimeout(timer);
  idleTimers.delete(channelId);
};

const stopIdleStream = async (streamId: string) => {
  const streamPromise = activeStreams.get(streamId);
  if (!streamPromise) return;

  const stream = await streamPromise.catch(() => null);
  if (!stream || activeStreams.get(streamId) !== streamPromise) return;

  activeStreams.delete(streamId);
  clearIdleTimer(streamId);
  if (!stream.ffmpeg.killed) stream.ffmpeg.kill("SIGTERM");
  await stream.page.close().catch(() => undefined);
  console.log(`[${streamId}] Stopped after ${IDLE_TIMEOUT_MS / 1000}s idle.`);
};

const touchStream = (streamId: string) => {
  clearIdleTimer(streamId);
  idleTimers.set(
    streamId,
    setTimeout(() => void stopIdleStream(streamId), IDLE_TIMEOUT_MS),
  );
};

const getBrowser = () => {
  if (!browserPromise) {
    const browserArgs = ["--ignore-certificate-errors"];
    browserArgs.push("--no-sandbox", "--disable-setuid-sandbox");

    browserPromise = puppeteer.launch({
      // Xvfb supplies the display while headed Chromium avoids the provider's headless block.
      headless: false,
      acceptInsecureCerts: true,
      args: browserArgs,
    });
  }

  return browserPromise;
};

const captureM3U8 = async (
  browser: Browser,
  streamId: string,
  targetUrl: string,
  filePrefix: string,
): Promise<CapturedStream> => {
  const page = await browser.newPage();

  try {
    page.on("response", (response: HTTPResponse) => {
      const url = response.url();
      if (response.status() >= 400 && /embed|stream|player|m3u8/i.test(url)) {
        console.warn(
          `[${filePrefix}] Player response ${response.status()}: ${url}`,
        );
      }
    });

    const m3u8Request = page.waitForRequest(
      (request: HTTPRequest) => request.url().toLowerCase().includes("m3u8"),
      { timeout: REQUEST_TIMEOUT_MS },
    );

    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: NAVIGATION_TIMEOUT_MS,
    });

    const request = await m3u8Request;
    const m3u8Url = request.url();
    const requestHeaders = request.headers();
    const cookies = await page.cookies(m3u8Url);
    const cookieHeader = cookies
      .map(({ name, value }) => `${name}=${value}`)
      .join("; ");

    const headers: Record<string, string> = {};
    for (const headerName of [
      "accept",
      "accept-language",
      "origin",
      "referer",
      "user-agent",
    ]) {
      const value = requestHeaders[headerName];
      if (value) headers[headerName] = value;
    }
    if (requestHeaders.cookie || cookieHeader) {
      headers.cookie = requestHeaders.cookie || cookieHeader;
    }

    console.log(`[${filePrefix}] Captured M3U8 request.`);
    return { channelId: streamId, page, m3u8Url, headers, filePrefix };
  } catch (error) {
    console.error(
      `[${filePrefix}] Frames discovered before failure:\n` +
        (page.frames().map((frame: Frame) => frame.url()).filter(Boolean).join("\n") ||
          "none"),
    );
    await page.close();
    throw error;
  }
};

const toFfmpegHeaders = (headers: Record<string, string>) =>
  `${Object.entries(headers)
    .map(([name, value]) => `${name}: ${value}`)
    .join("\r\n")}\r\n`;

const startFfmpegRelay = (
  stream: CapturedStream,
): { process: ChildProcess; outputPath: string } => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const outputPath = path.join(OUTPUT_DIR, `${stream.filePrefix}.m3u8`);
  const segmentPattern = path.join(
    OUTPUT_DIR,
    `${stream.filePrefix}-%06d.ts`,
  );
  const ffmpeg = spawn(
    FFMPEG_BIN,
    [
      "-hide_banner",
      "-loglevel",
      "warning",
      "-y",
      "-headers",
      toFfmpegHeaders(stream.headers),
      "-i",
      stream.m3u8Url,
      "-map",
      "0",
      "-c",
      "copy",
      "-f",
      "hls",
      "-hls_time",
      "4",
      "-hls_list_size",
      "6",
      "-hls_flags",
      "delete_segments+append_list",
      "-hls_segment_filename",
      segmentPattern,
      outputPath,
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );

  ffmpeg.stderr?.on("data", (chunk: Buffer) => {
    const message = chunk.toString().trim();
    if (message) console.error(`[${stream.filePrefix}] ${message}`);
  });
  ffmpeg.once("error", (error) => {
    console.error(`[${stream.filePrefix}] FFmpeg failed to start:`, error);
  });
  ffmpeg.once("close", (code, signal) => {
    console.warn(
      `[${stream.filePrefix}] FFmpeg stopped (code=${code}, signal=${signal})`,
    );
  });

  return { process: ffmpeg, outputPath };
};

const waitForFile = async (filePath: string) => {
  const deadline = Date.now() + REQUEST_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      if (fs.statSync(filePath).size > 0) return;
    } catch {
      // FFmpeg has not created the manifest yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${filePath}`);
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

const ensureBrowserStream = async (sessionId: string) => {
  const session = browserSessions.get(sessionId);
  if (!session) throw new Error("Unknown browser stream session");

  const streamKey = `browser-${sessionId}`;
  const existing = activeStreams.get(streamKey);
  if (existing) return existing;

  let streamPromise: Promise<ActiveStream>;
  streamPromise = (async () => {
    const captured = await captureM3U8(
      await getBrowser(),
      streamKey,
      session.url,
      streamKey,
    );
    const relay = startFfmpegRelay(captured);
    const activeStream: ActiveStream = {
      ...captured,
      ffmpeg: relay.process,
      outputPath: relay.outputPath,
    };

    relay.process.once("close", () => {
      if (activeStreams.get(streamKey) === streamPromise) {
        activeStreams.delete(streamKey);
      }
      clearIdleTimer(streamKey);
      void activeStream.page.close().catch(() => undefined);
    });

    await waitForFile(relay.outputPath);
    console.log(`[${streamKey}] Lazy relay is ready.`);
    return activeStream;
  })();

  activeStreams.set(streamKey, streamPromise);
  try {
    return await streamPromise;
  } catch (error) {
    if (activeStreams.get(streamKey) === streamPromise) {
      activeStreams.delete(streamKey);
    }
    throw error;
  }
};

const sendText = (res: ServerResponse, status: number, message: string) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end(message);
};

const serveFile = (
  res: ServerResponse,
  filePath: string,
  contentType: string,
) => {
  if (!fs.existsSync(filePath)) {
    sendText(res, 404, "HLS resource not found");
    return;
  }

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
      const session = {
        id: randomUUID(),
        url: validateBrowserUrl(body.url),
      };
      browserSessions.set(session.id, session);
      sendJson(res, 201, session);
    } catch (error) {
      sendJson(res, 400, {
        error: error instanceof Error ? error.message : "Invalid stream URL",
      });
    }
    return;
  }

  const browserManifestMatch = requestUrl.pathname.match(
    /^\/browser\/([a-f0-9-]+)\.m3u8$/i,
  );
  const browserSegmentMatch = requestUrl.pathname.match(
    /^\/browser\/browser-([a-f0-9-]+)-\d+\.ts$/i,
  );

  if (browserManifestMatch?.[1]) {
    const sessionId = browserManifestMatch[1];
    const streamKey = `browser-${sessionId}`;
    try {
      await ensureBrowserStream(sessionId);
      touchStream(streamKey);
      serveFile(
        res,
        path.join(OUTPUT_DIR, `${streamKey}.m3u8`),
        "application/vnd.apple.mpegurl",
      );
    } catch (error) {
      console.error(`[${streamKey}] Lazy start failed:`, error);
      sendText(res, 502, "Unable to start browser stream");
    }
    return;
  }

  if (browserSegmentMatch?.[1]) {
    const sessionId = browserSegmentMatch[1];
    const streamKey = `browser-${sessionId}`;
    try {
      await ensureBrowserStream(sessionId);
      touchStream(streamKey);
      serveFile(
        res,
        path.join(OUTPUT_DIR, path.basename(requestUrl.pathname)),
        "video/mp2t",
      );
    } catch (error) {
      console.error(`[${streamKey}] Segment relay failed:`, error);
      sendText(res, 502, "Unable to serve browser segment");
    }
    return;
  }

  sendText(res, 404, "Not found");
};

const run = async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const server = createServer((req, res) => {
    void handleRequest(req, res);
  });

  const shutdown = async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const streamPromise of activeStreams.values()) {
      const stream = await streamPromise.catch(() => null);
      if (stream && !stream.ffmpeg.killed) stream.ffmpeg.kill("SIGTERM");
      await stream?.page.close().catch(() => undefined);
    }
    for (const streamId of idleTimers.keys()) clearIdleTimer(streamId);
    const browser = await browserPromise?.catch(() => undefined);
    await browser?.close();
  };

  process.once("SIGINT", () => void shutdown().finally(() => process.exit(0)));
  process.once("SIGTERM", () => void shutdown().finally(() => process.exit(0)));

  server.listen(INTERNAL_PORT, "0.0.0.0", () => {
    console.log(
      `[browser-relay] Lazy relay listening on internal port ${INTERNAL_PORT}`,
    );
  });
};

run().catch((error: unknown) => {
  console.error("Browser relay failed:", error);
  process.exitCode = 1;
});
