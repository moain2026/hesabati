import { Component, inject, signal, computed } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { BasePageComponent } from '../../shared/base-page.component';
import { PAGE_IMPORTS } from '../../shared/page-imports';

interface VoucherLineForm {
  entityType:    string;
  entityId:      number | null;
  accountId:     number | null;
  description:   string;
  currencyId:    number;
  amount:        number;
  foreignAmount: number | null;
  exchangeRate:  number | null;
}

@Component({
  selector: 'app-vouchers',
  standalone: true,
  imports: [...PAGE_IMPORTS],
  templateUrl: './vouchers.html',
  styleUrl:    './vouchers.scss',
})
export class VouchersComponent extends BasePageComponent {
  private readonly api   = inject(ApiService);
  private readonly toast = inject(ToastService);

  // ===== Data =====
  vouchers       = signal<any[]>([]);
  accounts       = signal<any[]>([]);
  operationTypes = signal<any[]>([]);
  currencies     = signal<any[]>([]);
  funds          = signal<any[]>([]);
  banks          = signal<any[]>([]);
  exchanges      = signal<any[]>([]);
  wallets        = signal<any[]>([]);
  suppliers      = signal<any[]>([]);
  employees      = signal<any[]>([]);
  partners       = signal<any[]>([]);
  custodies      = signal<any[]>([]);
  warehouses     = signal<any[]>([]);

  // ===== UI State =====
  loading    = signal(true);
  saving     = signal(false);
  showForm   = signal(false);
  editingId  = signal<number | null>(null);
  expandedId = signal<number | null>(null);
  error      = signal('');

  // ===== Tab =====
  activeTab = signal<string>('all');

  /** Tab items for voucher type filter (TabBarComponent) */
  voucherTabs = computed(() => [
    { value: 'all',     label: 'الكل', icon: 'menu_book',     count: this.vouchers().length },
    { value: 'receipt', label: 'قبض',  icon: 'call_received', count: this.stats().receipts },
    { value: 'payment', label: 'صرف',  icon: 'call_made',     count: this.stats().payments },
  ]);

  filteredVouchers = computed(() => {
    const tab = this.activeTab();
    const all = this.vouchers();
    if (tab === 'all')     return all;
    if (tab === 'receipt') return all.filter((v: any) => v.voucherType === 'receipt');
    if (tab === 'payment') return all.filter((v: any) => v.voucherType === 'payment');
    return all.filter((v: any) => String(v.operationTypeId) === tab);
  });

  // ===== Form Header =====
  formHeader = signal({
    voucherType:     'receipt' as 'receipt' | 'payment',
    date:            new Date().toISOString().split('T')[0],
    description:     '',
    reference:       '',
    operationTypeId: null as number | null,
    currencyId:      1,
    exchangeRate:    null as number | null,
    status:          'draft' as 'draft' | 'draft' | 'confirmed',
  });

  // ===== Treasury =====
  treasuryType = signal<'fund'|'bank'|'exchange'|'e_wallet'|''>('');
  treasuryId   = signal<number | null>(null);

  treasuryOptions = computed(() => {
    switch (this.treasuryType()) {
      case 'fund':     return this.funds();
      case 'bank':     return this.banks();
      case 'exchange': return this.exchanges();
      case 'e_wallet': return this.wallets();
      default:         return [];
    }
  });

  // ===== Lines =====
  formLines = signal<VoucherLineForm[]>([]);

  totalAmount = computed(() =>
    this.formLines().reduce((s, l) => s + (Number(l.amount) || 0), 0)
  );

  hasForeignCurrency = computed(() =>
    this.formLines().some(l => l.currencyId && l.currencyId !== 1)
  );

  // ===== Preview Number =====
  previewNumber  = signal('');
  loadingPreview = signal(false);

