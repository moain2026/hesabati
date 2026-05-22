import { Component, inject, signal, computed } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { BasePageComponent } from '../../shared/base-page.component';
import { PAGE_IMPORTS } from '../../shared/page-imports';

@Component({
  selector: 'app-accounts',
  standalone: true,
  imports: [...PAGE_IMPORTS],
  templateUrl: './accounts.html',
  styleUrl: './accounts.scss',
})
export class AccountsComponent extends BasePageComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  loading = signal(true);
  accounts = signal<any[]>([]);
  accountSubNatures = signal<any[]>([]);
  fundTypes = signal<any[]>([]);
  bankTypes = signal<any[]>([]);
  exchangeTypes = signal<any[]>([]);
  eWalletTypes = signal<any[]>([]);
  supplierTypes = signal<any[]>([]);
  warehouseTypes = signal<any[]>([]);
  departments = signal<any[]>([]);
  stations = signal<any[]>([]);
  currencies = signal<any[]>([]);
  accountCurrencyIds = signal<number[]>([]);
  accountDefaultCurrencyId = signal<number | null>(null);
  showForm = signal(false);
  editingId = signal<number | null>(null);
  formMode = signal<'create-parent' | 'create-leaf' | 'edit-parent' | 'edit-leaf'>('create-leaf');
  editingLinkedEntity = signal(false);
  searchQuery = signal('');
  activeNatureFilter = signal<number | null>(null);
  collapsedIds = signal<Set<number>>(new Set<number>());

  form = signal<any>({
    isLeafAccount: true, parentAccountId: null, accountSubNatureId: null,
    subTypeId: null,
    name: '', code: '', stationId: null, provider: '', accountNumber: '',
    responsiblePerson: '', notes: '', isActive: true,
  });

  selectedSubNature = computed(() => {
    const id = this.form().accountSubNatureId;
    if (!id || !Number.isInteger(id) || id <= 0) return null;
    return this.accountSubNatures().find(n => n.id === id) || null;
  });

  showStationField = computed(() => this.selectedSubNature()?.requiresStation === true);
  showProviderField = computed(() => this.selectedSubNature()?.requiresProvider === true);
  showAccountNumberField = computed(() => this.selectedSubNature()?.requiresAccountNumber === true);
  subTypeOptions = computed(() => {
    const key = String(this.selectedSubNature()?.natureKey || '');
    if (key === 'fund') return this.fundTypes();
    if (key === 'bank') return this.bankTypes();
    if (key === 'exchange') return this.exchangeTypes();
    if (key === 'e_wallet') return this.eWalletTypes();
    if (key === 'supplier') return this.supplierTypes();
    if (key === 'warehouse') return this.warehouseTypes();
    if (key === 'employee') return this.departments();
    return [] as any[];
  });
  requiresSubTypeSelection = computed(() => this.form().isLeafAccount && this.subTypeOptions().length > 0);
  selectedSubType = computed(() => {
    const selectedId = Number(this.form().subTypeId);
    if (!Number.isInteger(selectedId) || selectedId <= 0) return null;
    return this.subTypeOptions().find((x: any) => x.id === selectedId) || null;
  });

  parentAccountOptions = computed(() =>
    this.accounts()
      .filter(a => a.isLeafAccount === false)
      .sort((a, b) => String(a.code || '').localeCompare(String(b.code || ''))),
  );

  private readonly filteredAccounts = computed(() => {
    let list = [...this.accounts()];
    const query = this.searchQuery().toLowerCase().trim();
    if (query) list = list.filter(a => a.name?.toLowerCase().includes(query) || String(a.code || '').toLowerCase().includes(query));
    const natureFilter = this.activeNatureFilter();
    if (natureFilter && Number.isInteger(natureFilter) && natureFilter > 0) {
      list = list.filter(a => a.accountSubNatureId === natureFilter);
    }
    return list;
  });

  treeRows = computed(() => {
    const all = this.accounts();
    const filtered = this.filteredAccounts();
    if (!all.length || !filtered.length) {
      return [] as Array<{ acc: any; level: number; hasChildren: boolean; isCollapsed: boolean; childrenCount: number }>;
    }

    const byId = new Map<number, any>();
    const childrenByParent = new Map<number | null, any[]>();
    const orderById = new Map<number, number>();
    all.forEach((acc, idx) => {
      orderById.set(acc.id, idx);
      byId.set(acc.id, acc);
    });

    const visibleIds = new Set<number>();
    for (const acc of filtered) {
      let current: any | undefined = acc;
      while (current && Number.isInteger(current.id) && !visibleIds.has(current.id)) {
        visibleIds.add(current.id);
        current = current.parentAccountId ? byId.get(current.parentAccountId) : undefined;
      }
    }

    const visibleList = all.filter(acc => visibleIds.has(acc.id));
    for (const acc of visibleList) {
      const parentId = Number.isInteger(acc.parentAccountId) ? acc.parentAccountId : null;
      if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
      childrenByParent.get(parentId)!.push(acc);
    }

    for (const [, items] of childrenByParent.entries()) {
      items.sort((a, b) => {
        if (a.isLeafAccount !== b.isLeafAccount) {
          return a.isLeafAccount ? 1 : -1;
        }
        const aCode = String(a.code || '');
        const bCode = String(b.code || '');
        if (aCode !== bCode) return aCode.localeCompare(bCode);
        return (orderById.get(a.id) ?? 0) - (orderById.get(b.id) ?? 0);
      });
    }

    const rows: Array<{ acc: any; level: number; hasChildren: boolean; isCollapsed: boolean; childrenCount: number }> = [];
    const collapsed = this.collapsedIds();
    const pushNode = (node: any, level: number) => {
      const children = childrenByParent.get(node.id) || [];
      const hasChildren = children.length > 0;
      const isCollapsed = hasChildren && collapsed.has(node.id);
      rows.push({ acc: node, level, hasChildren, isCollapsed, childrenCount: children.length });
      if (isCollapsed) return;
      for (const child of children) pushNode(child, level + 1);
    };

    const roots = [
      ...(childrenByParent.get(null) || []),
      ...visibleList.filter(acc => acc.parentAccountId != null && !visibleIds.has(acc.parentAccountId)),
    ];
    const seen = new Set<number>();
    for (const root of roots) {
      if (seen.has(root.id)) continue;
      seen.add(root.id);
      pushNode(root, 0);
    }

    return rows;
  });

  treeSummary = computed(() => {
    const rows = this.treeRows();
    const main = rows.filter(r => r.acc.isLeafAccount === false).length;
    const leaf = rows.filter(r => r.acc.isLeafAccount === true).length;
    return { total: rows.length, main, leaf };
  });

  naturesStats = computed(() => {
    const natures = [...this.accountSubNatures()].sort((a, b) => {
      const aSeq = Number(a?.sequenceNumber) || 0;
      const bSeq = Number(b?.sequenceNumber) || 0;
      if (aSeq !== bSeq) return aSeq - bSeq;
      return Number(a?.id || 0) - Number(b?.id || 0);
    });
    const accs = this.accounts();
    return natures.map(n => ({ ...n, count: accs.filter(a => a.accountSubNatureId === n.id).length }));
  });

  /** TabBarItem[] لتبويبات تصنيفات الحسابات (الكل + الأنواع التي count > 0) */
  accountTabs = computed(() => {
    const tabs: { value: number | null; label: string; icon?: string; count?: number }[] = [
      { value: null, label: 'الكل', icon: 'apps' },
    ];
    for (const n of this.naturesStats()) {
      if (n.count > 0) {
        tabs.push({ value: Number(n.id), label: n.name, icon: n.icon, count: n.count });
      }
    }
    return tabs;
  });

  protected override onBizIdChange(_bizId: number): void { if (this.bizId > 0) void this.loadAccounts(); }

  async loadAccounts() {
    if (this.bizId <= 0) { this.loading.set(false); return; }
    this.loading.set(true);
    try {
      const [accountsData, naturesData, stationsData, fundTypesData, bankTypesData, exchangeTypesData, eWalletTypesData, supplierTypesData, warehouseTypesData, departmentsData, currenciesData] = await Promise.all([
        this.api.getAccounts(this.bizId),
        this.api.getAccountSubNatures(this.bizId),
        this.api.getStations(this.bizId).catch(() => []),
        this.api.getFundTypes(this.bizId).catch(() => []),
        this.api.getBankTypes(this.bizId).catch(() => []),
        this.api.getExchangeTypes(this.bizId).catch(() => []),
        this.api.getEWalletTypes(this.bizId).catch(() => []),
        this.api.getSupplierTypes(this.bizId).catch(() => []),
        this.api.getWarehouseTypes(this.bizId).catch(() => []),
        this.api.getDepartments(this.bizId).catch(() => []),
        this.api.getCurrencies().catch(() => []),
      ]);
      this.accounts.set(
        (accountsData || []).map((a: any) => ({
          ...a,
          isLeafAccount: this.coerceLeafFlag(a.isLeafAccount),
        })),
      );
      this.accountSubNatures.set(naturesData || []);
      this.stations.set(stationsData || []);
      this.fundTypes.set(fundTypesData || []);
      this.bankTypes.set(bankTypesData || []);
      this.exchangeTypes.set(exchangeTypesData || []);
      this.eWalletTypes.set(eWalletTypesData || []);
      this.supplierTypes.set(supplierTypesData || []);
      this.warehouseTypes.set(warehouseTypesData || []);
      this.departments.set(departmentsData || []);
      this.currencies.set(currenciesData || []);
    } catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'فشل التحميل'); this.accounts.set([]); }
    finally { this.loading.set(false); }
  }

  openCreateParent() {
    this.editingId.set(null);
    this.formMode.set('create-parent');
    this.editingLinkedEntity.set(false);
    this.form.set({ isLeafAccount: false, parentAccountId: null, accountSubNatureId: null, subTypeId: null, name: '', code: '', stationId: null, provider: '', accountNumber: '', responsiblePerson: '', notes: '', isActive: true });
    this.showForm.set(true);
  }

  openCreateLeaf() {
    this.editingId.set(null);
    this.formMode.set('create-leaf');
    this.editingLinkedEntity.set(false);
    this.accountCurrencyIds.set([]); this.accountDefaultCurrencyId.set(null);
    this.form.set({ isLeafAccount: true, parentAccountId: null, accountSubNatureId: null, subTypeId: null, name: '', code: '', stationId: null, provider: '', accountNumber: '', responsiblePerson: '', notes: '', isActive: true });
    this.showForm.set(true);
  }

  async openEdit(acc: any) {
    const isLeaf = acc.isLeafAccount !== false;
    this.editingId.set(acc.id);
    this.formMode.set(isLeaf ? 'edit-leaf' : 'edit-parent');
    // فحص إذا الحساب مرتبط بكيان (صندوق/بنك/محفظة/صراف)
    const entityTypes = ['fund', 'bank', 'e_wallet', 'exchange'];
    this.editingLinkedEntity.set(isLeaf && entityTypes.includes(acc.accountType || ''));
    this.form.set({ isLeafAccount: isLeaf, parentAccountId: acc.parentAccountId || null, accountSubNatureId: acc.accountSubNatureId || null, subTypeId: acc.subTypeId || null, name: acc.name || '', code: acc.code || '', stationId: acc.stationId || null, provider: acc.provider || '', accountNumber: acc.accountNumber || '', responsiblePerson: acc.responsiblePerson || '', notes: acc.notes || '', isActive: acc.isActive !== false });
    // تحميل عملات الحساب
    if (isLeaf) {
      try {
        const accCurrencies = await this.api.getAccountCurrencies(acc.id);
        this.accountCurrencyIds.set((accCurrencies || []).map((c: any) => c.currencyId));
        const def = (accCurrencies || []).find((c: any) => c.isDefault);
        this.accountDefaultCurrencyId.set(def ? def.currencyId : null);
      } catch { this.accountCurrencyIds.set([]); this.accountDefaultCurrencyId.set(null); }
    } else {
      this.accountCurrencyIds.set([]); this.accountDefaultCurrencyId.set(null);
    }
    this.showForm.set(true);
  }

  async saveForm() {
    const f = this.form();
    if (!f.name?.trim()) { this.toast.error('اسم الحساب مطلوب'); return; }
    if (!f.isLeafAccount && !this.editingId() && !f.code?.trim()) {
      this.toast.error('الرمز/الكود مطلوب للحساب الرئيسي'); return;
    }
    if (f.isLeafAccount && (!f.accountSubNatureId || !Number.isInteger(f.accountSubNatureId) || f.accountSubNatureId <= 0)) {
      this.toast.error('يجب اختيار نوع الحساب الفرعي'); return;
    }
    if (this.requiresSubTypeSelection() && (!f.subTypeId || !Number.isInteger(f.subTypeId) || f.subTypeId <= 0)) {
      this.toast.error('يجب اختيار التصنيف قبل حفظ الحساب'); return;
    }
    try {
      const payload: any = { name: f.name, isLeafAccount: f.isLeafAccount, parentAccountId: f.parentAccountId || null, accountSubNatureId: f.accountSubNatureId || null, notes: f.notes || null, isActive: f.isActive !== false };
      if (!f.isLeafAccount && f.code?.trim()) { payload.code = f.code.trim(); }
      if (f.isLeafAccount && Number.isInteger(f.subTypeId) && f.subTypeId > 0) {
        payload.subTypeId = Number(f.subTypeId);
        payload.subType = this.selectedSubType()?.subTypeKey || null;
      }
      if (this.editingId()) {
        await this.api.updateAccount(this.bizId, this.editingId()!, payload);
        // حفظ عملات الحساب
        if (f.isLeafAccount && this.accountCurrencyIds().length > 0) {
          await this.api.setAccountCurrencies(this.editingId()!, this.accountCurrencyIds(), this.accountDefaultCurrencyId() ?? undefined);
        }
        this.toast.success('تم تحديث الحساب');
      } else {
        const created = await this.api.createAccount(this.bizId, payload);
        // حفظ عملات الحساب الجديد
        if (f.isLeafAccount && this.accountCurrencyIds().length > 0 && created?.id) {
          await this.api.setAccountCurrencies(created.id, this.accountCurrencyIds(), this.accountDefaultCurrencyId() ?? undefined);
        }
        this.toast.success('تم إنشاء الحساب');
      }
      this.showForm.set(false); await this.loadAccounts();
    } catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'فشل الحفظ'); }
  }

  async deleteAccount(acc: any) {
    const confirmed = await this.toast.confirm({ title: 'تأكيد الحذف', message: `هل تريد حذف الحساب "${acc.name}"؟`, type: 'danger' });
    if (!confirmed) return;
    try { await this.api.deleteAccount(this.bizId, acc.id); this.toast.success('تم الحذف'); await this.loadAccounts(); }
    catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'فشل الحذف'); }
  }

  selectSubNature(id: number) { this.form.update(f => ({ ...f, accountSubNatureId: id, subTypeId: null })); }

  toggleCurrency(currencyId: number) {
    this.accountCurrencyIds.update(ids => {
      if (ids.includes(currencyId)) {
        const next = ids.filter(id => id !== currencyId);
        if (this.accountDefaultCurrencyId() === currencyId) this.accountDefaultCurrencyId.set(next[0] ?? null);
        return next;
      }
      return [...ids, currencyId];
    });
  }

  setDefaultCurrency(currencyId: number) {
    if (this.accountCurrencyIds().includes(currencyId)) {
      this.accountDefaultCurrencyId.set(currencyId);
    }
  }
  setNatureFilter(id: number | null) { this.activeNatureFilter.set(id); }
  trackById(_: number, item: any) { return item?.id; }
  toggleNode(id: number) {
    this.collapsedIds.update(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  collapseAll() {
    const ids = new Set<number>();
    for (const row of this.treeRows()) {
      if (row.hasChildren) ids.add(row.acc.id);
    }
    this.collapsedIds.set(ids);
  }

  expandAll() {
    this.collapsedIds.set(new Set<number>());
  }

  private coerceLeafFlag(value: unknown): boolean {
    if (value === false || value === 'false' || value === 0 || value === '0') return false;
    return true;
  }
}
