import { Component, inject, signal } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { BaseCrudPageComponent } from '../../shared/base-crud-page.component';
import { PAGE_IMPORTS } from '../../shared/page-imports';

interface SupplierForm { name: string; supplierTypeId: number | null; category: string; phone: string; address: string; contactPerson: string; notes: string; }
interface Supplier {
  id: number; name: string; supplierTypeId?: number | null; category?: string;
  phone?: string; address?: string; contactPerson?: string; notes?: string;
  defaultCurrencyId?: number | null;
  isActive?: boolean;
  code?: string;
  accountCode?: string;
  accountLedgerCode?: string;
  accountSequence?: string | number;
  sequenceNumber?: string | number;
}

@Component({
  selector: 'app-suppliers',
  standalone: true,
  imports: [...PAGE_IMPORTS],
  templateUrl: './suppliers.html',
  styleUrl: './suppliers.scss',
})
export class SuppliersComponent extends BaseCrudPageComponent<Supplier> {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  suppliers = signal<Supplier[]>([]);
  supplierTypes = signal<any[]>([]);
  accountCurrencies = signal<any[]>([]);
  selectedCurrencyIds = signal<number[]>([]);
  defaultCurrencyId = signal<number | null>(null);
  filterCategory = signal<string>('all');
  searchQuery = signal<string>('');

  private readonly defaultForm: SupplierForm = { name: '', supplierTypeId: null, category: '', phone: '', address: '', contactPerson: '', notes: '' };
  form: SupplierForm = { ...this.defaultForm };

  protected override onBizIdChange(_bizId: number): void {
    this.load();
  }

  protected override resetForm(): void {
    this.form = { ...this.defaultForm };
    this.accountCurrencies.set([]);
    this.selectedCurrencyIds.set([]);
    this.defaultCurrencyId.set(null);
  }

  protected override populateForm(s: Supplier): void {
    this.form = {
      name: s.name,
      supplierTypeId: s.supplierTypeId ?? null,
      category: s.category || '',
      phone: s.phone || '',
      address: s.address || '',
      contactPerson: s.contactPerson || '',
      notes: s.notes || '',
    };
    this.accountCurrencies.set([]);
    this.selectedCurrencyIds.set([]);
    this.defaultCurrencyId.set(null);
    if (s.supplierTypeId) {
      this.onTypeChange(s.supplierTypeId).then(() => {
        const allIds = this.accountCurrencies().map((c: any) => c.currencyId);
        this.selectedCurrencyIds.set(allIds);
        if (s.defaultCurrencyId) this.defaultCurrencyId.set(s.defaultCurrencyId);
      });
    }
  }

  async load() {
    this.loading.set(true);
    try {
      const [data, types] = await Promise.all([
        this.api.getSuppliers(this.bizId),
        this.api.getSupplierTypes(this.bizId).catch(() => []),
      ]);
      this.suppliers.set(data);
      this.supplierTypes.set(types);
    } catch (e: unknown) {
      console.error(e);
      this.toast.error(e instanceof Error ? e.message : 'حدث خطأ أثناء تحميل بيانات الموردين');
    }
    this.loading.set(false);
  }

  categories(): string[] {
    const cats = new Set<string>();
    for (const s of this.suppliers()) {
      const name = this.getSupplierTypeName(s.supplierTypeId) || s.category;
      if (name) cats.add(name);
    }
    return Array.from(cats);
  }

  filteredSuppliers() {
    let list = this.suppliers();
    const cat = this.filterCategory();
    const q = this.searchQuery().toLowerCase();
    if (cat !== 'all') {
      list = list.filter(
        s => (this.getSupplierTypeName(s.supplierTypeId) || s.category) === cat,
      );
    }
    if (q) list = list.filter(s => s.name.toLowerCase().includes(q) || (s.contactPerson || '').toLowerCase().includes(q));
    return list;
  }

  async save() {
    this.saving.set(true);
    try {
      const payload = {
        ...this.form,
        category: this.getSupplierTypeName(this.form.supplierTypeId) || this.form.category || null,
        currencyIds: this.selectedCurrencyIds(),
        defaultCurrencyId: this.defaultCurrencyId(),
      };
      const wasEditing = this.editingId();
      if (wasEditing) {
        await this.api.updateSupplier(wasEditing, payload);
      } else {
        await this.api.createSupplier(this.bizId, payload);
      }
      this.closeForm();
      this.toast.success(wasEditing ? 'تم تحديث المورد بنجاح' : 'تم إضافة المورد بنجاح');
      await this.load();
    } catch (e: unknown) {
      console.error(e);
      this.toast.error(e instanceof Error ? e.message : 'حدث خطأ أثناء حفظ المورد');
    }
    this.saving.set(false);
  }

  async remove(s: Supplier) {
    const confirmed = await this.toast.confirm({ title: 'تأكيد الحذف', message: `هل أنت متأكد من حذف المورد "${s.name}"؟`, type: 'danger' });
    if (confirmed) {
      try {
        await this.api.deleteSupplier(s.id);
        this.toast.success('تم حذف المورد بنجاح');
        await this.load();
      } catch (e: unknown) {
        console.error(e);
        this.toast.error(e instanceof Error ? e.message : 'حدث خطأ أثناء الحذف');
      }
    }
  }

  getCategoryIcon(cat: string | undefined): string {
    if (!cat) return 'inventory_2';
    const map: Record<string, string> = { 'وقود': 'local_gas_station', 'زيوت': 'oil_barrel', 'قطع غيار': 'build', 'مواد غذائية': 'restaurant' };
    return map[cat] || 'inventory_2';
  }

  getSupplierTypeName(typeId: number | null | undefined): string {
    if (!typeId) return '';
    const t = this.supplierTypes().find((x: any) => x.id === typeId);
    return t?.name || '';
  }

  async onTypeChange(typeId: number) {
    if (typeId) {
      const st = this.supplierTypes().find((t: any) => t.id === typeId);
      if (st?.accountId) {
        try {
          const currencies = await this.api.getAccountCurrencies(st.accountId);
          this.accountCurrencies.set(currencies || []);
          const allIds = (currencies || []).map((c: any) => c.currencyId);
          this.selectedCurrencyIds.set(allIds);
          this.defaultCurrencyId.set(allIds[0] || null);
          return;
        } catch (e) { console.error(e); }
      }
    }
    this.accountCurrencies.set([]);
    this.selectedCurrencyIds.set([]);
    this.defaultCurrencyId.set(null);
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
