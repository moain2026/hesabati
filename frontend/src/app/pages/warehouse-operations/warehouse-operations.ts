import { Component, inject, signal, computed } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { BaseCrudPageComponent } from '../../shared/base-crud-page.component';
import { PAGE_IMPORTS } from '../../shared/page-imports';

interface WopItem {
  itemId:    number | null;
  itemName:  string;
  itemCode:  string;
  quantity:  number;
  unitCost:  number;
  unit:      string;
  notes:     string;
}

interface WarehouseOperation {
  id: number;
  operationType: string;
  operationNumber?: string;
  operationDate?: string;
  sourceWarehouseId?: number | null;
  destinationWarehouseId?: number | null;
  supplierId?: number | null;
  description?: string;
  reference?: string;
  status?: string;
  totalCost?: number | string;
  items?: any[];
}

const OP_META: Record<string, { label: string; icon: string; color: string }> = {
  supply_invoice:   { label: 'توريد فاتورة',  icon: 'receipt_long',  color: '#22c55e' },
  supply_order:     { label: 'توريد أمر',      icon: 'assignment',    color: '#3b82f6' },
  dispatch:         { label: 'صرف مخزني',      icon: 'outbox',        color: '#ef4444' },
  transfer_out:     { label: 'تحويل مخزني',    icon: 'swap_horiz',    color: '#8b5cf6' },
  receive_transfer: { label: 'استلام تحويل',   icon: 'move_to_inbox', color: '#f59e0b' },
};

@Component({
  selector: 'app-warehouse-operations',
  standalone: true,
  imports: [...PAGE_IMPORTS],
  templateUrl: './warehouse-operations.html',
  styleUrl:    './warehouse-operations.scss',
})
export class WarehouseOperationsComponent extends BaseCrudPageComponent<WarehouseOperation> {
  private readonly api   = inject(ApiService);
  private readonly toast = inject(ToastService);

  // ===== Data =====
  operations  = signal<WarehouseOperation[]>([]);
  warehouses  = signal<any[]>([]);
  suppliers   = signal<any[]>([]);
  inventoryItems = signal<any[]>([]);
  operationTypes = signal<any[]>([]);
  error    = signal('');
  expandedId = signal<number | null>(null);

  // ===== Tabs =====
  activeTab = signal<string>('all');
  filteredOps = computed(() => {
    const tab = this.activeTab();
    const all = this.operations();
    if (tab === 'all') return all;
    return all.filter((o: any) => o.operationType === tab);
  });

  // ===== Stats =====
  stats = computed(() => {
    const all = this.operations();
    const result: Record<string, number> = { all: all.length };
    for (const key of Object.keys(OP_META)) result[key] = all.filter((o: any) => o.operationType === key).length;
    return result;
  });

  // ===== Form =====
  formHeader = signal({
    operationType:         'supply_invoice' as string,
    sourceWarehouseId:     null as number | null,
    destinationWarehouseId:null as number | null,
    operationTypeId:       null as number | null,
    supplierId:            null as number | null,
    relatedOperationId:    null as number | null,
    operationDate:         new Date().toISOString().split('T')[0],
    description:           '',
    reference:             '',
    status:                'draft' as string,
  });

  formItems = signal<WopItem[]>([]);

  readonly allTypes = Object.entries(OP_META).map(([key, m]) => ({ key, ...m }));

  /** TabBarItem[] - الكل + كل نوع عملية مخزني */
  opTabs() {
    const tabs: { value: string; label: string; icon?: string; count?: number }[] = [
      { value: 'all', label: 'الكل', icon: 'list', count: this.operations().length },
    ];
    const s = this.stats() as Record<string, number>;
    for (const t of this.allTypes) {
      tabs.push({ value: t.key, label: t.label, icon: t.icon, count: s[t.key] ?? 0 });
    }
    return tabs;
  }

  readonly statusOptions = [
    { key: 'draft',     label: 'مسودة',  icon: 'edit_note',    color: '#64748b' },
    { key: 'confirmed', label: 'مؤكد',   icon: 'check_circle', color: '#22c55e' },
    { key: 'cancelled', label: 'ملغي',   icon: 'cancel',       color: '#ef4444' },
  ];

  meta(type: string) { return OP_META[type] || { label: type, icon: 'inventory_2', color: '#64748b' }; }

  needsSource()      { return ['dispatch','transfer_out'].includes(this.formHeader().operationType); }
  needsDestination() { return ['supply_invoice','supply_order','transfer_out','receive_transfer'].includes(this.formHeader().operationType); }
  needsSupplier()    { return this.formHeader().operationType === 'supply_invoice'; }
  needsRelated()     { return this.formHeader().operationType === 'receive_transfer'; }

