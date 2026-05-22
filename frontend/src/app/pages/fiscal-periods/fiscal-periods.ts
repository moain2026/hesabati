import { Component, inject } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { BasePageComponent } from '../../shared/base-page.component';
import { PAGE_IMPORTS } from '../../shared/page-imports';

@Component({
  selector: 'app-fiscal-periods',
  standalone: true,
  imports: [...PAGE_IMPORTS],
  templateUrl: './fiscal-periods.html',
  styleUrl: './fiscal-periods.scss',
})
export class FiscalPeriodsComponent extends BasePageComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  fiscalYears: any[] = [];
  selectedYear: any = null;
  periods: any[] = [];
  showCreateForm = false;
  newYear = new Date().getFullYear();
  showBulkForm = false;
  bulkStartYear = new Date().getFullYear();
  bulkEndYear = new Date().getFullYear();

  protected onBizIdChange(_bizId: number): void {
    this.load();
  }

  async load() {
    this.fiscalYears = await this.api.getFiscalYears(this.bizId);
    if (this.selectedYear) {
      await this.loadPeriods(this.selectedYear);
    } else if (this.fiscalYears.length > 0) {
      await this.loadPeriods(this.fiscalYears[0]);
    }
  }

  async loadPeriods(fy: any) {
    this.selectedYear = fy;
    this.periods = await this.api.getFiscalPeriods(this.bizId, fy.id);
  }

  /** TabBarItem[] للسنوات المالية */
  get fiscalYearTabs() {
    return this.fiscalYears.map((fy: any) => ({
      value: fy.id as number,
      label: String(fy.year),
      icon: fy.isClosed ? 'lock' : 'calendar_month',
      dimmed: !!fy.isClosed, // مقفلة → عتامة منخفضة، لكن قابلة للنقر
    }));
  }

  /** يُستدعى عند النقر على سنة من شريط tab */
  selectYearTab(yearId: number): void {
    const fy = this.fiscalYears.find((y: any) => y.id === yearId);
    if (fy) void this.loadPeriods(fy);
  }

  get openPeriodsCount() { return this.periods.filter(p => !p.isClosed).length; }
  get closedPeriodsCount() { return this.periods.filter(p => p.isClosed).length; }

  getMonthName(month: number): string {
    const names = ['', 'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    return names[month] || '';
  }

  async createYear() {
    try {
      await this.api.createFiscalYear(this.bizId, { year: this.newYear });
      this.toast.success(`تم إنشاء السنة المالية ${this.newYear}`);
      this.showCreateForm = false;
      this.load();
    } catch (e: any) {
      this.toast.error(e?.error?.error || 'حدث خطأ');
    }
  }

  async createBulkYears() {
    try {
      const res = await this.api.createFiscalYearsBulk(this.bizId, { startYear: this.bulkStartYear, endYear: this.bulkEndYear });
      this.toast.success(`تم إنشاء ${res.created} سنة مالية`);
      this.showBulkForm = false;
      this.load();
    } catch (e: any) {
      this.toast.error(e?.error?.error || 'حدث خطأ');
    }
  }

  async closePeriod(period: any) {
    if (!confirm(`هل تريد إقفال فترة ${this.getMonthName(period.month)} ${this.selectedYear?.year}؟`)) return;
    try {
      await this.api.closeFiscalPeriod(this.bizId, period.id);
      this.toast.success(`تم إقفال فترة ${this.getMonthName(period.month)}`);
      this.loadPeriods(this.selectedYear);
    } catch (e: any) {
      this.toast.error(e?.error?.error || 'حدث خطأ');
    }
  }

  // فتح فترة محاسبية
  async reopenPeriod(period: any) {
    if (!confirm(`هل تريد فتح فترة ${this.getMonthName(period.month)}؟`)) return;
    try {
      await this.api.reopenFiscalPeriod(this.bizId, period.id);
      this.toast.success(`تم فتح فترة ${this.getMonthName(period.month)}`);
      this.loadPeriods(this.selectedYear);
    } catch (e: any) {
      this.toast.error(e?.error?.error || 'فشل فتح الفترة');
    }
  }

  // فتح سنة مالية
  async reopenYear() {
    if (!this.selectedYear) return;
    if (!confirm(`هل تريد فتح السنة المالية ${this.selectedYear.year}؟`)) return;
    try {
      await this.api.reopenFiscalYear(this.bizId, this.selectedYear.id);
      this.toast.success(`تم فتح السنة المالية ${this.selectedYear.year}`);
      this.load();
    } catch (e: any) {
      this.toast.error(e?.error?.error || 'فشل فتح السنة');
    }
  }

  // إعادة تقييم العملات للفترة
  revalLoading = false;
  revalResult: any = null;

  async previewRevaluation(period: any) {
    this.revalLoading = true;
    try {
      this.revalResult = await this.api.previewRevaluation(this.bizId, period.endDate);
    } catch (e: any) {
      this.toast.error(e?.error?.error || 'فشل المعاينة');
    } finally {
      this.revalLoading = false;
    }
  }

  async executeRevaluation(period: any) {
    if (!confirm('هل تريد تنفيذ إعادة التقييم وإنشاء قيود فروقات العملة؟')) return;
    try {
      const result = await this.api.executeRevaluation(this.bizId, period.endDate);
      this.toast.success('تم إعادة التقييم بنجاح');
      this.revalResult = result;
    } catch (e: any) {
      this.toast.error(e?.error?.error || 'فشل إعادة التقييم');
    }
  }

  async closeYear() {
    if (!this.selectedYear) return;
    if (!confirm(`هل تريد إقفال السنة المالية ${this.selectedYear.year}؟ هذا الإجراء لا يمكن التراجع عنه.`)) return;
    try {
      await this.api.closeFiscalYear(this.bizId, this.selectedYear.id);
      this.toast.success(`تم إقفال السنة المالية ${this.selectedYear.year}`);
      this.load();
    } catch (e: any) {
      this.toast.error(e?.error?.error || 'حدث خطأ');
    }
  }
}
