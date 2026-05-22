import { Component, inject, signal } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { BaseCrudPageComponent } from '../../shared/base-crud-page.component';
import { PAGE_IMPORTS } from '../../shared/page-imports';

interface PendingAccountForm { personOrEntity: string; description: string; status: string; estimatedAmount: number; notes: string; accountId: number | null; }
interface PendingAccount {
  id: number; personOrEntity: string; description?: string;
  status: string; estimatedAmount?: number | string;
  notes?: string; accountId?: number | null;
  accountCode?: string; createdAt?: string;
}

@Component({
  selector: 'app-pending-accounts',
  standalone: true,
  imports: [...PAGE_IMPORTS],
  templateUrl: './pending-accounts.html',
  styleUrl: './pending-accounts.scss',
})
export class PendingAccountsComponent extends BaseCrudPageComponent<PendingAccount> {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  items = signal<PendingAccount[]>([]);
  filterStatus = signal<string>('all');
  pendingFilteredAccounts = signal<any[]>([]);

  private readonly defaultForm: PendingAccountForm = { personOrEntity: '', description: '', status: 'pending', estimatedAmount: 0, notes: '', accountId: null };
  form: PendingAccountForm = { ...this.defaultForm };

  protected override onBizIdChange(_bizId: number): void {
    this.load();
    this.api.getAccounts(this.bizId).then(a => this.pendingFilteredAccounts.set((a || []).filter((acc: any) => acc.accountType === 'pending')));
  }

  protected override resetForm(): void {
    this.form = { ...this.defaultForm };
  }

  protected override populateForm(item: PendingAccount): void {
    this.form = {
      personOrEntity: item.personOrEntity,
      description: item.description || '',
      status: item.status,
      estimatedAmount: Number(item.estimatedAmount || 0),
      notes: item.notes || '',
      accountId: item.accountId || null,
    };
  }

  async load() {
    this.loading.set(true);
    try {
      const data = await this.api.getPendingAccounts(this.bizId);
      this.items.set(data);
    } catch (e: unknown) {
      console.error(e);
      this.toast.error(e instanceof Error ? e.message : 'حدث خطأ أثناء تحميل الحسابات المعلقة');
    }
    this.loading.set(false);
  }

  filteredItems() {
    const f = this.filterStatus();
    if (f === 'all') return this.items();
    return this.items().filter(i => i.status === f);
  }

  totalAmount() { return this.filteredItems().reduce((s, i) => s + Number(i.estimatedAmount || 0), 0); }
  pendingCount() { return this.items().filter(i => i.status === 'pending').length; }
  resolvedCount() { return this.items().filter(i => i.status === 'resolved').length; }

  async save() {
    this.saving.set(true);
    try {
      const data = { ...this.form, estimatedAmount: String(this.form.estimatedAmount) };
      const wasEditing = this.editingId();
      if (wasEditing) {
        await this.api.updatePendingAccount(wasEditing, data);
      } else {
        await this.api.createPendingAccount(this.bizId, data);
      }
      this.closeForm();
      this.toast.success(wasEditing ? 'تم تحديث الحساب المعلق بنجاح' : 'تم إضافة الحساب المعلق بنجاح');
      await this.load();
    } catch (e: unknown) {
      console.error(e);
      this.toast.error(e instanceof Error ? e.message : 'حدث خطأ أثناء حفظ الحساب المعلق');
    }
    this.saving.set(false);
  }

  async remove(item: PendingAccount) {
    const confirmed = await this.toast.confirm({ title: 'تأكيد الحذف', message: `هل أنت متأكد من حذف "${item.personOrEntity}"؟`, type: 'danger' });
    if (confirmed) {
      try {
        await this.api.deletePendingAccount(item.id);
        this.toast.success('تم حذف الحساب المعلق بنجاح');
        await this.load();
      } catch (e: unknown) {
        console.error(e);
        this.toast.error(e instanceof Error ? e.message : 'حدث خطأ أثناء الحذف');
      }
    }
  }

  getStatusLabel(s: string | undefined): string {
    if (!s) return '';
    const map: Record<string, string> = { pending: 'معلق', in_progress: 'قيد المعالجة', resolved: 'تم الحل', written_off: 'شُطب' };
    return map[s] || s;
  }
  getStatusClass(s: string | undefined): string {
    if (!s) return '';
    const map: Record<string, string> = { pending: 'pending', in_progress: 'progress', resolved: 'resolved', written_off: 'written-off' };
    return map[s] || '';
  }
}
