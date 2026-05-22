import { Component, inject, signal, OnDestroy } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { BasePageComponent } from '../../shared/base-page.component';
import { PAGE_IMPORTS } from '../../shared/page-imports';
import { ReportPrintService } from '../../services/report-print.service';
import { ReportExportService } from '../../services/report-export.service';
import { NgApexchartsModule } from 'ng-apexcharts';
import type {
  ApexAxisChartSeries, ApexChart, ApexXAxis, ApexDataLabels,
  ApexTitleSubtitle, ApexStroke, ApexGrid, ApexYAxis, ApexLegend,
  ApexTooltip, ApexFill, ApexPlotOptions, ApexNonAxisChartSeries,
  ApexResponsive,
} from 'ng-apexcharts';
import { formatAmount as fmt } from '../../shared/helpers';

@Component({
  selector: 'app-reports-advanced',
  standalone: true,
  imports: [...PAGE_IMPORTS, NgApexchartsModule],
  templateUrl: './reports-advanced.html',
  styleUrl: './reports-advanced.scss',
})
export class ReportsAdvancedComponent extends BasePageComponent {
  private readonly api    = inject(ApiService);
  private readonly toast  = inject(ToastService);
  private readonly print  = inject(ReportPrintService);
  private readonly xls    = inject(ReportExportService);

  // ===== Tabs =====
  activeTab = signal('overview');
  loading   = signal(false);

  tabs = [
    { key: 'overview',       label: 'نظرة عامة',       icon: 'dashboard' },
    { key: 'profit-loss',    label: 'أرباح وخسائر',    icon: 'trending_up' },
    { key: 'trial-balance',  label: 'ميزان المراجعة',  icon: 'balance' },
    { key: 'statement',      label: 'كشف حساب',        icon: 'receipt_long' },
    { key: 'daily',          label: 'ملخص يومي',       icon: 'today' },
    { key: 'monthly',        label: 'مقارنة شهرية',    icon: 'bar_chart' },
  ];

  // ===== Filters =====
  dateFrom = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
  dateTo   = new Date().toISOString().split('T')[0];
  dailyDate = new Date().toISOString().split('T')[0];
  monthlyYear = new Date().getFullYear();
  selectedAccountId = '';
  statementSourceType: 'all' | 'payment_voucher' | 'receipt_voucher' | 'journal_manual' | 'inventory_txn' = 'all';

  // ===== Data =====
  accounts: any[] = [];
  funds: any[] = [];
  allAccounts: any[] = [];
  profitLoss:   any = null;
  statement:    any = null;
  dailySummary: any = null;
  trialBalance: any = null;
  monthly:      any = null;
  overview:     any = null;

  // ===== ApexCharts configs =====
  monthlyChart: {
    series: ApexAxisChartSeries;
    chart: ApexChart;
    xaxis: ApexXAxis;
    stroke: ApexStroke;
    dataLabels: ApexDataLabels;
    yaxis: ApexYAxis;
    legend: ApexLegend;
    tooltip: ApexTooltip;
    fill: ApexFill;
    grid: ApexGrid;
  } | null = null;

  overviewDonut: {
    series: ApexNonAxisChartSeries;
    chart: ApexChart;
    labels: string[];
    legend: ApexLegend;
    dataLabels: ApexDataLabels;
    responsive: ApexResponsive[];
    plotOptions: ApexPlotOptions;
    tooltip: ApexTooltip;
    title: ApexTitleSubtitle;
  } | null = null;

  // ===== Lifecycle =====
  protected override onBizIdChange(_bizId: number): void {
    this.loadBase();
  }

  async loadBase() {
    try {
      const [accs, fds] = await Promise.all([
        this.api.getAccounts(this.bizId),
        this.api.getFunds(this.bizId),
      ]);
      this.accounts = accs;
      this.funds = fds;
      this.allAccounts = [
        ...accs.map((a: any) => ({ ...a, _label: a.name })),
        ...fds.map((f: any) => ({ ...f, _label: `${f.name} (صندوق)`, _isFund: true })),
      ];
      if (this.allAccounts.length > 0 && !this.selectedAccountId)
        this.selectedAccountId = String(this.allAccounts[0].id);
    } catch (e) { console.error(e); }
    await this.loadTab();
  }

  async setTab(key: string) {
    this.activeTab.set(key);
    await this.loadTab();
  }

