import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "..", ".env") });

import { serve } from "@hono/node-server";
import { readFileSync, existsSync } from "node:fs";
import { wsService } from "./services/websocket.service.ts";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import authRoutes from "./routes/auth.ts";
import dashboardRoutes from "./routes/dashboard.ts";
import apiRoutes from "./routes/api/index.ts";
import { vouchersListRouter } from "./routes/api/vouchers-list.routes.ts";
import { vouchersCreateRouter } from "./routes/api/vouchers-create.routes.ts";
import { vouchersUpdateRouter } from "./routes/api/vouchers-update.routes.ts";
import operationEnhRoutes from "./routes/api/operation-enhancements.routes.ts";
import sidebarEnhRoutes from "./routes/api/sidebar-enhancements.routes.ts";
import screenEnhRoutes from "./routes/api/screen-enhancements.routes.ts";
import { screensWidgetData } from "./routes/api/screens-widget-data.routes.ts";
import { docsRoutes } from "./routes/api/docs.routes.ts";
import maintenanceRoutes from "./routes/maintenance.ts";
import { authMiddleware, adminMiddleware } from "./middleware/auth.ts";
import { db, closeDatabase } from "./db/index.ts";
import { sql } from "drizzle-orm";
import {
  rateLimitMiddleware,
  loginRateLimitMiddleware,
  registerRateLimitMiddleware,
} from "./middleware/rateLimit.ts";
import { xssSanitizeMiddleware } from "./middleware/validation.ts";

const isProduction = process.env.NODE_ENV === "production";
const app = new Hono();

// ===================== CORS: قائمة بيضاء بالنطاقات المسموحة =====================
const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS || "http://localhost:4200,http://localhost:3000"
)
  .split(",")
  .map((o) => o.trim());

