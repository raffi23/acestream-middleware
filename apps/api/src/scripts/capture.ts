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

const CHANNEL_IDS = ["91", "92", "93", "94", "95", "96", "97", "98", "99"];
const CHANNEL_ID_SET = new Set(CHANNEL_IDS);
const NAVIGATION_TIMEOUT_MS = 30_000;
const REQUEST_TIMEOUT_MS = 60_000;
const INTERNAL_PORT = Number(process.env.NTV_INTERNAL_PORT) || 8787;
const OUTPUT_DIR = path.resolve(
  process.env.NTV_OUTPUT_DIR || path.join(process.cwd(), "dist/src/public"),
);
const FFMPEG_BIN = process.env.FFMPEG_BIN || "ffmpeg";

type CapturedStream = {
  channelId: string;
  page: Page;
  m3u8Url: string;
  headers: Record<string, string>;
};

type ActiveStream = CapturedStream & {
  ffmpeg: ChildProcess;
  outputPath: string;
};

const activeStreams = new Map<string, Promise<ActiveStream>>();
let browserPromise: Promise<Browser> | undefined;

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
  channelId: string,
): Promise<CapturedStream> => {
  const targetUrl = `https://ntv.cx/channel/phoenix/${channelId}`;
  const page = await browser.newPage();

  try {
    page.on("response", (response: HTTPResponse) => {
      const url = response.url();
      if (response.status() >= 400 && /embed|stream|player|m3u8/i.test(url)) {
        console.warn(
          `[ntv-${channelId}] Player response ${response.status()}: ${url}`,
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

    console.log(`[ntv-${channelId}] Captured M3U8 request.`);
    return { channelId, page, m3u8Url, headers };
  } catch (error) {
    console.error(
      `[ntv-${channelId}] Frames discovered before failure:\n` +
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

  const outputPath = path.join(OUTPUT_DIR, `ntv-${stream.channelId}.m3u8`);
  const segmentPattern = path.join(
    OUTPUT_DIR,
    `ntv-${stream.channelId}-%06d.ts`,
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
    if (message) console.error(`[ntv-${stream.channelId}] ${message}`);
  });
  ffmpeg.once("error", (error) => {
    console.error(`[ntv-${stream.channelId}] FFmpeg failed to start:`, error);
  });
  ffmpeg.once("close", (code, signal) => {
    console.warn(
      `[ntv-${stream.channelId}] FFmpeg stopped (code=${code}, signal=${signal})`,
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

const ensureStream = async (channelId: string) => {
  if (!CHANNEL_ID_SET.has(channelId)) {
    throw new Error(`Unsupported NTV channel: ${channelId}`);
  }

  const existing = activeStreams.get(channelId);
  if (existing) return existing;

  let streamPromise: Promise<ActiveStream>;
  streamPromise = (async () => {
    const stream = await captureM3U8(await getBrowser(), channelId);
    const relay = startFfmpegRelay(stream);
    const activeStream: ActiveStream = {
      ...stream,
      ffmpeg: relay.process,
      outputPath: relay.outputPath,
    };

    relay.process.once("close", () => {
      if (activeStreams.get(channelId) === streamPromise) {
        activeStreams.delete(channelId);
      }
      void activeStream.page.close().catch(() => undefined);
    });

    await waitForFile(relay.outputPath);
    console.log(`[ntv-${channelId}] Lazy relay is ready.`);
    return activeStream;
  })();

  activeStreams.set(channelId, streamPromise);
  try {
    return await streamPromise;
  } catch (error) {
    if (activeStreams.get(channelId) === streamPromise) {
      activeStreams.delete(channelId);
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
  const requestUrl = new URL(req.url || "/", "http://ntv-relay");
  const manifestMatch = requestUrl.pathname.match(/^\/ntv\/(\d+)\.m3u8$/);
  const segmentMatch = requestUrl.pathname.match(
    /^\/ntv\/ntv-(\d+)-\d+\.ts$/,
  );

  if (manifestMatch) {
    const channelId = manifestMatch[1];
    if (!channelId) return sendText(res, 400, "Invalid channel");

    try {
      await ensureStream(channelId);
      serveFile(
        res,
        path.join(OUTPUT_DIR, `ntv-${channelId}.m3u8`),
        "application/vnd.apple.mpegurl",
      );
    } catch (error) {
      console.error(`[ntv-${channelId}] Lazy start failed:`, error);
      sendText(res, 502, "Unable to start NTV stream");
    }
    return;
  }

  if (segmentMatch) {
    const channelId = segmentMatch[1];
    if (!channelId || !CHANNEL_ID_SET.has(channelId)) {
      return sendText(res, 404, "HLS segment not found");
    }

    serveFile(
      res,
      path.join(OUTPUT_DIR, path.basename(requestUrl.pathname)),
      "video/mp2t",
    );
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
    const browser = await browserPromise?.catch(() => undefined);
    await browser?.close();
  };

  process.once("SIGINT", () => void shutdown().finally(() => process.exit(0)));
  process.once("SIGTERM", () => void shutdown().finally(() => process.exit(0)));

  server.listen(INTERNAL_PORT, "0.0.0.0", () => {
    console.log(
      `[ntv] Lazy relay listening on internal port ${INTERNAL_PORT}; configured channels: ${CHANNEL_IDS.join(", ")}`,
    );
  });
};

run().catch((error: unknown) => {
  console.error("NTV relay failed:", error);
  process.exitCode = 1;
});