  async loadTab() {
    this.loading.set(true);
    try {
      switch (this.activeTab()) {
        case 'overview':     await this.loadOverview();     break;
        case 'profit-loss':  await this.loadProfitLoss();   break;
        case 'trial-balance':await this.loadTrialBalance(); break;
        case 'statement':    await this.loadStatement();    break;
        case 'daily':        await this.loadDaily();        break;
        case 'monthly':      await this.loadMonthly();      break;
      }
    } catch (e: unknown) {
      this.toast.error('خطأ في تحميل التقرير');
    }
    this.loading.set(false);
  }

  // ===== Loaders =====
  private async loadOverview() {
    const [pl, trial] = await Promise.all([
      this.api.getProfitLossReport(this.bizId, this.dateFrom, this.dateTo),
      this.api.getTrialBalance(this.bizId, this.dateFrom, this.dateTo),
    ]);
    this.profitLoss = pl;
    this.trialBalance = trial;
    this.buildOverviewChart(pl);
  }

  private async loadProfitLoss() {
    this.profitLoss = await this.api.getProfitLossReport(this.bizId, this.dateFrom, this.dateTo);
    this.buildOverviewChart(this.profitLoss);
  }

  private async loadTrialBalance() {
    this.trialBalance = await this.api.getTrialBalance(this.bizId, this.dateFrom, this.dateTo);
  }

  private async loadStatement() {
    if (!this.selectedAccountId) return;
    this.statement = await this.api.getAccountStatement(
      this.bizId, Number(this.selectedAccountId),
      this.dateFrom, this.dateTo, this.statementSourceType
    );
  }

  private async loadDaily() {
    this.dailySummary = await this.api.getDailySummary(this.bizId, this.dailyDate);
  }

  private async loadMonthly() {
    this.monthly = await this.api.getMonthlyRevenue(this.bizId, this.monthlyYear);
    this.buildMonthlyChart(this.monthly);
  }

  // ===== Chart Builders =====
  private buildOverviewChart(pl: any) {
    if (!pl?.byCategory?.length) { this.overviewDonut = null; return; }
    const receipts = pl.byCategory.filter((c: any) => c.voucher_type === 'receipt');
    const labels   = receipts.slice(0, 8).map((c: any) => String(c.category || 'غير محدد'));
    const series   = receipts.slice(0, 8).map((c: any) => Number(c.total || 0));
    this.overviewDonut = {
      series,
      chart: { type: 'donut', height: 280, fontFamily: 'Tajawal, sans-serif' },
      labels,
      legend: { position: 'bottom', fontFamily: 'Tajawal', fontSize: '12px' },
      dataLabels: { enabled: false },
      responsive: [{ breakpoint: 480, options: { chart: { width: 200 } } }],
      plotOptions: { pie: { donut: { size: '65%' } } },
      tooltip: { y: { formatter: (v: number) => fmt(v) + ' ر.ي' } },
      title: { text: 'توزيع الإيرادات حسب التصنيف', align: 'center', style: { fontFamily: 'Tajawal', fontSize: '13px', fontWeight: '700' } },
    };
  }

  private buildMonthlyChart(data: any) {
    if (!data?.months) { this.monthlyChart = null; return; }
    const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                    'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
    const revenues  = Array(12).fill(0);
    const expenses  = Array(12).fill(0);
    for (const m of data.months) {
      const idx = Number(m.month) - 1;
      if (idx >= 0 && idx < 12) {
        revenues[idx]  = Number(m.revenue  || m.receipts  || 0);
        expenses[idx]  = Number(m.expenses || m.payments  || 0);
      }
    }
    this.monthlyChart = {
      series: [
        { name: 'الإيرادات', data: revenues, color: '#22c55e' },
        { name: 'المصروفات', data: expenses, color: '#ef4444' },
      ],
      chart: { type: 'area', height: 320, fontFamily: 'Tajawal, sans-serif', toolbar: { show: true } },
      xaxis: { categories: months, labels: { style: { fontFamily: 'Tajawal', fontSize: '11px' } } },
      stroke: { curve: 'smooth', width: 2 },
      dataLabels: { enabled: false },
      yaxis: { labels: { formatter: (v: number) => fmt(v) } },
      legend: { position: 'top', fontFamily: 'Tajawal', fontSize: '13px' },
      tooltip: { y: { formatter: (v: number) => fmt(v) + ' ر.ي' } },
      fill: { type: 'gradient', gradient: { opacityFrom: 0.4, opacityTo: 0.05 } },
      grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
    };
  }