  // ===== Stats =====
  stats = computed(() => ({
    total:        this.vouchers().length,
    receipts:     this.vouchers().filter((v: any) => v.voucherType === 'receipt').length,
    payments:     this.vouchers().filter((v: any) => v.voucherType === 'payment').length,
    totalReceipt: this.vouchers().filter((v: any) => v.voucherType === 'receipt')
                      .reduce((s: number, v: any) => s + Number(v.amount || 0), 0),
    totalPayment: this.vouchers().filter((v: any) => v.voucherType === 'payment')
                      .reduce((s: number, v: any) => s + Number(v.amount || 0), 0),
  }));

  readonly entityTypes = [
    { key: '',          label: '— بدون —' },
    { key: 'supplier',  label: 'مورد' },
    { key: 'employee',  label: 'موظف' },
    { key: 'partner',   label: 'شريك' },
    { key: 'fund',      label: 'صندوق / حساب مالي' },
    { key: 'custody',   label: 'عهدة' },
    { key: 'warehouse', label: 'مخزن' },
  ];

  readonly treasuryTypes: { key: 'fund'|'bank'|'exchange'|'e_wallet'; label: string; icon: string }[] = [
    { key: 'fund',     label: 'صندوق',   icon: 'account_balance_wallet' },
    { key: 'bank',     label: 'بنك',     icon: 'account_balance' },
    { key: 'exchange', label: 'صراف',    icon: 'currency_exchange' },
    { key: 'e_wallet', label: 'محفظة',   icon: 'wallet' },
  ];

  readonly entityTypeToAccountTypes: Record<string, string[]> = {
    'supplier':  ['supplier'],
    'employee':  ['employee'],
    'partner':   ['partner'],
    'fund':      ['fund', 'bank', 'e_wallet', 'exchange'],
    'custody':   ['custody'],
    'warehouse': ['warehouse'],
  };

  readonly statusOptions: { key: 'draft'|'draft'|'confirmed'; label: string; icon: string; color: string }[] = [
    { key: 'draft',      label: 'مسودة',     icon: 'edit_note',    color: '#64748b' },
    { key: 'draft', label: 'غير مراجع', icon: 'pending',      color: '#f59e0b' },
    { key: 'confirmed',   label: 'مراجع',     icon: 'check_circle', color: '#10b981' },
  ];

  protected override onBizIdChange(_bizId: number): void { this.load(); }

