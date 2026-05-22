/**
 * API Routes Index — نقطة الدخول الموحدة للمسارات
 * ══════════════════════════════════════════════════════════════
 * بعد تنظيف Phase 14: تم حذف ملفات الـ wrappers التي كانت فقط
 * تعيد التصدير (funds.routes, banks.routes, ...) وأصبحت كل وحدة
 * تستورد مباشرة ملفات -read.routes و -write.routes الفعلية.
 */
import { Hono } from "hono";

// ── الكيانات الأساسية ─────────────────────────────────────────────────
import businessesRoutes from "./businesses.routes.ts";
import stationsRoutes from "./stations.routes.ts";
import { fundsReadRoutes } from "./funds-read.routes.ts";
import { fundsWriteRoutes } from "./funds-write.routes.ts";
import { banksReadRoutes } from "./banks-read.routes.ts";
import { banksWriteRoutes } from "./banks-write.routes.ts";
import { walletsReadRoutes } from "./wallets-read.routes.ts";
import { walletsWriteRoutes } from "./wallets-write.routes.ts";
import { exchangesReadRoutes } from "./exchanges-read.routes.ts";
import { exchangesWriteRoutes } from "./exchanges-write.routes.ts";
import accountsReadRoutes from "./accounts-read.routes.ts";
import accountsWriteRoutes from "./accounts-write.routes.ts";
import { partnersReadRoutes } from "./partners-read.routes.ts";
import { partnersWriteRoutes } from "./partners-write.routes.ts";
import { suppliersReadRoutes } from "./suppliers-read.routes.ts";
import { suppliersWriteRoutes } from "./suppliers-write.routes.ts";
import { employeesReadRoutes } from "./employees-read.routes.ts";
import { employeesWriteRoutes } from "./employees-write.routes.ts";
import { pendingReadRoutes } from "./pending-read.routes.ts";
import { pendingWriteRoutes } from "./pending-write.routes.ts";
import { custodyReadRoutes } from "./custody-read.routes.ts";
import { custodyWriteRoutes } from "./custody-write.routes.ts";
import { budgetReadRoutes } from "./budget-read.routes.ts";
import { budgetWriteRoutes } from "./budget-write.routes.ts";
import { settlementsReadRoutes } from "./settlements-read.routes.ts";
import { settlementsWriteRoutes } from "./settlements-write.routes.ts";
import { billingConfigReadRoutes } from "./billing-config-read.routes.ts";
import { billingConfigWriteRoutes } from "./billing-config-write.routes.ts";
import {
  purchaseInvoicesReadRoutes,
} from "./purchase-invoices-read.routes.ts";
import { purchaseInvoicesWriteRoutes } from "./purchase-invoices-write.routes.ts";

// ── المخازن والعمليات ─────────────────────────────────────────────────
import { warehouseCrudRoutes } from "./warehouse-crud.routes.ts";
import { warehouseOpsReadRoutes } from "./warehouse-ops-read.routes.ts";
import { warehouseOpsWriteRoutes } from "./warehouse-ops-write.routes.ts";
import { warehousesReadRoutes } from "./warehouses-read.routes.ts";
import { warehousesWriteRoutes } from "./warehouses-write.routes.ts";

// ── الموارد البشرية والإدارة ──────────────────────────────────────────
import departmentsRoutes from "./departments.routes.ts";
import jobTitlesRoutes from "./job-titles.routes.ts";

// ── المحاسبة والقيود ──────────────────────────────────────────────────
import journalEntriesRoutes from "./journal-entries.routes.ts";
import operationTypesRoutes from "./operation-types.routes.ts";
import operationCategoriesRoutes from "./operation-categories.routes.ts";
import accountingTypesRoutes from "./accounting-types.routes.ts";
import accountSubNaturesRoutes from "./account-sub-natures.routes.ts";
import { analyticalAccountsRoutes } from "./analytical-accounts.routes.ts";
import reconciliationsRoutes from "./reconciliations.routes.ts";
import categoriesExpensesRoutes from "./categories-expenses.routes.ts";
import supplierTypesRoutes from "./supplier-types.routes.ts";
import inventoryItemTypesRoutes from "./inventory-item-types.routes.ts";

// ── التقارير وسير العمل ───────────────────────────────────────────────
import reportingRoutes from "./reporting.routes.ts";
import reportsRoutes from "./reports.routes.ts";
import workflowRoutes from "./workflow.routes.ts";
import inventoryRoutes from "./inventory.routes.ts";
import uiBuilderRoutes from "./ui-builder.routes.ts";

