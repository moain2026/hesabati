/**
 * ============================================================================
 *  BaseCrudSignalPageComponent
 * ============================================================================
 *  قاعدة موحّدة لكل صفحات CRUD التي تستخدم القالب الموحّد <app-crud-page>
 *  + Signal Forms.
 *
 *  ⚠️ قاعدة صارمة: أي صفحة CRUD جديدة ترث من هذا الـ base فقط.
 *  لا تكتب logic مكرر (load, save, delete, openCreate, openEdit) في الصفحات.
 *
 *  ما يوفّره:
 *  - loading/saving/showForm/editingId signals (موروثة من BaseCrudPageComponent)
 *  - filteredData() computed مع البحث + التبويبات
 *  - Signal Form initialization
 *  - openCreate / openEdit / closeForm / onSave / onDelete (موحّدة)
 *  - حقن ConfirmDialogService لتأكيد الحذف
 *  - حقن ToastService للإشعارات
 *
 *  ما يجب على الصفحات تنفيذه:
 *  - getConfig(): CrudPageConfig
 *  - loadData(): Promise<TEntity[]>
 *  - persistEntity(form, editingId): Promise<void>
 *  - deleteEntity(id): Promise<void>
 *  - (اختياري) toFormModel(entity)
 * ============================================================================
 */
import { computed, inject, signal } from '@angular/core';
import { form } from '@angular/forms/signals';

import { ApiService } from '../services/api.service';
import { ToastService } from '../services/toast.service';
import { ConfirmDialogService } from './components/confirm-dialog/confirm-dialog.service';
import { BaseCrudPageComponent } from './base-crud-page.component';
import type { CrudPageConfig } from './types/crud-page.types';

export abstract class BaseCrudSignalPageComponent<
  TEntity extends { id?: number } = any,
  TForm extends Record<string, any> = any,
