/**
 * legacy-compat.routes.ts — مسارات التوافق القديمة
 * ──────────────────────────────────────────────────
 * يحتوي على مسارات قديمة احتفظنا بها للحفاظ على توافق الفرونتند.
 * (تم حذف legacy-compat-misc.routes.ts و legacy-compat-vouchers.routes.ts
 * في تنظيف Phase 14 — كانتا dead code غير مسجّلتين في index.ts).
 */
import { Hono } from 'hono';
import { db } from '../../db/index.ts';
import { eq } from 'drizzle-orm';
import { funds } from '../../db/schema/index.ts';
import { safeHandler, parseId } from '../../middleware/helpers.ts';

const api = new Hono();

// جلب صندوق بالمعرّف (مسار قديم محفوظ للتوافق)
api.get('/funds/:id', safeHandler('جلب صندوق بالمعرّف', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return c.json({ error: 'معرّف الصندوق غير صالح' }, 400);
  const [fund] = await db.select().from(funds).where(eq(funds.id, id)).limit(1);
  if (!fund) return c.json({ error: 'الصندوق غير موجود' }, 404);
  return c.json(fund);
}));

export { api as legacyCompatRoutes };