  // ===== Helpers =====
  getSelectedAccountLabel(): string {
    return this.allAccounts.find(a => String(a.id) === this.selectedAccountId)?._label || '';
  }

  fmt(v: any): string { return fmt(v); }

  // ===== Card color helpers (for SummaryCardComponent) =====
  netProfitColor(): 'primary' | 'warning' {
    return (this.profitLoss?.summary?.net_profit ?? this.profitLoss?.summary?.netProfit ?? 0) >= 0 ? 'primary' : 'warning';
  }
  trialBalancedColor(): 'success' | 'warning' {
    return this.trialBalance?.totals?.isBalanced ? 'success' : 'warning';
  }
  trialBalancedIcon(): string {
    return this.trialBalance?.totals?.isBalanced ? 'check_circle' : 'warning';
  }
  trialBalancedLabel(): string {
    return this.trialBalance?.totals?.isBalanced ? 'متوازن' : 'غير متوازن';
  }

  getSourceTypeLabel(s: any): string {
    const m: Record<string, string> = {
      payment_voucher: 'سند صرف', receipt_voucher: 'سند قبض',
      journal_manual: 'قيد يومية', inventory_txn: 'حركة مخزنية',
    };
    return m[String(s || '')] || 'غير محدد';
  }

  getAccountTypeLabel(t: string): string {
    const m: Record<string, string> = {
      fund: 'صندوق', bank: 'بنك', e_wallet: 'محفظة', exchange: 'صراف',
      supplier: 'مورد', employee: 'موظف', partner: 'شريك',
      warehouse: 'مخزن', custody: 'عهدة', billing: 'فوترة',
    };
    return m[t] || t;
  }

  trialTotalDebit():  number { return (this.trialBalance?.accounts || []).reduce((s: number, a: any) => s + Number(a.total_debit  || 0), 0); }
  trialTotalCredit(): number { return (this.trialBalance?.accounts || []).reduce((s: number, a: any) => s + Number(a.total_credit || 0), 0); }

  stmtTotalDebit():   number {
    return (this.statement?.entries || []).reduce((s: number, e: any) =>
      s + (e.line_type === 'debit' ? Number(e.amount || 0) : 0), 0);
  }
  stmtTotalCredit():  number {
    return (this.statement?.entries || []).reduce((s: number, e: any) =>
      s + (e.line_type === 'credit' ? Number(e.amount || 0) : 0), 0);
  }
  stmtFinalBalance(): number {
    const entries = this.statement?.entries || [];
    if (!entries.length) return 0;
    return Number(entries[entries.length - 1]?.runningBalance || 0);
  }

  // ===== Print =====
  printCurrent() {
    const tab   = this.tabs.find(t => t.key === this.activeTab());
    const title = tab?.label || 'تقرير';
    const biz   = this.biz.currentBusinessName() || 'حساباتي';
    const range = this.activeTab() === 'daily'
      ? `التاريخ: ${this.dailyDate}`
      : `من ${this.dateFrom} إلى ${this.dateTo}`;

    const content = this.buildPrintContent();
    this.print.printHTML(content, title, biz, range);
  }

  private buildPrintContent(): string {
    switch (this.activeTab()) {
      case 'profit-loss':   return this.plPrint();
      case 'trial-balance': return this.trialPrint();
      case 'statement':     return this.stmtPrint();
      case 'daily':         return this.dailyPrint();
      default: return '<p>لا توجد بيانات للطباعة</p>';
    }
  }

  private plPrint(): string {
    if (!this.profitLoss) return '<p>لا توجد بيانات</p>';
    const s = this.profitLoss.summary || {};
    let html = `<div class="summary-grid">
      <div class="summary-card green"><div class="lbl">الإيرادات</div><div class="val">${fmt(s.total_income)}</div></div>
      <div class="summary-card red"><div class="lbl">المصروفات</div><div class="val">${fmt(s.total_expenses)}</div></div>
      <div class="summary-card blue"><div class="lbl">صافي الربح</div><div class="val">${fmt(s.net_profit)}</div></div>
      <div class="summary-card"><div class="lbl">عدد العمليات</div><div class="val">${s.total_operations || 0}</div></div>
    </div>`;
    if (this.profitLoss.byCategory?.length) {
      html += `<div class="section-title">التفاصيل حسب التصنيف</div>
      <table><thead><tr><th>التصنيف</th><th>النوع</th><th>المجموع</th><th>العدد</th></tr></thead><tbody>`;
      for (const c of this.profitLoss.byCategory)
        html += `<tr><td>${c.category || '-'}</td>
          <td><span class="badge ${c.voucher_type === 'receipt' ? 'badge-receipt' : 'badge-payment'}">${c.voucher_type === 'receipt' ? 'إيراد' : 'مصروف'}</span></td>
          <td class="amount">${fmt(c.total)}</td><td>${c.count}</td></tr>`;
      html += `</tbody></table>`;
    }
    return html;
  }

