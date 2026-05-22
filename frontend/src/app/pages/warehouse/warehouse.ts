import { Component, inject, signal, computed } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { BaseCrudPageComponent } from '../../shared/base-crud-page.component';
import { PAGE_IMPORTS } from '../../shared/page-imports';

interface WarehouseForm { name: string; accountId: number | null; warehouseType: string; subType: string; stationId: number | null; responsiblePerson: string; location: string; notes: string; }
interface WarehouseTypeForm { name: string; subTypeKey: string; description: string; icon: string; color: string; }
interface Warehouse {
  id: number; name: string;
  accountId?: number | null;
  warehouseType: string;
  subType?: string;
  stationId?: number | null;
  responsiblePerson?: string;
  location?: string;
  notes?: string;
  defaultCurrencyId?: number | null;
  code?: string;
  accountLedgerCode?: string;
  sequenceNumber?: string | number;
}

@Component({
  selector: 'app-warehouse',
  standalone: true,
  imports: [...PAGE_IMPORTS],
  templateUrl: './warehouse.html',
  styleUrl: './warehouse.scss',
})
export class WarehouseComponent extends BaseCrudPageComponent<Warehouse> {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  warehouses = signal<Warehouse[]>([]);
  stations = signal<any[]>([]);
  warehouseTypes = signal<any[]>([]);
  warehouseAccounts = signal<any[]>([]);
  accountCurrencies = signal<any[]>([]);
  selectedCurrencyIds = signal<number[]>([]);
  defaultCurrencyId = signal<number | null>(null);
  filterType = signal<string>('all');
  filterSubType = signal<string>('all');

  // نموذج إضافة/تعديل مخزن
  private readonly defaultForm: WarehouseForm = {
    name: '', accountId: null, warehouseType: 'main', subType: '',
    stationId: null, responsiblePerson: '', location: '', notes: '',
  };
  form: WarehouseForm = { ...this.defaultForm };

  protected resetForm(): void {
    this.form = { ...this.defaultForm };
    this.accountCurrencies.set([]);
    this.selectedCurrencyIds.set([]);
    this.defaultCurrencyId.set(null);
  }

  protected populateForm(w: Warehouse & { id: number }): void {
    this.form = {
      name: w.name, accountId: w.accountId ?? null, warehouseType: w.warehouseType, subType: w.subType || '',
      stationId: w.stationId ?? null, responsiblePerson: w.responsiblePerson || '',
      location: w.location || '', notes: w.notes || '',
    };
    this.accountCurrencies.set([]);
    this.selectedCurrencyIds.set([]);
    this.defaultCurrencyId.set(null);
    if (w.accountId) {
      this.onAccountChange(w.accountId).then(() => {
        const allIds = this.accountCurrencies().map((c: any) => c.currencyId);
        this.selectedCurrencyIds.set(allIds);
        if (w.defaultCurrencyId) this.defaultCurrencyId.set(w.defaultCurrencyId);
      });
    }
  }

  override openAdd(): void {
    const defaultAcc = this.warehouseAccounts()[0];
    this.resetForm();
    if (defaultAcc?.id) {
      this.form.accountId = defaultAcc.id;
      this.onAccountChange(defaultAcc.id);
    }
    this.editingId.set(null);
    this.showForm.set(true);
    this.scrollToTop();
  }

  // إدارة تصنيفات المخازن
  showTypeForm = signal(false);
  editingTypeId = signal<number | null>(null);
  typeForm: WarehouseTypeForm = {
    name: '', subTypeKey: '', description: '', icon: 'warehouse', color: '#4CAF50',
  };

  protected override onBizIdChange(_bizId: number): void {
    this.load();
  }

  async load() {
    this.loading.set(true);
    try {
      const [wh, sts, types, accs] = await Promise.allSettled([
        this.api.getWarehouses(this.bizId),
        this.api.getStations(this.bizId),
        this.api.getWarehouseTypes(this.bizId),
        this.api.getAccounts(this.bizId),
      ]);
      this.warehouses.set(wh.status === 'fulfilled' ? wh.value : []);
      this.stations.set(sts.status === 'fulfilled' ? sts.value : []);
      this.warehouseTypes.set(types.status === 'fulfilled' ? types.value : []);
      const allAccs = accs.status === 'fulfilled' ? (accs.value as any[]) : [];
      this.warehouseAccounts.set(allAccs.filter((a: any) => a.accountType === 'warehouse' && a.isLeafAccount === false));
    } catch (e) { console.error(e); }
    this.loading.set(false);
  }

