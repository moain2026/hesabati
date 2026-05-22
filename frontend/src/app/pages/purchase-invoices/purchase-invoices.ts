import { Component, inject, signal, computed } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { BaseCrudPageComponent } from '../../shared/base-crud-page.component';
import { PAGE_IMPORTS } from '../../shared/page-imports';

interface PurchaseInvoiceItem {
  inventoryItemId: number;
  itemName?: string;
  quantity: number;
  unitCost: number;
  totalCost?: number;
  discount: number;
  notes?: string;
}

interface PurchaseInvoice {
  id: number;
  invoiceNumber: string;
  fullSequenceNumber?: string;
  supplierSequenceNumber?: string;
  supplierId: number;
  supplierName?: string;
  warehouseId?: number;
  warehouseName?: string;
  currencyId: number;
  currencyCode?: string;
  subtotal: string;
  discount: string;
  totalAmount: string;
  paidAmount: string;
  remainingAmount: string;
  paymentMethod: string;
  status: string;
  receivedStatus: string;
  invoiceDate: string;
  dueDate?: string;
  externalReference?: string;
  notes?: string;
  items?: PurchaseInvoiceItem[];
}

@Component({
  selector: 'app-purchase-invoices',
  standalone: true,
  imports: [...PAGE_IMPORTS],
  templateUrl: './purchase-invoices.html',
  styleUrl: './purchase-invoices.scss',
})
export class PurchaseInvoicesComponent extends BaseCrudPageComponent<PurchaseInvoice> {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  // ===== State =====
  invoices       = signal<PurchaseInvoice[]>([]);
  suppliers      = signal<any[]>([]);
  warehouses     = signal<any[]>([]);
  currencies     = signal<any[]>([]);
  inventoryItems = signal<any[]>([]);
  expandedId     = signal<number | null>(null);
  error          = signal('');

  // ===== Tab Filter =====
  activeTab = signal<string>('all');

  filteredInvoices = computed(() => {
    const tab = this.activeTab();
    const all = this.invoices();
    if (tab === 'all') return all;
    return all.filter((inv: any) => inv.status === tab);
  });

  // ===== Stats =====
  readonly statusMeta: Record<string, { label: string; icon: string; color: string }> = {
    all:       { label: 'الكل',      icon: 'receipt_long', color: '#8b5cf6' },
    draft:     { label: 'مسودة',     icon: 'edit_note',    color: '#64748b' },
    confirmed: { label: 'مؤكدة',     icon: 'verified',     color: '#3b82f6' },
    completed: { label: 'مكتملة',    icon: 'check_circle', color: '#10b981' },
    cancelled: { label: 'ملغاة',     icon: 'cancel',       color: '#ef4444' },
  };

  readonly statusKeys = ['all', 'draft', 'confirmed', 'completed'];

  statusCount(status: string) {
    if (status === 'all') return this.invoices().length;
    return this.invoices().filter(inv => inv.status === status).length;
  }

  /** TabBarItem[] لتبويبات الفواتير */
  statusTabs() {
    const active = this.activeTab();
    return this.statusKeys.map((key) => {
      const meta = this.statusMeta[key];
      return {
        value: key,
        label: meta.label,
        icon: meta.icon,
        count: this.statusCount(key),
        // اللون الديناميكي يظهر فقط عند عدم التفعيل
        customColor: active === key ? undefined : meta.color,
      };
    });
  }

  // ===== Form =====
  formHeader = signal({
    supplierId:        null as number | null,
    warehouseId:       null as number | null,
    currencyId:        1,
    paymentMethod:     'credit' as string,
    invoiceDate:       new Date().toISOString().split('T')[0],
    dueDate:           '',
    externalReference: '',
    notes:             '',
  });

  formItems = signal<PurchaseInvoiceItem[]>([]);

  newItem: PurchaseInvoiceItem = {
    inventoryItemId: 0,
    quantity: 1,
    unitCost: 0,
    discount: 0,
    notes: '',
  };

  // ===== Computed =====
  formSubtotal = computed(() =>
    this.formItems().reduce((s, i) => s + (i.quantity * i.unitCost), 0)
  );
  formDiscount = computed(() =>
    this.formItems().reduce((s, i) => s + (i.discount || 0), 0)
  );
  formTotal = computed(() =>
    this.formSubtotal() - this.formDiscount()
  );

  readonly paymentOptions = [
    { key: 'credit',  label: 'آجل',   icon: 'schedule', color: '#f59e0b' },
    { key: 'cash',    label: 'نقداً', icon: 'payments', color: '#10b981' },
    { key: 'partial', label: 'جزئي',  icon: 'sync_alt', color: '#3b82f6' },
  ];

  protected override onBizIdChange(_bizId: number): void {
    this.loadAll();
  }

