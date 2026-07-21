import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGzip } from "node:zlib";

const PROJECT_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PORT = Number.parseInt(process.env.DEEPGYM_PORT || "4173", 10);
const HOST = process.env.DEEPGYM_HOST || "127.0.0.1";

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function resolveRequestPath(urlPath) {
  const pathname = decodeURIComponent(new URL(urlPath, `http://${HOST}:${PORT}`).pathname);
  const requested = pathname === "/" ? "/prototype/index.html" : pathname;
  const normalized = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, "");
  const absolute = resolve(join(PROJECT_ROOT, normalized));
  return absolute.startsWith(PROJECT_ROOT) ? absolute : null;
}

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(message);
}

const server = createServer((request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    sendText(response, 405, "Method Not Allowed");
    return;
  }

  let filePath;
  try {
    filePath = resolveRequestPath(request.url || "/");
  } catch {
    sendText(response, 400, "Bad Request");
    return;
  }

  if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
    sendText(response, 404, "Not Found");
    return;
  }

  const extension = extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extension] || "application/octet-stream";
  const acceptsGzip = /\bgzip\b/.test(request.headers["accept-encoding"] || "");
  const shouldCompress = acceptsGzip && [".html", ".css", ".js", ".json", ".md"].includes(extension);

  const headers = {
    "Cache-Control": extension === ".json" ? "no-cache" : "no-store",
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
  };
  if (shouldCompress) headers["Content-Encoding"] = "gzip";

  response.writeHead(200, headers);
  if (request.method === "HEAD") {
    response.end();
    return;
  }

  const stream = createReadStream(filePath);
  stream.on("error", () => {
    if (!response.headersSent) sendText(response, 500, "Internal Server Error");
    else response.destroy();
  });

  if (shouldCompress) stream.pipe(createGzip()).pipe(response);
  else stream.pipe(response);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`端口 ${PORT} 已被占用。可运行 DEEPGYM_PORT=4174 npm run dev 更换端口。`);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  console.log(`DeepGYM 原型已启动：http://${HOST}:${PORT}`);
  console.log("按 Control + C 停止服务。当前动图来自远程开发预览源，不可视为发布许可。" );
});
