import { Component, inject, signal } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { BaseCrudPageComponent } from '../../shared/base-crud-page.component';
import { PAGE_IMPORTS } from '../../shared/page-imports';

interface SettlementForm {
  title: string; reconciliationType: string; status: string; withPerson: string;
  accountId: number | null; fundId: number | null; stationId: number | null;
  periodStart: string; periodEnd: string; expectedAmount: number; actualAmount: number; notes: string;
}
interface Settlement {
  id: number; title: string; reconciliationType: string; status: string;
  withPerson?: string;
  accountId?: number | null; fundId?: number | null; stationId?: number | null;
  periodStart?: string; periodEnd?: string;
  expectedAmount?: number | string; actualAmount?: number | string;
  notes?: string;
}

@Component({
  selector: 'app-settlements',
  standalone: true,
  imports: [...PAGE_IMPORTS],
  templateUrl: './settlements.html',
  styleUrl: './settlements.scss',
})
export class SettlementsComponent extends BaseCrudPageComponent<Settlement> {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  settlements = signal<Settlement[]>([]);
  accounts = signal<any[]>([]);
  funds = signal<any[]>([]);
  stations = signal<any[]>([]);
  filterType = signal<string>('all');
  filterStatus = signal<string>('all');

  /** Tab items for type filter (TabBarComponent) */
  typeTabs = [
    { value: 'all',        label: 'الكل' },
    { value: 'manager',    label: 'مدير' },
    { value: 'exchange',   label: 'صراف' },
    { value: 'accountant', label: 'محاسب' },
    { value: 'supplier',   label: 'مورد' },
    { value: 'custody',    label: 'عهدة' },
  ];

  /** Tab items for status filter (TabBarComponent) */
  statusTabs = [
    { value: 'all',         label: 'الكل' },
    { value: 'open',        label: 'مفتوحة' },
    { value: 'in_progress', label: 'قيد التنفيذ' },
    { value: 'completed',   label: 'مكتملة' },
  ];

  private readonly defaultForm: SettlementForm = {
    title: '', reconciliationType: 'manager', status: 'open', withPerson: '',
    accountId: null, fundId: null, stationId: null,
    periodStart: '', periodEnd: '', expectedAmount: 0, actualAmount: 0,
    notes: '',
  };
  form: SettlementForm = { ...this.defaultForm };

  protected override onBizIdChange(_bizId: number): void {
    this.load();
  }

  protected override resetForm(): void {
    this.form = { ...this.defaultForm };
  }

  protected override populateForm(r: Settlement): void {
    this.form = {
      title: r.title,
      reconciliationType: r.reconciliationType,
      status: r.status,
      withPerson: r.withPerson || '',
      accountId: r.accountId ?? null,
      fundId: r.fundId ?? null,
      stationId: r.stationId ?? null,
      periodStart: r.periodStart || '',
      periodEnd: r.periodEnd || '',
      expectedAmount: Number(r.expectedAmount || 0),
      actualAmount: Number(r.actualAmount || 0),
      notes: r.notes || '',
    };
  }

  async load() {
    this.loading.set(true);
    try {
      const [sett, accs, fds, sts] = await Promise.all([
        this.api.getSettlements(this.bizId),
        this.api.getAccounts(this.bizId),
        this.api.getFunds(this.bizId),
        this.api.getStations(this.bizId),
      ]);
      this.settlements.set(sett);
      this.accounts.set(accs);
      this.funds.set(fds);
      this.stations.set(sts);
    } catch (e: unknown) {
      console.error(e);
      this.toast.error(e instanceof Error ? e.message : 'حدث خطأ أثناء تحميل بيانات التصفيات');
    }
    this.loading.set(false);
  }

  filteredSettlements() {
    let list = this.settlements();
    const t = this.filterType();
    const s = this.filterStatus();
    if (t !== 'all') list = list.filter(r => r.reconciliationType === t);
    if (s !== 'all') list = list.filter(r => r.status === s);
    return list;
  }

  totalExpected() { return this.filteredSettlements().reduce((s, r) => s + Number(r.expectedAmount || 0), 0); }
  totalActual() { return this.filteredSettlements().reduce((s, r) => s + Number(r.actualAmount || 0), 0); }
  totalDifference() { return this.totalExpected() - this.totalActual(); }

  async save() {
    this.saving.set(true);
    try {
      const data = {
        ...this.form,
        expectedAmount: String(this.form.expectedAmount),
        actualAmount: String(this.form.actualAmount),
      };
      const wasEditing = this.editingId();
      if (wasEditing) {
        await this.api.updateSettlement(wasEditing, data);
      } else {
        await this.api.createSettlement(this.bizId, data);
      }
      this.closeForm();
      this.toast.success(wasEditing ? 'تم تحديث التصفية بنجاح' : 'تم إنشاء التصفية بنجاح');
      await this.load();
    } catch (e: unknown) {
      console.error(e);
      this.toast.error(e instanceof Error ? e.message : 'حدث خطأ أثناء حفظ التصفية');
    }
    this.saving.set(false);
  }

  async remove(r: Settlement) {
    const confirmed = await this.toast.confirm({ title: 'تأكيد الحذف', message: `هل أنت متأكد من حذف التصفية "${r.title}"؟`, type: 'danger' });
    if (confirmed) {
      try {
        await this.api.deleteSettlement(r.id);
        this.toast.success('تم حذف التصفية بنجاح');
        await this.load();
      } catch (e: unknown) {
        console.error(e);
        this.toast.error(e instanceof Error ? e.message : 'حدث خطأ أثناء الحذف');
      }
    }
  }

  getTypeLabel(t: string | undefined): string {
    if (!t) return '';
    const map: Record<string, string> = { manager: 'مدير', exchange: 'صراف', accountant: 'محاسب', supplier: 'مورد', custody: 'عهدة' };
    return map[t] || t;
  }
  getTypeIcon(t: string | undefined): string {
    if (!t) return 'receipt_long';
    const map: Record<string, string> = { manager: 'manage_accounts', exchange: 'currency_exchange', accountant: 'calculate', supplier: 'local_shipping', custody: 'lock' };
    return map[t] || 'receipt_long';
  }
  getStatusLabel(s: string | undefined): string {
    if (!s) return '';
    const map: Record<string, string> = { open: 'مفتوحة', in_progress: 'قيد التنفيذ', completed: 'مكتملة', disputed: 'متنازع عليها' };
    return map[s] || s;
  }
  getStatusClass(s: string | undefined): string {
    if (!s) return '';
    const map: Record<string, string> = { open: 'open', in_progress: 'progress', completed: 'completed', disputed: 'disputed' };
    return map[s] || '';
  }

  getAccountName(id: number | null | undefined): string {
    if (!id) return '-';
    const a = this.accounts().find(a => a.id === id);
    return a ? a.name : '-';
  }
  getStationName(id: number | null | undefined): string {
    if (!id) return '-';
    const s = this.stations().find(s => s.id === id);
    return s ? s.name : '-';
  }
}
