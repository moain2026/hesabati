import { Component, inject, signal } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { BaseCrudPageComponent } from '../../shared/base-crud-page.component';
import { PAGE_IMPORTS } from '../../shared/page-imports';

interface JournalCategoryForm { name: string; categoryKey: string; description: string; icon: string; color: string; }
interface JournalCategory extends JournalCategoryForm {
  id: number;
  isSystem?: boolean;
  isActive?: boolean;
  code?: string;
  accountCode?: string;
  accountLedgerCode?: string;
  accountSequence?: string | number;
  sequenceNumber?: string | number;
}

@Component({
  selector: 'app-journal-categories',
  standalone: true,
  imports: [...PAGE_IMPORTS],
  templateUrl: './journal-categories.html',
  styleUrl: './journal-categories.scss',
})
export class JournalCategoriesComponent extends BaseCrudPageComponent<JournalCategory> {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  categories = signal<JournalCategory[]>([]);

  private readonly defaultForm: JournalCategoryForm = { name: '', categoryKey: '', description: '', icon: 'book', color: '#6366f1' };
  form: JournalCategoryForm = { ...this.defaultForm };

  protected override onBizIdChange(_bizId: number): void {
    this.load();
  }

  protected override resetForm(): void {
    this.form = { ...this.defaultForm };
  }

  protected override populateForm(c: JournalCategory): void {
    this.form = {
      name: c.name,
      categoryKey: c.categoryKey,
      description: c.description || '',
      icon: c.icon || 'book',
      color: c.color || '#6366f1',
    };
  }

  async load() {
    this.loading.set(true);
    try {
      const data = await this.api.getJournalEntryCategories(this.bizId);
      this.categories.set(data || []);
    } catch (e) { console.error(e); }
    this.loading.set(false);
  }

  async save() {
    if (!this.form.name?.trim() || !this.form.categoryKey?.trim()) {
      this.toast.error('يرجى إدخال الاسم والمفتاح');
      return;
    }
    this.saving.set(true);
    try {
      if (this.editingId()) {
        await this.api.updateJournalEntryCategory(this.editingId()!, this.form);
        this.toast.success('تم تعديل التصنيف بنجاح');
      } else {
        await this.api.createJournalEntryCategory(this.bizId, this.form);
        this.toast.success('تم إضافة التصنيف بنجاح');
      }
      this.closeForm();
      await this.load();
    } catch (e: unknown) {
      this.toast.error(e instanceof Error ? e.message : 'حدث خطأ');
    }
    this.saving.set(false);
  }

  async remove(c: JournalCategory) {
    const confirmed = await this.toast.confirm({
      title: 'تأكيد الحذف',
      message: `هل أنت متأكد من حذف التصنيف "${c.name}"؟`,
      type: 'danger',
    });
    if (confirmed) {
      try {
        await this.api.deleteJournalEntryCategory(c.id);
        this.toast.success('تم حذف التصنيف');
        await this.load();
      } catch (e: unknown) {
        this.toast.error(e instanceof Error ? e.message : 'حدث خطأ');
      }
    }
  }

  availableIcons = [
    'book', 'menu_book', 'auto_stories', 'library_books', 'receipt_long',
    'description', 'article', 'note', 'sticky_note_2', 'assignment',
    'fact_check', 'rule', 'checklist', 'task', 'summarize',
  ];
}
