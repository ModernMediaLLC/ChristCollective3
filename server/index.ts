import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { globalLimiter } from "./security";
import { initPush } from "./pushNotifications";

// Apify API key is configured via environment variables (TIKTOK_API_KEY)
if (process.env.TIKTOK_API_KEY) {
  console.log('Apify API configured for live social media data extraction');
} else {
  console.warn('Warning: TIKTOK_API_KEY not configured. Social media scraping may not work.');
}

const app = express();

// CORS configuration for mobile app and external previews
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests from Replit, CodeMagic, localhost, and mobile apps
    const allowedOrigins = [
      /\.replit\.dev$/,
      /\.codemagic\.app$/,
      /\.railway\.app$/,
      /localhost/,
      /127\.0\.0\.1/,
      'capacitor://localhost',
      'ionic://localhost',
      'http://localhost',
      'https://localhost',
      'http://127.0.0.1:5000',
      'https://127.0.0.1:5000',
      'https://christcollective.com',
      'https://www.christcollective.com',
      ...(process.env.APP_URL ? [process.env.APP_URL] : []),
    ];
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Check if origin matches any allowed pattern
    const isAllowed = allowedOrigins.some(pattern => {
      if (typeof pattern === 'string') {
        return origin === pattern;
      }
      return pattern.test(origin);
    });
    
    if (isAllowed) {
      callback(null, true);
    } else if (process.env.NODE_ENV !== 'production') {
      // Allow all origins in development
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Session-ID'],
  exposedHeaders: ['set-cookie']
}));

// Global rate limiter for all /api routes — OWASP: prevent brute-force and DoS
app.use('/api', globalLimiter);

// Prevent browsers and CDNs from caching API responses — ensures all users get fresh data
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Skip JSON parsing for Stripe webhook endpoints (they need raw body for signature verification)
// Body size limit: 1MB max to prevent payload-based DoS (OWASP)
app.use((req, res, next) => {
  if (req.path === '/api/shop/webhook' || req.path === '/api/donations/webhook') {
    next();
  } else {
    express.json({ limit: '1mb' })(req, res, next);
  }
});
app.use(express.urlencoded({ extended: false, limit: '1mb' }));


app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000");
  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    log(`serving on port ${port}`);
    initPush();
  });
})();