  private trialPrint(): string {
    if (!this.trialBalance) return '<p>لا توجد بيانات</p>';
    const t = this.trialBalance.totals || {};
    let html = `<div class="summary-grid">
      <div class="summary-card green"><div class="lbl">إجمالي المدين</div><div class="val">${fmt(t.totalDebit)}</div></div>
      <div class="summary-card red"><div class="lbl">إجمالي الدائن</div><div class="val">${fmt(t.totalCredit)}</div></div>
      <div class="summary-card ${t.isBalanced ? 'blue' : 'red'}"><div class="lbl">الحالة</div><div class="val">${t.isBalanced ? 'متوازن ✓' : 'غير متوازن ✗'}</div></div>
    </div>
    <table><thead><tr><th>الحساب</th><th>النوع</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead><tbody>`;
    for (const a of (this.trialBalance.accounts || []))
      html += `<tr><td>${a.account_name}</td><td>${this.getAccountTypeLabel(a.account_type)}</td>
        <td class="debit">${fmt(a.total_debit)}</td>
        <td class="credit">${fmt(a.total_credit)}</td>
        <td class="${Number(a.balance) >= 0 ? 'pos' : 'neg'} amount">${fmt(a.balance)}</td></tr>`;
    html += `<tr class="total-row"><td colspan="2">الإجمالي</td>
      <td class="debit">${fmt(t.totalDebit)}</td>
      <td class="credit">${fmt(t.totalCredit)}</td>
      <td class="amount">${fmt((t.totalDebit || 0) - (t.totalCredit || 0))}</td></tr>`;
    html += `</tbody></table>`;
    return html;
  }

  private stmtPrint(): string {
    if (!this.statement) return '<p>لا توجد بيانات</p>';
    const accName = this.statement.account?.name || this.getSelectedAccountLabel();
    let html = `<p style="font-weight:800;margin-bottom:12px">الحساب: ${accName}</p>
    <table><thead><tr><th>التاريخ</th><th>المرجع</th><th>نوع الحركة</th><th>البيان</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead><tbody>`;
    for (const e of (this.statement.entries || []))
      html += `<tr>
        <td>${e.entry_date || '-'}</td>
        <td>${e.entry_number || '-'}</td>
        <td>${this.getSourceTypeLabel(e.source_type)}</td>
        <td>${e.entry_description || e.line_description || '-'}</td>
        <td class="debit">${e.line_type === 'debit' ? fmt(e.amount) : '-'}</td>
        <td class="credit">${e.line_type === 'credit' ? fmt(e.amount) : '-'}</td>
        <td class="${Number(e.runningBalance || 0) >= 0 ? 'pos' : 'neg'} amount">${fmt(e.runningBalance || 0)}</td>
      </tr>`;
    html += `<tr class="total-row">
      <td colspan="4">الإجمالي</td>
      <td class="debit">${fmt(this.stmtTotalDebit())}</td>
      <td class="credit">${fmt(this.stmtTotalCredit())}</td>
      <td class="amount">${fmt(this.stmtFinalBalance())}</td>
    </tr></tbody></table>`;
    return html;
  }

  private dailyPrint(): string {
    if (!this.dailySummary) return '<p>لا توجد بيانات</p>';
    const s = this.dailySummary.summary || {};
    let html = `<div class="summary-grid">
      <div class="summary-card green"><div class="lbl">التحصيل</div><div class="val">${fmt(s.receipts)}</div></div>
      <div class="summary-card red"><div class="lbl">الصرف</div><div class="val">${fmt(s.payments)}</div></div>
      <div class="summary-card blue"><div class="lbl">الصافي</div><div class="val">${fmt((s.receipts||0)-(s.payments||0))}</div></div>
      <div class="summary-card"><div class="lbl">عدد العمليات</div><div class="val">${s.operations_count || 0}</div></div>
    </div>`;
    if (this.dailySummary.byOperationType?.length) {
      html += `<div class="section-title">حسب نوع العملية</div>
      <table><thead><tr><th>نوع العملية</th><th>النوع</th><th>المجموع</th><th>العدد</th></tr></thead><tbody>`;
      for (const o of this.dailySummary.byOperationType)
        html += `<tr><td>${o.name}</td>
          <td><span class="badge ${o.voucher_type === 'receipt' ? 'badge-receipt' : 'badge-payment'}">${o.voucher_type === 'receipt' ? 'تحصيل' : 'صرف'}</span></td>
          <td class="amount">${fmt(o.total)}</td><td>${o.count}</td></tr>`;
      html += `</tbody></table>`;
    }
    return html;
  }

