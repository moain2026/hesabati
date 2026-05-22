import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService, Business } from '../../services/api.service';
import { PAGE_IMPORTS } from '../../shared/page-imports';

interface BusinessSummary {
  id: number;
  name: string;
  icon: string;
  color: string;
  type: string;
  stations: number;
  employees: number;
  accounts: number;
  funds: number;
  suppliers: number;
  pendingAccounts: number;
  partners: any[];
}

@Component({
  selector: 'app-summary',
  standalone: true,
  imports: [...PAGE_IMPORTS, RouterLink],
  templateUrl: './summary.html',
  styleUrl: './summary.scss',
})
export class SummaryComponent implements OnInit {
  private readonly api = inject(ApiService);

  businesses = signal<BusinessSummary[]>([]);
  loading = signal(true);
  error = signal('');

  // إجماليات كل الأعمال
  totals = signal({
    stations: 0,
    employees: 0,
    accounts: 0,
    funds: 0,
    suppliers: 0,
    pendingAccounts: 0,
  });

  ngOnInit() {
    this.loadAllBusinesses();
  }

  /** لون بطاقة الحسابات المعلقة (danger إن وُجدت، muted إن كانت 0) */
  pendingColor(): 'danger' | 'muted' {
    return this.totals().pendingAccounts > 0 ? 'danger' : 'muted';
  }

  async loadAllBusinesses() {
    try {
      const data: Business[] = await this.api.getBusinesses();
      const summaries: BusinessSummary[] = data.map(b => ({
        id: b.id,
        name: b.name,
        icon: b.icon,
        color: b.color,
        type: b.type,
        stations: b.stats.stations,
        employees: b.stats.employees,
        accounts: b.stats.accounts,
        funds: b.stats.funds,
        suppliers: b.stats.suppliers,
        pendingAccounts: b.stats.pendingAccounts,
        partners: b.partners,
      }));

      this.businesses.set(summaries);

      // حساب الإجماليات
      const totals = summaries.reduce((acc, b) => ({
        stations: acc.stations + b.stations,
        employees: acc.employees + b.employees,
        accounts: acc.accounts + b.accounts,
        funds: acc.funds + b.funds,
        suppliers: acc.suppliers + b.suppliers,
        pendingAccounts: acc.pendingAccounts + b.pendingAccounts,
      }), { stations: 0, employees: 0, accounts: 0, funds: 0, suppliers: 0, pendingAccounts: 0 });

      this.totals.set(totals);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'خطأ في تحميل البيانات');
    } finally {
      this.loading.set(false);
    }
  }

  getTypeLabel(type: string): string {
    switch (type) {
      case 'stations': return 'محطات كهرباء';
      case 'single_station': return 'محطة واحدة';
      case 'personal': return 'شخصي';
      default: return 'عمل';
    }
  }

  getTypeIcon(type: string): string {
    switch (type) {
      case 'stations': return 'bolt';
      case 'single_station': return 'electric_bolt';
      case 'personal': return 'person';
      default: return 'business';
    }
  }
}
