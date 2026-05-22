import { Component, inject, signal } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { BaseCrudPageComponent } from '../../shared/base-crud-page.component';
import { PAGE_IMPORTS } from '../../shared/page-imports';

interface EmployeeForm { fullName: string; accountId: number | null; departmentId: number | null; jobTitleId: number | null; jobTitle: string; stationId: number | null; department: string; salary: number; salaryCurrency: string; phone: string; status: string; notes: string; }

interface Employee {
  id: number; fullName: string;
  accountId?: number | null;
  departmentId?: number | null;
  jobTitleId?: number | null;
  jobTitle?: string;
  stationId?: number | null;
  stationName?: string;
  department?: string;
  salary?: number | string;
  salaryCurrency?: string;
  phone?: string;
  status: string;
  notes?: string;
  code?: string;
  accountLedgerCode?: string;
  sequenceNumber?: string | number;
}

@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [...PAGE_IMPORTS],
  templateUrl: './employees.html',
  styleUrl: './employees.scss',
})
export class EmployeesComponent extends BaseCrudPageComponent<Employee> {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  employees = signal<Employee[]>([]);
  stations = signal<any[]>([]);
  departments = signal<any[]>([]);
  jobTitles = signal<any[]>([]);
  employeeAccounts = signal<any[]>([]);
  filterStation = signal<string>('all');

  accountCurrencies = signal<any[]>([]);
  selectedCurrencyIds = signal<number[]>([]);
  defaultCurrencyId = signal<number | null>(null);

  private readonly defaultForm: EmployeeForm = { fullName: '', accountId: null, departmentId: null, jobTitleId: null, jobTitle: '', stationId: null, department: '', salary: 0, salaryCurrency: 'YER', phone: '', status: 'active', notes: '' };
  form: EmployeeForm = { ...this.defaultForm };

  protected override onBizIdChange(_bizId: number): void {
    this.load();
  }

  protected resetForm(): void {
    this.form = { ...this.defaultForm };
    this.accountCurrencies.set([]);
    this.selectedCurrencyIds.set([]);
    this.defaultCurrencyId.set(null);
  }

  protected populateForm(emp: Employee & { id: number }): void {
    this.form = {
      fullName: emp.fullName,
      accountId: emp.accountId ?? null,
      departmentId: emp.departmentId ?? null,
      jobTitleId: emp.jobTitleId ?? null,
      jobTitle: emp.jobTitle || '',
      stationId: emp.stationId ?? null,
      department: emp.department || '',
      salary: Number(emp.salary || 0),
      salaryCurrency: emp.salaryCurrency || 'YER',
      phone: emp.phone || '',
      status: emp.status,
      notes: emp.notes || '',
    };
    this.accountCurrencies.set([]);
    this.selectedCurrencyIds.set([]);
    this.defaultCurrencyId.set(null);
    if (emp.accountId) {
      this.onAccountChange(emp.accountId).then(() => {
        const matchCurr = this.accountCurrencies().find(
          (c: any) => c.code === emp.salaryCurrency || c.currencyCode === emp.salaryCurrency
        );
        if (matchCurr) this.defaultCurrencyId.set(matchCurr.currencyId);
      });
    }
  }

  override openAdd(): void {
    const defaultAcc = this.employeeAccounts()[0];
    this.resetForm();
    if (defaultAcc?.id) {
      this.form.accountId = defaultAcc.id;
      this.onAccountChange(defaultAcc.id);
    }
    this.editingId.set(null);
    this.showForm.set(true);
    this.scrollToTop();
  }

  async load() {
    this.loading.set(true);
    try {
      const [emps, sts, deps, titles, accs] = await Promise.all([
        this.api.getEmployees(this.bizId),
        this.api.getStations(this.bizId),
        this.api.getDepartments(this.bizId).catch(() => []),
        this.api.getJobTitles(this.bizId).catch(() => []),
        this.api.getAccounts(this.bizId).catch(() => []),
      ]);
      this.employees.set(emps); this.stations.set(sts);
      this.departments.set(deps); this.jobTitles.set(titles);
      this.employeeAccounts.set((accs as any[]).filter((a: any) => a.accountType === 'employee' && a.isLeafAccount === false || a.accountSubNatureKey === 'employee'));
    } catch (e: unknown) {
      console.error(e);
      this.toast.error(e instanceof Error ? e.message : 'حدث خطأ أثناء تحميل بيانات الموظفين');
    }
    this.loading.set(false);
  }

