/**
 * ============================================================================
 *  Hesabati — Unified CRUD Page Types
 * ============================================================================
 *  أنواع البيانات المشتركة للقالب الموحّد <app-crud-page>
 *
 *  ⚠️ هذه الأنواع إلزامية لكل صفحات CRUD — لا تكتب أنواعاً خاصة لكل صفحة.
 * ============================================================================
 */

import type { TemplateRef } from '@angular/core';

// ============================================================================
//  1. Column definition for the data list
// ============================================================================

/** نوع خلية الجدول/الكارد */
export type CellType =
  | 'text'        // نص عادي
  | 'badge'       // شارة ملوّنة (status badge)
  | 'amount'      // مبلغ مالي (مع عملة اختيارية)
  | 'date'        // تاريخ
  | 'datetime'    // تاريخ ووقت
  | 'boolean'     // ✅ / ❌
  | 'icon'        // أيقونة Material
  | 'image'       // صورة
  | 'currency'    // مبلغ + عملة
  | 'custom';     // عبر TemplateRef

/** خيار لون للـ badge type */
export type BadgeColor = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

/**
 * تعريف عمود في القائمة (جدول أو شبكة كروت).
 * يُستخدم كـ مدخل لـ <app-crud-page [columns]="...">
 */
export interface CrudColumn<T = any> {
  /** اسم الحقل في الكائن (يدعم dot notation: "account.name") */
  key: keyof T | string;

  /** عنوان العمود الظاهر للمستخدم */
  label: string;

  /** نوع الخلية — يحدد طريقة العرض */
  type?: CellType;

  /** أيقونة Material تظهر مع الخلية (مفيدة لـ icon/text) */
  icon?: string;

  /** عرض العمود (px أو fr) */
  width?: string;

  /** محاذاة المحتوى */
  align?: 'start' | 'center' | 'end';

  /** هل العمود قابل للفرز؟ */
  sortable?: boolean;

  /** هل العمود ظاهر؟ (لإخفاء مشروط) */
  visible?: boolean;

  /** ربط لون الـ badge بقيمة الصف (للنوع 'badge') */
  badgeColor?: BadgeColor | ((row: T) => BadgeColor);

  /** دالة استخراج/تحويل القيمة للعرض */
  format?: (value: any, row: T) => string | number;

  /** اسم العملة (للنوع 'amount' أو 'currency') */
  currency?: string | ((row: T) => string);

  /** قالب مخصص للخلية (للنوع 'custom') */
  template?: TemplateRef<{ $implicit: T; column: CrudColumn<T> }>;

  /** إخفاء العمود على الموبايل */
  hideOnMobile?: boolean;
}

// ============================================================================
//  2. Form field definition (Signal Forms compatible)
// ============================================================================

/** نوع حقل الإدخال */
export type FieldType =
  | 'text'
  | 'number'
  | 'email'
  | 'tel'
  | 'password'
  | 'textarea'
  | 'select'
  | 'multiselect'
  | 'checkbox'
  | 'radio'
  | 'date'
  | 'datetime'
  | 'switch'
  | 'currency'
  | 'amount'
  | 'chip-select'   // اختيار متعدد بشكل chips (مثل العملات)
  | 'custom';

/** خيار لـ select / radio */
export interface FieldOption {
  value: any;
  label: string;
  icon?: string;
  disabled?: boolean;
  description?: string;
}

/**
 * تعريف حقل في النموذج — يُستخدم مع Signal Forms.
 * Validation و reactivity مدمجة عبر Signal Forms API.
 */
export interface FormFieldConfig<T = any> {
  /** اسم الحقل (مطابق لمفتاح في كائن النموذج) */
  key: keyof T & string;

  /** عنوان الحقل المعروض */
  label: string;

  /** نوع الحقل */
  type: FieldType;

  /** نص تلميحي داخل الحقل */
  placeholder?: string;

  /** نص توضيحي تحت الحقل */
  hint?: string;

  /** أيقونة Material قبل الحقل */
  icon?: string;

  /** هل الحقل مطلوب؟ (يضاف validator تلقائياً عبر Signal Forms) */
  required?: boolean;

  /** هل الحقل معطّل؟ */
  disabled?: boolean | (() => boolean);

  /** هل الحقل مخفي؟ (شرطي) */
  hidden?: boolean | (() => boolean);

  /** هل للقراءة فقط؟ */
  readonly?: boolean | (() => boolean);

  /** خيارات (للأنواع select / multiselect / radio / chip-select) */
  options?: FieldOption[] | (() => FieldOption[]);

  /** الحد الأدنى (للأرقام والنصوص) */
  min?: number;

  /** الحد الأقصى */
  max?: number;

  /** الطول الأدنى للنص */
  minLength?: number;

