import { Component, inject, signal } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { BasePageComponent } from '../../shared/base-page.component';
import { PAGE_IMPORTS } from '../../shared/page-imports';

interface ItemForm { name: string; itemNumber: string; description: string; itemTypeId: number | null; unit: string; minStock: number; isActive: boolean; }
interface ItemTypeForm { name: string; subTypeKey: string; description: string; icon: string; color: string; }

@Component({
  selector: 'app-inventory-item-types',
  standalone: true,
  imports: [...PAGE_IMPORTS],
  templateUrl: './inventory-item-types.html',
  styleUrl: './inventory-item-types.scss',
})
export class InventoryItemTypesComponent extends BasePageComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  // ===== Data =====
  items = signal<any[]>([]);
  types = signal<any[]>([]);
  loading = signal(true);

  activeItemsCount(): number { return this.items().filter((i: any) => i.isActive !== false).length; }

  // ===== Tabs =====
  activeTab = signal<'items' | 'types'>('items');

  // ===== Items Form =====
  showItemForm = signal(false);
  editingItemId = signal<number | null>(null);
  itemForm: ItemForm = { name: '', itemNumber: '', description: '', itemTypeId: null, unit: '', minStock: 0, isActive: true };

  // ===== Types Form =====
  showTypeForm = signal(false);
  editingTypeId = signal<number | null>(null);
  typeForm: ItemTypeForm = { name: '', subTypeKey: '', description: '', icon: 'inventory_2', color: '#6366f1' };

  readonly availableIcons = [
    'inventory_2', 'category', 'widgets', 'view_in_ar', 'local_offer',
    'shopping_bag', 'store', 'conveyor_belt', 'forklift', 'package_2',
    'deployed_code', 'pallet', 'warehouse', 'precision_manufacturing', 'settings_input_component',
  ];

  protected override onBizIdChange(_bizId: number): void { this.load(); }

  async load() {
    this.loading.set(true);
    try {
      const [items, types] = await Promise.all([
        this.api.getInventoryItems(this.bizId),
        this.api.getInventoryItemTypes(this.bizId),
      ]);
      this.items.set(items || []);
      this.types.set(types || []);
    } catch (e) { console.error(e); }
    this.loading.set(false);
  }

  getTypeName(typeId: number | null): string {
    if (!typeId) return '—';
    return this.types().find(t => t.id === typeId)?.name || '—';
  }

  // ===== Items CRUD =====
  openAddItem() {
    this.itemForm = { name: '', itemNumber: '', description: '', itemTypeId: null, unit: 'قطعة', minStock: 0, isActive: true };
    this.editingItemId.set(null);
    this.showItemForm.set(true);
  }

  openEditItem(item: any) {
    this.itemForm = {
      name: item.name || '',
      itemNumber: item.category || '',
      description: item.notes || '',
      itemTypeId: item.itemTypeId || null,
      unit: item.unit || '',
      minStock: Number(item.minQuantity) || 0,
      isActive: item.isActive !== false,
    };
    this.editingItemId.set(item.id);
    this.showItemForm.set(true);
  }

  async saveItem() {
    if (!this.itemForm.name?.trim()) { this.toast.error('اسم الصنف مطلوب'); return; }
    if (!this.itemForm.itemNumber?.toString().trim()) { this.toast.error('رقم الصنف مطلوب'); return; }
    const payload = {
      name: this.itemForm.name,
      itemNumber: this.itemForm.itemNumber,
      category: this.itemForm.itemNumber,
      itemTypeId: this.itemForm.itemTypeId,
      unit: this.itemForm.unit,
      minQuantity: this.itemForm.minStock,
      notes: this.itemForm.description,
      isActive: this.itemForm.isActive,
    };
    try {
      if (this.editingItemId()) {
        await this.api.updateInventoryItem(this.editingItemId()!, payload);
        this.toast.success('تم تعديل الصنف');
      } else {
        await this.api.createInventoryItem(this.bizId, payload);
        this.toast.success('تم إضافة الصنف');
      }
      this.showItemForm.set(false);
      await this.load();
    } catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'حدث خطأ'); }
  }

  async removeItem(item: any) {
    const ok = await this.toast.confirm({ title: 'حذف صنف', message: `حذف "ص${item.name}"؟`, type: 'danger' });
    if (!ok) return;
    try {
      await this.api.deleteInventoryItem(item.id);
      this.toast.success('تم الحذف');
      await this.load();
    } catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'حدث خطأ'); }
  }

  // ===== Types CRUD =====
  openAddType() {
    this.typeForm = { name: '', subTypeKey: '', description: '', icon: 'inventory_2', color: '#6366f1' };
    this.editingTypeId.set(null);
    this.showTypeForm.set(true);
  }

  openEditType(t: any) {
    this.typeForm = { name: t.name, subTypeKey: t.subTypeKey || '', description: t.description || '', icon: t.icon || 'inventory_2', color: t.color || '#6366f1' };
    this.editingTypeId.set(t.id);
    this.showTypeForm.set(true);
  }

  onTypeNameChange() {
    if (!this.editingTypeId()) {
      this.typeForm.subTypeKey = this.typeForm.name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^\w\u0621-\u064A]/g, '');
    }
  }

  async saveType() {
    if (!this.typeForm.name?.trim()) { this.toast.error('اسم النوع مطلوب'); return; }
    try {
      if (this.editingTypeId()) {
        await this.api.updateInventoryItemType(this.editingTypeId()!, this.typeForm);
        this.toast.success('تم تعديل النوع');
      } else {
        await this.api.createInventoryItemType(this.bizId, this.typeForm);
        this.toast.success('تم إضافة النوع');
      }
      this.showTypeForm.set(false);
      await this.load();
    } catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'حدث خطأ'); }
  }

  async removeType(t: any) {
    const ok = await this.toast.confirm({ title: 'حذف نوع', message: `حذف "ص${t.name}"؟`, type: 'danger' });
    if (!ok) return;
    try {
      await this.api.deleteInventoryItemType(t.id);
      this.toast.success('تم الحذف');
      await this.load();
    } catch (e: unknown) { this.toast.error(e instanceof Error ? e.message : 'حدث خطأ'); }
  }
}
