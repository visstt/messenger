import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import httpProxy from "http-proxy";

const rootDir = dirname(fileURLToPath(import.meta.url));
const distDir = join(rootDir, "dist");
const backend = process.env.BACKEND_URL || "http://backend:8080";
const port = Number(process.env.PORT || 80);
const wsTarget = backend.replace(/^http/, "ws");

const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  xfwd: true,
});

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
};

function pipeFile(filePath, res, contentType) {
  if (contentType) {
    res.setHeader("Content-Type", contentType);
  }
  const stream = createReadStream(filePath);
  stream.on("error", (err) => {
    console.error("static file error:", err.message);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end("Static file error");
    } else {
      res.destroy();
    }
  });
  stream.pipe(res);
}

function sendIndex(res) {
  pipeFile(join(distDir, "index.html"), res, mimeTypes[".html"]);
}

function sendStatic(req, res) {
  const pathname = (req.url || "/").split("?")[0];
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
  const filePath = resolve(distDir, relative);
  const distResolved = resolve(distDir);

  if (!filePath.startsWith(distResolved) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    sendIndex(res);
    return;
  }

  pipeFile(filePath, res, mimeTypes[extname(filePath)]);
}

const server = createServer((req, res) => {
  const url = req.url || "/";
  if (url === "/healthz" || url.startsWith("/api/") || url.startsWith("/uploads/")) {
    proxy.web(req, res, { target: backend }, (err) => {
      if (!res.headersSent) {
        res.statusCode = 502;
        res.end("Bad gateway");
      }
      console.error("proxy error:", err?.message || err);
    });
    return;
  }
  sendStatic(req, res);
});

server.on("upgrade", (req, socket, head) => {
  if ((req.url || "").startsWith("/ws")) {
    proxy.ws(req, socket, head, { target: wsTarget });
    return;
  }
  socket.destroy();
});

proxy.on("error", (err) => {
  console.error("proxy transport error:", err?.message || err);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`frontend listening on :${port}, dist ${distDir}, backend ${backend}`);
});
