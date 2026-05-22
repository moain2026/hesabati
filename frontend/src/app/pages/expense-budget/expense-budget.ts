import { Component, inject, signal } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { BaseCrudPageComponent } from '../../shared/base-crud-page.component';
import { PAGE_IMPORTS } from '../../shared/page-imports';

interface BudgetForm { name: string; stationId: number | null; amount: number; currencyId: number; expenseType: string; month: number | null; year: number | null; notes: string; accountId: number | null; }

interface ExpenseBudgetItem {
  id: number; name: string;
  stationId?: number | null;
  amount?: number | string;
  currencyId?: number;
  expenseType?: string;
  month?: number | null;
  year?: number | null;
  notes?: string;
  accountId?: number | null;
}

@Component({
  selector: 'app-expense-budget',
  standalone: true,
  imports: [...PAGE_IMPORTS],
  templateUrl: './expense-budget.html',
  styleUrl: './expense-budget.scss',
})
export class ExpenseBudgetComponent extends BaseCrudPageComponent<ExpenseBudgetItem> {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  items = signal<ExpenseBudgetItem[]>([]);
  currencies = signal<any[]>([]);
  stations = signal<any[]>([]);

  filterMonth = signal<number | null>(null);
  filterYear = signal<number | null>(null);
  months = [1,2,3,4,5,6,7,8,9,10,11,12];
  years: number[] = [];
  budgetAccounts = signal<any[]>([]);
  accountCurrencies = signal<any[]>([]);
  selectedCurrencyId = signal<number | null>(null);

  private readonly defaultForm: BudgetForm = { name: '', stationId: null, amount: 0, currencyId: 1, expenseType: 'variable', month: null, year: null, notes: '', accountId: null };
  form: BudgetForm = { ...this.defaultForm };

  override ngOnInit(): void {
    super.ngOnInit();
    const y = new Date().getFullYear();
    for (let i = y; i >= y - 5; i--) this.years.push(i);
  }

  protected override onBizIdChange(_bizId: number): void {
    this.load();
    this.api.getCurrencies().then(c => this.currencies.set(c || []));
    this.api.getStations(this.bizId).then(s => this.stations.set(s || []));
    this.api.getAccounts(this.bizId).then(a => this.budgetAccounts.set((a || []).filter((acc: any) => acc.accountType === 'budget')));
  }

  protected resetForm(): void {
    this.form = {
      ...this.defaultForm,
      month: this.filterMonth() || null,
      year: this.filterYear() || new Date().getFullYear(),
    };
    this.accountCurrencies.set([]);
    this.selectedCurrencyId.set(null);
  }

  protected populateForm(item: ExpenseBudgetItem & { id: number }): void {
    this.form = {
      name: item.name,
      stationId: item.stationId || null,
      amount: Number(item.amount || 0),
      currencyId: item.currencyId || 1,
      expenseType: item.expenseType || 'variable',
      month: item.month ?? null,
      year: item.year ?? null,
      notes: item.notes || '',
      accountId: item.accountId ?? null,
    };
    this.accountCurrencies.set([]);
    this.selectedCurrencyId.set(null);
    if (item.accountId) {
      this.onAccountChange(item.accountId).then(() => {
        if (item.currencyId) this.selectedCurrencyId.set(item.currencyId);
      });
    }
  }

  async load() {
    this.loading.set(true);
    try {
      const month = this.filterMonth();
      const year = this.filterYear();
      const data = await this.api.getExpenseBudget(this.bizId, month ?? undefined, year ?? undefined);
      this.items.set(data || []);
    } catch (e) { console.error(e); }
    this.loading.set(false);
  }

  onFilterChange() { this.load(); }

  async save() {
    if (!this.form.name?.trim()) { this.toast.warning('يرجى إدخال اسم البند'); return; }
    this.saving.set(true);
    try {
      const currId = this.selectedCurrencyId() || this.form.currencyId;
      const payload = { ...this.form, amount: Number(this.form.amount), currencyId: currId };
      const id = this.editingId();
      if (id === null) {
        await this.api.createExpenseBudget(this.bizId, payload);
        this.toast.success('تم إضافة بند الميزانية بنجاح');
      } else {
        await this.api.updateExpenseBudget(id, payload);
        this.toast.success('تم تعديل البند بنجاح');
      }
      this.closeForm();
      await this.load();
    } catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'حدث خطأ'); }
    finally { this.saving.set(false); }
  }

  async remove(item: ExpenseBudgetItem) {
    const confirmed = await this.toast.confirm({ title: 'تأكيد الحذف', message: `هل أنت متأكد من حذف "${item.name}"؟`, type: 'danger' });
    if (confirmed) {
      try {
        await this.api.deleteExpenseBudget(item.id);
        this.toast.success('تم الحذف');
        await this.load();
      } catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'حدث خطأ'); }
    }
  }

  getExpenseTypeLabel(t: string | undefined): string {
    if (!t) return '';
    const map: Record<string, string> = { fixed: 'ثابت', variable: 'متغير', annual: 'سنوي' };
    return map[t] || t;
  }
  getStationName(id: number | null | undefined): string {
    if (!id) return '-';
    return this.stations().find(s => s.id === id)?.name || '-';
  }
  getCurrencyCode(id: number | undefined): string {
    if (!id) return 'ر.ي';
    return this.currencies().find(c => c.id === id)?.code || 'ر.ي';
  }
  totalAmount(): number { return this.items().reduce((s, i) => s + Number(i.amount || 0), 0); }

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
}
