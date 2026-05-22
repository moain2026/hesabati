import { Component, inject, signal, computed } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { BasePageComponent } from '../../shared/base-page.component';
import { PAGE_IMPORTS } from '../../shared/page-imports';

@Component({
  selector: 'app-billing-systems',
  standalone: true,
  imports: [...PAGE_IMPORTS],
  templateUrl: './billing-systems.html',
  styleUrl: './billing-systems.scss',
})
export class BillingSystemsComponent extends BasePageComponent {
  private readonly toast = inject(ToastService);
  private readonly api = inject(ApiService);

  loading = signal(true);
  error = signal('');
  successMsg = signal('');

  // ===== البيانات =====
  billingAccounts = signal<any[]>([]);   // حسابات الفوترة من employee_billing_accounts
  billingSystems = signal<any[]>([]);    // أنظمة الفوترة من billing_systems_config
  accountTypes = signal<any[]>([]);      // أنواع حسابات الفوترة من billing_account_types
  stations = signal<any[]>([]);          // المحطات
  employees = signal<any[]>([]);         // الموظفين

  // أسماء الأنظمة تُجلب ديناميكياً من billingSystemsConfig

  methodNameMap: Record<string, string> = {
    'cash_mobile': 'تحصيل نقدي بالجوال',
    'manual_assign': 'تحصيل إسناد يدوي',
    'electronic': 'سداد إلكتروني',
    'haseb_deposit': 'إيداع حاسب',
  };

  // ===== حالة الواجهة =====
  activeTab = signal<'accounts' | 'systems' | 'types'>('accounts');
  activeSystem = signal('all');
  activeStation = signal('all');
  searchQuery = signal('');
  showHowItWorks = signal(false);

  // ===== نموذج إضافة حساب فوترة =====
  showAccountForm = signal(false);
  editingAccountId = signal<number | null>(null);
  accountForm = signal<any>({
    employeeId: '',
    stationId: '',
    billingSystemId: '',
    collectionMethod: '',
    label: '',
    notes: '',
  });

  // ===== wizard إضافة نظام فوترة جديد =====
  showSystemWizard = signal(false);
  wizardStep = signal(1); // 1: الاسم، 2: المحطات، 3: أنواع الحسابات
  systemForm = signal<any>({
    name: '',
    color: '#3b82f6',
    icon: 'receipt',
    stationScope: 'per_station', // per_station | multi_station
    stationIds: [] as number[],
    supportedTypes: [] as string[],
  });

  // ===== نموذج إضافة نوع حساب =====
  showTypeForm = signal(false);
  editingTypeId = signal<number | null>(null);
  typeForm = signal<any>({ name: '', description: '' });

  // ===== حسابات مفلترة =====
  filteredAccounts = computed(() => {
    const sys = this.activeSystem();
    const station = this.activeStation();
    const q = this.searchQuery().toLowerCase();
    return this.billingAccounts().filter(a => {
      const sysDisplayName = a.billingSystemName || this.getSystemDisplayName(a.billingSystemId);
      const matchSys = sys === 'all' || sysDisplayName === sys;
      const matchStation = station === 'all' || a.stationName === station;
      const matchQ = !q || (a.label || '').toLowerCase().includes(q) ||
        (a.employeeName || '').toLowerCase().includes(q);
      return matchSys && matchStation && matchQ;
    });
  });

