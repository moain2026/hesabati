import { Component, inject, signal } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { BaseCrudPageComponent } from '../../shared/base-crud-page.component';
import { PAGE_IMPORTS } from '../../shared/page-imports';

interface AccountSubNatureForm {
  name: string; natureKey: string; icon: string; color: string;
  requiresStation: boolean; requiresEmployee: boolean; requiresProvider: boolean;
  requiresAccountNumber: boolean; requiresSupplierType: boolean;
  supportsCashOperations: boolean; canReceivePayment: boolean; canMakePayment: boolean;
  isActive: boolean;
}
interface AccountSubNature extends AccountSubNatureForm {
  id: number;
  isSystem?: boolean;
  accountCode?: string;
  accountLedgerCode?: string;
  accountSequence?: string | number;
  sequenceNumber?: string | number;
  code?: string;
}

@Component({
  selector: 'app-account-sub-natures',
  standalone: true,
  imports: [...PAGE_IMPORTS],
  templateUrl: './account-sub-natures.html',
  styleUrl: './account-sub-natures.scss',
})
export class AccountSubNaturesComponent extends BaseCrudPageComponent<AccountSubNature> {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  items = signal<AccountSubNature[]>([]);

  private readonly defaultForm: AccountSubNatureForm = {
    name: '', natureKey: '', icon: 'category', color: '#64748b',
    requiresStation: false, requiresEmployee: false, requiresProvider: false,
    requiresAccountNumber: false, requiresSupplierType: false,
    supportsCashOperations: true, canReceivePayment: true, canMakePayment: true,
    isActive: true,
  };
  form: AccountSubNatureForm = { ...this.defaultForm };

  protected override onBizIdChange(): void { this.load(); }

  protected override resetForm(): void {
    this.form = { ...this.defaultForm };
  }

  protected override populateForm(item: AccountSubNature): void {
    this.form = { ...this.defaultForm, ...item };
  }

  async load() {
    this.loading.set(true);
    try { this.items.set(await this.api.getAccountSubNatures(this.bizId)); }
    catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'تعذر جلب الأنواع الفرعية'); this.items.set([]); }
    this.loading.set(false);
  }

  async save() {
    if (!this.form.name?.trim()) return this.toast.error('اسم النوع مطلوب');
    if (!this.form.natureKey?.trim()) return this.toast.error('مفتاح النوع مطلوب');
    this.saving.set(true);
    try {
      if (this.editingId()) {
        await this.api.updateAccountSubNature(this.bizId, this.editingId()!, this.form);
        this.toast.success('تم تعديل النوع الفرعي');
      } else {
        await this.api.createAccountSubNature(this.bizId, this.form);
        this.toast.success('تم إضافة النوع الفرعي');
      }
      this.closeForm();
      await this.load();
    } catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'فشل الحفظ'); }
    this.saving.set(false);
  }

  async remove(item: AccountSubNature) {
    const confirmed = await this.toast.confirm({ title: 'تأكيد الحذف', message: `هل تريد حذف النوع "${item.name}"؟`, type: 'danger' });
    if (!confirmed) return;
    try { await this.api.deleteAccountSubNature(this.bizId, item.id); this.toast.success('تم الحذف'); await this.load(); }
    catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'تعذر الحذف'); }
  }
}
