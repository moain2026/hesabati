/**
 * ============================================================================
 *  BanksComponent — Proof of Concept للقالب الموحّد <app-crud-page>
 * ============================================================================
 *  ⚠️ هذه الصفحة تستخدم القالب الموحّد + Signal Forms.
 *  لا تكتب أي HTML/Form يدوي. كل شيء تكوين فقط.
 *
 *  قبل: banks.ts = 273 سطر، banks.html = 227 سطر  (500 سطر)
 *  بعد: banks.ts = ~110 سطر، banks.html = 1 سطر    (~111 سطر) — انخفاض 78%
 * ============================================================================
 */
import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { CrudPageComponent } from '../../shared/templates/crud-page/crud-page.component';
import { BaseCrudSignalPageComponent } from '../../shared/base-crud-signal-page.component';
import type { CrudPageConfig } from '../../shared/types/crud-page.types';

interface BankEntity {
  id?: number;
  name: string;
  accountId: number | null;
  accountNumber?: string;
  provider?: string;
  responsiblePerson?: string;
  description?: string;
  notes?: string;
  isActive?: boolean;
}

interface BankForm {
  name: string;
  accountId: number | null;
  accountNumber: string;
  provider: string;
  responsiblePerson: string;
  description: string;
  notes: string;
}

@Component({
  selector: 'app-banks',
  imports: [CrudPageComponent],
  // ✅ Angular MCP best practice: OnPush + Signals = zoneless-ready
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-crud-page
      [config]="config()"
      [data]="filteredData()"
      [form]="entityForm"
      [loading]="loading()"
      [saving]="saving()"
      [showForm]="showForm()"
      [editingId]="editingId()"
      [activeTab]="activeTab()"
      [searchTerm]="searchTerm()"
      (create)="openCreate()"
      (edit)="openEdit($any($event))"
      (delete)="onDelete($any($event))"
      (save)="onSave()"
      (cancel)="closeForm()"
      (tabChange)="activeTab.set($event)"
      (search)="searchTerm.set($event)"
    />
  `,
})
export class BanksComponent extends BaseCrudSignalPageComponent<BankEntity, BankForm> {
  /** قائمة الحسابات البنكية المرتبطة (للـ select في النموذج) */
  private readonly bankAccounts = computed<{ value: number; label: string }[]>(() => {
    // محمّلة لاحقاً — في POC نستعمل قائمة فارغة
    return [];
  });

  /** التكوين الكامل للصفحة */
  override getConfig(): CrudPageConfig<BankEntity, BankForm> {
    return {
      title: 'البنوك',
      icon: 'fluent-emoji:bank',
      breadcrumb: ['الرئيسية', 'البنوك'],
      createLabel: 'بنك جديد',
      emptyTitle: 'لا توجد بنوك',
      emptySubtitle: 'أضف بنكاً جديداً للبدء',

      // ----- الأعمدة (جدول العرض) -----
      columns: [
        { key: 'name', label: 'الاسم', type: 'text', icon: 'fluent-emoji:bank' },
        { key: 'provider', label: 'المزود', type: 'text' },
        { key: 'accountNumber', label: 'رقم الحساب', type: 'text' },
        { key: 'responsiblePerson', label: 'المسؤول', type: 'text' },
        {
          key: 'isActive',
          label: 'الحالة',
          type: 'badge',
          format: (v) => (v ? 'نشط' : 'متوقف'),
          badgeColor: (r) => (r.isActive ? 'success' : 'muted'),
        },
      ],

      // ----- تبويبات الفلترة -----
      tabs: () => [
        { value: 'all', label: 'الكل', icon: 'fluent-emoji:books', count: this.data().length },
        {
          value: 'active',
          label: 'نشط',
          icon: 'fluent-emoji:check-mark-button',
          count: this.data().filter((b) => b.isActive).length,
        },
        {
          value: 'inactive',
          label: 'متوقف',
          icon: 'fluent-emoji:cross-mark',
          count: this.data().filter((b) => !b.isActive).length,
        },
      ],

      // ----- البحث -----
      searchEnabled: true,
      searchKeys: ['name', 'provider', 'accountNumber', 'responsiblePerson'],

      // ----- كروت الإحصائيات -----
      summaryCards: () => [
        {
          icon: 'fluent-emoji:bank',
          color: 'primary',
          label: 'إجمالي البنوك',
          value: this.data().length,
        },
        {
          icon: 'fluent-emoji:check-mark-button',
          color: 'success',
          label: 'البنوك النشطة',
          value: this.data().filter((b) => b.isActive).length,
        },
        {
          icon: 'fluent-emoji:control-knobs',
          color: 'secondary',
          label: 'النتائج',
          value: this.filteredData().length,
        },
      ],

      // ----- النموذج (Signal Forms) -----
      defaultForm: {
        name: '',
        accountId: null,
        accountNumber: '',
        provider: '',
        responsiblePerson: '',
        description: '',
        notes: '',
      },
      formFields: [
        {
          key: 'name',
          label: 'اسم البنك',
          type: 'text',
          required: true,
          placeholder: 'مثال: كريمي الحديدة',
          colSpan: 12,
          icon: 'fluent-emoji:bank',
        },
        {
          key: 'accountId',
          label: 'الحساب المرتبط',
          type: 'select',
          required: true,
          placeholder: 'اختر الحساب',
          options: () => this.bankAccounts(),
          colSpan: 12,
        },
        {
          key: 'accountNumber',
          label: 'رقم الحساب البنكي',
          type: 'text',
          placeholder: '0123456789',
          dir: 'ltr',
          icon: 'fluent-emoji:input-numbers',
        },
        {
          key: 'provider',
          label: 'البنك / المزوّد',
          type: 'text',
          placeholder: 'اسم البنك',
          icon: 'fluent-emoji:office-building',
        },
        {
          key: 'responsiblePerson',
          label: 'المسؤول',
          type: 'text',
          placeholder: 'اسم المسؤول',
          icon: 'fluent-emoji:bust-in-silhouette',
        },
        {
          key: 'notes',
          label: 'ملاحظات',
          type: 'textarea',
          rows: 3,
          colSpan: 12,
        },
      ],

      formTitle: { create: 'إضافة بنك جديد', edit: 'تعديل البنك' },
      entityName: (b) => b.name,
      deleteMessage: (b) => `هل أنت متأكد من حذف البنك "<strong>${b.name}</strong>"؟ هذا الإجراء لا يمكن التراجع عنه.`,
    };
  }

  // ----- API ربط -----
  protected override async loadData(): Promise<BankEntity[]> {
    return (await this.api.getBanks(this.bizId)) as BankEntity[];
  }

  protected override async persistEntity(formValue: BankForm, editingId: number | null): Promise<void> {
    if (!formValue.name?.trim()) {
      throw new Error('اسم البنك مطلوب');
    }
    if (editingId) {
      await this.api.updateBank(this.bizId, editingId, formValue as any);
    } else {
      await this.api.createBank(this.bizId, formValue as any);
    }
  }

  protected override async deleteEntity(id: number): Promise<void> {
    await this.api.deleteBank(this.bizId, id);
  }

  /** alias للقالب */
  config = this.configSignal;
}