  filteredEmployees() {
    const f = this.filterStation();
    if (f === 'all') return this.employees();
    return this.employees().filter(e => String(e.stationId) === f || (!e.stationId && f === 'admin'));
  }

  totalSalaries() { return this.filteredEmployees().reduce((s, e) => s + Number(e.salary || 0), 0); }

  async save() {
    this.saving.set(true);
    try {
      if (!this.defaultCurrencyId()) {
        this.toast.error('يجب اختيار عملة الراتب');
        return;
      }
      const selectedCurr = this.accountCurrencies().find(c => c.currencyId === this.defaultCurrencyId());
      const salaryCurrency = selectedCurr?.code || selectedCurr?.currencyCode || 'YER';
      const allCurrencyIds = this.accountCurrencies().map((c: any) => c.currencyId);
      const data = {
        ...this.form,
        department: this.getDepartmentName(this.form.departmentId) || this.form.department || null,
        jobTitle: this.getJobTitleName(this.form.jobTitleId) || this.form.jobTitle || null,
        salary: String(this.form.salary),
        salaryCurrency,
        currencyIds: allCurrencyIds,
        defaultCurrencyId: this.defaultCurrencyId(),
      };
      const wasEditing = this.isEditing();
      if (this.editingId()) await this.api.updateEmployee(this.bizId, this.editingId()!, data);
      else await this.api.createEmployee(this.bizId, data);
      this.closeForm();
      this.toast.success(wasEditing ? 'تم تحديث بيانات الموظف بنجاح' : 'تم إضافة الموظف بنجاح');
      await this.load();
    } catch (e: unknown) {
      console.error(e);
      this.toast.error(e instanceof Error ? e.message : 'حدث خطأ أثناء حفظ بيانات الموظف');
    } finally {
      this.saving.set(false);
    }
  }

  async remove(id: number) {
    const confirmed = await this.toast.confirm({ title: 'تأكيد الحذف', message: 'هل أنت متأكد من حذف هذا الموظف؟', type: 'danger' });
    if (confirmed) {
      try {
        await this.api.deleteEmployee(this.bizId, id);
        this.toast.success('تم حذف الموظف بنجاح');
        await this.load();
      } catch (e: unknown) {
        console.error(e);
        this.toast.error(e instanceof Error ? e.message : 'حدث خطأ أثناء حذف الموظف');
      }
    }
  }

  getStatusLabel(s: string | undefined): string { if (!s) return ''; return s === 'active' ? 'نشط' : s === 'suspended' ? 'موقوف' : 'غير نشط'; }
  getStatusClass(s: string | undefined): string { if (!s) return ''; return s === 'active' ? 'active' : 'inactive'; }

  getDepartmentName(id: number | null | undefined): string {
    if (!id) return '';
    return this.departments().find((d: any) => d.id === id)?.name || '';
  }

  getJobTitleName(id: number | null | undefined): string {
    if (!id) return '';
    return this.jobTitles().find((j: any) => j.id === id)?.name || '';
  }

  async onAccountChange(accountId: number) {
    if (accountId) {
      try {
        const currencies = await this.api.getAccountCurrencies(accountId);
        this.accountCurrencies.set(currencies || []);
        const allCurrencyIds = (currencies || []).map((c: any) => c.currencyId);
        this.selectedCurrencyIds.set(allCurrencyIds);
        this.defaultCurrencyId.set(null);
      } catch (e) {
        console.error(e);
        this.accountCurrencies.set([]);
        this.selectedCurrencyIds.set([]);
        this.defaultCurrencyId.set(null);
      }
    } else {
      this.accountCurrencies.set([]);
      this.selectedCurrencyIds.set([]);
      this.defaultCurrencyId.set(null);
    }
  }

  toggleCurrency(currencyId: number) {
    const current = this.selectedCurrencyIds();
    if (current.includes(currencyId)) {
      this.selectedCurrencyIds.set(current.filter(id => id !== currencyId));
      if (this.defaultCurrencyId() === currencyId) this.defaultCurrencyId.set(null);
    } else {
      this.selectedCurrencyIds.set([...current, currencyId]);
    }
  }

  isCurrencySelected(currencyId: number): boolean {
    return this.selectedCurrencyIds().includes(currencyId);
  }

  setDefaultCurrency(currencyId: number) {
    this.defaultCurrencyId.set(currencyId);
  }
}
