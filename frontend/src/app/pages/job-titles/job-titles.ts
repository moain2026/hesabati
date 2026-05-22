import { Component, inject, signal } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { BaseCrudPageComponent } from '../../shared/base-crud-page.component';
import { PAGE_IMPORTS } from '../../shared/page-imports';

interface JobTitleForm { name: string; description: string; icon: string; color: string; }
interface JobTitle { id: number; name: string; description?: string; icon?: string; color?: string; isActive?: boolean; }

@Component({
  selector: 'app-job-titles',
  standalone: true,
  imports: [...PAGE_IMPORTS],
  templateUrl: './job-titles.html',
  styleUrl: './job-titles.scss',
})
export class JobTitlesComponent extends BaseCrudPageComponent<JobTitle> {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  jobTitles = signal<JobTitle[]>([]);

  private readonly defaultForm: JobTitleForm = { name: '', description: '', icon: 'badge', color: '#f59e0b' };
  form: JobTitleForm = { ...this.defaultForm };

  protected override onBizIdChange(_bizId: number): void {
    this.load();
  }

  protected override resetForm(): void {
    this.form = { ...this.defaultForm };
  }

  protected override populateForm(j: JobTitle): void {
    this.form = {
      name: j.name,
      description: j.description || '',
      icon: j.icon || 'badge',
      color: j.color || '#f59e0b',
    };
  }

  async load() {
    this.loading.set(true);
    try {
      const data = await this.api.getJobTitles(this.bizId);
      this.jobTitles.set(data || []);
    } catch (e) { console.error(e); }
    this.loading.set(false);
  }

  async save() {
    if (!this.form.name?.trim()) {
      this.toast.error('يرجى إدخال المسمى الوظيفي');
      return;
    }
    this.saving.set(true);
    try {
      if (this.editingId()) {
        await this.api.updateJobTitle(this.editingId()!, this.form);
        this.toast.success('تم تعديل المسمى الوظيفي بنجاح');
      } else {
        await this.api.createJobTitle(this.bizId, this.form);
        this.toast.success('تم إضافة المسمى الوظيفي بنجاح');
      }
      this.closeForm();
      await this.load();
    } catch (e: unknown) {
      this.toast.error(e instanceof Error ? e.message : 'حدث خطأ');
    }
    this.saving.set(false);
  }

  async remove(j: JobTitle) {
    const confirmed = await this.toast.confirm({
      title: 'تأكيد الحذف',
      message: `هل أنت متأكد من حذف المسمى الوظيفي "${j.name}"؟`,
      type: 'danger',
    });
    if (confirmed) {
      try {
        await this.api.deleteJobTitle(j.id);
        this.toast.success('تم حذف المسمى الوظيفي');
        await this.load();
      } catch (e: unknown) {
        this.toast.error(e instanceof Error ? e.message : 'حدث خطأ');
      }
    }
  }

  availableIcons = [
    'badge', 'person', 'work', 'engineering', 'supervisor_account',
    'manage_accounts', 'admin_panel_settings', 'support_agent', 'school', 'military_tech',
    'local_police', 'health_and_safety', 'construction', 'precision_manufacturing', 'science',
  ];
}