  // ===== Loading =====
  async loadAll() {
    this.loading.set(true);
    this.error.set('');
    try {
      const [invoicesData, suppliersData, warehousesData, currenciesData, itemsData] = await Promise.all([
        this.api.getPurchaseInvoices(this.bizId),
        this.api.getSuppliers(this.bizId),
        this.api.getWarehouses(this.bizId),
        this.api.getCurrencies(),
        this.api.getInventoryItems(this.bizId),
      ]);
      this.invoices.set(invoicesData);
      this.suppliers.set(suppliersData);
      this.warehouses.set(warehousesData);
      this.currencies.set(currenciesData);
      this.inventoryItems.set(itemsData);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'حدث خطأ أثناء تحميل البيانات');
    }
    this.loading.set(false);
  }

  // ===== Form Open/Close =====
  protected resetForm(): void {
    this.formHeader.set({
      supplierId: null, warehouseId: null, currencyId: 1, paymentMethod: 'credit',
      invoiceDate: new Date().toISOString().split('T')[0], dueDate: '', externalReference: '', notes: '',
    });
    this.formItems.set([]);
    this.error.set('');
  }

  protected populateForm(_inv: PurchaseInvoice & { id: number }): void {
    // populated asynchronously in openEdit override
  }

  openNew() { this.openAdd(); }

  override async openEdit(inv: PurchaseInvoice & { id: number }) {
    try {
      const d = await this.api.getPurchaseInvoice(this.bizId, inv.id);
      this.formHeader.set({
        supplierId: d.supplierId,
        warehouseId: d.warehouseId,
        currencyId: d.currencyId,
        paymentMethod: d.paymentMethod,
        invoiceDate: d.invoiceDate ? new Date(d.invoiceDate).toISOString().split('T')[0] : '',
        dueDate: d.dueDate ? new Date(d.dueDate).toISOString().split('T')[0] : '',
        externalReference: d.externalReference || '',
        notes: d.notes || '',
      });
      this.formItems.set(
        (d.items || []).map((item: any) => ({
          inventoryItemId: item.inventoryItemId,
          itemName: item.itemName,
          quantity: parseFloat(item.quantity),
          unitCost: parseFloat(item.unitCost),
          discount: parseFloat(item.discount || 0),
          notes: item.notes || '',
        }))
      );
      this.editingId.set(inv.id);
      this.error.set('');
      this.showForm.set(true);
      this.scrollToTop();
    } catch (e: unknown) {
      this.toast.error('فشل في تحميل تفاصيل الفاتورة');
    }
  }

  // ===== Items =====
  addItem() {
    if (!this.newItem.inventoryItemId || this.newItem.quantity <= 0 || this.newItem.unitCost <= 0) {
      this.toast.error('يرجى تحديد الصنف والكمية والسعر');
      return;
    }
    const item = this.inventoryItems().find(i => i.id === this.newItem.inventoryItemId);
    this.formItems.update(items => [...items, {
      ...this.newItem,
      itemName: item?.name || '',
      totalCost: this.newItem.quantity * this.newItem.unitCost,
    }]);
    this.newItem = { inventoryItemId: 0, quantity: 1, unitCost: 0, discount: 0, notes: '' };
  }

  removeItem(index: number) {
    this.formItems.update(items => items.filter((_, i) => i !== index));
  }

  // ===== Save =====
  async save() {
    const h = this.formHeader();
    if (!h.supplierId) { this.error.set('يرجى اختيار المورد'); return; }
    if (!this.formItems().length) { this.error.set('يرجى إضافة عنصر واحد على الأقل'); return; }

    this.saving.set(true);
    this.error.set('');
    try {
      const payload = {
        ...h,
        items: this.formItems().map(item => ({
          inventoryItemId: item.inventoryItemId,
          quantity: item.quantity,
          unitCost: item.unitCost,
          discount: item.discount,
          notes: item.notes,
        })),
      };

      if (this.editingId()) {
        await this.api.updatePurchaseInvoice(this.bizId, this.editingId()!, payload);
        this.toast.success('تم تحديث الفاتورة');
      } else {
        await this.api.createPurchaseInvoice(this.bizId, payload);
        this.toast.success('تم إنشاء الفاتورة');
      }
      this.closeForm();
      await this.loadAll();
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'حدث خطأ أثناء حفظ الفاتورة');
    }
    this.saving.set(false);
  }

  // ===== Actions =====
  async confirm(inv: PurchaseInvoice) {
    try {
      await this.api.confirmPurchaseInvoice(this.bizId, inv.id);
      this.toast.success('تم تأكيد الفاتورة');
      await this.loadAll();
    } catch (e: unknown) {
      this.toast.error(e instanceof Error ? e.message : 'فشل في تأكيد الفاتورة');
    }
  }

  async remove(inv: PurchaseInvoice) {
    const ok = await this.toast.confirm({
      title: 'تأكيد الحذف',
      message: `هل أنت متأكد من حذف الفاتورة "${inv.invoiceNumber}"؟`,
      type: 'danger',
    });
    if (!ok) return;
    try {
      await this.api.deletePurchaseInvoice(this.bizId, inv.id);
      this.toast.success('تم حذف الفاتورة');
      await this.loadAll();
    } catch (e: unknown) {
      this.toast.error(e instanceof Error ? e.message : 'حدث خطأ أثناء الحذف');
    }
  }

  toggleExpand(id: number) {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  // ===== Helpers =====
  getSupplierName(id: number | null | undefined): string {
    if (!id) return '—';
    return this.suppliers().find((s: any) => s.id === id)?.name || '—';
  }

  getStatusInfo(status: string | undefined) {
    if (!status) return this.statusMeta['draft'];
    return this.statusMeta[status] || this.statusMeta['draft'];
  }

  getPaymentLabel(method: string | undefined): string {
    if (!method) return '';
    return this.paymentOptions.find(p => p.key === method)?.label || method;
  }

  formatDate(d: string): string {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return d; }
  }

  fmt(val: string | number | undefined | null): string {
    const num = typeof val === 'string' ? parseFloat(val) : (val ?? 0);
    return isNaN(num) ? '0.00' : num.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  trackById(_: number, item: any) { return item.id; }
}