app.use(
  "*",
  cors({
    origin: (origin) => {
      // السماح بالطلبات بدون origin (مثل curl أو mobile apps)
      if (!origin) return ALLOWED_ORIGINS[0];
      // التحقق من القائمة البيضاء
      if (ALLOWED_ORIGINS.includes(origin)) return origin;
      // في بيئة التطوير فقط، السماح بـ localhost
      if (!isProduction && origin.startsWith("http://localhost:"))
        return origin;
      // رفض النطاقات غير المسموحة
      return ALLOWED_ORIGINS[0];
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.use("*", logger());

// ===================== Rate Limiting =====================
// تسجيل الدخول: 20 محاولة / 15 دقيقة
app.use("/api/auth/login", loginRateLimitMiddleware());
// التسجيل: 10 محاولات / 15 دقيقة
app.use("/api/auth/register", registerRateLimitMiddleware());
// API عام: 1000 طلب / دقيقة
app.use("/api/*", rateLimitMiddleware({ windowMs: 60000, maxRequests: 1000 }));

// ===================== XSS Sanitization =====================
// استثناء /api/auth لأن تسجيل الدخول والتسجيل يقرآن الـ body مباشرة (استهلاك مزدوج يسبب فشل)
app.use("/api/*", async (c, next) => {
  if (c.req.path.startsWith("/api/auth")) return await next();
  return xssSanitizeMiddleware()(c, next);
});

// ===================== Security Headers =====================
app.use("*", async (c, next) => {
  await next();
  // منع تضمين الموقع في iframe (حماية من Clickjacking)
  c.header("X-Frame-Options", "DENY");
  // منع sniffing لنوع المحتوى
  c.header("X-Content-Type-Options", "nosniff");
  // تفعيل XSS Protection في المتصفح
  c.header("X-XSS-Protection", "1; mode=block");
  // منع تسريب referrer
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  // إزالة header الخادم
  c.header("X-Powered-By", "");
  // Content Security Policy - منع XSS والموارد غير الموثوقة
  c.header(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' wss: ws:",
  );
  // منع استخدام ميزات المتصفح الحساسة
  c.header(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );
  // منع MIME type sniffing
  c.header("X-DNS-Prefetch-Control", "off");
  // في الإنتاج: فرض HTTPS
  if (isProduction) {
    c.header(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }
});

// ===================== Public routes =====================
app.route("/api/auth", authRoutes);

// ===================== Protected routes =====================
app.use("/api/*", authMiddleware());

// مسارات الصيانة: محمية بـ auth + دور admin فقط
app.use("/api/maintenance", adminMiddleware());
app.route("/api/maintenance", maintenanceRoutes);

app.route("/api/dashboard", dashboardRoutes);
app.route("/api", apiRoutes);
app.route("/api", vouchersListRouter);
app.route("/api", vouchersCreateRouter);
app.route("/api", vouchersUpdateRouter);
app.route("/api", operationEnhRoutes);
app.route("/api", sidebarEnhRoutes);
app.route("/api", screenEnhRoutes);
app.route("/api", screensWidgetData);
app.route("/", docsRoutes);

// ===================== Health (قبل المعالج العام حتى لا يلتقطها app.get('*')) =====================
app.get("/health", (c) =>
  c.json({
    status: "ok",
    message: "حساباتي - النظام يعمل بنجاح",
    environment: process.env.NODE_ENV || "development",
    uptime: Math.floor(process.uptime()),
  }),
);
app.get("/health/db", async (c) => {
  try {
    const start = Date.now();
    await db.execute(sql`SELECT 1`);
    const latency = Date.now() - start;
    return c.json({
      status: "connected",
      message: "قاعدة البيانات متصلة وتعمل بنجاح",
      latency: `${latency}ms`,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    return c.json(
      {
        status: "disconnected",
        message: "فشل الاتصال بقاعدة البيانات",
        error: err instanceof Error ? err.message : JSON.stringify(err),
        timestamp: new Date().toISOString(),
      },
      503,
    );
  }
});

// ===================== تقديم الواجهة الأمامية (من backend/public) =====================
const publicDir = path.join(__dirname, "..", "public");
const MIME: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};
app.get("*", async (c) => {
  const url = new URL(c.req.url);
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/health")) {
    return c.json({ error: "المسار المطلوب غير موجود" }, 404);
  }
  const isRoot = url.pathname === "/" || url.pathname === "";
  let filePath = isRoot
    ? path.join(publicDir, "index.html")
    : path.join(
        publicDir,
        url.pathname.replace(/^\//, "").replaceAll("..", ""),
      );
  if (!filePath.startsWith(publicDir)) {
    filePath = path.join(publicDir, "index.html");
  }
  if (!existsSync(filePath)) {
    const indexHtml = path.join(publicDir, "index.html");
    if (existsSync(indexHtml)) {
      const html = readFileSync(indexHtml, "utf-8");
      return c.html(html);
    }
    return c.json({ error: "المسار المطلوب غير موجود" }, 404);
  }
  try {
    const ext = path.extname(filePath);
    const mime = MIME[ext] || "application/octet-stream";
    const body = readFileSync(filePath);
    c.header("Content-Type", mime);
    return c.body(body);
  } catch {
    return c.json({ error: "خطأ في قراءة الملف" }, 500);
  }
});

// ===================== Global Error Handler =====================
app.onError((err, c) => {
  console.error(`[${new Date().toISOString()}] خطأ غير متوقع:`, err);
  return c.json(
    {
      error: "حدث خطأ غير متوقع في الخادم - حاول مرة أخرى",
      details: isProduction ? undefined : err.message,
    },
    500,
  );
});

app.notFound((c) => {
  return c.json({ error: "المسار المطلوب غير موجود" }, 404);
});

// ===================== Auto-migration: ensure color columns exist =====================
(async () => {
  try {
    await db.execute(
      sql`ALTER TABLE sidebar_sections ADD COLUMN IF NOT EXISTS color varchar(30) DEFAULT '#6366f1'`,
    );
    await db.execute(
      sql`ALTER TABLE sidebar_items ADD COLUMN IF NOT EXISTS color varchar(30)`,
    );
    console.log("✅ تم التحقق من أعمدة color في جداول السايدبار");
  } catch (e) {
    console.warn("⚠️ تعذّر التحقق من أعمدة color:", e);
  }
})();

// ===================== Auto-migration: journal_entry_lines — حقول الحساب التحليلي والعملة =====================
(async () => {
  try {
    await db.execute(sql`ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS entity_type varchar(30)`);
    await db.execute(sql`ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS entity_id integer`);
    await db.execute(sql`ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS currency_id integer`);
    await db.execute(sql`ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS foreign_amount decimal(20,2)`);
    await db.execute(sql`ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS exchange_rate decimal(20,6)`);
    console.log("✅ تم التحقق من أعمدة journal_entry_lines (entity/currency)");
  } catch (e) {
    console.warn("⚠️ تعذّر تحديث journal_entry_lines:", e);
  }
})();

const port = Number.parseInt(process.env.PORT || "3000", 10);
console.log(
  `🚀 حساباتي API يعمل على المنفذ ${port} (${process.env.NODE_ENV || "development"})`,
);

const server = serve({ fetch: app.fetch, port });
wsService.init(server as any);

// ===================== DB Keep-Alive =====================
// نبض دوري كل 30 ثانية لإبقاء اتصال قاعدة البيانات حياً
setInterval(async () => {
  try {
    await db.execute(sql`SELECT 1`);
  } catch {
    // تجاهل الخطأ — سيتصل تلقائياً عند الطلب التالي
  }
}, 30_000);

// ===================== Graceful Shutdown =====================
let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n⚠️ استلام إشارة ${signal} - بدء الإغلاق الآمن...`);

  // إيقاف قبول اتصالات جديدة
  server.close(() => {
    console.log("✅ تم إيقاف قبول الاتصالات الجديدة");
  });

  // إغلاق WebSocket
  wsService.shutdown();
  console.log("✅ تم إغلاق اتصالات WebSocket");

  // إغلاق قاعدة البيانات
  try {
    await closeDatabase();
  } catch (err: unknown) {
    console.error("❌ خطأ في إغلاق قاعدة البيانات:", err);
  }

  console.log("✅ تم الإغلاق الآمن بنجاح");
  process.exit(0);
}

// التقاط إشارات الإيقاف
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// التقاط الأخطاء غير المعالجة
process.on("uncaughtException", (err) => {
  console.error(`[${new Date().toISOString()}] ❌ خطأ غير ملتقط:`, err);
  gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason) => {
  console.error(`[${new Date().toISOString()}] ❌ وعد غير معالج:`, reason);
});

export default app;