  // ===== الفلترة =====
  filteredWarehouses() {
    const f = this.filterType();
    const sf = this.filterSubType();
    let list = this.warehouses().filter(w => w.warehouseType !== 'custody');
    if (f !== 'all') list = list.filter(w => w.warehouseType === f);
    if (sf !== 'all') list = list.filter(w => (w.subType || '') === sf);
    return list;
  }

  mainCount() { return this.warehouses().filter(w => w.warehouseType === 'main').length; }
  stationCount() { return this.warehouses().filter(w => w.warehouseType === 'station').length; }
  subCount() { return this.warehouses().filter(w => w.warehouseType === 'sub').length; }

  // الفلاتر الفرعية الديناميكية حسب التصنيف
  subTypeFilters = computed(() => {
    const whs = this.warehouses();
    const types = this.warehouseTypes();
    const subTypes = [...new Set(whs.map(w => w.subType).filter((s): s is string => !!s))];
    return subTypes.map(st => {
      const typeInfo = types.find((t: any) => t.subTypeKey === st);
      return {
        key: st,
        label: typeInfo?.name || st,
        icon: typeInfo?.icon || 'label',
        color: typeInfo?.color || '#64748b',
        count: whs.filter(w => w.subType === st).length,
      };
    });
  });

  /** TabBarItem[] لفلتر النوع الرئيسي (all/main/station/sub) */
  warehouseTypeTabs = computed(() => {
    const tabs: { value: string; label: string; count: number }[] = [
      { value: 'all',     label: 'الكل',   count: this.warehouses().length },
      { value: 'main',    label: 'رئيسي',  count: this.mainCount() },
      { value: 'station', label: 'محطة',   count: this.stationCount() },
    ];
    if (this.subCount() > 0) {
      tabs.push({ value: 'sub', label: 'فرعي', count: this.subCount() });
    }
    return tabs;
  });

  /** TabBarItem[] للأنواع الفرعية الديناميكية */
  subTypeTabs = computed(() => {
    return this.subTypeFilters().map((sf) => ({
      value: sf.key,
      label: sf.label,
      icon: sf.icon,
      count: sf.count,
      customColor: sf.color,
    }));
  });

  /** يُغيّر النوع الرئيسي ويُعيد فلتر النوع الفرعي إلى all */
  changeFilterType(t: string): void {
    this.filterType.set(t);
    this.filterSubType.set('all');
  }

  getStationName(stationId: number | null | undefined): string {
    if (!stationId) return '-';
    const st = this.stations().find(s => s.id === stationId);
    return st ? st.name : '-';
  }

  getSubTypeName(subType: string | null | undefined): string {
    if (!subType) return '';
    const t = this.warehouseTypes().find((wt: any) => wt.subTypeKey === subType);
    return t ? t.name : subType;
  }

  // ===== إضافة/تعديل مخزن =====
  async save() {
    if (!this.form.name?.trim()) {
      this.toast.error('يرجى إدخال اسم المخزن');
      return;
    }
    this.saving.set(true);
    try {
      const payload = {
        ...this.form,
        currencyIds: this.selectedCurrencyIds(),
        defaultCurrencyId: this.defaultCurrencyId(),
      };
      if (this.editingId()) {
        await this.api.updateWarehouse(this.editingId()!, payload);
        this.toast.success('تم تعديل المخزن بنجاح');
      } else {
        await this.api.createWarehouse(this.bizId, payload);
        this.toast.success('تم إضافة المخزن بنجاح');
      }
      this.closeForm();
      await this.load();
    } catch (e: unknown) {
      this.toast.error(e instanceof Error ? e.message : 'حدث خطأ');
    } finally {
      this.saving.set(false);
    }
  }

  async remove(w: any) {
    const confirmed = await this.toast.confirm({
      title: 'تأكيد الحذف',
      message: `هل أنت متأكد من حذف المخزن "${w.name}"؟`,
      type: 'danger',
    });
    if (confirmed) {
      try {
        await this.api.deleteWarehouse(w.id);
        this.toast.success('تم حذف المخزن');
        await this.load();
      } catch (e: unknown) {
        this.toast.error(e instanceof Error ? e.message : 'حدث خطأ');
      }
    }
  }

