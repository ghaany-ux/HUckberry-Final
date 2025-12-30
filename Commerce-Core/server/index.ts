import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { spawn } from "child_process";
import httpProxy from "http-proxy";
import path from "path";
import fs from "fs";

const app = express();
const httpServer = createServer(app);

// Create a proxy server for Python backend
const proxy = httpProxy.createProxyServer({
  target: "http://127.0.0.1:8000",
  changeOrigin: true,
});

proxy.on("error", (err, _req, res) => {
  console.error("Proxy error:", err.message);
  if (res && "writeHead" in res) {
    (res as Response).status(502).json({ error: "Backend not available" });
  }
});

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

// Spawn Python backend
function startPythonBackend() {
  log("Starting Python FastAPI backend...", "python");
  
  const pythonProcess = spawn("python", ["main.py"], {
    cwd: path.resolve("backend"),
    env: { ...process.env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  pythonProcess.stdout?.on("data", (data) => {
    const message = data.toString().trim();
    if (message) log(message, "python");
  });

  pythonProcess.stderr?.on("data", (data) => {
    const message = data.toString().trim();
    if (message) log(message, "python");
  });

  pythonProcess.on("error", (err) => {
    log(`Failed to start Python backend: ${err.message}`, "python");
  });

  pythonProcess.on("exit", (code, signal) => {
    log(`Python backend exited with code ${code}, signal ${signal}`, "python");
    // Restart after a delay if it exits unexpectedly
    if (code !== 0) {
      setTimeout(() => startPythonBackend(), 3000);
    }
  });

  return pythonProcess;
}

// Start Python backend
startPythonBackend();

// Wait for Python backend to be ready
async function waitForPythonBackend(maxAttempts = 30): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch("http://127.0.0.1:8000/api/health");
      if (response.ok) {
        log("Python backend is ready", "python");
        return true;
      }
    } catch {
      // Backend not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  log("Python backend did not become ready in time", "python");
  return false;
}

// Proxy all /api/* requests to Python backend
app.use("/api", (req, res) => {
  // Restore the /api prefix for Python backend
  req.url = `/api${req.url}`;
  proxy.web(req, res);
});

// Proxy /static requests to Python backend
app.use("/static", (req, res) => {
  req.url = `/static${req.url}`;
  proxy.web(req, res);
});

// Serve frontend files
const frontendDir = path.resolve("frontend");

app.get("/", (_req, res) => {
  res.sendFile(path.join(frontendDir, "index.html"));
});

app.get("/index.html", (_req, res) => {
  res.sendFile(path.join(frontendDir, "index.html"));
});

app.get("/shop.html", (_req, res) => {
  res.sendFile(path.join(frontendDir, "shop.html"));
});

app.get("/admin-login.html", (_req, res) => {
  res.sendFile(path.join(frontendDir, "admin-login.html"));
});

app.get("/admin.html", (_req, res) => {
  res.sendFile(path.join(frontendDir, "admin.html"));
});

app.get("/style.css", (_req, res) => {
  res.setHeader("Content-Type", "text/css");
  res.sendFile(path.join(frontendDir, "style.css"));
});

app.get("/script.js", (_req, res) => {
  res.setHeader("Content-Type", "application/javascript");
  res.sendFile(path.join(frontendDir, "script.js"));
});

// Error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
});

// Start server
const port = parseInt(process.env.PORT || "5000", 10);

(async () => {
  // Wait for Python backend
  await waitForPythonBackend();

  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`Serving on port ${port}`);
      log(`Frontend: http://localhost:${port}`);
      log(`API docs: http://localhost:${port}/api/docs (proxied to Python)`);
    }
  );
})();
