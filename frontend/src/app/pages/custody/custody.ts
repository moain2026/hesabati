import { Component, inject, signal, computed } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { BaseCrudPageComponent } from '../../shared/base-crud-page.component';
import { PAGE_IMPORTS } from '../../shared/page-imports';

interface CustodyForm {
  custodyType: string;
  contentType: string;
  partyName: string;
  partyType: string;
  employeeId: number | null;
  description: string;
  amount: number;
  accountId: number | null;
  currencyId: number | null;
}
interface SettleForm {
  amount: number;
  notes: string;
  settledAt: string;
}
interface CustodyRecord {
  id: number;
  custodyType: string;
  custodyNumber?: string;
  contentType?: string;
  partyName: string;
  partyType?: string;
  employeeId?: number | null;
  description?: string;
  amount?: number;
  accountId?: number | null;
  currencyId?: number | null;
  status?: string;
  isActive?: boolean;
  code?: string;
  createdAt?: string;
  updatedAt?: string;
  settledAt?: string;
  settledAmount?: number;
  remainingAmount?: number;
  notes?: string;
}

@Component({
  selector: 'app-custody',
  standalone: true,
  imports: [...PAGE_IMPORTS],
  templateUrl: './custody.html',
  styleUrl: './custody.scss',
})
export class CustodyComponent extends BaseCrudPageComponent<CustodyRecord> {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  records = signal<CustodyRecord[]>([]);
  custodyAccounts = signal<any[]>([]);
  activeTab = signal<'permanent' | 'temporary'>('permanent');
  // لتجنب أخطاء null في القوالب عند عرض تفاصيل العهدة
  viewingRecord = signal<any>(null);
  settlements = signal<any[]>([]);
  showSettleForm = signal(false);

  filteredAccounts = signal<any[]>([]);
  accountCurrencies = signal<any[]>([]);
  selectedCurrencyId = signal<number | null>(null);

  private readonly defaultForm: CustodyForm = {
    custodyType: 'permanent',
    contentType: 'cash',
    partyName: '',
    partyType: 'employee',
    employeeId: null,
    description: '',
    amount: 0,
    accountId: null,
    currencyId: null,
  };
  form: CustodyForm = { ...this.defaultForm };

  settleForm: SettleForm = { amount: 0, notes: '', settledAt: '' };

  partyTypes = [
    { key: 'employee', label: 'موظف' },
    { key: 'supplier', label: 'مورد' },
    { key: 'external', label: 'طرف خارجي' },
  ];

  contentTypes = [
    { key: 'cash', label: 'نقدية' },
    { key: 'material', label: 'عينية' },
    { key: 'mixed', label: 'مختلطة' },
  ];

  protected override onBizIdChange(_bizId: number): void {
    this.load();
  }

  protected override resetForm(): void {
    this.form = { ...this.defaultForm, custodyType: this.activeTab() };
    this.accountCurrencies.set([]);
    this.selectedCurrencyId.set(null);
  }

  protected override populateForm(c: CustodyRecord): void {
    this.form = {
      custodyType: c.custodyType || 'permanent',
      contentType: c.contentType || 'cash',
      partyName: c.partyName || '',
      partyType: c.partyType || 'employee',
      employeeId: c.employeeId ?? null,
      description: c.description || '',
      amount: c.amount || 0,
      accountId: c.accountId ?? null,
      currencyId: c.currencyId ?? null,
    };
    this.accountCurrencies.set([]);
    this.selectedCurrencyId.set(null);
    if (c.accountId) {
      this.onAccountChange(c.accountId).then(() => {
        if (c.currencyId) this.selectedCurrencyId.set(c.currencyId);
      });
    }
  }

  filteredRecords = computed(() =>
    this.records().filter((r) => r.custodyType === this.activeTab()),
  );

  /** TabBarItem[] لأنواع العهد */
  readonly custodyTabs = [
    { value: 'permanent' as const, label: 'دائمة', icon: 'lock' },
    { value: 'temporary' as const, label: 'مؤقتة', icon: 'schedule' },
  ];

  switchTab(tab: 'permanent' | 'temporary') {
    this.activeTab.set(tab);
  }