// ── العملات والفترات المالية ──────────────────────────────────────────
import { currencyRoutes } from "./currency.routes.ts";
import { fiscalRoutes } from "./fiscal.routes.ts";
import { accountCurrenciesRoutes } from "./account-currencies.routes.ts";
import { syncRoutes } from "./sync-currencies.routes.ts";
import { fundCurrenciesRoutes } from "./fund-currencies.routes.ts";

// ── الصلاحيات والأمان ─────────────────────────────────────────────────
import { rbacRoutes } from "./rbac.routes.ts";
import { attachmentsEnhancedRoutes } from "./attachments-enhanced.routes.ts";
import { miscCategoriesRoutes } from "./misc-categories.routes.ts";

// ── الواجهة والشاشات ──────────────────────────────────────────────────
import { sidebarRoutes } from "./sidebar.routes.ts";
import { screensManageRoutes, screensPermRoutes } from "./screens.routes.ts";
import { billingAccountsApi } from "./billing-accounts.routes.ts";

// ── المتفرقات ────────────────────────────────────────────────────────
import { api as restRoutes } from "./api.rest.ts";
import { legacyCompatRoutes } from "./legacy-compat.routes.ts";

const api = new Hono();

// ── تسجيل جميع المسارات ──────────────────────────────────────────────
api.route("/", businessesRoutes);
api.route("/", stationsRoutes);

// الكيانات المالية
api.route("/", fundsReadRoutes);
api.route("/", fundsWriteRoutes);
api.route("/", banksReadRoutes);
api.route("/", banksWriteRoutes);
api.route("/", walletsReadRoutes);
api.route("/", walletsWriteRoutes);
api.route("/", exchangesReadRoutes);
api.route("/", exchangesWriteRoutes);

// الحسابات
api.route("/", accountsReadRoutes);
api.route("/", accountsWriteRoutes);
api.route("/", analyticalAccountsRoutes);
api.route("/", accountSubNaturesRoutes);
api.route("/", accountingTypesRoutes);
api.route("/", accountCurrenciesRoutes);

// الشركاء والموردون والموظفون
api.route("/", partnersReadRoutes);
api.route("/", partnersWriteRoutes);
api.route("/", suppliersReadRoutes);
api.route("/", suppliersWriteRoutes);
api.route("/", supplierTypesRoutes);
api.route("/", employeesReadRoutes);
api.route("/", employeesWriteRoutes);
api.route("/", departmentsRoutes);
api.route("/", jobTitlesRoutes);

// المعلّقة والعهد والميزانية
api.route("/", pendingReadRoutes);
api.route("/", pendingWriteRoutes);
api.route("/", custodyReadRoutes);
api.route("/", custodyWriteRoutes);
api.route("/", budgetReadRoutes);
api.route("/", budgetWriteRoutes);
api.route("/", settlementsReadRoutes);
api.route("/", settlementsWriteRoutes);

// المحاسبة والقيود
api.route("/", journalEntriesRoutes);
api.route("/", operationTypesRoutes);
api.route("/", operationCategoriesRoutes);
api.route("/", reconciliationsRoutes);
api.route("/", categoriesExpensesRoutes);

// الفوترة
api.route("/", billingConfigReadRoutes);
api.route("/", billingConfigWriteRoutes);
api.route("/", billingAccountsApi);

// المخازن
api.route("/", warehouseCrudRoutes);
api.route("/", warehouseOpsReadRoutes);
api.route("/", warehouseOpsWriteRoutes);
api.route("/", warehousesReadRoutes);
api.route("/", warehousesWriteRoutes);
api.route("/", inventoryItemTypesRoutes);
api.route("/", inventoryRoutes);

// المشتريات
api.route("/", purchaseInvoicesReadRoutes);
api.route("/", purchaseInvoicesWriteRoutes);

// التقارير وسير العمل
api.route("/", reportingRoutes);
api.route("/", reportsRoutes);
api.route("/", workflowRoutes);

// العملات والفترات
api.route("/", currencyRoutes);
api.route("/", fiscalRoutes);
api.route("/", syncRoutes);
api.route("/", fundCurrenciesRoutes);

// الصلاحيات والأمان
api.route("/", rbacRoutes);
api.route("/", attachmentsEnhancedRoutes);
api.route("/", miscCategoriesRoutes);

// الواجهة والشاشات
api.route("/", uiBuilderRoutes);
api.route("/", sidebarRoutes);
api.route("/", screensManageRoutes);
api.route("/", screensPermRoutes);

// المتفرقات والتوافق القديم
api.route("/", restRoutes);
api.route("/", legacyCompatRoutes);

export default api;
