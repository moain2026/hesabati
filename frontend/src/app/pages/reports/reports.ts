import { Component, inject, signal } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { BasePageComponent } from '../../shared/base-page.component';
import { PAGE_IMPORTS } from '../../shared/page-imports';
import { formatAmount as formatAmountShared, formatDate as formatDateShared } from '../../shared/helpers';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [...PAGE_IMPORTS],
  templateUrl: './reports.html',
  styleUrl: './reports.scss',
})
export class ReportsComponent extends BasePageComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  loading = signal(true);
  activeReport = signal<string>('overview');

  // بيانات التقارير
  stats = signal<any>({});
  accounts = signal<any[]>([]);
  funds = signal<any[]>([]);
  employees = signal<any[]>([]);
  vouchers = signal<any[]>([]);
  journalEntries = signal<any[]>([]);

  // ميزان المراجعة
  trialBalance = signal<any[]>([]);
  trialLoading = signal(false);
  trialDateFrom = signal('');
  trialDateTo = signal('');

  // كشف حساب
  statementData = signal<any[]>([]);
  statementAccount = signal<any>(null);
  statementLoading = signal(false);
  statementDateFrom = signal('');
  statementDateTo = signal('');
  statementSourceType = signal<'all' | 'payment_voucher' | 'receipt_voucher' | 'journal_manual' | 'inventory_txn'>('all');
  selectedAccountId = signal<number | null>(null);

  // فلاتر
  dateFrom = signal('');
  dateTo = signal('');

  reportTypes = [
    { id: 'overview', label: 'نظرة عامة', icon: 'dashboard' },
    { id: 'trial-balance', label: 'ميزان المراجعة', icon: 'balance' },
    { id: 'statement', label: 'كشف حساب', icon: 'description' },
    { id: 'accounts', label: 'الحسابات', icon: 'account_balance' },
    { id: 'funds', label: 'الصناديق', icon: 'savings' },
    { id: 'employees', label: 'الرواتب', icon: 'groups' },
    { id: 'vouchers', label: 'السندات', icon: 'receipt_long' },
    { id: 'journal', label: 'القيود', icon: 'menu_book' },
  ];

  /** TabBar items derived from reportTypes (id→value mapping) */
  reportTabs = this.reportTypes.map(r => ({ value: r.id, label: r.label, icon: r.icon }));

  protected override onBizIdChange(_bizId: number): void {
    this.load();
  }

  async load() {
    this.loading.set(true);
    try {
      const [accs, fds, emps, vouchers, journal] = await Promise.all([
        this.api.getAccounts(this.bizId),
        this.api.getFunds(this.bizId),
        this.api.getEmployees(this.bizId),
        this.api.getVouchers(this.bizId),
        this.api.getJournalEntries(this.bizId),
      ]);
      this.accounts.set(accs);
      this.funds.set(fds);
      this.employees.set(emps);
      this.vouchers.set(vouchers);
      this.journalEntries.set(journal);

      this.stats.set({
        totalAccounts: accs.length,
        totalFunds: fds.length,
        totalEmployees: emps.length,
        totalVouchers: vouchers.length,
        totalJournal: journal.length,
        totalSalaries: emps.reduce((s: number, e: any) => s + Number(e.salary || 0), 0),
        receiptVouchers: vouchers.filter((v: any) => v.voucherType === 'receipt').length,
        paymentVouchers: vouchers.filter((v: any) => v.voucherType === 'payment').length,
        totalReceipts: vouchers.filter((v: any) => v.voucherType === 'receipt').reduce((s: number, v: any) => s + Number(v.amount || 0), 0),
        totalPayments: vouchers.filter((v: any) => v.voucherType === 'payment').reduce((s: number, v: any) => s + Number(v.amount || 0), 0),
      });
    } catch (e) { console.error(e); }
    this.loading.set(false);
  }

  setReport(id: string) {
    this.activeReport.set(id);
    if (id === 'trial-balance' && this.trialBalance().length === 0) {
      this.loadTrialBalance();
    }
  }

  // ===================== ميزان المراجعة =====================
  async loadTrialBalance() {
    this.trialLoading.set(true);
    try {
      const params: any = {};
      if (this.trialDateFrom()) params.dateFrom = this.trialDateFrom();
      if (this.trialDateTo()) params.dateTo = this.trialDateTo();
      const result = await this.api.getTrialBalance(this.bizId, params.dateFrom, params.dateTo);
      this.trialBalance.set(Array.isArray(result) ? result : (result as any).accounts || []);
    } catch (e: unknown) {
      this.toast.error('خطأ في جلب ميزان المراجعة: ' + (e instanceof Error ? e.message : ''));
      this.trialBalance.set([]);
    }
    this.trialLoading.set(false);
  }

  getTrialTotalDebit(): number {
    return this.trialBalance().reduce((s: number, a: any) => s + Number(a.totalDebit || a.debit || 0), 0);
  }

  getTrialTotalCredit(): number {
    return this.trialBalance().reduce((s: number, a: any) => s + Number(a.totalCredit || a.credit || 0), 0);
  }

  getTrialTotalBalance(): number {
    return this.trialBalance().reduce((s: number, a: any) => s + Number(a.balance || 0), 0);
  }

  // ===================== كشف حساب =====================
  async loadAccountStatement() {
    const accId = this.selectedAccountId();
    if (!accId) { this.toast.warning('اختر حساباً أولاً'); return; }
    this.statementLoading.set(true);
    try {
      const params: any = {};
      if (this.statementDateFrom()) params.dateFrom = this.statementDateFrom();
      if (this.statementDateTo()) params.dateTo = this.statementDateTo();
      const result = await this.api.getAccountStatement(
        this.bizId,
        accId,
        params.dateFrom,
        params.dateTo,
        this.statementSourceType(),
      );
      this.statementData.set(Array.isArray(result) ? result : (result as any).entries || []);
      this.statementAccount.set(this.accounts().find(a => a.id === accId));
    } catch (e: unknown) {
      this.toast.error('خطأ في جلب كشف الحساب: ' + (e instanceof Error ? e.message : ''));
      this.statementData.set([]);
    }
    this.statementLoading.set(false);
  }

  getStatementTotalDebit(): number {
    return this.statementData().reduce((s: number, e: any) => {
      if (e?.debit !== undefined && e?.debit !== null) return s + Number(e.debit || 0);
      return s + (String(e?.line_type || '').toLowerCase() === 'debit' ? Number(e?.amount || 0) : 0);
    }, 0);
  }

  getStatementTotalCredit(): number {
    return this.statementData().reduce((s: number, e: any) => {
      if (e?.credit !== undefined && e?.credit !== null) return s + Number(e.credit || 0);
      return s + (String(e?.line_type || '').toLowerCase() === 'credit' ? Number(e?.amount || 0) : 0);
    }, 0);
  }

  getSourceTypeLabel(sourceType: string | null | undefined): string {
    const map: Record<string, string> = {
      payment_voucher: 'سند صرف',
      receipt_voucher: 'سند قبض',
      journal_manual: 'قيد يومية',
      inventory_txn: 'حركة مخزنية',
    };
    return map[String(sourceType || '')] || 'غير محدد';
  }

  // ===================== طباعة =====================
  printReport() {
    const printArea = document.getElementById('report-print-area');
    if (!printArea) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html dir="rtl"><head>
        <title>تقرير - ${this.biz.currentBusinessName()}</title>
        <style>
          body { font-family: 'Tajawal', sans-serif; padding: 20px; direction: rtl; color: #1e293b; }
          .print-header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
          .print-header h2 { margin: 0 0 4px; font-size: 20px; }
          .print-header p { margin: 0; font-size: 13px; color: #666; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { padding: 8px 12px; border: 1px solid #ddd; text-align: right; font-size: 13px; }
          th { background: #f1f5f9; font-weight: 700; }
          .total-row { font-weight: 900; background: #f8fafc; }
          .amount { font-family: monospace; }
          .text-green { color: #16a34a; }
          .text-red { color: #dc2626; }
          .text-blue { color: #2563eb; }
          @media print { body { padding: 0; } }
        </style>
      </head><body>
        <div class="print-header">
          <h2>${this.biz.currentBusinessName()}</h2>
          <p>${this.getReportTitle()} - ${new Date().toLocaleDateString('ar-YE')}</p>
        </div>
        ${printArea.innerHTML}
      </body></html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 300);
  }

  getReportTitle(): string {
    const r = this.reportTypes.find(r => r.id === this.activeReport());
    return r?.label || 'تقرير';
  }

  // تجميع الحسابات حسب النوع
  accountsByType() {
    const groups: Record<string, any[]> = {};
    for (const a of this.accounts()) {
      const t = a.accountType || 'other';
      if (!groups[t]) groups[t] = [];
      groups[t].push(a);
    }
    return Object.entries(groups).map(([type, items]) => ({ type, items, count: items.length }));
  }

  // تجميع الصناديق حسب النوع
  fundsByType() {
    const groups: Record<string, any[]> = {};
    for (const f of this.funds()) {
      const t = f.fundType || 'other';
      if (!groups[t]) groups[t] = [];
      groups[t].push(f);
    }
    return Object.entries(groups).map(([type, items]) => ({ type, items, count: items.length }));
  }

  // تجميع الموظفين حسب المحطة
  employeesByStation() {
    const groups: Record<string, any[]> = {};
    for (const e of this.employees()) {
      const s = e.stationName || 'الإدارة';
      if (!groups[s]) groups[s] = [];
      groups[s].push(e);
    }
    return Object.entries(groups).map(([station, items]) => ({
      station, items, count: items.length,
      totalSalary: items.reduce((s: number, e: any) => s + Number(e.salary || 0), 0),
    }));
  }

  getAccountTypeLabel(t: string): string {
    const map: Record<string, string> = {
      fund: 'صندوق', bank: 'بنك', e_wallet: 'محفظة', exchange: 'صراف',
      accounting: 'أخرى', custody: 'عهدة', billing: 'فوترة', warehouse: 'مخزن',
      supplier: 'مورد', employee: 'موظف', partner: 'شريك',
      budget: 'ميزانية', settlement: 'تصفية', pending: 'معلقة',
    };
    return map[t] || t;
  }

  getFundTypeLabel(t: string): string {
    const map: Record<string, string> = {
      collection: 'تحصيل', salary_advance: 'سلف رواتب', custody: 'عهدة',
      safe: 'خزنة', expense: 'مصروفات', deposit: 'إيداع',
    };
    return map[t] || t;
  }

  formatAmount(n: unknown): string {
    return formatAmountShared(n);
  }

  formatDate(d: string): string {
    if (!d) return '-';
    return formatDateShared(d);
  }
}
