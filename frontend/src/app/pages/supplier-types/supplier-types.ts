import { Component, inject, signal } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { BaseCrudPageComponent } from '../../shared/base-crud-page.component';
import { PAGE_IMPORTS } from '../../shared/page-imports';

interface SupplierTypeForm { name: string; subTypeKey: string; description: string; icon: string; color: string; }
interface SupplierType {
  id: number; name: string; subTypeKey: string;
  description?: string; icon?: string; color?: string;
  isActive?: boolean; isSystem?: boolean;
  code?: string; accountCode?: string;
  accountLedgerCode?: string; accountSequence?: string | number;
  sequenceNumber?: string | number;
}

@Component({
  selector: 'app-supplier-types',
  standalone: true,
  imports: [...PAGE_IMPORTS],
  templateUrl: './supplier-types.html',
  styleUrl: './supplier-types.scss',
})
export class SupplierTypesComponent extends BaseCrudPageComponent<SupplierType> {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  types = signal<SupplierType[]>([]);

  private readonly defaultForm: SupplierTypeForm = { name: '', subTypeKey: '', description: '', icon: 'local_shipping', color: '#0ea5e9' };
  form: SupplierTypeForm = { ...this.defaultForm };

  protected override onBizIdChange(_bizId: number): void {
    this.load();
  }

  protected override resetForm(): void {
    this.form = { ...this.defaultForm };
  }

  protected override populateForm(t: SupplierType): void {
    this.form = {
      name: t.name,
      subTypeKey: t.subTypeKey,
      description: t.description || '',
      icon: t.icon || 'local_shipping',
      color: t.color || '#0ea5e9',
    };
  }

  async load() {
    this.loading.set(true);
    try {
      const data = await this.api.getSupplierTypes(this.bizId);
      this.types.set(data || []);
    } catch (e) { console.error(e); }
    this.loading.set(false);
  }

  onNameChange() {
    if (!this.editingId()) {
      this.form.subTypeKey = this.form.name
        .trim().toLowerCase().replace(/\s+/g, '_').replace(/[^\u0621-\u064Aa-z0-9_]/g, '');
    }
  }

  async save() {
    if (!this.form.name?.trim()) {
      this.toast.error('يرجى إدخال الاسم');
      return;
    }
    if (!this.form.subTypeKey?.trim()) {
      this.form.subTypeKey = this.form.name.trim().toLowerCase().replace(/\s+/g, '_');
    }
    this.saving.set(true);
    try {
      if (this.editingId()) {
        await this.api.updateSupplierType(this.editingId()!, this.form);
        this.toast.success('تم تعديل النوع بنجاح');
      } else {
        await this.api.createSupplierType(this.bizId, this.form);
        this.toast.success('تم إضافة النوع بنجاح');
      }
      this.closeForm();
      await this.load();
    } catch (e: unknown) {
      this.toast.error(e instanceof Error ? e.message : 'حدث خطأ');
    }
    this.saving.set(false);
  }

  async remove(t: SupplierType) {
    const confirmed = await this.toast.confirm({
      title: 'تأكيد الحذف',
      message: `هل أنت متأكد من حذف النوع "${t.name}"؟`,
      type: 'danger',
    });
    if (confirmed) {
      try {
        await this.api.deleteSupplierType(t.id);
        this.toast.success('تم حذف النوع');
        await this.load();
      } catch (e: unknown) {
        this.toast.error(e instanceof Error ? e.message : 'حدث خطأ');
      }
    }
  }

  availableIcons = [
    'local_shipping', 'inventory', 'store', 'storefront', 'shopping_cart',
    'handshake', 'business', 'factory', 'agriculture', 'construction',
    'precision_manufacturing', 'engineering', 'warehouse', 'science', 'biotech',
  ];
}
