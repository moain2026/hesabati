import { Component, inject, signal, computed } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { BasePageComponent } from '../../shared/base-page.component';
import { PAGE_IMPORTS } from '../../shared/page-imports';

@Component({
  selector: 'app-operation-types',
  standalone: true,
  imports: [...PAGE_IMPORTS],
  templateUrl: './operation-types.html',
  styleUrl: './operation-types.scss',
})
export class OperationTypesComponent extends BasePageComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  loading = signal(true);
  saving = signal(false);
  error = signal('');
  success = signal('');

  // ===================== التبويب الرئيسي =====================
  // 'categories' = إدارة التصنيفات | 'templates' = القوالب
  activeTab = signal<'categories' | 'templates'>('templates');

  // ===================== Data =====================
  operationTypes = signal<any[]>([]);
  accounts = signal<any[]>([]);
  funds = signal<any[]>([]);
  categories = signal<any[]>([]);

  // ===================== UI State =====================
  showHowItWorks = signal(false);
  showWizard = signal(false);
  editingId = signal<number | null>(null);
  activeCategory = signal('all');
  selectedOT = signal<any>(null);
  showAccountsModal = signal(false);
  showStatsView = signal(false);
  operationStats = signal<any[]>([]);
  searchQuery = signal('');
  nameCheckResult = signal<{exists: boolean; name: string} | null>(null);
  nameCheckTimeout: any = null;

  // ===================== إدارة التصنيفات (تبويب مستقل) =====================
  showCategoryForm = signal(false);
  newCategoryName = signal('');
  newCategoryIcon = signal('label');
  newCategoryColor = signal('#3b82f6');
  editingCategoryOld = signal<string | null>(null);

  // ===================== Wizard State =====================
  wizardStep = signal(1);
  wizardSystemMessage = signal('');

  wiz = signal<any>({
    name: '',
    description: '',
    icon: 'receipt_long',
    color: '#3b82f6',
    categoryId: null as number | null,
    category: '',
    voucherType: '',
    paymentMethod: '',
    sourceAccountId: null as number | null,
    sourceFundId: null as number | null,
    sourceWarehouseId: null as number | null,
    linkedAccounts: [] as { accountId: number; accountName: string; accountType: string; permission: string }[],
    screens: [] as string[],
    requiresAttachment: false,
    hasMultiLines: true,
    isActive: true,
    sortOrder: 0,
    workflowEnabled: false,
    workflowStates: ['draft', 'confirmed'] as string[],
    workflowInitialState: 'draft',
    workflowTransitions: [] as { fromState: string; toState: string; actionName: string; allowedRoles: string[] }[],
  });
  newWfState = signal('');
  newTrFrom = signal('');
  newTrTo = signal('');
  newTrAction = signal('');
  roles = signal<any[]>([]);

  selectedAccountType = signal('');

  // ===================== Computed: التصنيفات =====================
  dynamicCategories = computed(() => {
    return this.categories().map(c => {
      const id = Number(c.id);
      return {
        id,
        name: c.name || `تصنيف ${id}`,
        icon: c.icon || 'label',
        color: c.color || '#3b82f6',
        count: this.operationTypes().filter(ot => Number(ot.categoryId) === id).length,
      };
    });
  });

  categoryDetails = computed(() => {
    return this.categories().map(cat => {
      const catId = Number(cat.id);
      const templates = this.operationTypes().filter(ot => Number(ot.categoryId) === catId);
      return {
        id: catId,
        name: cat.name,
        count: templates.length,
        icon: cat.icon || 'label',
        color: cat.color || '#3b82f6',
        sequenceNumber: cat.sequenceNumber || null,
        code: cat.code || null,
      };
    });
  });

  categoryFilters = computed(() => {
    const filters = [{ value: 'all', label: 'الكل', icon: 'apps' }];
    for (const cat of this.categories()) {
      filters.push({ value: String(cat.id), label: cat.name, icon: cat.icon || 'label' });
    }
    return filters;
  });

  /** TabBarItem[] لتبويب الصفحة الرئيسي (قوالب / تصنيفات) */
  mainTabs = computed(() => [
    { value: 'templates' as const,  label: 'القوالب',    icon: 'auto_awesome', count: this.operationTypes().length },
    { value: 'categories' as const, label: 'التصنيفات', icon: 'folder',       count: this.dynamicCategories().length },
  ]);

  /** TabBarItem[] لفلاتر التصنيفات مع count */
  categoryFiltersWithCounts = computed(() => {
    return this.categoryFilters().map((f) => ({
      value: f.value,
      label: f.label,
      icon: f.icon,
      count: f.value === 'all' ? null : this.countByCategory(f.value),
    }));
  });

  operationTypeOptions = [
    { value: 'receipt', label: 'سند قبض', icon: 'call_received', desc: 'استلام أموال', color: '#10b981', group: 'مالية' },
    { value: 'payment', label: 'سند صرف', icon: 'call_made', desc: 'صرف أموال', color: '#ef4444', group: 'مالية' },
    { value: 'journal', label: 'قيد محاسبي', icon: 'book', desc: 'تحويل بين حسابات بدون صندوق', color: '#f59e0b', group: 'مالية' },
    { value: 'supply_invoice', label: 'توريد مخزني - فاتورة', icon: 'local_shipping', desc: 'إدخال أصناف من فاتورة مشتريات', color: '#06b6d4', group: 'مخزنية' },
    { value: 'supply_order', label: 'توريد مخزني - أمر توريد', icon: 'move_to_inbox', desc: 'إدخال أصناف بأمر توريد', color: '#0891b2', group: 'مخزنية' },
    { value: 'dispatch', label: 'صرف مخزني', icon: 'outbox', desc: 'إخراج أصناف من المخزن', color: '#f97316', group: 'مخزنية' },
    { value: 'transfer_out', label: 'تحويل مخزني', icon: 'swap_horiz', desc: 'نقل أصناف بين مخازن', color: '#8b5cf6', group: 'مخزنية' },
    { value: 'receive_transfer', label: 'استلام تحويل مخزني', icon: 'inventory', desc: 'استلام أصناف من تحويل مخزني', color: '#14b8a6', group: 'مخزنية' },
  ];

  paymentMethods = [
    { value: 'cash', label: 'نقداً', icon: 'payments', desc: 'تحصيل أو صرف نقدي مباشر', accountType: 'fund' },
    { value: 'bank', label: 'بنك', icon: 'account_balance', desc: 'إيداع أو سحب بنكي', accountType: 'bank' },
    { value: 'exchange', label: 'صراف', icon: 'currency_exchange', desc: 'عبر صراف أو حوالة', accountType: 'exchange' },
    { value: 'e_wallet', label: 'محفظة إلكترونية', icon: 'phone_android', desc: 'تحويل عبر محفظة إلكترونية', accountType: 'e_wallet' },
  ];

  icons = [
    'receipt_long', 'payments', 'book', 'local_shipping', 'account_balance_wallet',
    'savings', 'currency_exchange', 'swap_horiz', 'trending_up', 'bolt',
    'groups', 'handshake', 'warehouse', 'local_atm', 'credit_card',
    'call_received', 'call_made', 'move_to_inbox', 'outbox', 'request_quote',
  ];

  colors = [
    '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
    '#14b8a6', '#f97316', '#ec4899', '#06b6d4', '#84cc16',
  ];

  categoryIcons = [
    'payments', 'local_shipping', 'receipt_long', 'book', 'folder',
    'label', 'category', 'sell', 'style', 'bookmark',
    'flag', 'star', 'bolt', 'diamond', 'workspace_premium',
  ];

  permissions = [
    { value: 'both', label: 'يستقبل ويدفع' },
    { value: 'receive_only', label: 'يستقبل فقط' },
    { value: 'pay_only', label: 'يدفع فقط' },
  ];

  accountTypeLabels: Record<string, string> = {
    billing: 'فوترة', fund: 'صندوق', bank: 'بنك', exchange: 'صراف',
    wallet: 'محفظة', custody: 'عهدة',
    accounting: 'أخرى', e_wallet: 'محفظة إلكترونية',
    supplier: 'مورد', partner: 'شريك', employee: 'موظف',
    warehouse: 'مخزن', budget: 'ميزانية', settlement: 'تسوية',
    pending: 'معلق', other: 'أخرى',
  };

  accountTypeIcons: Record<string, string> = {
    bank: 'account_balance', exchange: 'currency_exchange',
    e_wallet: 'phone_android', wallet: 'wallet',
    custody: 'lock', fund: 'savings', billing: 'receipt',
    supplier: 'local_shipping', partner: 'handshake',
    employee: 'badge', accounting: 'book',
    warehouse: 'warehouse', budget: 'account_balance_wallet',
    settlement: 'balance', pending: 'hourglass_empty',
    other: 'more_horiz',
  };

  // ===================== Computed: حسابات المصدر (الطرف الأول) =====================
  // حسب وسيلة الدفع المختارة - تعرض الحسابات أو الصناديق المتاحة
  sourceAccounts = computed(() => {
    const w = this.wiz();
    if (!w.paymentMethod) return [];

    if (w.paymentMethod === 'cash') {
      // نقداً → نعرض الصناديق
      return this.funds().map(f => ({
        id: f.id,
        name: f.name,
        type: 'fund',
        icon: 'account_balance_wallet',
        subInfo: f.fundType || '',
        stationName: f.stationName || '',
      }));
    }

    // بنك/صراف/محفظة → نعرض الحسابات من نوع معين
    const pm = this.paymentMethods.find(p => p.value === w.paymentMethod);
    if (!pm) return [];

    return this.accounts().filter(a => a.accountType === pm.accountType).map(a => ({
      id: a.id,
      name: a.name,
      type: 'account',
      icon: pm.icon,
      subInfo: a.provider || a.accountNumber || '',
      stationName: '',
    }));
  });

  // ===================== Computed: الحسابات المرتبطة (الطرف الثاني) =====================
  // نعرض كل الحسابات من API الحسابات - المستخدم يختار الطرف الثاني
  availableAccounts = computed(() => {
    const all = this.accounts();
    // نعرض كل الحسابات الموجودة في صفحة الحسابات
    return all;
  });

  availableAccountTypes = computed(() => {
    const types = new Set<string>();
    this.availableAccounts().forEach(a => { if (a.accountType) types.add(a.accountType); });
    return Array.from(types);
  });

  filteredAccountsByType = computed(() => {
    // المصدر: accounts و funds و billing (حسابات فوترة) لكل منها مساحة id مستقلة - لا نزيل تكراراً بال id فقط
    const all = this.availableAccounts().filter((a: any) => a != null && a.id != null);
    const selType = this.selectedAccountType();
    if (!selType) return all;
    return all.filter((a: any) => a.accountType === selType);
  });

  linkedAccountIds = computed(() => {
    const ids = this.wiz().linkedAccounts
      .map((la: any) => la.accountId != null ? Number(la.accountId) : null)
      .filter((id: number | null): id is number => id != null && !Number.isNaN(id));
    return new Set(ids);
  });

  filteredTypes = computed(() => {
    const cat = this.activeCategory();
    const q = this.searchQuery().toLowerCase().trim();
    let all = this.operationTypes();
    if (cat !== 'all') all = all.filter(ot => String(ot.categoryId) === cat);
    if (q) all = all.filter(ot => (ot.name || '').toLowerCase().includes(q) || (ot.description || '').toLowerCase().includes(q));
    return all;
  });

  groupedByCategory = computed(() => {
    const all = this.filteredTypes();
    const groups: { category: string; categoryId: number; items: any[] }[] = [];
    const catMap = new Map<number, any[]>();
    for (const ot of all) {
      const catId = Number(ot.categoryId) || 0;
      if (!catMap.has(catId)) catMap.set(catId, []);
      catMap.get(catId)!.push(ot);
    }
    for (const [catId, items] of catMap) {
      const cat = this.categories().find(c => Number(c.id) === catId);
      groups.push({ category: cat?.name || 'غير مصنف', categoryId: catId, items });
    }
    return groups;
  });

  // ===================== Computed: عدد خطوات الـ wizard =====================
  totalSteps = computed(() => {
    const w = this.wiz();
    // قيد محاسبي: 4+1 خطوات (تصنيف → نوع → حسابات → سير العمل → تفاصيل)
    if (w.voucherType === 'journal') return 5;
    // عمليات مخزنية: 5+1 خطوات (تصنيف → نوع → مخزن → حسابات → سير العمل → تفاصيل)
    if (this.isWarehouseType(w.voucherType)) return 6;
    // سند قبض/صرف: 6+1 خطوات (تصنيف → نوع → وسيلة → مصدر → حسابات → سير العمل → تفاصيل)
    return 7;
  });

  // ===================== المخازن =====================
  warehouses = signal<any[]>([]);

  isWarehouseType(voucherType: string): boolean {
    return ['supply_invoice', 'supply_order', 'dispatch', 'transfer_out', 'receive_transfer'].includes(voucherType);
  }

  // المخازن المتاحة كمصدر
  sourceWarehouses = computed(() => {
    return this.warehouses();
  });

  // ===================== Computed: اسم المصدر المختار =====================
  selectedSourceName = computed(() => {
    const w = this.wiz();
    if (w.paymentMethod === 'cash' && w.sourceFundId) {
      const fund = this.funds().find(f => f.id === w.sourceFundId);
      return fund?.name || '';
    }
    if (w.sourceAccountId) {
      const acc = this.accounts().find(a => a.id === w.sourceAccountId);
      return acc?.name || '';
    }
    return '';
  });

  protected override onBizIdChange(_bizId: number): void {
    void this.loadAll();
  }

  async loadAll() {
    this.loading.set(true);
    try {
      const [ots, allAccs, fnds, whs, cats] = await Promise.all([
        this.api.getOperationTypes(this.bizId),
        this.api.getAllAccounts(this.bizId),
        this.api.getFunds(this.bizId),
        this.api.getWarehouses(this.bizId),
        this.api.getOperationCategories(this.bizId),
      ]);
      this.operationTypes.set(ots);
      this.accounts.set(allAccs.accounts);
      this.funds.set(fnds);
      this.warehouses.set(whs);
      this.categories.set(cats);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.loading.set(false);
    }
  }

  // ===================== Tab Navigation =====================
  switchTab(tab: 'categories' | 'templates') {
    this.activeTab.set(tab);
  }

  // ===================== Category Management (تبويب مستقل) =====================
  getCategoryIcon(cat: string): string {
    const iconMap: Record<string, string> = {
      'تحصيل': 'payments', 'توريد': 'local_shipping', 'سندات': 'receipt_long',
      'قيود': 'book', 'غير مصنف': 'folder_off',
    };
    return iconMap[cat] || 'label';
  }

  getCategoryColor(cat: string): string {
    const colorMap: Record<string, string> = {
      'تحصيل': '#22c55e', 'توريد': '#3b82f6', 'سندات': '#f59e0b',
      'قيود': '#8b5cf6', 'غير مصنف': '#64748b',
    };
    if (colorMap[cat]) return colorMap[cat];
    const firstOT = this.operationTypes().find(ot => ot.category === cat);
    return firstOT?.color || '#3b82f6';
  }

  openCategoryForm() {
    this.newCategoryName.set('');
    this.newCategoryIcon.set('label');
    this.newCategoryColor.set('#3b82f6');
    this.editingCategoryOld.set(null);
    this.showCategoryForm.set(true);
  }

  editCategory(cat: string) {
    this.editingCategoryOld.set(cat);
    this.newCategoryName.set(cat);
    this.newCategoryIcon.set(this.getCategoryIcon(cat));
    this.newCategoryColor.set('#3b82f6');
    this.showCategoryForm.set(true);
  }

  closeCategoryForm() {
    this.showCategoryForm.set(false);
    this.editingCategoryOld.set(null);
  }

  async saveCategory() {
    const name = this.newCategoryName().trim();
    if (!name) { this.showError('اسم التصنيف مطلوب'); return; }
    this.saving.set(true);
    try {
      if (this.editingCategoryOld()) {
        const cat = this.categories().find(c => c.name === this.editingCategoryOld());
        if (cat) {
          await this.api.updateOperationCategory(this.bizId, cat.id, { name });
        }
      } else {
        const categoryKey = name.toLowerCase().replace(/\s+/g, '_').replace(/[^\w\u0621-\u064A]/g, '');
        await this.api.createOperationCategory(this.bizId, {
          name,
          categoryKey,
          icon: this.newCategoryIcon(),
          color: this.newCategoryColor(),
        });
      }
      this.closeCategoryForm();
      this.showSuccess(this.editingCategoryOld() ? 'تم تعديل التصنيف' : 'تم إنشاء التصنيف');
      await this.loadAll();
    } catch (e: unknown) {
      this.showError(e instanceof Error ? e.message : 'خطأ في حفظ التصنيف');
    }
    this.saving.set(false);
  }

  async deleteCategory(cat: any) {
    const confirmed = await this.toast.confirm({ title: 'تأكيد الحذف', message: `حذف التصنيف "${cat.name}"?`, type: 'danger' });
    if (!confirmed) return;
    this.saving.set(true);
    try {
      await this.api.deleteOperationCategory(this.bizId, cat.id);
      this.showSuccess('تم حذف التصنيف');
      await this.loadAll();
    } catch (e: unknown) {
      this.showError(e instanceof Error ? e.message : 'خطأ في الحذف');
    }
    this.saving.set(false);
  }

  // ===================== Wizard (تبويب القوالب) =====================
  openWizard() {
    this.wizardSystemMessage.set('');
    if (this.dynamicCategories().length === 0) {
      this.showWizardError('لا يمكن إنشاء قالب الآن. أنشئ تصنيفاً أولاً من تبويب "التصنيفات" ثم أعد المحاولة.');
      return;
    }
    this.editingId.set(null);
    this.wiz.set({
      name: '', description: '', icon: 'receipt_long', color: '#3b82f6',
      categoryId: null,
      category: '',
      voucherType: '', paymentMethod: '',
      sourceAccountId: null,
      sourceFundId: null,
      sourceWarehouseId: null,
      linkedAccounts: [], screens: [],
      requiresAttachment: false, hasMultiLines: true,
      isActive: true, sortOrder: 0,
      workflowEnabled: false, workflowStates: ['draft', 'confirmed'], workflowInitialState: 'draft', workflowTransitions: [],
    });
    this.wizardStep.set(1);
    this.selectedAccountType.set('');
    this.showWizard.set(true);
  }

  openEditWizard(ot: any) {
    this.wizardSystemMessage.set('');
    this.editingId.set(ot.id);
    // لا نستخدم la.id لأنه معرّف صف الربط (operation_type_accounts.id) وليس معرّف الحساب
    const linked = (ot.linkedAccounts || []).map((la: any) => {
      const accountId = la.accountId ?? la.account_id;
      if (accountId == null) return null;
      const id = Number(accountId);
      if (Number.isNaN(id)) return null;
      return {
        accountId: id,
        accountName: la.label ?? la.accountName ?? '',
        accountType: la.accountType ?? '',
        permission: la.permission || 'both',
      };
    });
    type LinkedAccountItem = { accountId: number; accountName: string; accountType: string; permission: string };
    const linkedFiltered = linked.filter((x: LinkedAccountItem | null): x is LinkedAccountItem => x != null);
    const categoryName = this.categories().find(c => Number(c.id) === Number(ot.categoryId))?.name || '';
    this.wiz.set({
      name: ot.name || '',
      description: ot.description || '',
      icon: ot.icon || 'receipt_long',
      color: ot.color || '#3b82f6',
      categoryId: ot.categoryId || null,
      category: categoryName,
      voucherType: ot.voucherType || '',
      paymentMethod: ot.paymentMethod || '',
      sourceAccountId: ot.sourceAccountId || null,
      sourceFundId: ot.sourceFundId || null,
      sourceWarehouseId: ot.sourceWarehouseId || null,
      linkedAccounts: linkedFiltered,
      screens: ot.screens ? (typeof ot.screens === 'string' ? (() => { try { return JSON.parse(ot.screens); } catch { return []; } })() : ot.screens) : [],
      requiresAttachment: ot.requiresAttachment || false,
      hasMultiLines: ot.hasMultiLines || false,
      isActive: ot.isActive !== false,
      sortOrder: ot.sortOrder || 0,
      workflowEnabled: ot.workflowConfig?.enabled || false,
      workflowStates: ot.workflowConfig?.states || ['draft', 'confirmed'],
      workflowInitialState: ot.workflowConfig?.initialState || 'draft',
      workflowTransitions: ot.workflowConfig?.transitions || [],
    });
    this.wizardStep.set(1);
    this.selectedAccountType.set('');
    this.showWizard.set(true);
  }

  setWizField(field: string, value: any) {
    this.wiz.update(w => ({ ...w, [field]: value }));
  }

  selectCategory(cat: { id: number; name: string }) {
    this.setWizField('categoryId', cat.id);
    this.setWizField('category', cat.name);
  }

  selectVoucherType(vt: string) {
    this.wiz.update(w => ({
      ...w,
      voucherType: vt,
      paymentMethod: this.isWarehouseType(vt) ? '' : (vt === 'journal' ? '' : w.paymentMethod),
      sourceAccountId: null,
      sourceFundId: null,
      sourceWarehouseId: null,
      linkedAccounts: [],
    }));
    this.selectedAccountType.set('');
  }

  selectWarehouse(wh: any) {
    this.wiz.update(w => ({
      ...w,
      sourceWarehouseId: w.sourceWarehouseId === wh.id ? null : wh.id,
    }));
  }

  selectPaymentMethod(pm: string) {
    this.wiz.update(w => ({
      ...w,
      paymentMethod: pm,
      sourceAccountId: null,
      sourceFundId: null,
      linkedAccounts: [],
    }));
    this.selectedAccountType.set('');
  }

  selectSource(source: any) {
    if (source.type === 'fund') {
      this.wiz.update(w => ({
        ...w,
        sourceFundId: w.sourceFundId === source.id ? null : source.id,
        sourceAccountId: null,
      }));
    } else {
      this.wiz.update(w => ({
        ...w,
        sourceAccountId: w.sourceAccountId === source.id ? null : source.id,
        sourceFundId: null,
      }));
    }
  }

  isSourceSelected(source: any): boolean {
    const w = this.wiz();
    if (source.type === 'fund') return w.sourceFundId === source.id;
    return w.sourceAccountId === source.id;
  }

  toggleLinkedAccount(acc: any) {
    if (!acc || acc.id == null) return;
    const accountId = Number(acc.id);
    if (Number.isNaN(accountId)) return;
    this.wiz.update(w => {
      const existing = w.linkedAccounts.find((la: any) => Number(la.accountId) === accountId);
      if (existing) {
        return { ...w, linkedAccounts: w.linkedAccounts.filter((la: any) => Number(la.accountId) !== accountId) };
      }
      return {
        ...w,
        linkedAccounts: [...w.linkedAccounts, {
          accountId,
          accountName: acc.name ?? '',
          accountType: acc.accountType ?? '',
          permission: 'receive_only',
        }]
      };
    });
  }

  async selectAllAccounts() {
    const opts = this.filteredAccountsByType();
    const currentIds = this.linkedAccountIds();
    const toAdd = opts.filter(a => a && a.id != null && !currentIds.has(Number(a.id)));
    if (toAdd.length === 0) return;
    const confirmed = await this.toast.confirm({
      title: 'تحديد الكل',
      message: `سيتم إضافة كل الحسابات المعروضة (${toAdd.length} حساب) إلى القالب. متابعة؟`,
      type: 'info',
    });
    if (!confirmed) return;
    const newAccounts = toAdd.map(a => ({
      accountId: Number(a.id),
      accountName: a.name ?? '',
      accountType: a.accountType ?? '',
      permission: 'receive_only',
    }));
    this.wiz.update(w => ({
      ...w,
      linkedAccounts: [...w.linkedAccounts, ...newAccounts],
    }));
  }

  removeLinkedAccount(accId: number) {
    this.wiz.update(w => ({
      ...w,
      linkedAccounts: w.linkedAccounts.filter((la: any) => la.accountId !== accId),
    }));
  }

  // ===================== Wizard Navigation =====================
  // سند قبض/صرف: 6 خطوات (تصنيف → نوع → وسيلة → مصدر → حسابات → تفاصيل)
  // قيد محاسبي: 4 خطوات (تصنيف → نوع → حسابات → تفاصيل)
  // عملية مخزنية: 5 خطوات (تصنيف → نوع → مخزن → حسابات → تفاصيل)

  getDisplayStep(): number {
    return this.wizardStep();
  }

  canGoNext(): boolean {
    const w = this.wiz();
    const step = this.wizardStep();

    if (step === 1) return !!w.categoryId;
    if (step === 2) return !!w.voucherType;

    if (w.voucherType === 'journal') {
      if (step === 3) return w.linkedAccounts.length > 0;
      if (step === 4) return true; // سير العمل اختياري
      if (step === 5) return !!w.name.trim();
    } else if (this.isWarehouseType(w.voucherType)) {
      if (step === 3) return !!w.sourceWarehouseId;
      if (step === 4) return true; // الحسابات اختيارية
      if (step === 5) return true; // سير العمل اختياري
      if (step === 6) return !!w.name.trim();
    } else {
      if (step === 3) return !!w.paymentMethod;
      if (step === 4) {
        if (w.paymentMethod === 'cash') return !!w.sourceFundId;
        return !!w.sourceAccountId;
      }
      if (step === 5) return w.linkedAccounts.length > 0;
      if (step === 6) return true; // سير العمل اختياري
      if (step === 7) return !!w.name.trim();
    }
    return true;
  }

  isLastStep(): boolean {
    const w = this.wiz();
    const step = this.wizardStep();
    if (w.voucherType === 'journal') return step === 5;
    if (this.isWarehouseType(w.voucherType)) return step === 6;
    return step === 7;
  }

  nextStep() {
    this.wizardStep.update(s => s + 1);
  }

  prevStep() {
    this.wizardStep.update(s => s - 1);
  }

  getContentType(): 'category' | 'voucherType' | 'paymentMethod' | 'source' | 'warehouse' | 'accounts' | 'workflow' | 'details' {
    const w = this.wiz();
    const step = this.wizardStep();

    if (step === 1) return 'category';
    if (step === 2) return 'voucherType';

    if (w.voucherType === 'journal') {
      if (step === 3) return 'accounts';
      if (step === 4) return 'workflow';
      if (step === 5) return 'details';
    } else if (this.isWarehouseType(w.voucherType)) {
      if (step === 3) return 'warehouse';
      if (step === 4) return 'accounts';
      if (step === 5) return 'workflow';
      if (step === 6) return 'details';
    } else {
      if (step === 3) return 'paymentMethod';
      if (step === 4) return 'source';
      if (step === 5) return 'accounts';
      if (step === 6) return 'workflow';
      if (step === 7) return 'details';
    }
    return 'category';
  }

  // ===================== Step Labels for wizard header =====================
  getStepLabels(): { num: number; label: string }[] {
    const w = this.wiz();
    if (w.voucherType === 'journal') {
      return [
        { num: 1, label: 'التصنيف' },
        { num: 2, label: 'نوع العملية' },
        { num: 3, label: 'الحسابات' },
        { num: 4, label: 'سير العمل' },
        { num: 5, label: 'التفاصيل' },
      ];
    }
    if (this.isWarehouseType(w.voucherType)) {
      return [
        { num: 1, label: 'التصنيف' },
        { num: 2, label: 'نوع العملية' },
        { num: 3, label: 'المخزن' },
        { num: 4, label: 'الحسابات' },
        { num: 5, label: 'سير العمل' },
        { num: 6, label: 'التفاصيل' },
      ];
    }
    return [
      { num: 1, label: 'التصنيف' },
      { num: 2, label: 'نوع العملية' },
      { num: 3, label: 'الوسيلة' },
      { num: 4, label: 'المصدر' },
      { num: 5, label: 'الحسابات' },
      { num: 6, label: 'سير العمل' },
      { num: 7, label: 'التفاصيل' },
    ];
  }

  getPaymentMethodIcon(): string {
    const pm = this.paymentMethods.find(p => p.value === this.wiz().paymentMethod);
    return pm?.icon || 'payments';
  }

  getPaymentMethodName(): string {
    const pm = this.paymentMethods.find(p => p.value === this.wiz().paymentMethod);
    return pm?.label || '';
  }

  async saveWizard() {
    const w = this.wiz();
    if (!w.name.trim()) { this.showWizardError('اسم القالب مطلوب قبل الحفظ'); return; }
    if (!w.categoryId) { this.showWizardError('لا يمكن إنشاء القالب بدون تصنيف. اختر تصنيفاً أولاً.'); return; }

    this.saving.set(true);
    this.wizardSystemMessage.set('');
    try {
      const payload: any = {
        name: w.name,
        description: w.description,
        icon: w.icon,
        color: w.color,
        categoryId: w.categoryId,
        voucherType: w.voucherType,
        paymentMethod: w.paymentMethod || null,
        sourceAccountId: w.sourceAccountId || null,
        sourceFundId: w.sourceFundId || null,
        sourceWarehouseId: w.sourceWarehouseId || null,
        screens: w.screens.length > 0 ? w.screens : [],
        requiresAttachment: w.requiresAttachment,
        hasMultiLines: w.hasMultiLines,
        isActive: w.isActive,
        sortOrder: w.sortOrder,
        linkedAccounts: w.linkedAccounts
          .filter((la: any) => la.accountId != null && !Number.isNaN(Number(la.accountId)))
          .map((la: any) => ({
            accountId: Number(la.accountId),
            label: la.accountName ?? '',
            permission: la.permission ?? 'both',
            sortOrder: 0,
          })),
        workflowConfig: w.workflowEnabled ? {
          enabled: true,
          states: w.workflowStates,
          initialState: w.workflowInitialState,
          transitions: w.workflowTransitions,
        } : { enabled: false },
      };

      if (this.editingId()) {
        await this.api.updateOperationType(this.editingId()!, payload);
      } else {
        await this.api.createOperationType(this.bizId, payload);
      }

      this.showWizard.set(false);
      this.showSuccess(this.editingId() ? 'تم تعديل القالب بنجاح' : 'تم إنشاء القالب بنجاح');
      await this.loadAll();
    } catch (e: unknown) {
      this.showWizardError(e instanceof Error ? e.message : 'تعذر حفظ القالب. تحقق من البيانات ثم أعد المحاولة.');
    }
    this.saving.set(false);
  }

  // ===================== Clone Template =====================
  async cloneOT(ot: any) {
    const cfm = await this.toast.confirm({ title: 'نسخ القالب', message: `هل تريد نسخ القالب "${ot.name}"؟`, type: 'info' });
    if (!cfm) return;
    this.saving.set(true);
    try {
      await this.api.cloneOperationType(this.bizId, ot.id);
      this.showSuccess(`تم نسخ القالب "${ot.name}" بنجاح`);
      await this.loadAll();
    } catch (e: unknown) {
      this.showError(e instanceof Error ? e.message : 'خطأ في نسخ القالب');
    }
    this.saving.set(false);
  }

  // ===================== Toggle Active =====================
  async toggleOT(ot: any) {
    this.saving.set(true);
    try {
      await this.api.toggleOperationType(this.bizId, ot.id);
      this.showSuccess(ot.isActive ? `تم تعطيل "${ot.name}"` : `تم تفعيل "${ot.name}"`);
      await this.loadAll();
    } catch (e: unknown) {
      this.showError(e instanceof Error ? e.message : 'خطأ في تغيير الحالة');
    }
    this.saving.set(false);
  }

  // ===================== Stats View =====================
  async loadStats() {
    try {
      const stats = await this.api.getOperationTypesStats(this.bizId);
      this.operationStats.set(stats);
      this.showStatsView.set(true);
    } catch (e: unknown) {
      this.showError(e instanceof Error ? e.message : 'خطأ في جلب الإحصائيات');
    }
  }

  getStatForOT(otId: number): any {
    return this.operationStats().find((s: any) => s.id === otId) || { usage_count: 0, total_amount: 0 };
  }

  // ===================== Check Name Duplicate =====================
  checkNameDuplicate(name: string) {
    if (this.nameCheckTimeout) clearTimeout(this.nameCheckTimeout);
    if (!name.trim()) { this.nameCheckResult.set(null); return; }
    this.nameCheckTimeout = setTimeout(async () => {
      try {
        const result = await this.api.checkOperationTypeName(this.bizId, name, this.editingId() || undefined);
        this.nameCheckResult.set(result);
      } catch { this.nameCheckResult.set(null); }
    }, 500);
  }

  // ===================== Delete Template =====================
  async deleteOT(id: number) {
    const cfm = await this.toast.confirm({ title: 'تأكيد الحذف', message: 'هل تريد حذف هذا القالب؟ سيتم حذف كل الحسابات المرتبطة به.', type: 'danger' });
    if (!cfm) return;
    try {
      await this.api.deleteOperationType(id);
      await this.loadAll();
    } catch (e: unknown) {
      this.showError(e instanceof Error ? e.message : String(e));
    }
  }

  // ===================== Accounts Modal =====================
  openAccountsView(ot: any) {
    this.selectedOT.set(ot);
    this.showAccountsModal.set(true);
  }

  // ===================== Helpers =====================
  showError(msg: string) {
    this.error.set(msg);
    this.toast.error(msg, 'رسالة النظام', 7000);
    setTimeout(() => this.error.set(''), 5000);
  }

  showSuccess(msg: string) {
    this.success.set(msg);
    this.toast.success(msg, 'رسالة النظام', 4500);
    setTimeout(() => this.success.set(''), 4000);
  }

  showWizardError(msg: string) {
    this.wizardSystemMessage.set(msg);
    this.toast.error(msg, 'رسالة النظام', 8000);
  }

  getAccountName(id: number): string {
    return this.accounts().find(a => a.id === id)?.name || '—';
  }

  getFundName(id: number): string {
    return this.funds().find(f => f.id === id)?.name || '—';
  }

  getAccountTypeLabel(t: string): string {
    return this.accountTypeLabels[t] || t;
  }

  getVoucherTypeLabel(t: string): string {
    const m: Record<string, string> = { receipt: 'سند قبض', payment: 'سند صرف', journal: 'قيد محاسبي', transfer: 'تحويل' };
    return m[t] || t;
  }

  getPaymentMethodLabel(pm: string): string {
    return this.paymentMethods.find(x => x.value === pm)?.label || pm || '—';
  }

  getPermissionLabel(p: string): string {
    return this.permissions.find(x => x.value === p)?.label || p;
  }

  getWarehouseName(id: number): string {
    return this.warehouses().find((w: any) => w.id === id)?.name || '—';
  }

  getSourceLabel(ot: any): string {
    if (ot.sourceWarehouseId) {
      return this.getWarehouseName(ot.sourceWarehouseId);
    }
    if (ot.sourceFundId) {
      return this.getFundName(ot.sourceFundId);
    }
    if (ot.sourceAccountId) {
      return this.getAccountName(ot.sourceAccountId);
    }
    return '—';
  }

  getVoucherTypeOption(value: string) {
    return this.operationTypeOptions.find(o => o.value === value);
  }

  countByCategory(category: string): number {
    return this.operationTypes().filter(ot => String(ot.categoryId) === String(category)).length;
  }

  countAccountsByType(accountType: string): number {
    return this.availableAccounts().filter(a => a.accountType === accountType).length;
  }

  trackById(_: number, item: any) { return item.id; }

  // ===================== سير العمل - دوال الإدارة =====================
  addWorkflowState() {
    const s = this.newWfState().trim();
    if (!s) return;
    const current = this.wiz().workflowStates;
    if (current.includes(s)) return;
    this.wiz.update(w => ({ ...w, workflowStates: [...w.workflowStates, s] }));
    this.newWfState.set('');
  }

  removeWorkflowState(state: string) {
    if (state === 'draft') return; // لا يمكن حذف draft
    this.wiz.update(w => ({
      ...w,
      workflowStates: w.workflowStates.filter((s: string) => s !== state),
      workflowTransitions: w.workflowTransitions.filter((t: any) => t.fromState !== state && t.toState !== state),
      workflowInitialState: w.workflowInitialState === state ? 'draft' : w.workflowInitialState,
    }));
  }

  addWorkflowTransition() {
    const from = this.newTrFrom();
    const to = this.newTrTo();
    const action = this.newTrAction().trim();
    if (!from || !to || !action || from === to) return;
    this.wiz.update(w => ({
      ...w,
      workflowTransitions: [...w.workflowTransitions, { fromState: from, toState: to, actionName: action, allowedRoles: [] }],
    }));
    this.newTrFrom.set('');
    this.newTrTo.set('');
    this.newTrAction.set('');
  }

  removeWorkflowTransition(idx: number) {
    this.wiz.update(w => ({
      ...w,
      workflowTransitions: w.workflowTransitions.filter((_: any, i: number) => i !== idx),
    }));
  }

  getStateLabel(state: string): string {
    const labels: Record<string, string> = {
      draft: 'مسودة', confirmed: 'معتمد', pending_approval: 'بانتظار الاعتماد',
      approved: 'موافق عليه', rejected: 'مرفوض', cancelled: 'ملغي',
    };
    return labels[state] || state;
  }

  getStateColor(state: string): string {
    const colors: Record<string, string> = {
      draft: '#f59e0b', confirmed: '#22c55e', pending_approval: '#3b82f6',
      approved: '#10b981', rejected: '#ef4444', cancelled: '#64748b',
    };
    return colors[state] || '#64748b';
  }
}
