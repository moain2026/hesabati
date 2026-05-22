/**
 * ============================================================================
 *  APP_ICONS — السجل المركزي لجميع الأيقونات (Microsoft Fluent 3D Emoji)
 * ============================================================================
 *  📦 Library: Microsoft Fluent UI Emoji (MIT) via Iconify
 *  🎨 Style: 3D rendered, premium, polished — used in Teams/Outlook/Windows 11
 *  🔧 Usage: <iconify-icon [icon]="APP_ICONS.banks.main"></iconify-icon>
 *
 *  ✅ Approved by user: "خلاص تمام اعتمد هذه المكتبة" (2026-05-22)
 * ============================================================================
 */

/** أيقونات الصفحات الرئيسية (Page-level icons) */
export const APP_ICONS = {
  // ============ الصفحات المالية الأساسية ============
  banks: {
    main: 'fluent-emoji:bank',
    accountNumber: 'fluent-emoji:input-numbers',
    provider: 'fluent-emoji:office-building',
    person: 'fluent-emoji:bust-in-silhouette',
  },
  funds: {
    main: 'fluent-emoji:money-bag',
    cash: 'fluent-emoji:dollar-banknote',
  },
  customers: {
    main: 'fluent-emoji:people',
    person: 'fluent-emoji:bust-in-silhouette',
  },
  reports: {
    main: 'fluent-emoji:bar-chart',
  },
  wallets: {
    main: 'fluent-emoji:credit-card',
  },
  packages: {
    main: 'fluent-emoji:package',
  },
  receipts: {
    main: 'fluent-emoji:receipt',
  },
  settings: {
    main: 'fluent-emoji:gear',
  },
  statistics: {
    main: 'fluent-emoji:chart-increasing',
  },

  // ============ الإجراءات (Actions) ============
  actions: {
    add: 'fluent-emoji:plus',
    edit: 'fluent-emoji:pencil',
    delete: 'fluent-emoji:wastebasket',
    save: 'fluent-emoji:floppy-disk',
    cancel: 'fluent-emoji:cross-mark',
    close: 'fluent-emoji:cross-mark',
    search: 'fluent-emoji:magnifying-glass-tilted-left',
    filter: 'fluent-emoji:control-knobs',
    download: 'fluent-emoji:down-arrow',
    upload: 'fluent-emoji:up-arrow',
  },

  // ============ الحالات (Status) ============
  status: {
    active: 'fluent-emoji:check-mark-button',
    inactive: 'fluent-emoji:cross-mark',
    success: 'fluent-emoji:check-mark-button',
    warning: 'fluent-emoji:warning',
    error: 'fluent-emoji:cross-mark',
    info: 'fluent-emoji:information',
    all: 'fluent-emoji:books',
  },

  // ============ حقول النموذج (Form Fields) ============
  form: {
    text: 'fluent-emoji:memo',
    number: 'fluent-emoji:input-numbers',
    email: 'fluent-emoji:e-mail',
    phone: 'fluent-emoji:telephone',
    date: 'fluent-emoji:calendar',
    location: 'fluent-emoji:round-pushpin',
    notes: 'fluent-emoji:spiral-notepad',
    tag: 'fluent-emoji:label',
    business: 'fluent-emoji:office-building',
  },
} as const;

/**
 * Material Icons → Fluent 3D mapping (for legacy migration).
 * يُستخدم تلقائياً في normalizeIcon() لترقية الأيقونات القديمة.
 */
export const MATERIAL_TO_FLUENT_MAP: Record<string, string> = {
  // مالية وبنوك
  account_balance: 'fluent-emoji:bank',
  attach_money: 'fluent-emoji:money-bag',
  credit_card: 'fluent-emoji:credit-card',
  payments: 'fluent-emoji:dollar-banknote',
  receipt: 'fluent-emoji:receipt',
  receipt_long: 'fluent-emoji:receipt',

  // أشخاص
  person: 'fluent-emoji:bust-in-silhouette',
  people: 'fluent-emoji:people',
  group: 'fluent-emoji:people',
  groups: 'fluent-emoji:people',

  // تقارير وإحصائيات
  bar_chart: 'fluent-emoji:bar-chart',
  insights: 'fluent-emoji:chart-increasing',
  trending_up: 'fluent-emoji:chart-increasing',
  analytics: 'fluent-emoji:bar-chart',

  // مخازن وحزم
  inventory: 'fluent-emoji:package',
  inventory_2: 'fluent-emoji:package',
  warehouse: 'fluent-emoji:package',

  // إعدادات
  settings: 'fluent-emoji:gear',
  tune: 'fluent-emoji:control-knobs',
  build: 'fluent-emoji:wrench',

  // إجراءات
  add: 'fluent-emoji:plus',
  edit: 'fluent-emoji:pencil',
  delete: 'fluent-emoji:wastebasket',
  save: 'fluent-emoji:floppy-disk',
  close: 'fluent-emoji:cross-mark',
  cancel: 'fluent-emoji:cross-mark',
  search: 'fluent-emoji:magnifying-glass-tilted-left',
  filter_list: 'fluent-emoji:control-knobs',

  // حالات
  check_circle: 'fluent-emoji:check-mark-button',
  error: 'fluent-emoji:cross-mark',
  warning: 'fluent-emoji:warning',
  info: 'fluent-emoji:information',
  apps: 'fluent-emoji:books',

  // حقول
  tag: 'fluent-emoji:label',
  business: 'fluent-emoji:office-building',
  phone: 'fluent-emoji:telephone',
  email: 'fluent-emoji:e-mail',
  location_on: 'fluent-emoji:round-pushpin',
  notes: 'fluent-emoji:spiral-notepad',
  description: 'fluent-emoji:memo',
};

/**
 * تطبيع اسم الأيقونة:
 * - إذا كان الاسم يحتوي على ':' فهو Iconify بالفعل → يُمرّر كما هو
 * - إذا كان اسم Material Icon → يُترجم إلى fluent-emoji عبر الخريطة
 * - وإلا يُعاد كما هو (للتوافق الخلفي)
 */
export function normalizeIcon(icon: string | undefined | null): string {
  if (!icon) return 'fluent-emoji:question-mark';
  if (icon.includes(':')) return icon; // already Iconify format
  return MATERIAL_TO_FLUENT_MAP[icon] || icon;
}

/** فحص ما إذا كانت الأيقونة بصيغة Iconify (مثل fluent-emoji:bank) */
export function isIconifyIcon(icon: string | undefined | null): boolean {
  return !!icon && icon.includes(':');
}
