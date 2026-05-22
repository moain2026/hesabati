import { Component, inject, signal } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { CssBackgroundComponent } from '../../shared/components/css-background/css-background.component';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { SummaryCardComponent } from '../../shared/components/summary-card/summary-card.component';
import { NgApexchartsModule } from 'ng-apexcharts';
import { BasePageComponent } from '../../shared/base-page.component';

export interface ChartDataItem {
  label: string;
  value: number;
  color?: string;
}
export interface ChartClickEvent {
  item: ChartDataItem;
  index: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CssBackgroundComponent, StatCardComponent, NgApexchartsModule, SummaryCardComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardComponent extends BasePageComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  stations = signal<any[]>([]);
  employees = signal<any[]>([]);
  accounts = signal<any[]>([]);
  funds = signal<any[]>([]);
  suppliers = signal<any[]>([]);
  pendingAccounts = signal<any[]>([]);
  partners = signal<any[]>([]);
  warehouses = signal<any[]>([]);
  loading = signal(true);
  totalSalaries = signal(0);
  loadError = signal('');
  // ملخص مالي
  totalReceipts = signal(0);
  totalPayments = signal(0);
  operationsCount = signal(0);
  netBalance = signal(0);
  chartData = signal<ChartDataItem[]>([]);
  waterfallData = signal<ChartDataItem[]>([]);
  treemapData = signal<ChartDataItem[]>([]);
  gaugeValue = signal(0);
  gaugeMax = signal(100);

  // وضع العرض التقديمي
  presentationMode = signal(false);

  protected onBizIdChange(_bizId: number): void {
    this.loadData();
  }

  async loadData() {
    this.loading.set(true);
    this.loadError.set('');
    try {
      const results = await Promise.allSettled([
        this.api.getStations(this.bizId),
        this.api.getEmployees(this.bizId),
        this.api.getAccounts(this.bizId),
        this.api.getFunds(this.bizId),
        this.api.getSuppliers(this.bizId),
        this.api.getPendingAccounts(this.bizId),
        this.api.getBusiness(this.bizId),
        this.api.getWarehouses(this.bizId),
      ]);

      const getValue = (result: PromiseSettledResult<any>, fallback: any = []) => {
        return result.status === 'fulfilled' ? result.value : fallback;
      };

      this.stations.set(getValue(results[0], []));
      this.employees.set(getValue(results[1], []));
      this.accounts.set(getValue(results[2], []));
      this.funds.set(getValue(results[3], []));
      this.suppliers.set(getValue(results[4], []));
      this.pendingAccounts.set(getValue(results[5], []));
      this.warehouses.set(getValue(results[7], []));

      const bizData = getValue(results[6], {});
      if (bizData?.partners) this.partners.set(bizData.partners);

      const emps = getValue(results[1], []);
      this.totalSalaries.set(emps.reduce((sum: number, e: any) => sum + Number(e.salary || 0), 0));

      this.buildChartData();
      this.buildWaterfallData();
      this.buildTreemapData();
      this.buildGaugeData();

      // جلب الملخص المالي
      try {
        const stats = await this.api.getWidgetStatsEnhanced(this.bizId);
        this.totalReceipts.set(stats.totalReceipts || 0);
        this.totalPayments.set(stats.totalPayments || 0);
        this.operationsCount.set(stats.operationsCount || 0);
        this.netBalance.set(stats.netBalance || 0);
      } catch (e) {
        /* ignore */
      }

      const failedCount = results.filter((r) => r.status === 'rejected').length;
      if (failedCount > 0 && failedCount < results.length) {
        this.loadError.set(`تم تحميل البيانات جزئياً (${failedCount} طلب فشل)`);
      } else if (failedCount === results.length) {
        this.loadError.set('فشل تحميل جميع البيانات — تأكد من اتصال الخادم');
      }
    } catch (e: any) {
      console.error('خطأ في تحميل بيانات لوحة التحكم:', e);
      this.loadError.set(e?.message || 'حدث خطأ غير متوقع أثناء تحميل البيانات');
    } finally {
      this.loading.set(false);
    }
  }

  navigate(path: string) {
    this.router.navigate([`/biz/${this.bizId}/${path}`]);
  }

  formatNumber(n: number): string {
    return new Intl.NumberFormat('ar-YE').format(n);
  }

  getAccountTypeLabel(type: string): string {
    const map: Record<string, string> = {
      e_wallet: 'محفظة إلكترونية',
      bank: 'بنك',
      exchange: 'صراف',
      custody: 'عهدة',
      warehouse: 'مخزن',
      fund: 'صندوق',
      billing: 'فوترة',
      accounting: 'أخرى',
      budget: 'ميزانية',
      supplier: 'مورد',
      employee: 'موظف',
      partner: 'شريك',
      settlement: 'تسوية',
      pending: 'معلّق',
    };
    return map[type] || type;
  }