  /** الطول الأقصى للنص */
  maxLength?: number;

  /** Regex للتحقق */
  pattern?: RegExp | string;

  /** رسالة خطأ مخصصة */
  errorMessage?: string;

  /**
   * عرض الحقل في الشبكة (1-12).
   * - 12 = صف كامل
   * - 6  = نصف صف (افتراضي للحقول العادية)
   * - 4  = ثلث صف
   */
  colSpan?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

  /** عدد الصفوف للـ textarea */
  rows?: number;

  /** اتجاه النص (مفيد لأرقام الحساب) */
  dir?: 'ltr' | 'rtl' | 'auto';

  /** قالب مخصص (للنوع 'custom') */
  template?: TemplateRef<any>;

  /** عند تغيّر القيمة — callback اختياري */
  onChange?: (value: any) => void;
}

// ============================================================================
//  3. Summary card config
// ============================================================================

export interface SummaryCardConfig {
  icon: string;
  label: string;
  value: number | string | (() => number | string);
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'muted';
  customColor?: string;
  valueFormat?: 'number' | 'percent' | 'currency' | 'text';
  currency?: string;
  subtext?: string;
}

// ============================================================================
//  4. Tab definition
// ============================================================================

export interface CrudTab<TValue = string> {
  value: TValue;
  label: string;
  icon?: string;
  /** تُحسب تلقائياً من البيانات إن لم تُمرَّر */
  count?: number | (() => number);
  disabled?: boolean;
  dimmed?: boolean;
  customColor?: string;
  customBgColor?: string;
}

// ============================================================================
//  5. Layout style for the data display
// ============================================================================

export type CrudLayout = 'table' | 'grid' | 'list';

// ============================================================================
//  6. Action button (extra actions beyond edit/delete)
// ============================================================================

export interface CrudAction<T = any> {
  icon: string;
  label: string;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
  visible?: boolean | ((row: T) => boolean);
  disabled?: boolean | ((row: T) => boolean);
  handler: (row: T) => void;
}

// ============================================================================
//  7. The complete CRUD page configuration
// ============================================================================

/**
 * تكوين كامل لصفحة CRUD — يُمرَّر للقالب الموحّد كـ input واحد.
 * يضمن أن كل المعلومات اللازمة لبناء الصفحة في مكان واحد.
 */
export interface CrudPageConfig<TEntity = any, TFormModel = any> {
  // ------ Header ------
  /** عنوان الصفحة (يظهر في الـ header) */
  title: string;
  /** عنوان فرعي (اختياري) */
  subtitle?: string;
  /** أيقونة Material للصفحة */
  icon?: string;
  /** breadcrumb */
  breadcrumb?: string[];
  /** نص زر "إضافة جديد" */
  createLabel?: string;

  // ------ Layout ------
  /** كيف تُعرض البيانات: جدول | شبكة كروت | قائمة */
  layout?: CrudLayout;

  // ------ Data ------
  /** أعمدة العرض */
  columns: CrudColumn<TEntity>[];
  /** خيارات إضافية للصف (روابط، أزرار مخصصة) */
  rowActions?: CrudAction<TEntity>[];

  // ------ Filtering ------
  /** تبويبات الفلترة (اختياري) */
  tabs?: CrudTab[] | (() => CrudTab[]);
  /** حقل البحث الذكي (نشط دائماً افتراضياً) */
  searchEnabled?: boolean;
  /** الحقول التي يبحث فيها smart-filter */
  searchKeys?: (keyof TEntity)[];

  // ------ Summary cards ------
  summaryCards?: SummaryCardConfig[] | (() => SummaryCardConfig[]);

  // ------ Form ------
  /** حقول النموذج (للإضافة والتعديل) */
  formFields: FormFieldConfig<TFormModel>[];
  /** القيم الافتراضية للنموذج الجديد */
  defaultForm: TFormModel;
  /** تحويل entity → form model عند التعديل */
  toFormModel?: (entity: TEntity) => TFormModel;
  /** عنوان النموذج (الافتراضي: "إضافة" / "تعديل") */
  formTitle?: { create: string; edit: string };

  // ------ Behavior ------
  /** هل الحذف مفعّل؟ (default: true) */
  enableDelete?: boolean;
  /** هل التعديل مفعّل؟ (default: true) */
  enableEdit?: boolean;
  /** هل الإضافة مفعّلة؟ (default: true) */
  enableCreate?: boolean;
  /** تأكيد الحذف برسالة مخصصة */
  deleteMessage?: (row: TEntity) => string;
  /** اسم الـ entity في رسائل الحذف */
  entityName?: (row: TEntity) => string;

  // ------ Empty state ------
  emptyTitle?: string;
  emptySubtitle?: string;
}