  // ===== تجميع حسب النظام ثم الموظف =====
  groupedBySystem = computed(() => {
    const filtered = this.filteredAccounts();
    const systems = this.billingSystems();
    const groups: any[] = [];

    for (const sys of systems) {
      const sysAccounts = filtered.filter(a => {
        const displayName = a.billingSystemName || this.getSystemDisplayName(a.billingSystemId);
        return displayName === sys.name;
      });
      if (sysAccounts.length === 0) continue;

      const empMap = new Map<string, any[]>();
      for (const acc of sysAccounts) {
        const emp = acc.employeeName || 'غير محدد';
        if (!empMap.has(emp)) empMap.set(emp, []);
        empMap.get(emp)!.push(acc);
      }

      const employees = Array.from(empMap.entries()).map(([name, accs]) => ({
        name,
        accounts: accs.sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0)),
      }));

      groups.push({ system: sys.name, info: sys, employees });
    }
    return groups;
  });

  // ===== إحصائيات =====
  stats = computed(() => {
    const all = this.billingAccounts();
    const systems = this.billingSystems();
    const bySys = systems.map(s => ({
      ...s,
      count: all.filter(a => (a.billingSystemName || this.getSystemDisplayName(a.billingSystemId)) === s.name).length,
    }));
    const employees = new Set(all.map((a: any) => a.employeeName).filter(Boolean)).size;
    return { total: all.length, employees, bySys };
  });

  // ===== قائمة المحطات المتاحة =====
  stationNames = computed(() => this.stations().map(s => s.name));

  // ===== أيقونات متاحة للنظام =====
  availableIcons = [
    'receipt', 'credit_card', 'volunteer_activism', 'payments', 'account_balance',
    'savings', 'currency_exchange', 'monetization_on', 'attach_money', 'wallet',
  ];

  availableColors = [
    '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
    '#14b8a6', '#f97316', '#ec4899', '#06b6d4', '#84cc16',
  ];

  // أنظمة الفوترة المتاحة تُجلب ديناميكياً من billingSystems()
  get availableBillingSystems() {
    return this.billingSystems().map(s => ({ value: s.id, label: s.name }));
  }

  availableCollectionMethods = [
    { value: 'cash_mobile', label: 'تحصيل نقدي بالجوال' },
    { value: 'manual_assign', label: 'تحصيل إسناد يدوي' },
    { value: 'electronic', label: 'سداد إلكتروني' },
    { value: 'haseb_deposit', label: 'إيداع حاسب' },
  ];

  /** Tabs الرئيسية للصفحة */
  mainTabs = computed(() => [
    { value: 'accounts' as const, label: 'حسابات الفوترة', icon: 'receipt'  },
    { value: 'systems'  as const, label: 'أنظمة الفوترة',  icon: 'settings', count: this.billingSystems().length },
    { value: 'types'    as const, label: 'أنواع الحسابات', icon: 'category', count: this.accountTypes().length },
  ]);

  /** Tabs لاختيار نظام الفوترة (داخل tab "accounts") */
  systemTabs = computed(() => {
    const tabs: { value: string; label: string; icon?: string; customColor?: string }[] = [
      { value: 'all', label: 'الكل' },
    ];
    for (const s of this.billingSystems()) {
      tabs.push({ value: s.name, label: s.name, icon: s.icon, customColor: s.color });
    }
    return tabs;
  });

  /** Tabs لاختيار المحطة */
  stationTabs = computed(() => {
    const tabs: { value: string; label: string }[] = [{ value: 'all', label: 'كل المحطات' }];
    for (const name of this.stationNames()) {
      tabs.push({ value: name, label: name });
    }
    return tabs;
  });

  /** Tabs لطريقة التحصيل في الفورم */
  collectionMethodTabs = this.availableCollectionMethods.map((m) => ({
    value: m.value,
    label: m.label,
  }));

  protected override onBizIdChange(_bizId: number): void {
    void this.loadAll();
  }

  async loadAll() {
    this.loading.set(true);
    try {
      const [billingAccounts, systems, types, stations, emps] = await Promise.all([
        this.api.getEmployeeBillingAccounts(this.bizId),
        this.api.getBillingSystemsConfig(this.bizId).catch(() => []),
        this.api.getBillingAccountTypes(this.bizId).catch(() => []),
        this.api.getStations(this.bizId).catch(() => []),
        this.api.getEmployees(this.bizId).catch(() => []),
      ]);
      this.billingAccounts.set(billingAccounts);
      this.billingSystems.set(systems);
      this.accountTypes.set(types);
      this.stations.set(stations);
      this.employees.set(emps);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.loading.set(false);
    }
  }

  // ===== إدارة حسابات الفوترة =====
  openCreateAccount() {
    this.editingAccountId.set(null);
    this.accountForm.set({
      employeeId: '',
      stationId: this.stations()[0]?.id || '',
      billingSystemId: this.billingSystems()[0]?.id || '',
      collectionMethod: 'cash_mobile',
      label: '',
      notes: '',
    });
    this.showAccountForm.set(true);
  }

  openEditAccount(acc: any) {
    this.editingAccountId.set(acc.id);
    this.accountForm.set({
      employeeId: acc.employeeId || '',
      stationId: acc.stationId || '',
      billingSystemId: acc.billingSystemId || '',
      collectionMethod: acc.collectionMethod || '',
      label: acc.label || '',
      notes: acc.notes || '',
    });
    this.showAccountForm.set(true);
  }

  updateAccountLabel() {
    const f = this.accountForm();
    const emp = this.employees().find((e: any) => e.id == f.employeeId);
    const sys = this.billingSystems().find((s: any) => s.id == f.billingSystemId);
    const method = this.availableCollectionMethods.find(m => m.value === f.collectionMethod);
    if (emp && sys && method) {
      const label = `${emp.fullName} - ${sys.name} - ${method.label}`;
      this.accountForm.update(form => ({ ...form, label }));
    }
  }

  async saveAccountForm() {
    const f = this.accountForm();
    if (!f.employeeId) { this.error.set('الموظف مطلوب'); return; }
    if (!f.stationId) { this.error.set('المحطة مطلوبة'); return; }
    if (!f.billingSystemId) { this.error.set('نظام الفوترة مطلوب'); return; }
    if (!f.collectionMethod) { this.error.set('طريقة التحصيل مطلوبة'); return; }

    if (!f.label.trim()) {
      this.updateAccountLabel();
    }

    const accountData: any = {
      employeeId: Number.parseInt(f.employeeId, 10),
      stationId: Number.parseInt(f.stationId, 10),
      billingSystemId: Number.parseInt(String(f.billingSystemId), 10),
      collectionMethod: f.collectionMethod,
      label: this.accountForm().label || f.label,
      notes: f.notes || '',
    };

    try {
      if (this.editingAccountId()) {
        await this.api.updateEmployeeBillingAccount(this.editingAccountId()!, accountData);
        this.successMsg.set('تم تحديث حساب الفوترة');
      } else {
        await this.api.createEmployeeBillingAccount(accountData);
        this.successMsg.set('تم إنشاء حساب الفوترة');
      }
      this.showAccountForm.set(false);
      await this.loadAll();
      setTimeout(() => this.successMsg.set(''), 4000);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : String(e));
    }
  }

  async toggleAccountActive(acc: any) {
    try {
      await this.api.updateEmployeeBillingAccount(acc.id, { isActive: !acc.isActive });
      await this.loadAll();
      this.successMsg.set(acc.isActive ? 'تم إيقاف الحساب' : 'تم تفعيل الحساب');
      setTimeout(() => this.successMsg.set(''), 3000);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : String(e));
    }
  }

  async deleteAccount(acc: any) {
    const confirmed = await this.toast.confirm({ title: 'تأكيد الحذف', message: `هل تريد حذف حساب "${acc.label}"؟`, type: 'danger' });
    if (!confirmed) return;
    try {
      await this.api.deleteEmployeeBillingAccount(acc.id);
      await this.loadAll();
      this.successMsg.set('تم حذف الحساب');
      setTimeout(() => this.successMsg.set(''), 3000);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : String(e));
    }
  }

  // ===== wizard إضافة نظام فوترة =====
  openSystemWizard() {
    this.wizardStep.set(1);
    this.systemForm.set({
      name: '',
      color: '#3b82f6',
      icon: 'receipt',
      stationScope: 'per_station',
      stationIds: [],
      supportedTypes: this.accountTypes().map((t: any) => t.name),
    });
    this.showSystemWizard.set(true);
  }

  wizardNext() {
    const step = this.wizardStep();
    const f = this.systemForm();
    if (step === 1 && !f.name.trim()) { this.error.set('اسم النظام مطلوب'); return; }
    this.error.set('');
    this.wizardStep.set(step + 1);
  }

  wizardBack() {
    this.wizardStep.set(this.wizardStep() - 1);
  }

  toggleWizardStation(stationId: number) {
    this.systemForm.update(f => {
      const ids: number[] = [...f.stationIds];
      const idx = ids.indexOf(stationId);
      if (idx >= 0) ids.splice(idx, 1);
      else ids.push(stationId);
      return { ...f, stationIds: ids };
    });
  }

  toggleWizardType(typeName: string) {
    this.systemForm.update(f => {
      const types: string[] = [...f.supportedTypes];
      const idx = types.indexOf(typeName);
      if (idx >= 0) types.splice(idx, 1);
      else types.push(typeName);
      return { ...f, supportedTypes: types };
    });
  }

  async saveSystemWizard() {
    const f = this.systemForm();
    if (!f.name.trim()) { this.error.set('اسم النظام مطلوب'); return; }
    if (f.supportedTypes.length === 0) { this.error.set('اختر نوع حساب واحد على الأقل'); return; }

    try {
      await this.api.createBillingSystemConfig(this.bizId, {
        name: f.name,
        color: f.color,
        icon: f.icon,
        stationScope: f.stationScope,
        stationIds: f.stationIds,
        supportedTypes: f.supportedTypes,
      });
      this.showSystemWizard.set(false);
      await this.loadAll();
      this.successMsg.set(`تم إضافة نظام "${f.name}" بنجاح`);
      setTimeout(() => this.successMsg.set(''), 4000);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : String(e));
    }
  }

  async deleteSystem(sys: any) {
    const confirmed = await this.toast.confirm({ title: 'تأكيد الحذف', message: `هل تريد حذف نظام "${sys.name}"؟`, type: 'danger' });
    if (!confirmed) return;
    try {
      await this.api.deleteBillingSystemConfig(sys.id);
      await this.loadAll();
      this.successMsg.set('تم حذف النظام');
      setTimeout(() => this.successMsg.set(''), 3000);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : String(e));
    }
  }

  // ===== إدارة أنواع الحسابات =====
  openCreateType() {
    this.editingTypeId.set(null);
    this.typeForm.set({ name: '', description: '' });
    this.showTypeForm.set(true);
  }

  openEditType(type: any) {
    this.editingTypeId.set(type.id);
    this.typeForm.set({ name: type.name, description: type.description || '' });
    this.showTypeForm.set(true);
  }

  async saveTypeForm() {
    const f = this.typeForm();
    if (!f.name.trim()) { this.error.set('اسم النوع مطلوب'); return; }
    try {
      if (this.editingTypeId()) {
        await this.api.updateBillingAccountType(this.editingTypeId()!, f);
        this.successMsg.set('تم تحديث نوع الحساب');
      } else {
        await this.api.createBillingAccountType(this.bizId, f);
        this.successMsg.set('تم إضافة نوع الحساب الجديد');
      }
      this.showTypeForm.set(false);
      await this.loadAll();
      setTimeout(() => this.successMsg.set(''), 3000);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : String(e));
    }
  }

  async deleteType(type: any) {
    const confirmed = await this.toast.confirm({ title: 'تأكيد الحذف', message: `هل تريد حذف نوع "${type.name}"؟`, type: 'danger' });
    if (!confirmed) return;
    try {
      await this.api.deleteBillingAccountType(type.id);
      await this.loadAll();
      this.successMsg.set('تم حذف النوع');
      setTimeout(() => this.successMsg.set(''), 3000);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : String(e));
    }
  }

  setFormField(form: 'account' | 'type', field: string, value: any) {
    if (form === 'account') {
      this.accountForm.update(f => ({ ...f, [field]: value }));
      if (['employeeId', 'billingSystemId', 'collectionMethod'].includes(field)) {
        this.updateAccountLabel();
      }
    } else {
      this.typeForm.update(f => ({ ...f, [field]: value }));
    }
  }

  setSystemFormField(field: string, value: any) {
    this.systemForm.update(f => ({ ...f, [field]: value }));
  }

  getSystemInfo(name: string) {
    return this.billingSystems().find(s => s.name === name) ||
      { name, color: '#64748b', icon: 'receipt' };
  }

  getSystemDisplayName(billingSystemId: number | string): string {
    const sys = this.billingSystems().find((s: any) => s.id == billingSystemId);
    return sys?.name || String(billingSystemId);
  }

  getMethodDisplayName(method: string): string {
    return this.methodNameMap[method] || method;
  }

  getSysCount(sysName: string): number {
    return this.billingAccounts()
      .filter((a: any) => (a.billingSystemName || this.getSystemDisplayName(a.billingSystemId)) === sysName)
      .length;
  }

  trackById(_: number, item: any) { return item.id; }
  trackByName(_: number, item: any) { return item.name; }
}