  // ===== Load =====
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const [vouchs, accs, opTypes, currs, sups, emps, parts, fds, bks, excs, wlts, custs, whs] = await Promise.all([
        this.api.getVouchersAdvanced(this.bizId),
        this.api.getAccounts(this.bizId),
        this.api.getOperationTypes(this.bizId),
        this.api.getCurrencies(),
        this.api.getSuppliers(this.bizId),
        this.api.getEmployees(this.bizId),
        this.api.getPartners(this.bizId),
        this.api.getFunds(this.bizId),
        this.api.getBanks(this.bizId),
        this.api.getExchanges(this.bizId),
        this.api.getWallets(this.bizId),
        this.api.getCustodyRecords(this.bizId),
        this.api.getWarehouses(this.bizId),
      ]);
      this.vouchers.set((vouchs as any)?.vouchers || vouchs || []);
      this.accounts.set(accs || []);
      this.operationTypes.set(opTypes || []);
      this.currencies.set(currs || []);
      this.suppliers.set(sups || []);
      this.employees.set(emps || []);
      this.partners.set(parts || []);
      this.funds.set(fds || []);
      this.banks.set(bks || []);
      this.exchanges.set(excs || []);
      this.wallets.set(wlts || []);
      this.custodies.set(custs || []);
      this.warehouses.set(whs || []);
    } catch (e: any) { this.error.set(e?.message || 'حدث خطأ في التحميل'); }
    this.loading.set(false);
  }

  // ===== Form =====
  newLine(): VoucherLineForm {
    return { entityType: '', entityId: null, accountId: null,
             description: '', currencyId: 1, amount: 0,
             foreignAmount: null, exchangeRate: null };
  }

  openNew(type: 'receipt' | 'payment' = 'receipt') {
    this.editingId.set(null);
    this.formHeader.set({ voucherType: type, date: new Date().toISOString().split('T')[0],
      description: '', reference: '', operationTypeId: null, currencyId: 1, exchangeRate: null, status: 'draft' });
    this.treasuryType.set('');
    this.treasuryId.set(null);
    this.previewNumber.set('');
    this.formLines.set([this.newLine()]);
    this.error.set('');
    this.showForm.set(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  openEdit(v: any) {
    this.editingId.set(v.id);
    const dateStr = v.voucherDate
      ? new Date(v.voucherDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];
    this.formHeader.set({
      voucherType:     v.voucherType || 'receipt',
      date:            dateStr,
      description:     v.description || '',
      reference:       v.reference   || '',
      operationTypeId: v.operationTypeId || null,
      currencyId:      v.currencyId || 1,
      exchangeRate:    v.exchangeRate ? Number(v.exchangeRate) : null,
      status:          v.status || 'draft',
    });
    // Treasury
    if (v.fromFundId)      { this.treasuryType.set('fund');     this.treasuryId.set(v.fromFundId); }
    else if (v.toFundId)   { this.treasuryType.set('fund');     this.treasuryId.set(v.toFundId); }
    else                   { this.treasuryType.set(''); this.treasuryId.set(null); }
    this.previewNumber.set(v.voucherNumber || '');
    const lines = (v.lines || []).map((l: any) => ({
      entityType:    l.entityType || '',
      entityId:      l.entityId   || null,
      accountId:     l.accountId  || null,
      description:   l.description || '',
      currencyId:    l.currencyId || 1,
      amount:        Number(l.amount) || 0,
      foreignAmount: l.foreignAmount ? Number(l.foreignAmount) : null,
      exchangeRate:  l.exchangeRate  ? Number(l.exchangeRate)  : null,
    }));
    this.formLines.set(lines.length > 0 ? lines : [this.newLine()]);
    this.error.set('');
    this.showForm.set(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  updateLine(i: number, field: keyof VoucherLineForm, value: any) {
    this.formLines.update(ls => {
      const copy = [...ls];
      copy[i] = { ...copy[i], [field]: value };
      if (field === 'entityType') { copy[i].accountId = null; copy[i].entityId = null; }
      if (field === 'accountId')  copy[i].entityId = null;
      if (field === 'currencyId' && value === 1) { copy[i].foreignAmount = null; copy[i].exchangeRate = null; }
      if (field === 'currencyId' && value !== 1) {
        // تعبئة السعر الافتراضي تلقائياً من بيانات العملة
        const currency = this.currencies().find((c: any) => c.id === value);
        if (currency?.exchangeRate) {
          copy[i].exchangeRate = Number(currency.exchangeRate);
          if (copy[i].foreignAmount) {
            copy[i].amount = Math.round(Number(copy[i].foreignAmount) * copy[i].exchangeRate * 100) / 100;
          }
        }
      }
      if (field === 'foreignAmount' || field === 'exchangeRate') {
        const fa = Number(copy[i].foreignAmount) || 0;
        const er = Number(copy[i].exchangeRate)  || 0;
        if (fa > 0 && er > 0) copy[i].amount = Math.round(fa * er * 100) / 100;
      }
      return copy;
    });
  }

  addLine()    { this.formLines.update(ls => [...ls, this.newLine()]); }
  removeLine(i: number) { if (this.formLines().length > 1) this.formLines.update(ls => ls.filter((_, idx) => idx !== i)); }
  duplicateLine(i: number) {
    const src = this.formLines()[i];
    this.formLines.update(ls => { const c = [...ls]; c.splice(i + 1, 0, { ...src, amount: 0 }); return c; });
  }

  async onOperationTypeChange(opTypeId: number | null) {
    this.formHeader.update(h => ({ ...h, operationTypeId: opTypeId }));
    await this.fetchPreview();
  }

  async onDateChange(date: string) {
    this.formHeader.update(h => ({ ...h, date }));
    if (this.formHeader().operationTypeId) await this.fetchPreview();
  }

  async fetchPreview() {
    const h = this.formHeader();
    const tId = this.treasuryId();
    const tType = this.treasuryType();
    if (!tId || !tType) { this.previewNumber.set(''); return; }
    this.loadingPreview.set(true);
    try {
      const params: any = { voucherType: h.voucherType };
      if (tType === 'fund')     h.voucherType === 'payment' ? params.fromFundId = tId : params.toFundId = tId;
      else if (tType === 'bank') h.voucherType === 'payment' ? params.fromAccountId = tId : params.toAccountId = tId;
      else params.toFundId = tId;
      if (h.operationTypeId) params.operationTypeId = h.operationTypeId;
      const res = await this.api.getVoucherNumberPreview(this.bizId, params);
      this.previewNumber.set(res?.voucherNumber || res?.previewNumber || '');
    } catch { /* silent */ }
    this.loadingPreview.set(false);
  }

  // ===== Save =====
  async save() {
    const h = this.formHeader();
    if (!h.description) { this.error.set('أدخل بيان السند'); return; }
    if (!this.treasuryId()) { this.error.set('اختر الخزينة / الحساب المالي'); return; }
    const valid = this.formLines().filter(l => Number(l.amount) > 0);
    if (valid.length === 0) { this.error.set('أدخل سطراً واحداً على الأقل بمبلغ'); return; }

    // تحقق من سعر الصرف ضمن السقف المسموح
    for (const line of valid) {
      if (line.currencyId && line.currencyId !== 1 && line.exchangeRate) {
        const currency = this.currencies().find((c: any) => c.id === line.currencyId);
        if (currency) {
          const min = currency.minRate ? Number(currency.minRate) : null;
          const max = currency.maxRate ? Number(currency.maxRate) : null;
          const rate = Number(line.exchangeRate);
          if (min && rate < min) { this.error.set(`سعر الصرف ${rate} أقل من الحد الأدنى ${min} لعملة ${currency.code}`); this.saving.set(false); return; }
          if (max && rate > max) { this.error.set(`سعر الصرف ${rate} أعلى من الحد الأقصى ${max} لعملة ${currency.code}`); this.saving.set(false); return; }
        }
      }
    }
    this.saving.set(true);
    this.error.set('');
    try {
      const payload: any = {
        voucherType:     h.voucherType,
        description:     h.description,
        voucherDate:     h.date,
        reference:       h.reference || null,
        operationTypeId: h.operationTypeId || null,
        currencyId:      h.currencyId || 1,
        exchangeRate:    h.exchangeRate || null,
        status:          h.status,
        amount:          String(this.totalAmount()),
        lines:           valid.map(l => ({
          entityType:    l.entityType || null,
          entityId:      l.entityId   || null,
          accountId:     l.accountId  || null,
          amount:        String(l.amount),
          description:   l.description || null,
          currencyId:    l.currencyId  || 1,
          foreignAmount: l.foreignAmount ? String(l.foreignAmount) : null,
          exchangeRate:  l.exchangeRate  ? String(l.exchangeRate)  : null,
        })),
      };
      // Attach treasury based on type and voucher direction
      const tType = this.treasuryType();
      const tId   = this.treasuryId();
      if (tType === 'fund')     { h.voucherType === 'payment' ? payload.fromFundId = tId : payload.toFundId = tId; }
      else if (tType === 'bank'){ h.voucherType === 'payment' ? payload.fromAccountId = tId : payload.toAccountId = tId; }
      else if (tType === 'exchange' || tType === 'e_wallet') { payload.fundId = tId; }

      if (this.editingId()) {
        await this.api.updateVoucher(this.bizId, this.editingId()!, payload);
        this.toast.success('تم تعديل السند بنجاح');
      } else {
        await this.api.createVoucher(this.bizId, payload);
        this.toast.success('تم حفظ السند بنجاح');
      }
      this.showForm.set(false);
      await this.load();
    } catch (e: any) { this.error.set(e?.message || 'حدث خطأ في الحفظ'); }
    this.saving.set(false);
  }

  async deleteVoucher(id: number) {
    const ok = await this.toast.confirm({ title: 'حذف السند', message: 'هل أنت متأكد من الحذف؟', type: 'danger' });
    if (!ok) return;
    try {
      await this.api.deleteVoucher(id);
      this.toast.success('تم الحذف');
      if (this.expandedId() === id) this.expandedId.set(null);
      await this.load();
    } catch (e: any) { this.toast.error(e?.message || 'حدث خطأ في الحذف'); }
  }

  toggleExpand(id: number) {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  // ===== Helpers =====
  fmt(v: any) { return Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }

  formatDate(d: any) {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('ar-u-nu-latn-ca-gregory', { year: 'numeric', month: 'short', day: 'numeric' }); } catch { return String(d); }
  }

  getAccountName(id: number | null): string {
    if (!id) return '—';
    const a = this.accounts().find((x: any) => x.id === id);
    return a ? (a.code ? `${a.code} - ${a.name}` : a.name) : String(id);
  }

  getTreasuryName(): string {
    const id = this.treasuryId();
    if (!id) return '—';
    const opts = this.treasuryOptions();
    const t = opts.find((x: any) => x.id === id);
    return t ? (t.name || t.fundName || t.label) : String(id);
  }

  getCurrencyName(id: number | null): string {
    if (!id || id === 1) return 'ر.ي';
    const c = this.currencies().find((x: any) => x.id === id);
    return c ? (c.code || c.symbol || c.name) : String(id);
  }

  getAccountsForEntityType(entityType: string): any[] {
    if (!entityType) return this.accounts();
    const types = this.entityTypeToAccountTypes[entityType];
    if (!types) return this.accounts();
    return this.accounts().filter((a: any) => types.includes(a.accountType));
  }

  getEntityList(entityType: string, filterByAccountId?: number | null): any[] {
    let list: any[];
    switch (entityType) {
      case 'supplier':  list = this.suppliers(); break;
      case 'employee':  list = this.employees(); break;
      case 'partner':   list = this.partners(); break;
      case 'fund':      list = [...this.funds(), ...this.banks(), ...this.exchanges(), ...this.wallets()]; break;
      case 'custody':   list = this.custodies(); break;
      case 'warehouse': list = this.warehouses(); break;
      default: return [];
    }
    if (filterByAccountId) {
      const filtered = list.filter((x: any) => x.accountId === filterByAccountId);
      return filtered.length > 0 ? filtered : list;
    }
    return list;
  }

  getEntityLabel(entityType: string, entityId: number | null): string {
    if (!entityType || !entityId) return '—';
    const list = this.getEntityList(entityType);
    const e = list.find((x: any) => x.id === entityId);
    return e ? (e.name || e.fullName || e.fundName || String(entityId)) : String(entityId);
  }

  getVoucherTreasuryName(v: any): string {
    if (v.fromFundId || v.toFundId) {
      const id = v.fromFundId || v.toFundId;
      const f = this.funds().find((x: any) => x.id === id);
      return f ? f.name : `صندوق #${id}`;
    }
    return '—';
  }

  // ===== Print =====
  printVoucher(v: any) {
    const bizName = (document.querySelector('.biz-name') as HTMLElement)?.innerText || 'المنشأة';
    const isReceipt = v.voucherType === 'receipt';
    const lines: any[] = v.lines || [];
    const rows = lines.map((l: any, i: number) => `
      <tr>
        <td>${i + 1}</td>
        <td>${l.accountName || this.getAccountName(l.accountId)}</td>
        <td>${l.entityType && l.entityId ? this.getEntityLabel(l.entityType, l.entityId) : '—'}</td>
        <td>${l.description || '—'}</td>
        <td class="amt">${this.fmt(l.amount)}</td>
      </tr>`).join('');
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><title>${isReceipt ? 'سند قبض' : 'سند صرف'}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; font-size: 13px; direction: rtl; padding: 24px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start;
    border-bottom: 3px solid ${isReceipt ? '#22c55e' : '#ef4444'}; padding-bottom: 12px; margin-bottom: 16px; }
  .biz { font-size: 18px; font-weight: 900; color: ${isReceipt ? '#16a34a' : '#dc2626'}; }
  .vtype { display: inline-block; padding: 4px 14px; border-radius: 20px; font-weight: 900;
    background: ${isReceipt ? '#dcfce7' : '#fee2e2'}; color: ${isReceipt ? '#16a34a' : '#dc2626'}; margin-top: 4px; }
  .meta { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 16px; padding: 10px 14px;
    background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
  .meta-item { display: flex; flex-direction: column; gap: 2px; }
  .meta-label { font-size: 10px; color: #64748b; font-weight: 700; }
  .meta-value { font-size: 13px; font-weight: 800; color: #1e293b; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { padding: 8px 10px; background: ${isReceipt ? '#16a34a' : '#dc2626'}; color: #fff; font-size: 12px; text-align: right; }
  td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
  .amt { font-family: monospace; font-weight: 700; text-align: left; }
  .total-box { display: flex; justify-content: flex-end; gap: 16px; padding: 10px 16px;
    background: ${isReceipt ? '#f0fdf4' : '#fef2f2'}; border-radius: 8px; }
  .total-label { font-size: 11px; color: #64748b; font-weight: 700; }
  .total-val { font-size: 20px; font-weight: 900; font-family: monospace;
    color: ${isReceipt ? '#16a34a' : '#dc2626'}; }
  .footer { margin-top: 24px; display: flex; justify-content: space-between;
    font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  .sig-row { display: flex; justify-content: space-between; margin-top: 40px; }
  .sig-box { text-align: center; width: 180px; }
  .sig-line { border-top: 1px solid #1e293b; padding-top: 4px; font-size: 11px; color: #64748b; }
  @media print { body { padding: 12px; } }
</style></head>
<body>
  <div class="header">
    <div>
      <div class="biz">${bizName}</div>
      <span class="vtype">${isReceipt ? '✓ سند قبض' : '↑ سند صرف'}</span>
    </div>
    <div style="text-align:left">
      <div style="font-size:18px;font-weight:900;font-family:monospace;color:${isReceipt ? '#16a34a' : '#dc2626'}">${v.voucherNumber || '#' + v.id}</div>
      <div style="font-size:11px;color:#64748b">${this.formatDate(v.voucherDate)}</div>
    </div>
  </div>
  <div class="meta">
    <div class="meta-item"><div class="meta-label">التاريخ</div><div class="meta-value">${this.formatDate(v.voucherDate)}</div></div>
    <div class="meta-item"><div class="meta-label">البيان</div><div class="meta-value">${v.description || ''}</div></div>
    ${v.reference ? `<div class="meta-item"><div class="meta-label">المرجع</div><div class="meta-value">${v.reference}</div></div>` : ''}
    <div class="meta-item"><div class="meta-label">الخزينة</div><div class="meta-value">${this.getVoucherTreasuryName(v)}</div></div>
  </div>
  <table>
    <thead><tr><th>#</th><th>الحساب</th><th>الجهة</th><th>البيان</th><th>المبلغ</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="total-box">
    <div>
      <div class="total-label">${isReceipt ? 'إجمالي المقبوض' : 'إجمالي المصروف'}</div>
      <div class="total-val">${this.fmt(v.amount)}</div>
    </div>
  </div>
  <div class="sig-row">
    <div class="sig-box"><div style="height:40px"></div><div class="sig-line">المستلم</div></div>
    <div class="sig-box"><div style="height:40px"></div><div class="sig-line">المحاسب</div></div>
    <div class="sig-box"><div style="height:40px"></div><div class="sig-line">المدير</div></div>
  </div>
  <div class="footer">
    <span>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-YE')}</span>
    <span>حالة السند: ${v.status === 'confirmed' ? 'مراجع' : v.status === 'draft' ? 'غير مراجع' : 'مسودة'}</span>
  </div>
  <script>window.onload = () => { window.print(); }<\/script>
</body></html>`;
    const w = window.open('', '_blank', 'width=900,height=700');
    if (w) { w.document.write(html); w.document.close(); }
  }
}