  getFundTypeLabel(type: string): string {
    const map: Record<string, string> = {
      collection: 'تحصيل',
      salary_advance: 'سلف',
      custody: 'عهدة',
      safe: 'خزنة',
      expense: 'خرج',
      deposit: 'توريدات',
    };
    return map[type] || type;
  }

  getWarehouseTypeLabel(type: string): string {
    const map: Record<string, string> = {
      main: 'رئيسي',
      station: 'محطة',
      sub: 'فرعي',
    };
    return map[type] || type;
  }

  retry() {
    this.loadData();
  }

  /** معالجة النقر على عنصر في الرسم البياني */
  onChartClick(event: ChartClickEvent) {
    const labelToRoute: Record<string, string> = {
      محطات: 'stations',
      موظفون: 'employees',
      حسابات: 'accounts',
      صناديق: 'funds',
      موردون: 'suppliers',
      مخازن: 'warehouse',
    };
    const route = labelToRoute[event.item.label];
    if (route) this.navigate(route);
  }

  /** تبديل وضع العرض التقديمي */
  togglePresentation() {
    this.presentationMode.update((v) => !v);
  }

  private buildChartData(): void {
    const items: ChartDataItem[] = [];
    const stCount = this.stations().length;
    const empCount = this.employees().length;
    const accCount = this.accounts().length;
    const fundCount = this.funds().length;
    const supCount = this.suppliers().length;
    const whCount = this.warehouses().length;

    if (stCount > 0) items.push({ label: 'محطات', value: stCount, color: '#6366f1' });
    if (empCount > 0) items.push({ label: 'موظفون', value: empCount, color: '#06b6d4' });
    if (accCount > 0) items.push({ label: 'حسابات', value: accCount, color: '#10b981' });
    if (fundCount > 0) items.push({ label: 'صناديق', value: fundCount, color: '#f59e0b' });
    if (supCount > 0) items.push({ label: 'موردون', value: supCount, color: '#ef4444' });
    if (whCount > 0) items.push({ label: 'مخازن', value: whCount, color: '#8b5cf6' });

    this.chartData.set(items);
  }

  /** بناء بيانات Waterfall - تدفق الأصول */
  private buildWaterfallData(): void {
    const items: ChartDataItem[] = [];
    const stCount = this.stations().length;
    const empCount = this.employees().length;
    const fundCount = this.funds().length;
    const supCount = this.suppliers().length;

    if (stCount > 0) items.push({ label: 'محطات', value: stCount, color: '#10b981' });
    if (empCount > 0) items.push({ label: 'موظفون', value: -empCount, color: '#ef4444' });
    if (fundCount > 0) items.push({ label: 'صناديق', value: fundCount, color: '#10b981' });
    if (supCount > 0) items.push({ label: 'موردون', value: -supCount, color: '#ef4444' });

    this.waterfallData.set(items);
  }

  /** بناء بيانات Treemap - توزيع الأصول */
  private buildTreemapData(): void {
    const items: ChartDataItem[] = [];
    const stCount = this.stations().length;
    const empCount = this.employees().length;
    const accCount = this.accounts().length;
    const fundCount = this.funds().length;
    const supCount = this.suppliers().length;
    const whCount = this.warehouses().length;

    if (stCount > 0) items.push({ label: 'محطات', value: stCount * 3, color: '#6366f1' });
    if (empCount > 0) items.push({ label: 'موظفون', value: empCount * 2, color: '#06b6d4' });
    if (accCount > 0) items.push({ label: 'حسابات', value: accCount * 2, color: '#10b981' });
    if (fundCount > 0) items.push({ label: 'صناديق', value: fundCount * 4, color: '#f59e0b' });
    if (supCount > 0) items.push({ label: 'موردون', value: supCount * 2, color: '#ef4444' });
    if (whCount > 0) items.push({ label: 'مخازن', value: whCount * 3, color: '#8b5cf6' });

    this.treemapData.set(items);
  }

  /** بناء بيانات Gauge - نسبة الاكتمال */
  private buildGaugeData(): void {
    const totalAssets =
      this.stations().length +
      this.employees().length +
      this.accounts().length +
      this.funds().length +
      this.suppliers().length +
      this.warehouses().length;
    this.gaugeValue.set(totalAssets);
    this.gaugeMax.set(Math.max(totalAssets * 1.5, 20));
  }
}
