import { signal } from '@angular/core';
import { BasePageComponent } from './base-page.component';

/**
 * قاعدة موحّدة للصفحات التي تحتوي CRUD (إضافة/تعديل/حذف/قائمة).
 *
 * ترث من BasePageComponent وتضيف:
 *  - showForm / editingId / loading / saving signals
 *  - openAdd / openEdit / closeForm helpers
 *  - isEditing computed helper
 *
 * مثال الاستخدام:
 *   export class DepartmentsComponent extends BaseCrudPageComponent<Department> {
 *     departments = signal<Department[]>([]);
 *     form: DepartmentForm = { ...this.defaultForm };
 *     private readonly defaultForm = { name: '', ... };
 *
 *     protected override onBizIdChange() { this.load(); }
 *     protected override resetForm() { this.form = { ...this.defaultForm }; }
 *
 *     protected override populateForm(d: Department) {
 *       this.form = { name: d.name, ... };
 *     }
 *
 *     async load() { ... }
 *     async save() { ... }
 *   }
 */
export abstract class BaseCrudPageComponent<TEntity = unknown> extends BasePageComponent {
  /** حالة تحميل القائمة */
  loading = signal(true);

  /** حالة حفظ النموذج */
  saving = signal(false);

  /** عرض/إخفاء نموذج الإضافة/التعديل */
  showForm = signal(false);

  /** المعرّف الحالي قيد التعديل (null = إضافة جديدة) */
  editingId = signal<number | null>(null);

  /** هل النموذج في وضع التعديل؟ */
  isEditing(): boolean {
    return this.editingId() !== null;
  }

  /**
   * فتح نموذج إضافة جديد:
   * 1) يعيد ضبط النموذج عبر resetForm()
   * 2) يضبط editingId = null
   * 3) يُظهر النموذج ويُمرّر للأعلى
   */
  openAdd(): void {
    this.resetForm();
    this.editingId.set(null);
    this.showForm.set(true);
    this.scrollToTop();
  }

  /**
   * فتح نموذج تعديل:
   * 1) يستدعي populateForm(entity) لتعبئة الحقول
   * 2) يضبط editingId
   * 3) يُظهر النموذج ويُمرّر للأعلى
   */
  openEdit(entity: TEntity & { id: number }): void {
    this.populateForm(entity);
    this.editingId.set(entity.id);
    this.showForm.set(true);
    this.scrollToTop();
  }

  /** إغلاق النموذج وإعادة ضبطه */
  closeForm(): void {
    this.showForm.set(false);
    this.editingId.set(null);
    this.resetForm();
  }

  /** تمرير لأعلى الصفحة بسلاسة */
  protected scrollToTop(): void {
    globalThis.window?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** يجب أن تعيد الصفحة تعيين حقول النموذج للقيم الافتراضية */
  protected abstract resetForm(): void;

  /** يجب أن تملأ الصفحة حقول النموذج من الكيان المُمرر */
  protected abstract populateForm(entity: TEntity & { id: number }): void;
}
