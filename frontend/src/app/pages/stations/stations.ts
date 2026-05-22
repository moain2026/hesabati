import { Component, computed, inject, signal } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { BaseCrudPageComponent } from '../../shared/base-crud-page.component';
import { PAGE_IMPORTS } from '../../shared/page-imports';

interface Station {
  id: number;
  name: string;
  code?: string;
  location?: string;
  isActive?: boolean;
  notes?: string;
  billingSystems?: string[] | string;
  sequenceNumber?: string | number;
  hasEmployees?: boolean;
}

interface StationForm {
  name: string;
  code: string;
  location: string;
  isActive: boolean;
  notes: string;
  billingSystemsStr: string;
}

@Component({
  selector: 'app-stations',
  standalone: true,
  imports: [...PAGE_IMPORTS],
  templateUrl: './stations.html',
  styleUrl: './stations.scss',
})
export class StationsComponent extends BaseCrudPageComponent<Station> {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  stations = signal<Station[]>([]);
  billingSystems = signal<any[]>([]);

  // backward-compat: editingStation derived from editingId + stations list
  editingStation = computed<Station | null>(() => {
    const id = this.editingId();
    if (id === null) return null;
    return this.stations().find(s => s.id === id) ?? null;
  });

  private readonly defaultFormValue: StationForm = {
    name: '',
    code: '',
    location: '',
    isActive: true,
    notes: '',
    billingSystemsStr: '',
  };

  form = signal<StationForm>({ ...this.defaultFormValue });

  protected override onBizIdChange(_bizId: number): void {
    this.load();
  }

  protected resetForm(): void {
    this.form.set({ ...this.defaultFormValue });
  }

  protected populateForm(s: Station & { id: number }): void {
    const billingStr = Array.isArray(s.billingSystems)
      ? s.billingSystems.join(', ')
      : (s.billingSystems || '');
    this.form.set({
      name: s.name || '',
      code: s.code || '',
      location: s.location || '',
      isActive: s.isActive !== false,
      notes: s.notes || '',
      billingSystemsStr: billingStr,
    });
  }

  // Backward-compat alias for templates that call openCreate()
  openCreate(): void { this.openAdd(); }

  async load() {
    this.loading.set(true);
    try {
      const [data, systems] = await Promise.all([
        this.api.getStations(this.bizId),
        this.api.getBillingSystemsConfig(this.bizId).catch(() => []),
      ]);
      this.stations.set(data);
      this.billingSystems.set(systems);
    } catch (e: unknown) {
      console.error(e);
      this.toast.error(e instanceof Error ? e.message : 'حدث خطأ أثناء تحميل المحطات');
    }
    this.loading.set(false);
  }

  getBillingSystemsArray(str: string): string[] {
    if (!str || !str.trim()) return [];
    return str.split(',').map(s => s.trim()).filter(Boolean);
  }

  async save() {
    const f = this.form();
    if (!f.name?.trim()) {
      this.toast.warning('اسم المحطة مطلوب');
      return;
    }
    if (!f.code?.trim()) {
      this.toast.warning('رمز المحطة مطلوب');
      return;
    }

    this.saving.set(true);
    try {
      const payload = {
        name: f.name.trim(),
        code: f.code.trim(),
        location: f.location?.trim() || null,
        isActive: f.isActive,
        notes: f.notes?.trim() || null,
        billingSystems: this.getBillingSystemsArray(f.billingSystemsStr),
      };

      const editingId = this.editingId();
      if (editingId !== null) {
        await this.api.updateStationByBiz(this.bizId, editingId, payload);
        this.toast.success('تم تحديث المحطة بنجاح');
      } else {
        await this.api.createStation(this.bizId, payload);
        this.toast.success('تم إضافة المحطة بنجاح');
      }
      this.closeForm();
      await this.load();
    } catch (e: unknown) {
      this.toast.error(e instanceof Error ? e.message : 'حدث خطأ أثناء الحفظ');
    } finally {
      this.saving.set(false);
    }
  }

  async deleteStation(s: Station) {
    const confirmed = await this.toast.confirm({
      title: 'تأكيد الحذف',
      message: `هل تريد حذف المحطة "${s.name}"؟`,
      type: 'danger',
    });
    if (!confirmed) return;

    try {
      await this.api.deleteStation(this.bizId, s.id);
      this.toast.success('تم حذف المحطة');
      await this.load();
    } catch (e: unknown) {
      this.toast.error(e instanceof Error ? e.message : 'حدث خطأ أثناء الحذف');
    }
  }

  getBillingLabel(sysKey: string): string {
    const sys = this.billingSystems().find((s: any) => s.systemKey === sysKey);
    return sys?.name ?? sysKey;
  }

  setFormField(field: string, value: any) {
    this.form.update(f => ({ ...f, [field]: value }));
  }
}
