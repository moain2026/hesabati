import { Component, inject, signal } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { BaseCrudPageComponent } from '../../shared/base-crud-page.component';
import { PAGE_IMPORTS } from '../../shared/page-imports';

interface DepartmentForm {
  name: string;
  code: string;
  description: string;
  icon: string;
  color: string;
}

interface Department {
  id: number;
  name: string;
  code?: string;
  description?: string;
  icon?: string;
  color?: string;
  isActive?: boolean;
  [key: string]: unknown;
}

@Component({
  selector: 'app-departments',
  standalone: true,
  imports: [...PAGE_IMPORTS],
  templateUrl: './departments.html',
  styleUrl: './departments.scss',
})
export class DepartmentsComponent extends BaseCrudPageComponent<Department> {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  departments = signal<Department[]>([]);

  private readonly defaultForm: DepartmentForm = { name: '', code: '', description: '', icon: 'business', color: '#8b5cf6' };
  form: DepartmentForm = { ...this.defaultForm };

  protected override onBizIdChange(_bizId: number): void {
    this.load();
  }

  protected override resetForm(): void {
    this.form = { ...this.defaultForm };
  }

  protected override populateForm(d: Department): void {
    this.form = {
      name: d.name,
      code: d.code || '',
      description: d.description || '',
      icon: d.icon || 'business',
      color: d.color || '#8b5cf6',
    };
  }

  async load() {
    this.loading.set(true);
    try {
      const data = await this.api.getDepartments(this.bizId);
      this.departments.set(data || []);
    } catch (e) { console.error(e); }
    this.loading.set(false);
  }

  async save() {
    if (!this.form.name?.trim()) {
      this.toast.error('يرجى إدخال اسم القسم');
      return;
    }
    this.saving.set(true);
    try {
      if (this.editingId()) {
        await this.api.updateDepartment(this.editingId()!, this.form);
        this.toast.success('تم تعديل القسم بنجاح');
      } else {
        await this.api.createDepartment(this.bizId, this.form);
        this.toast.success('تم إضافة القسم بنجاح');
      }
      this.closeForm();
      await this.load();
    } catch (e: unknown) {
      this.toast.error(e instanceof Error ? e.message : 'حدث خطأ');
    }
    this.saving.set(false);
  }

  async remove(d: Department) {
    const confirmed = await this.toast.confirm({
      title: 'تأكيد الحذف',
      message: `هل أنت متأكد من حذف القسم "${d.name}"؟`,
      type: 'danger',
    });
    if (confirmed) {
      try {
        await this.api.deleteDepartment(d.id);
        this.toast.success('تم حذف القسم');
        await this.load();
      } catch (e: unknown) {
        this.toast.error(e instanceof Error ? e.message : 'حدث خطأ');
      }
    }
  }

  availableIcons = [
    'business', 'corporate_fare', 'apartment', 'domain', 'location_city',
    'meeting_room', 'groups', 'work', 'badge', 'hub',
    'account_tree', 'schema', 'lan', 'device_hub', 'mediation',
  ];
}