  // ===== Excel Export =====
  exportExcel() {
    switch (this.activeTab()) {
      case 'trial-balance': this.exportTrialExcel(); break;
      case 'statement':     this.exportStmtExcel();  break;
      case 'profit-loss':   this.exportPlExcel();    break;
      case 'daily':         this.exportDailyExcel(); break;
    }
  }

  private exportTrialExcel() {
    if (!this.trialBalance?.accounts?.length) { this.toast.warning('لا توجد بيانات'); return; }
    this.xls.exportSimple('ميزان-المراجعة', 'ميزان المراجعة', [
      { header: 'الحساب',  key: 'account_name', width: 30 },
      { header: 'النوع',   key: 'account_type', width: 14, format: (v) => this.getAccountTypeLabel(v) },
      { header: 'مدين',    key: 'total_debit',  width: 16, format: (v) => Number(v || 0) },
      { header: 'دائن',    key: 'total_credit', width: 16, format: (v) => Number(v || 0) },
      { header: 'الرصيد',  key: 'balance',      width: 16, format: (v) => Number(v || 0) },
    ], this.trialBalance.accounts, {
      account_name: 'الإجمالي',
      total_debit:  this.trialTotalDebit(),
      total_credit: this.trialTotalCredit(),
    });
  }

  private exportStmtExcel() {
    if (!this.statement?.entries?.length) { this.toast.warning('لا توجد بيانات'); return; }
    this.xls.exportSimple('كشف-حساب', `كشف حساب - ${this.getSelectedAccountLabel()}`, [
      { header: 'التاريخ',     key: 'entry_date',         width: 14 },
      { header: 'المرجع',      key: 'entry_number',       width: 16 },
      { header: 'نوع الحركة', key: 'source_type',        width: 14, format: (v) => this.getSourceTypeLabel(v) },
      { header: 'البيان',      key: 'entry_description',  width: 32 },
      { header: 'مدين',        key: 'debit_amount',       width: 14, format: (_v, r) => r.line_type === 'debit'  ? Number(r.amount || 0) : '' },
      { header: 'دائن',        key: 'credit_amount',      width: 14, format: (_v, r) => r.line_type === 'credit' ? Number(r.amount || 0) : '' },
      { header: 'الرصيد',      key: 'runningBalance',     width: 14, format: (v) => Number(v || 0) },
    ], this.statement.entries);
  }

  private exportPlExcel() {
    if (!this.profitLoss?.byCategory?.length) { this.toast.warning('لا توجد بيانات'); return; }
    this.xls.exportSimple('الأرباح-والخسائر', 'الأرباح والخسائر', [
      { header: 'التصنيف', key: 'category',     width: 24 },
      { header: 'النوع',   key: 'voucher_type', width: 12, format: (v) => v === 'receipt' ? 'إيراد' : 'مصروف' },
      { header: 'المجموع', key: 'total',        width: 16, format: (v) => Number(v || 0) },
      { header: 'العدد',   key: 'count',        width: 10 },
    ], this.profitLoss.byCategory);
  }

  private exportDailyExcel() {
    if (!this.dailySummary?.byOperationType?.length) { this.toast.warning('لا توجد بيانات'); return; }
    this.xls.exportSimple('الملخص-اليومي', `ملخص يوم ${this.dailyDate}`, [
      { header: 'نوع العملية', key: 'name',         width: 24 },
      { header: 'النوع',       key: 'voucher_type', width: 12, format: (v) => v === 'receipt' ? 'تحصيل' : 'صرف' },
      { header: 'المجموع',     key: 'total',        width: 16, format: (v) => Number(v || 0) },
      { header: 'العدد',       key: 'count',        width: 10 },
    ], this.dailySummary.byOperationType);
  }
}
