import { Component, inject, signal } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { BaseCrudPageComponent } from '../../shared/base-crud-page.component';
import { PAGE_IMPORTS } from '../../shared/page-imports';

interface ExpenseCategoryForm { name: string; description: string; icon: string; color: string; sortOrder: number; isActive: boolean; }
interface ExpenseCategory { id: number; name: string; description?: string; icon?: string; color?: string; sortOrder?: number; isActive?: boolean; }

@Component({
  selector: 'app-expense-categories',
  standalone: true,
  imports: [...PAGE_IMPORTS],
  templateUrl: './expense-categories.html',
  styleUrl: './expense-categories.scss',
})
export class ExpenseCategoriesComponent extends BaseCrudPageComponent<ExpenseCategory> {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  categories = signal<ExpenseCategory[]>([]);

  private readonly defaultForm: ExpenseCategoryForm = { name: '', description: '', icon: 'receipt_long', color: '#3b82f6', sortOrder: 0, isActive: true };
  form: ExpenseCategoryForm = { ...this.defaultForm };

  protected override onBizIdChange(_bizId: number): void {
    this.load();
  }

  protected override resetForm(): void {
    this.form = { ...this.defaultForm };
  }

  protected override populateForm(c: ExpenseCategory): void {
    this.form = {
      name: c.name,
      description: c.description || '',
      icon: c.icon || 'receipt_long',
      color: c.color || '#3b82f6',
      sortOrder: c.sortOrder ?? 0,
      isActive: c.isActive !== false,
    };
  }

  async load() {
    this.loading.set(true);
    try {
      const data = await this.api.getExpenseCategories(this.bizId);
      this.categories.set(data || []);
    } catch (e) { console.error(e); }
    this.loading.set(false);
  }

  async save() {
    if (!this.form.name?.trim()) {
      this.toast.warning('يرجى إدخال اسم التصنيف');
      return;
    }
    this.saving.set(true);
    try {
      const id = this.editingId();
      if (id !== null) {
        await this.api.updateExpenseCategory(id, this.form);
        this.toast.success('تم تعديل التصنيف بنجاح');
      } else {
        await this.api.createExpenseCategory(this.bizId, this.form);
        this.toast.success('تم إضافة التصنيف بنجاح');
      }
      this.closeForm();
      await this.load();
    } catch (e: unknown) {
      this.toast.error(e instanceof Error ? e.message : 'حدث خطأ');
    }
    this.saving.set(false);
  }

  async remove(c: ExpenseCategory) {
    const confirmed = await this.toast.confirm({
      title: 'تأكيد الحذف',
      message: `هل أنت متأكد من حذف التصنيف "${c.name}"؟`,
      type: 'danger',
    });
    if (confirmed) {
      try {
        await this.api.deleteExpenseCategory(c.id);
        this.toast.success('تم حذف التصنيف');
        await this.load();
      } catch (e: unknown) {
        this.toast.error(e instanceof Error ? e.message : 'حدث خطأ');
      }
    }
  }

  availableIcons = ['receipt_long', 'receipt', 'payments', 'savings', 'account_balance', 'category', 'label', 'folder', 'description', 'attach_money'];
}