  async load() {
    this.loading.set(true);
    try {
      const [custodyRecordsData, custodyAccountsData, allAccounts] = await Promise.all([
        this.api.getCustodyRecords(this.bizId),
        this.api.getCustodyAccounts(this.bizId),
        this.api.getAccounts(this.bizId),
      ]);
      this.records.set(custodyRecordsData || []);
      this.custodyAccounts.set(custodyAccountsData || []);
      this.filteredAccounts.set(
        (allAccounts || []).filter((a: any) => a.accountType === 'custody' && a.isLeafAccount === false),
      );
    } catch (e) {
      console.error(e);
    }
    this.loading.set(false);
  }

  async save() {
    if (!this.form.partyName?.trim()) {
      this.toast.error('يرجى إدخال اسم الطرف');
      return;
    }
    this.saving.set(true);
    const data = { ...this.form, currencyId: this.selectedCurrencyId() };
    try {
      const wasEditing = this.editingId();
      if (wasEditing) {
        await this.api.updateCustodyRecord(this.bizId, wasEditing, data);
        this.toast.success('تم تعديل سجل العهدة بنجاح');
      } else {
        await this.api.createCustodyRecord(this.bizId, data);
        this.toast.success('تم إنشاء سجل العهدة بنجاح');
      }
      this.closeForm();
      await this.load();
    } catch (e: unknown) {
      this.toast.error(e instanceof Error ? e.message : 'حدث خطأ');
    }
    this.saving.set(false);
  }

  async onAccountChange(accountId: number) {
    if (accountId) {
      try {
        const currencies = await this.api.getAccountCurrencies(accountId);
        this.accountCurrencies.set(currencies || []);
        this.selectedCurrencyId.set(null);
      } catch (e) {
        console.error(e);
        this.accountCurrencies.set([]);
      }
    } else {
      this.accountCurrencies.set([]);
      this.selectedCurrencyId.set(null);
    }
  }

  selectCurrency(currencyId: number) {
    this.selectedCurrencyId.set(currencyId);
  }

  async remove(c: CustodyRecord) {
    const confirmed = await this.toast.confirm({
      title: 'تأكيد الحذف',
      message: `هل أنت متأكد من حذف عهدة "${c.partyName}"؟`,
      type: 'danger',
    });
    if (confirmed) {
      try {
        await this.api.deleteCustodyRecord(this.bizId, c.id);
        this.toast.success('تم حذف سجل العهدة');
        await this.load();
      } catch (e: unknown) {
        this.toast.error(e instanceof Error ? e.message : 'حدث خطأ');
      }
    }
  }

  async viewDetails(c: any) {
    this.viewingRecord.set(c);
    try {
      const detail = await this.api.getCustodyRecord(this.bizId, c.id);
      this.settlements.set(detail.settlements || []);
    } catch {
      this.settlements.set([]);
    }
  }

  openSettle() {
    this.settleForm = { amount: 0, notes: '', settledAt: new Date().toISOString().split('T')[0] };
    this.showSettleForm.set(true);
  }

  async submitSettle() {
    if (!this.settleForm.amount || this.settleForm.amount <= 0) {
      this.toast.error('يرجى إدخال مبلغ التسوية');
      return;
    }
    const target = this.viewingRecord();
    if (!target?.id) return;
    try {
      await this.api.addCustodySettlement(this.bizId, target.id, this.settleForm);
      this.toast.success('تم إضافة التسوية بنجاح');
      this.showSettleForm.set(false);
      await this.viewDetails(target);
      await this.load();
    } catch (e: unknown) {
      this.toast.error(e instanceof Error ? e.message : 'حدث خطأ');
    }
  }

  getStatusLabel(status: string | undefined): string {
    if (!status) return '';
    const map: Record<string, string> = {
      active: 'نشطة',
      partially_settled: 'مسوّاة جزئياً',
      settled: 'مسوّاة',
      cancelled: 'ملغاة',
    };
    return map[status] || status;
  }

  getStatusClass(status: string | undefined): string {
    if (!status) return '';
    const map: Record<string, string> = {
      active: 'st-active',
      partially_settled: 'st-partial',
      settled: 'st-settled',
      cancelled: 'st-cancelled',
    };
    return map[status] || '';
  }

  getPartyTypeLabel(type: string | undefined): string {
    if (!type) return '';
    return this.partyTypes.find((t) => t.key === type)?.label || type;
  }

  getContentTypeLabel(type: string | undefined): string {
    if (!type) return '';
    return this.contentTypes.find((t) => t.key === type)?.label || type;
  }
}
