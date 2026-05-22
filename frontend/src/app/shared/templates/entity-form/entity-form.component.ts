/**
 * ============================================================================
 *  <app-entity-form>
 * ============================================================================
 *  نموذج موحّد لإنشاء/تعديل أي كيان — مبني على Signal Forms.
 *
 *  ⚠️ صارم: لا تكتب أي <input>/<select>/<form> يدوي في صفحات CRUD.
 *  استخدم هذا المكوّن دائماً.
 *
 *  الاستخدام (داخل القالب الموحّد، تلقائي):
 *    <app-entity-form
 *      [fields]="config.formFields"
 *      [form]="entityForm"
 *      [title]="formTitle()"
 *      [saving]="saving()"
 *      (save)="onSave()"
 *      (cancel)="closeForm()" />
 * ============================================================================
 */
import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
  computed,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormField, type Field } from '@angular/forms/signals';
import type { FormFieldConfig, FieldOption } from '../../types/crud-page.types';
import { AppIconComponent } from '../../icons/app-icon.component';

@Component({
  selector: 'app-entity-form',
  imports: [NgTemplateOutlet, FormsModule, FormField, AppIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './entity-form.component.html',
  styleUrl: './entity-form.component.scss',
})
export class EntityFormComponent<T extends Record<string, any> = any> {
  /** حقول النموذج (التكوين) */
  fields = input.required<FormFieldConfig<T>[]>();

  /** كائن Signal Form (من form() API) */
  form = input.required<Field<T>>();

  /** عنوان النموذج */
  title = input<string>('نموذج');

  /** أيقونة العنوان */
  icon = input<string>('edit_note');

  /** هل النموذج في وضع التعديل؟ */
  isEditing = input<boolean>(false);

  /** هل يحفظ حالياً؟ */
  saving = input<boolean>(false);

  /** نص زر الحفظ */
  saveLabel = input<string>('حفظ');

  /** عرض النموذج (افتراضي 2 أعمدة) */
  columns = input<1 | 2 | 3>(2);

  // ------ Events ------
  save = output<void>();
  cancel = output<void>();

  /** ترتيب الحقول الظاهرة فقط */
  visibleFields = computed(() => {
    return this.fields().filter((f) => {
      if (typeof f.hidden === 'function') return !f.hidden();
      return !f.hidden;
    });
  });

  /** Grid class بناء على عدد الأعمدة */
  gridClass = computed(() => {
    const cols = this.columns();
    return cols === 1
      ? 'grid-cols-1'
      : cols === 2
        ? 'grid-cols-1 md:grid-cols-2'
        : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
  });

  /** اسم class للـ colSpan في Tailwind */
  colSpanClass(span?: number): string {
    if (!span) return 'md:col-span-1';
    if (span >= 12) return 'md:col-span-2 lg:col-span-3';
    if (span >= 6) return 'md:col-span-2';
    return 'md:col-span-1';
  }

  /** قراءة قيمة `disabled` (قد تكون دالة) */
  isDisabled(field: FormFieldConfig<T>): boolean {
    if (this.saving()) return true;
    if (typeof field.disabled === 'function') return field.disabled();
    return !!field.disabled;
  }

  /** قراءة قيمة `readonly` */
  isReadonly(field: FormFieldConfig<T>): boolean {
    if (typeof field.readonly === 'function') return field.readonly();
    return !!field.readonly;
  }

  /** قراءة الخيارات (قد تكون static أو دالة) */
  getOptions(field: FormFieldConfig<T>): FieldOption[] {
    if (!field.options) return [];
    return typeof field.options === 'function' ? field.options() : field.options;
  }

  /** الوصول لـ Signal Form field المقابل */
  getFieldControl(key: string): any {
    const f: any = this.form();
    return f?.[key];
  }

  /** الأخطاء الحالية لحقل */
  getFieldErrors(key: string): any[] {
    const ctrl = this.getFieldControl(key);
    if (!ctrl) return [];
    try {
      const errors = ctrl().errors?.() ?? [];
      return Array.isArray(errors) ? errors : [];
    } catch {
      return [];
    }
  }

  /** هل الحقل صالح؟ */
  isFieldInvalid(key: string): boolean {
    const ctrl = this.getFieldControl(key);
    if (!ctrl) return false;
    try {
      const state = ctrl();
      return (state?.invalid?.() ?? false) && (state?.touched?.() ?? false);
    } catch {
      return false;
    }
  }

  /** أول رسالة خطأ */
  firstError(key: string): string {
    const errs = this.getFieldErrors(key);
    return errs[0]?.message ?? '';
  }

  /** حدث الحفظ — يفحص validity أولاً */
  onSubmit(): void {
    const f: any = this.form();
    try {
      // طبع كل الحقول لإظهار الأخطاء
      if (f && typeof f === 'function') {
        const state = f();
        state?.markAllAsTouched?.();
      }
    } catch {
      /* noop */
    }
    this.save.emit();
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
