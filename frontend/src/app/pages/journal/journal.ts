import { Component, inject, signal, computed } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { BasePageComponent } from '../../shared/base-page.component';
import { PAGE_IMPORTS } from '../../shared/page-imports';
import { formatAmount as formatAmountShared, formatDate as formatDateShared } from '../../shared/helpers';

/** سطر قيد واحد في النموذج الحر */
export interface JournalLineForm {
  lineType: 'debit' | 'credit';
  accountId: number | null;
  entityType: string;         // supplier | employee | partner | fund | custody | warehouse | ''
  entityId: number | null;
  description: string;
  currencyId: number;
  amount: number;             // المبلغ بالعملة المحلية
  foreignAmount: number | null;
  exchangeRate: number | null;
}

@Component({
  selector: 'app-journal',
  standalone: true,
  imports: [...PAGE_IMPORTS],
  templateUrl: './journal.html',
  styleUrl: './journal.scss',
})
export class JournalComponent extends BasePageComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  // ===== State =====
  entries       = signal<any[]>([]);
  // Summary counts
  balancedCount(): number { return this.entries().filter(e => e.isBalanced).length; }
  draftCount(): number { return this.entries().filter(e => e.status === 'draft' || !e.status).length; }
  confirmedCount(): number { return this.entries().filter(e => e.status === 'confirmed').length; }
  uncategorizedCount(): number { return this.entries().filter(e => !e.category).length; }
  categoryCount(key: string): number { return this.entries().filter(e => e.category === key).length; }

  /** Tab items for category filter (TabBarComponent) */
  categoryTabs() {
    const tabs: { value: string; label: string; icon: string; count: number }[] = [
      { value: 'all', label: 'الكل', icon: 'menu_book', count: this.entries().length },
    ];
    for (const c of this.categories()) {
      tabs.push({
        value: c.categoryKey,
        label: c.name,
        icon: c.icon || 'label',
        count: this.categoryCount(c.categoryKey),
      });
    }
    const uncategorized = this.uncategorizedCount();
    if (uncategorized > 0) {
      tabs.push({ value: 'other', label: 'غير مصنف', icon: 'help_outline', count: uncategorized });
    }
    return tabs;
  }

  accounts      = signal<any[]>([]);
  operationTypes= signal<any[]>([]);
  currencies    = signal<any[]>([]);
  suppliers     = signal<any[]>([]);
  employees     = signal<any[]>([]);
  partners      = signal<any[]>([]);
  funds         = signal<any[]>([]);
  custodies     = signal<any[]>([]);
  warehouses    = signal<any[]>([]);
  loading       = signal(true);
  saving        = signal(false);
  showForm      = signal(false);
  expandedId    = signal<number | null>(null);
  error         = signal('');
  editingId     = signal<number | null>(null);

  // ===== إدارة أنواع القيود =====
  showTypesPanel  = signal(false);
  categories      = signal<any[]>([]);
  savingCat       = signal(false);
  editingCatId    = signal<number | null>(null);
  catForm         = signal({ name: '', categoryKey: '', description: '', icon: 'menu_book', color: '#6366f1' });
  showCatForm     = signal(false);

  readonly catIcons = ['menu_book','receipt_long','book','auto_stories','library_books',
    'description','article','note','assignment','fact_check','rule','summarize','task','edit_note','payments'];

  // ===== نموذج القيد (رأس) =====
  formHeader = signal({
    date:            new Date().toISOString().split('T')[0],
    description:     '',
    reference:       '',
    operationTypeId: null as number | null,
    categoryKey:     '' as string,
    status:          'draft' as 'draft' | 'draft' | 'confirmed',
  });

  // الرقم التسلسلي المعاين
  previewNumber  = signal('');
  loadingPreview = signal(false);

  // ===== سطور القيد الحرة =====
  formLines = signal<JournalLineForm[]>([]);

  // ===== Tab Filter =====
  activeTab = signal<string>('all');

  filteredEntries = computed(() => {
    const tab = this.activeTab();
    const all = this.entries();
    if (tab === 'all')   return all;
    if (tab === 'other') return all.filter((e: any) => !e.category);
    return all.filter((e: any) => e.category === tab);
  });

  // ===== Computed =====
  journalOpTypes = computed(() =>
    this.operationTypes().filter((ot: any) => ot.category === 'journal' || !ot.category)
  );

  totalDebit = computed(() =>
    this.formLines().reduce((s, l) => s + (l.lineType === 'debit' ? (Number(l.amount) || 0) : 0), 0)
  );
  totalCredit = computed(() =>
    this.formLines().reduce((s, l) => s + (l.lineType === 'credit' ? (Number(l.amount) || 0) : 0), 0)
  );
  difference = computed(() => Math.abs(this.totalDebit() - this.totalCredit()));
  isBalanced  = computed(() => this.difference() < 0.01);
  hasForeignCurrency = computed(() =>
    this.formLines().some(l => l.currencyId && l.currencyId !== 1)
  );

  // أنواع الكيانات التحليلية
  readonly entityTypes = [
    { key: '',          label: '— بدون —' },
    { key: 'supplier',  label: 'مورد' },
    { key: 'employee',  label: 'موظف' },
    { key: 'partner',   label: 'شريك' },
    { key: 'fund',      label: 'صندوق / حساب مالي' },
    { key: 'custody',   label: 'عهدة' },
    { key: 'warehouse', label: 'مخزن' },
  ];

  readonly statusOptions = [
    { key: 'draft',      label: 'مسودة',       icon: 'edit_note',    color: '#64748b' },
    { key: 'draft', label: 'غير مراجع',   icon: 'pending',      color: '#f59e0b' },
    { key: 'confirmed',   label: 'مراجع',       icon: 'check_circle', color: '#10b981' },
  ];

  protected override onBizIdChange(_bizId: number): void { this.load(); this.loadCategories(); }

  // ===== أنواع القيود (Categories) =====
  async loadCategories() {
    try {
      const data = await this.api.getJournalEntryCategories(this.bizId);
      this.categories.set(data || []);
    } catch { /* non-critical */ }
  }

  openTypesPanel() { this.showTypesPanel.set(true); this.showCatForm.set(false); }
  closeTypesPanel() { this.showTypesPanel.set(false); }

  openAddCat() {
    this.catForm.set({ name: '', categoryKey: '', description: '', icon: 'menu_book', color: '#6366f1' });
    this.editingCatId.set(null);
    this.showCatForm.set(true);
  }

  openEditCat(c: any) {
    this.catForm.set({ name: c.name, categoryKey: c.categoryKey, description: c.description || '',
      icon: c.icon || 'menu_book', color: c.color || '#6366f1' });
    this.editingCatId.set(c.id);
    this.showCatForm.set(true);
  }

  async saveCat() {
    const f = this.catForm();
    if (!f.name?.trim() || !f.categoryKey?.trim()) {
      this.toast.error('يرجى إدخال الاسم والمفتاح'); return;
    }
    this.savingCat.set(true);
    try {
      if (this.editingCatId()) {
        await this.api.updateJournalEntryCategory(this.editingCatId()!, f);
        this.toast.success('تم تعديل النوع');
      } else {
        await this.api.createJournalEntryCategory(this.bizId, f);
        this.toast.success('تم إضافة النوع');
      }
      this.showCatForm.set(false);
      await this.loadCategories();
    } catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'حدث خطأ'); }
    this.savingCat.set(false);
  }

  async removeCat(c: any) {
    const ok = await this.toast.confirm({ title: 'حذف النوع', message: `حذف نوع «${c.name}»?`, type: 'danger' });
    if (!ok) return;
    try {
      await this.api.deleteJournalEntryCategory(c.id);
      this.toast.success('تم الحذف');
      await this.loadCategories();
    } catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'حدث خطأ'); }
  }

  // ===== Loading =====
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const [entries, accs, opTypes, currs, sups, emps, parts, fds, custs, whs] = await Promise.all([
        this.api.getJournalEntries(this.bizId),
        this.api.getAccounts(this.bizId),
        this.api.getOperationTypes(this.bizId),
        this.api.getAllCurrencies(),
        this.api.getSuppliers(this.bizId).catch(() => []),
        this.api.getEmployees(this.bizId).catch(() => []),
        this.api.getPartners(this.bizId).catch(() => []),
        this.api.getFunds(this.bizId).catch(() => []),
        this.api.getCustodyRecords(this.bizId).catch(() => []),
        this.api.getWarehouses(this.bizId).catch(() => []),
      ]);
      this.entries.set(entries);
      this.accounts.set(accs);
      this.operationTypes.set(opTypes);
      this.currencies.set((currs || []).filter((c: any) => c.isActive !== false));
      this.suppliers.set(sups || []);
      this.employees.set(emps || []);
      this.partners.set(parts || []);
      this.funds.set(fds || []);
      this.custodies.set(custs || []);
      this.warehouses.set(whs || []);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'حدث خطأ في تحميل البيانات');
    }
    this.loading.set(false);
  }

  // ===== Form Lines =====
  newLine(): JournalLineForm {
    return { lineType: 'debit', accountId: null, entityType: '', entityId: null,
             description: '', currencyId: 1, amount: 0, foreignAmount: null, exchangeRate: null };
  }

  openNew() {
    this.editingId.set(null);
    this.formHeader.set({ date: new Date().toISOString().split('T')[0],
      description: '', reference: '', operationTypeId: null, categoryKey: '', status: 'draft' });
    this.previewNumber.set('');
    this.formLines.set([this.newLine(), this.newLine()]);
    this.error.set('');
    this.showForm.set(true);
  }

  openEdit(entry: any) {
    this.editingId.set(entry.id);
    const dateStr = entry.entryDate
      ? new Date(entry.entryDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];
    this.formHeader.set({
      date:            dateStr,
      description:     entry.description || '',
      reference:       entry.reference   || '',
      operationTypeId: entry.operationTypeId || null,
      categoryKey:     entry.category    || '',
      status:          entry.status      || 'draft',
    });
    this.previewNumber.set(entry.fullSequenceNumber || entry.entryNumber || '');
    this.formLines.set(
      (entry.lines || []).map((l: any) => ({
        lineType:      l.lineType || 'debit',
        accountId:     l.accountId || null,
        entityType:    l.entityType || '',
        entityId:      l.entityId   || null,
        description:   l.description || '',
        currencyId:    l.currencyId  || 1,
        amount:        Number(l.amount) || 0,
        foreignAmount: l.foreignAmount ? Number(l.foreignAmount) : null,
        exchangeRate:  l.exchangeRate  ? Number(l.exchangeRate)  : null,
      }))
    );
    if (this.formLines().length < 2) {
      while (this.formLines().length < 2) this.formLines.update(ls => [...ls, this.newLine()]);
    }
    this.error.set('');
    this.showForm.set(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  printEntry(entry: any) {
    const bizName = (document.querySelector('.biz-name') as HTMLElement)?.innerText || 'المنشأة';
    const lines: any[] = entry.lines || [];
    const rows = lines.map((l: any, i: number) => `
      <tr class="${l.lineType === 'debit' ? 'row-d' : 'row-c'}">
        <td>${i + 1}</td>
        <td>${l.accountName || this.getAccountName(l.accountId)}</td>
        <td>${l.entityType && l.entityId ? this.getEntityLabel(l.entityType, l.entityId) : '—'}</td>
        <td>${l.description || '—'}</td>
        <td class="amt">${l.lineType === 'debit'  ? this.fmt(l.amount) : ''}</td>
        <td class="amt">${l.lineType === 'credit' ? this.fmt(l.amount) : ''}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><title>قيد محاسبي</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; font-size: 13px; color: #1e293b; direction: rtl; padding: 24px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #6366f1; padding-bottom: 12px; margin-bottom: 16px; }
  .biz { font-size: 18px; font-weight: 900; color: #6366f1; }
  .title { font-size: 14px; font-weight: 700; color: #1e293b; margin-top: 4px; }
  .meta { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 16px; padding: 10px 14px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
  .meta-item { display: flex; flex-direction: column; gap: 2px; }
  .meta-label { font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; }
  .meta-value { font-size: 13px; font-weight: 800; color: #1e293b; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { padding: 8px 10px; background: #6366f1; color: #fff; font-size: 12px; font-weight: 700; text-align: right; }
  td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
  .row-d { background: rgba(22,163,74,.04); }
  .row-c { background: rgba(220,38,38,.04); }
  .amt { font-family: monospace; font-weight: 700; text-align: left; }
  .totals { display: flex; justify-content: flex-end; gap: 32px; padding: 10px 16px; background: #f1f5f9; border-radius: 8px; }
  .tot-item { text-align: center; }
  .tot-label { font-size: 10px; color: #64748b; font-weight: 700; }
  .tot-val { font-size: 16px; font-weight: 900; font-family: monospace; }
  .tot-debit { color: #16a34a; } .tot-credit { color: #dc2626; }
  .footer { margin-top: 24px; display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  @media print { body { padding: 12px; } }
</style></head>
<body>
  <div class="header">
    <div>
      <div class="biz">${bizName}</div>
      <div class="title">قيد يومية محاسبي</div>
    </div>
    <div style="text-align:left">
      <div style="font-size:18px;font-weight:900;font-family:monospace;color:#6366f1">${entry.entryNumber || entry.fullSequenceNumber || '#' + entry.id}</div>
      <div style="font-size:11px;color:#64748b">${entry.category || ''}</div>
    </div>
  </div>
  <div class="meta">
    <div class="meta-item"><div class="meta-label">التاريخ</div><div class="meta-value">${this.formatDate(entry.entryDate)}</div></div>
    <div class="meta-item"><div class="meta-label">البيان</div><div class="meta-value">${entry.description}</div></div>
    ${entry.reference ? `<div class="meta-item"><div class="meta-label">المرجع</div><div class="meta-value">${entry.reference}</div></div>` : ''}
    <div class="meta-item"><div class="meta-label">الحالة</div><div class="meta-value">${entry.status === 'confirmed' ? 'مراجع' : entry.status === 'draft' ? 'غير مراجع' : 'مسودة'}</div></div>
  </div>
  <table>
    <thead><tr><th>#</th><th>الحساب</th><th>الحساب التحليلي</th><th>البيان</th><th>مدين</th><th>دائن</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div class="tot-item"><div class="tot-label">مجموع المدين</div><div class="tot-val tot-debit">${this.fmt(entry.totalDebit)}</div></div>
    <div class="tot-item"><div class="tot-label">مجموع الدائن</div><div class="tot-val tot-credit">${this.fmt(entry.totalCredit)}</div></div>
  </div>
  <div class="footer">
    <span>تاريخ الطباعة: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
    <span>${entry.isBalanced ? '✓ القيد متوازن' : '⚠ القيد غير متوازن'}</span>
  </div>
  <script>window.onload = () => { window.print(); }<\/script>
</body></html>`;

    const w = window.open('', '_blank', 'width=900,height=700');
    if (w) { w.document.write(html); w.document.close(); }
  }

  async onCategoryChange(categoryKey: string) {
    this.formHeader.update(h => ({ ...h, categoryKey }));
    await this.refreshPreview();
  }

  async onOperationTypeChange(opTypeId: number | null) {
    this.formHeader.update(h => ({ ...h, operationTypeId: opTypeId }));
    if (this.formHeader().categoryKey) await this.refreshPreview();
  }

  async onDateChange(date: string) {
    this.formHeader.update(h => ({ ...h, date }));
    if (this.formHeader().categoryKey) await this.refreshPreview();
  }

  async refreshPreview() {
    const h = this.formHeader();
    this.previewNumber.set('');
    if (!h.categoryKey) return;
    const year = h.date ? new Date(h.date).getFullYear() : new Date().getFullYear();
    this.loadingPreview.set(true);
    try {
      const res = await this.api.getJournalEntryPreviewNumber(
        this.bizId, h.categoryKey, h.operationTypeId ?? undefined, year
      );
      this.previewNumber.set(res?.previewNumber || '');
    } catch { /* silent */ }
    this.loadingPreview.set(false);
  }

  addLine() {
    this.formLines.update(ls => [...ls, this.newLine()]);
  }

  removeLine(i: number) {
    if (this.formLines().length <= 2) return;
    this.formLines.update(ls => ls.filter((_, idx) => idx !== i));
  }

  duplicateLine(i: number) {
    const src = this.formLines()[i];
    this.formLines.update(ls => {
      const copy = [...ls];
      copy.splice(i + 1, 0, { ...src, amount: 0, foreignAmount: null });
      return copy;
    });
  }

  updateLine(i: number, field: keyof JournalLineForm, value: any) {
    this.formLines.update(ls => {
      const copy = [...ls];
      copy[i] = { ...copy[i], [field]: value };
      // عند تغيير نوع الكيان: أعد ضبط الحساب الفرعي والكيان التحليلي
      if (field === 'entityType') { copy[i].accountId = null; copy[i].entityId = null; }
      // عند تغيير الحساب الفرعي: أعد ضبط الكيان التحليلي فقط
      if (field === 'accountId') copy[i].entityId = null;
      // عند تغيير العملة لعملة محلية: امسح المبالغ الأجنبية
      if (field === 'currencyId' && value !== 1) {
        const currency = this.currencies().find((c: any) => c.id === value);
        if (currency?.exchangeRate) {
          copy[i].exchangeRate = Number(currency.exchangeRate);
          if (copy[i].foreignAmount) {
            copy[i].amount = Math.round(Number(copy[i].foreignAmount) * copy[i].exchangeRate * 100) / 100;
          }
        }
      }
      if (field === 'currencyId' && value === 1) {
        copy[i].foreignAmount = null;
        copy[i].exchangeRate = null;
        // لا تمسح المبلغ المحلي
      }
      // احسب المبلغ المحلي تلقائياً عند تغيير المبلغ الأجنبي أو سعر الصرف
      if (field === 'foreignAmount' || field === 'exchangeRate') {
        const fa = Number(copy[i].foreignAmount) || 0;
        const er = Number(copy[i].exchangeRate) || 0;
        if (fa > 0 && er > 0) copy[i].amount = Math.round(fa * er * 100) / 100;
      }
      return copy;
    });
  }

  // أنواع الحسابات المقابلة لكل نوع كيان
  readonly entityTypeToAccountTypes: Record<string, string[]> = {
    'supplier':  ['supplier'],
    'employee':  ['employee'],
    'partner':   ['partner'],
    'fund':      ['fund', 'bank', 'e_wallet', 'exchange'],
    'custody':   ['custody'],
    'warehouse': ['warehouse'],
  };

  /** الحسابات الفرعية المفلترة حسب نوع الكيان */
  getAccountsForEntityType(entityType: string): any[] {
    if (!entityType) return this.accounts();
    const types = this.entityTypeToAccountTypes[entityType];
    if (!types) return this.accounts();
    return this.accounts().filter((a: any) => types.includes(a.accountType));
  }

  /** الكيانات التحليلية المفلترة حسب الحساب الفرعي المختار */
  getEntityList(entityType: string, filterByAccountId?: number | null): any[] {
    let list: any[];
    switch (entityType) {
      case 'supplier':  list = this.suppliers(); break;
      case 'employee':  list = this.employees(); break;
      case 'partner':   list = this.partners(); break;
      case 'fund':      list = this.funds(); break;
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

  // ===== Save =====
  async save() {
    const h = this.formHeader();
    if (!h.categoryKey)      { this.error.set('يرجى اختيار نوع القيد'); return; }
    if (!h.description)     { this.error.set('أدخل البيان العام للقيد'); return; }
    const lines = this.formLines();
    const valid = lines.filter(l => l.accountId && Number(l.amount) > 0);
    if (valid.length < 2)   { this.error.set('يجب إدخال سطرين على الأقل بحسابات ومبالغ صحيحة'); return; }
    if (!this.isBalanced())  { this.error.set('القيد غير متوازن — مجموع المدين ≠ مجموع الدائن'); return; }

    this.saving.set(true);
    this.error.set('');
    try {
      const payload = {
        description:     h.description,
        date:            h.date,
        reference:       h.reference,
        operationTypeId: h.operationTypeId,
        status:          h.status,
        categoryKey: h.categoryKey || undefined,
        lines: valid.map(l => ({
          accountId:     l.accountId,
          lineType:      l.lineType,
          amount:        l.amount,
          description:   l.description,
          entityType:    l.entityType || null,
          entityId:      l.entityId || null,
          currencyId:    l.currencyId || 1,
          foreignAmount: l.foreignAmount || null,
          exchangeRate:  l.exchangeRate || null,
        })),
      };
      if (this.editingId()) {
        await this.api.updateJournalEntry(this.bizId, this.editingId()!, payload);
        this.toast.success('تم تحديث القيد');
      } else {
        await this.api.createJournalEntry(this.bizId, payload);
        this.toast.success('تم حفظ القيد');
      }
      this.showForm.set(false);
      await this.load();
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'حدث خطأ');
    }
    this.saving.set(false);
  }

  async deleteEntry(id: number) {
    const confirmed = await this.toast.confirm({ title: 'تأكيد الحذف', message: 'هل أنت متأكد من حذف هذا القيد؟', type: 'danger' });
    if (!confirmed) return;
    try {
      await this.api.deleteJournalEntry(id);
      await this.load();
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'حدث خطأ');
    }
  }

  toggleExpand(id: number) {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  // ===== Helpers =====
  getAccountName(id: number | null): string {
    if (!id) return '—';
    return this.accounts().find((a: any) => a.id === id)?.name || '—';
  }

  getCurrencyCode(id: number): string {
    return this.currencies().find((c: any) => c.id === id)?.code || 'ر.ع';
  }

  getStatusInfo(key: string) {
    return this.statusOptions.find(s => s.key === key) || this.statusOptions[0];
  }

  formatDate(d: string): string  { return formatDateShared(d || ''); }
  fmt(amount: unknown): string   { return formatAmountShared(amount); }
  trackById(_: number, item: any){ return item.id; }
}