> extends BaseCrudPageComponent<TEntity> {
  protected readonly api = inject(ApiService);
  protected readonly toast = inject(ToastService);
  protected readonly confirm = inject(ConfirmDialogService);
  // injector موروث من BasePageComponent — لا نُعرّفه مرة أخرى

  /** البيانات الأصلية من الـ API */
  data = signal<TEntity[]>([]);

  /** نص البحث */
  searchTerm = signal<string>('');

  /** التبويب النشط */
  activeTab = signal<string>('all');

  /** كائن Signal Form — يُهيَّأ في init() */
  entityForm: any = null;

  /**
   * التكوين الكامل للصفحة — يجب تنفيذه في الصفحة الوارثة.
   */
  abstract getConfig(): CrudPageConfig<TEntity, TForm>;

  /**
   * تحميل البيانات — يجب تنفيذه في الصفحة الوارثة.
   */
  protected abstract loadData(): Promise<TEntity[]>;

  /**
   * حفظ الكيان (إنشاء أو تحديث) — يجب تنفيذه.
   * @param formValue قيمة النموذج الحالية
   * @param editingId المعرّف عند التعديل (null عند الإنشاء)
   */
  protected abstract persistEntity(formValue: TForm, editingId: number | null): Promise<void>;

  /**
   * حذف الكيان — يجب تنفيذه.
   */
  protected abstract deleteEntity(id: number): Promise<void>;

  /**
   * تحويل entity إلى form model عند التعديل.
   * يستخدم defaultForm كقالب ويأخذ كل المفاتيح الموجودة في entity.
   */
  protected toFormModel(entity: TEntity): TForm {
    const cfg = this.getConfig();
    const defaultForm = { ...cfg.defaultForm } as any;
    if (cfg.toFormModel) return cfg.toFormModel(entity);
    const e: any = entity;
    Object.keys(defaultForm).forEach((k) => {
      if (k in e) defaultForm[k] = e[k] ?? defaultForm[k];
    });
    return defaultForm as TForm;
  }

  /** كاش لتكوين الصفحة */
  protected readonly configSignal = computed(() => this.getConfig());

  /**
   * البيانات المفلترة (بحث + تبويبات).
   * يمكن للصفحات الوارثة override.
   */
  filteredData = computed(() => {
    let rows = this.data();
    const cfg = this.configSignal();

    // فلترة حسب التبويبات (إذا كانت قيمة TabBarItem.value تطابق مفتاحاً في الكيان)
    const tab = this.activeTab();
    if (tab && tab !== 'all') {
      rows = this.filterByTab(rows, tab);
    }

    // البحث
    const term = this.searchTerm().trim().toLowerCase();
    if (term && cfg.searchEnabled !== false) {
      const keys = cfg.searchKeys && cfg.searchKeys.length
        ? cfg.searchKeys
        : (cfg.columns.filter((c) => c.type !== 'amount' && c.type !== 'date').map((c) => c.key) as (keyof TEntity)[]);
      rows = rows.filter((r) =>
        keys.some((k) => {
          const v: any = (r as any)[k];
          return v != null && String(v).toLowerCase().includes(term);
        }),
      );
    }
    return rows;
  });

  /**
   * فلترة حسب التبويب — افتراضي: يبحث في الحقول الشائعة (isActive, status, type)
   * يمكن للصفحات override للسلوك المخصص.
   */
  protected filterByTab(rows: TEntity[], tab: string): TEntity[] {
    // الحالات الشائعة
    if (tab === 'active') return rows.filter((r: any) => r.isActive === true);
    if (tab === 'inactive') return rows.filter((r: any) => r.isActive === false);
    // status / type matching
    return rows.filter((r: any) => r.status === tab || r.type === tab || r.category === tab);
  }

  /**
   * تهيئة الـ Signal Form من defaultForm.
   * يُستدعى تلقائياً في openCreate و openEdit.
   */
  protected initForm(initialValue: TForm): void {
    const valueSignal = signal<TForm>(initialValue);
    this.entityForm = form(valueSignal, undefined as any, { injector: this.injector });
  }

  /** يُستدعى عند تغيّر bizId — يُحمّل البيانات */
  protected override onBizIdChange(_bizId: number): void {
    void this.load();
  }

  /** تحميل القائمة */
  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const rows = await this.loadData();
      this.data.set(rows || []);
    } catch (e: unknown) {
      console.error('[CRUD] load failed:', e);
      this.toast.error(e instanceof Error ? e.message : 'فشل تحميل البيانات');
    } finally {
      this.loading.set(false);
    }
  }

  /** فتح نموذج إنشاء جديد */
  override openAdd(): void {
    const cfg = this.getConfig();
    this.initForm({ ...cfg.defaultForm } as TForm);
    this.editingId.set(null);
    this.showForm.set(true);
    this.scrollToTop();
  }

  /** بديل أوضح بالاسم */
  openCreate(): void {
    this.openAdd();
  }

  /** فتح نموذج تعديل */
  override openEdit(entity: TEntity & { id: number }): void {
    const model = this.toFormModel(entity);
    this.initForm(model);
    this.editingId.set(entity.id);
    this.showForm.set(true);
    this.scrollToTop();
  }

  /** إغلاق النموذج */
  override closeForm(): void {
    this.showForm.set(false);
    this.editingId.set(null);
    this.entityForm = null;
  }

  /** حفظ النموذج */
  async onSave(): Promise<void> {
    if (!this.entityForm) return;
    this.saving.set(true);
    try {
      // استخراج القيمة من Signal Form
      const f = this.entityForm;
      const state = typeof f === 'function' ? f() : f;
      const value: TForm = state?.value?.() ?? state?.value ?? state;

      await this.persistEntity(value, this.editingId());
      this.toast.success(this.editingId() ? 'تم التحديث بنجاح' : 'تم الإنشاء بنجاح');
      this.closeForm();
      await this.load();
    } catch (e: unknown) {
      console.error('[CRUD] save failed:', e);
      this.toast.error(e instanceof Error ? e.message : 'فشل الحفظ');
    } finally {
      this.saving.set(false);
    }
  }

  /** حذف مع تأكيد */
  async onDelete(entity: TEntity & { id: number }): Promise<void> {
    const cfg = this.getConfig();
    const name = cfg.entityName ? cfg.entityName(entity) : (entity as any).name || `#${entity.id}`;
    const message = cfg.deleteMessage ? cfg.deleteMessage(entity) : `هل أنت متأكد من حذف "${name}"؟`;

    const confirmed = await this.confirm.danger('تأكيد الحذف', message);
    if (!confirmed) return;

    try {
      await this.deleteEntity(entity.id);
      this.toast.success('تم الحذف بنجاح');
      await this.load();
    } catch (e: unknown) {
      console.error('[CRUD] delete failed:', e);
      this.toast.error(e instanceof Error ? e.message : 'فشل الحذف');
    }
  }

  // مطلوب من BaseCrudPageComponent لكن نتجاوزه بـ Signal Forms
  protected override resetForm(): void {
    const cfg = this.getConfig();
    this.initForm({ ...cfg.defaultForm } as TForm);
  }

  protected override populateForm(entity: TEntity): void {
    const model = this.toFormModel(entity);
    this.initForm(model);
  }
}