  pendingTransfers = computed(() => this.operations().filter((o: any) => o.operationType === 'transfer_out' && o.status === 'confirmed'));

  grandTotal = computed(() => this.formItems().reduce((s, i) => s + (i.quantity || 0) * (i.unitCost || 0), 0));
  totalQty   = computed(() => this.formItems().reduce((s, i) => s + (i.quantity || 0), 0));

  protected override onBizIdChange(_bizId: number): void { this.load(); }

  async load() {
    this.loading.set(true);
    try {
      const [ops, whs, supps, invItems, ots] = await Promise.allSettled([
        this.api.getWarehouseOperations(this.bizId),
        this.api.getWarehouses(this.bizId),
        this.api.getSuppliers(this.bizId),
        this.api.getInventoryItems(this.bizId),
        this.api.getOperationTypes(this.bizId),
      ]);
      this.operations.set(ops.status    === 'fulfilled' ? ops.value    || [] : []);
      this.warehouses.set(whs.status    === 'fulfilled' ? whs.value    || [] : []);
      this.suppliers.set(supps.status   === 'fulfilled' ? supps.value  || [] : []);
      this.inventoryItems.set(invItems.status === 'fulfilled' ? invItems.value || [] : []);
      this.operationTypes.set(ots.status === 'fulfilled' ? ots.value   || [] : []);
    } catch (e) { console.error(e); }
    this.loading.set(false);
  }

  newItem(): WopItem {
    return { itemId: null, itemName: '', itemCode: '', quantity: 1, unitCost: 0, unit: 'قطعة', notes: '' };
  }

  protected resetForm(): void {
    this.formHeader.set({
      operationType: 'supply_invoice', sourceWarehouseId: null, destinationWarehouseId: null,
      operationTypeId: null, supplierId: null, relatedOperationId: null,
      operationDate: new Date().toISOString().split('T')[0],
      description: '', reference: '', status: 'draft',
    });
    this.formItems.set([this.newItem()]);
    this.error.set('');
  }

  protected populateForm(_op: WarehouseOperation & { id: number }): void {
    // edit not supported for warehouse operations (create-only flow)
  }

  openNew(type = 'supply_invoice') {
    this.resetForm();
    this.formHeader.update(h => ({ ...h, operationType: type }));
    this.editingId.set(null);
    this.showForm.set(true);
    this.scrollToTop();
  }

  addItem()    { this.formItems.update(ls => [...ls, this.newItem()]); }
  removeItem(i: number) { if (this.formItems().length > 1) this.formItems.update(ls => ls.filter((_, idx) => idx !== i)); }

  updateItem(i: number, field: keyof WopItem, value: any) {
    this.formItems.update(ls => { const c = [...ls]; c[i] = { ...c[i], [field]: value }; return c; });
  }

  onItemSelect(i: number, itemId: number | null) {
    if (!itemId) { this.updateItem(i, 'itemId', null); return; }
    const inv = this.inventoryItems().find((x: any) => x.id === itemId);
    if (inv) {
      this.formItems.update(ls => {
        const c = [...ls];
        c[i] = { ...c[i], itemId, itemName: inv.name, itemCode: inv.code || inv.category || '', unit: inv.unit || 'قطعة' };
        return c;
      });
    }
  }

  async save() {
    const h = this.formHeader();
    if (!h.description?.trim()) { this.error.set('البيان مطلوب'); return; }
    if (this.needsDestination() && !h.destinationWarehouseId) { this.error.set('يرجى تحديد المخزن الوجهة'); return; }
    if (this.needsSource()      && !h.sourceWarehouseId)      { this.error.set('يرجى تحديد المخزن المصدر'); return; }
    if (this.needsSupplier()    && !h.supplierId)             { this.error.set('يرجى تحديد المورد'); return; }
    if (this.needsRelated()     && !h.relatedOperationId)     { this.error.set('يرجى تحديد عملية التحويل المرتبطة'); return; }
    const validItems = this.formItems().filter(i => i.itemName?.trim() || i.itemId);
    if (!validItems.length) { this.error.set('يجب إضافة صنف واحد على الأقل'); return; }

    this.saving.set(true);
    this.error.set('');
    try {
      await this.api.createWarehouseOperation(this.bizId, { ...h, items: validItems });
      this.toast.success('تم إنشاء العملية المخزنية بنجاح');
      this.closeForm();
      await this.load();
    } catch (e: unknown) { this.error.set(e instanceof Error ? e.message : 'حدث خطأ'); }
    finally { this.saving.set(false); }
  }

  toggleExpand(id: number) { this.expandedId.set(this.expandedId() === id ? null : id); }

  fmt(v: any) { return Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }

  formatDate(d: any) {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('ar-u-nu-latn-ca-gregory', { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return String(d); }
  }

  getWarehouseName(id: number | null | undefined) { return id ? (this.warehouses().find((w: any) => w.id === id)?.name || '—') : '—'; }
  getSupplierName(id: number | null | undefined)  { return id ? (this.suppliers().find((s: any) => s.id === id)?.name || '—') : '—'; }
  getItemName(id: number | null | undefined)      { return id ? (this.inventoryItems().find((i: any) => i.id === id)?.name || '—') : '—'; }

  printOperation(op: any) {
    const meta = this.meta(op.operationType);
    const lines = (op.items || []).map((it: any, i: number) => `
      <tr>
        <td>${i + 1}</td>
        <td>${it.itemName || this.getItemName(it.itemId)}</td>
        <td>${it.itemCode || '—'}</td>
        <td style="text-align:center">${this.fmt(it.quantity)} ${it.unit || ''}</td>
        <td style="text-align:left">${this.fmt(it.unitCost)}</td>
        <td style="text-align:left;font-weight:900">${this.fmt((it.quantity || 0) * (it.unitCost || 0))}</td>
      </tr>`).join('');
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><title>${meta.label}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; font-size: 13px; direction: rtl; padding: 24px; }
  .header { display: flex; justify-content: space-between; border-bottom: 3px solid ${meta.color}; padding-bottom: 12px; margin-bottom: 16px; }
  .title { font-size: 18px; font-weight: 900; color: ${meta.color}; }
  .meta { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 16px; padding: 10px 14px; background: #f8fafc; border-radius: 8px; }
  .meta-item { display: flex; flex-direction: column; gap: 2px; }
  .meta-label { font-size: 10px; color: #64748b; font-weight: 700; }
  .meta-value { font-size: 13px; font-weight: 800; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { padding: 8px 10px; background: ${meta.color}; color: #fff; font-size: 12px; text-align: right; }
  td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
  .total-row { background: #f1f5f9; font-weight: 900; border-top: 2px solid ${meta.color}; }
  .footer { display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 24px; }
  .sig-row { display: flex; justify-content: space-between; margin-top: 40px; }
  .sig-box { text-align: center; width: 160px; border-top: 1px solid #1e293b; padding-top: 4px; font-size: 11px; color: #64748b; }
  @media print { body { padding: 12px; } }
</style></head>
<body>
  <div class="header">
    <div><div class="title">${meta.label}</div><div style="font-size:11px;color:#64748b;margin-top:4px">${this.formatDate(op.operationDate)}</div></div>
    <div style="text-align:left;font-size:18px;font-weight:900;font-family:monospace;color:${meta.color}">${op.operationNumber || '#' + op.id}</div>
  </div>
  <div class="meta">
    <div class="meta-item"><div class="meta-label">البيان</div><div class="meta-value">${op.description || ''}</div></div>
    ${op.sourceWarehouseId      ? `<div class="meta-item"><div class="meta-label">المخزن المصدر</div><div class="meta-value">${this.getWarehouseName(op.sourceWarehouseId)}</div></div>` : ''}
    ${op.destinationWarehouseId ? `<div class="meta-item"><div class="meta-label">المخزن الوجهة</div><div class="meta-value">${this.getWarehouseName(op.destinationWarehouseId)}</div></div>` : ''}
    ${op.supplierId             ? `<div class="meta-item"><div class="meta-label">المورد</div><div class="meta-value">${this.getSupplierName(op.supplierId)}</div></div>` : ''}
    ${op.reference              ? `<div class="meta-item"><div class="meta-label">المرجع</div><div class="meta-value">${op.reference}</div></div>` : ''}
  </div>
  <table>
    <thead><tr><th>#</th><th>الصنف</th><th>الكود</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead>
    <tbody>${lines}</tbody>
    <tfoot><tr class="total-row"><td colspan="5" style="text-align:right">الإجمالي الكلي</td><td style="text-align:left;font-size:15px">${this.fmt(op.totalCost || 0)}</td></tr></tfoot>
  </table>
  <div class="sig-row">
    <div class="sig-box">أمين المخزن</div>
    <div class="sig-box">المحاسب</div>
    <div class="sig-box">المدير</div>
  </div>
  <div class="footer">
    <span>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-u-nu-latn-ca-gregory')}</span>
    <span>الحالة: ${op.status === 'confirmed' ? 'مؤكد' : op.status === 'cancelled' ? 'ملغي' : 'مسودة'}</span>
  </div>
  <script>window.onload = () => { window.print(); }<\/script>
</body></html>`;
    const w = window.open('', '_blank', 'width=900,height=700');
    if (w) { w.document.write(html); w.document.close(); }
  }
}
