import { Component, inject, signal } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { BaseCrudPageComponent } from '../../shared/base-crud-page.component';
import { PAGE_IMPORTS } from '../../shared/page-imports';

interface ReconciliationForm {
  title: string; reconciliationType: string;
  accountId: number | null; fundId: number | null;
  periodStart: string; periodEnd: string;
  expectedAmount: number; actualAmount: number; notes: string;
}
interface Reconciliation {
  id: number; title: string; reconciliationType?: string;
  accountId?: number | null; fundId?: number | null;
  periodStart?: string; periodEnd?: string;
  expectedAmount?: number | string; actualAmount?: number | string;
  notes?: string; status?: string;
  withPerson?: string;
}

@Component({
  selector: 'app-reconciliations',
  standalone: true,
  imports: [...PAGE_IMPORTS],
  templateUrl: './reconciliations.html',
  styleUrl: './reconciliations.scss',
})
export class ReconciliationsComponent extends BaseCrudPageComponent<Reconciliation> {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  reconciliations = signal<Reconciliation[]>([]);
  viewingItem = signal<any>(null);

  private readonly defaultForm: ReconciliationForm = {
    title: '', reconciliationType: 'manager', accountId: null, fundId: null,
    periodStart: '', periodEnd: '', expectedAmount: 0, actualAmount: 0, notes: '',
  };
  form: ReconciliationForm = { ...this.defaultForm };

  reconciliationTypes = [
    { key: 'manager', label: 'مدير' },
    { key: 'exchange', label: 'صراف' },
    { key: 'accountant', label: 'محاسب' },
    { key: 'supplier', label: 'مورد' },
    { key: 'custody', label: 'عهدة' },
  ];

  protected override onBizIdChange(_bizId: number): void {
    this.load();
  }

  protected override resetForm(): void {
    this.form = { ...this.defaultForm };
  }

  protected override populateForm(r: Reconciliation): void {
    this.form = {
      title: r.title,
      reconciliationType: r.reconciliationType || 'manager',
      accountId: r.accountId ?? null,
      fundId: r.fundId ?? null,
      periodStart: r.periodStart?.split('T')[0] || '',
      periodEnd: r.periodEnd?.split('T')[0] || '',
      expectedAmount: Number(r.expectedAmount || 0),
      actualAmount: Number(r.actualAmount || 0),
      notes: r.notes || '',
    };
  }

  async load() {
    this.loading.set(true);
    try {
      const data = await this.api.getReconciliations(this.bizId);
      this.reconciliations.set(data || []);
    } catch (e) { console.error(e); }
    this.loading.set(false);
  }

  viewDetails(r: Reconciliation) {
    this.viewingItem.set(r);
  }

  async save() {
    if (!this.form.title?.trim()) {
      this.toast.error('يرجى إدخال عنوان المطابقة');
      return;
    }
    this.saving.set(true);
    try {
      const wasEditing = this.editingId();
      if (wasEditing) {
        await this.api.updateReconciliation(this.bizId, wasEditing, this.form);
        this.toast.success('تم تعديل المطابقة بنجاح');
      } else {
        await this.api.createReconciliation(this.bizId, this.form);
        this.toast.success('تم إنشاء المطابقة بنجاح');
      }
      this.closeForm();
      await this.load();
    } catch (e: unknown) {
      this.toast.error(e instanceof Error ? e.message : 'حدث خطأ');
    }
    this.saving.set(false);
  }

  getDifference(r: Reconciliation): number {
    return Number(r.actualAmount || 0) - Number(r.expectedAmount || 0);
  }

  getStatusLabel(status: string | undefined): string {
    if (!status) return '';
    const map: Record<string, string> = {
      open: 'مفتوحة', in_progress: 'قيد التنفيذ',
      completed: 'مكتملة', disputed: 'متنازع عليها',
    };
    return map[status] || status;
  }

  getTypeLabel(type: string | undefined): string {
    if (!type) return '';
    return this.reconciliationTypes.find(t => t.key === type)?.label || type;
  }

  getStatusClass(status: string | undefined): string {
    if (!status) return '';
    const map: Record<string, string> = {
      open: 'status-open', in_progress: 'status-progress',
      completed: 'status-completed', disputed: 'status-disputed',
    };
    return map[status] || '';
  }
}