  // ===== إدارة تصنيفات المخازن =====
  openAddType() {
    this.typeForm = { name: '', subTypeKey: '', description: '', icon: 'warehouse', color: '#4CAF50' };
    this.editingTypeId.set(null);
    this.showTypeForm.set(true);
  }

  openEditType(t: any) {
    this.typeForm = {
      name: t.name, subTypeKey: t.subTypeKey, description: t.description || '',
      icon: t.icon || 'warehouse', color: t.color || '#4CAF50',
    };
    this.editingTypeId.set(t.id);
    this.showTypeForm.set(true);
  }

  async saveType() {
    if (!this.typeForm.name?.trim() || !this.typeForm.subTypeKey?.trim()) {
      this.toast.error('يرجى إدخال الاسم والمفتاح');
      return;
    }
    try {
      if (this.editingTypeId()) {
        await this.api.updateWarehouseType(this.editingTypeId()!, this.typeForm);
        this.toast.success('تم تعديل التصنيف بنجاح');
      } else {
        await this.api.createWarehouseType(this.bizId, this.typeForm);
        this.toast.success('تم إضافة التصنيف بنجاح');
      }
      this.showTypeForm.set(false);
      await this.load();
    } catch (e: unknown) {
      this.toast.error(e instanceof Error ? e.message : 'حدث خطأ');
    }
  }

  async removeType(t: any) {
    const confirmed = await this.toast.confirm({
      title: 'تأكيد الحذف',
      message: `هل أنت متأكد من حذف التصنيف "${t.name}"؟`,
      type: 'danger',
    });
    if (confirmed) {
      try {
        await this.api.deleteWarehouseType(t.id);
        this.toast.success('تم حذف التصنيف');
        await this.load();
      } catch (e: unknown) {
        this.toast.error(e instanceof Error ? e.message : 'حدث خطأ');
      }
    }
  }

  // ===== مساعدات =====
  getTypeLabel(t: string | undefined): string {
    if (!t) return '';
    const map: Record<string, string> = { main: 'رئيسي', station: 'محطة', sub: 'فرعي' };
    return map[t] || t;
  }

  getTypeClass(t: string | undefined): string {
    if (!t) return 'default';
    const map: Record<string, string> = { main: 'active', station: 'partner', sub: 'info' };
    return map[t] || 'default';
  }

  getTypeIcon(t: string | undefined): string {
    if (!t) return 'warehouse';
    const map: Record<string, string> = { main: 'store', station: 'local_gas_station', sub: 'inventory_2' };
    return map[t] || 'warehouse';
  }

  getTypeColor(t: string | undefined): string {
    if (!t) return '#64748b';
    const map: Record<string, string> = { main: '#f59e0b', station: '#3b82f6', sub: '#8b5cf6' };
    return map[t] || '#64748b';
  }

  // أيقونات متاحة للتصنيفات
  availableIcons = [
    'warehouse', 'store', 'inventory_2', 'local_shipping', 'local_gas_station',
    'storefront', 'factory', 'domain', 'business', 'apartment',
    'home_work', 'garage', 'archive', 'inbox', 'shelves',
  ];

  async onAccountChange(accountId: number) {
    if (accountId) {
      try {
        const currencies = await this.api.getAccountCurrencies(accountId);
        this.accountCurrencies.set(currencies || []);
        const allIds = (currencies || []).map((c: any) => c.currencyId);
        this.selectedCurrencyIds.set(allIds);
        this.defaultCurrencyId.set(allIds[0] || null);
      } catch (e) {
        console.error(e);
        this.accountCurrencies.set([]);
      }
    } else {
      this.accountCurrencies.set([]);
      this.selectedCurrencyIds.set([]);
      this.defaultCurrencyId.set(null);
    }
  }

  toggleCurrency(currencyId: number) {
    const ids = [...this.selectedCurrencyIds()];
    const idx = ids.indexOf(currencyId);
    if (idx >= 0) {
      ids.splice(idx, 1);
      if (this.defaultCurrencyId() === currencyId) this.defaultCurrencyId.set(ids[0] || null);
    } else {
      ids.push(currencyId);
    }
    this.selectedCurrencyIds.set(ids);
  }

  setDefaultCurrency(currencyId: number) {
    this.defaultCurrencyId.set(currencyId);
    if (!this.selectedCurrencyIds().includes(currencyId)) {
      this.selectedCurrencyIds.update(ids => [...ids, currencyId]);
    }
  }
}
