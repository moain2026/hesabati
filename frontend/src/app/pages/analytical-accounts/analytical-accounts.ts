import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { BasePageComponent } from '../../shared/base-page.component';
import { PAGE_IMPORTS } from '../../shared/page-imports';

interface AnalyticalAccount {
  id: number;
  name: string;
  code: string;
  ledgerCode: string;
  accountType: string;
  isActive: boolean;
  createdAt: string;
  subNatureName: string | null;
  subNatureKey: string | null;
  subNatureIcon: string | null;
  subNatureColor: string | null;
  currencies: { currencyId: number; currencyCode: string; currencySymbol: string }[];
}

interface SubNature {
  id: number;
  natureKey: string;
  name: string;
  icon: string;
  color: string;
}
interface AddFormData {
  name: string;
  natureKey: string;
}
interface EditFormData {
  name: string;
}

const NATURE_LABELS: Record<string, string> = {
  fund: 'صناديق',
  bank: 'بنوك',
  e_wallet: 'محافظ',
  exchange: 'صرافين',
  supplier: 'موردين',
  employee: 'موظفين',
  partner: 'شركاء',
  warehouse: 'مخازن',
  custody: 'عهد',
  pending: 'معلقة',
  intermediary: 'وسيطة',
  billing: 'فوترة',
};

const NATURE_ICONS: Record<string, string> = {
  fund: 'account_balance_wallet',
  bank: 'account_balance',
  e_wallet: 'wallet',
  exchange: 'currency_exchange',
  supplier: 'store',
  employee: 'badge',
  partner: 'handshake',
  warehouse: 'warehouse',
  custody: 'lock',
  pending: 'pending_actions',
  intermediary: 'swap_horiz',
  billing: 'receipt_long',
};

const NATURE_COLORS: Record<string, string> = {
  fund: '#0284c7',
  bank: '#7c3aed',
  e_wallet: '#0891b2',
  exchange: '#d97706',
  supplier: '#16a34a',
  employee: '#dc2626',
  partner: '#db2777',
  warehouse: '#92400e',
  custody: '#6b21a8',
  pending: '#9ca3af',
  intermediary: '#0369a1',
  billing: '#0f766e',
};

@Component({
  selector: 'app-analytical-accounts',
  standalone: true,
  imports: [...PAGE_IMPORTS, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './analytical-accounts.html',
  styleUrl: './analytical-accounts.scss',
})
export class AnalyticalAccountsComponent extends BasePageComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  loading = signal(true);
  saving = signal(false);
  allAccounts = signal<AnalyticalAccount[]>([]);
  subNatures = signal<SubNature[]>([]);
  filterType = signal('');
  searchQuery = signal('');

  // ===== نموذج الإضافة — Signal Form =====
  showAddModal = signal(false);
  addModel = signal<AddFormData>({ name: '', natureKey: 'fund' });
  addForm = form(this.addModel);

  // ===== نموذج التعديل — Signal Form =====
  showEditModal = signal(false);
  editingAccount = signal<AnalyticalAccount | null>(null);
  editModel = signal<EditFormData>({ name: '' });
  editForm = form(this.editModel);

  // ===== تأكيد الحذف =====
  showDeleteModal = signal(false);
  deletingAccount = signal<AnalyticalAccount | null>(null);

  availableTypes = computed(() => {
    const map = new Map<
      string,
      { key: string; label: string; icon: string; color: string; count: number }
    >();
    for (const acc of this.allAccounts()) {
      const key = acc.subNatureKey || acc.accountType || 'unknown';
      if (!map.has(key)) {
        const sn = this.subNatures().find((s) => s.natureKey === key);
        map.set(key, {
          key,
          label: sn?.name || NATURE_LABELS[key] || key,
          icon: sn?.icon || NATURE_ICONS[key] || 'category',
          color: sn?.color || NATURE_COLORS[key] || '#6b7280',
          count: 0,
        });
      }
      map.get(key)!.count++;
    }
    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  });

  filteredAccounts = computed(() => {
    const type = this.filterType();
    const q = this.searchQuery().toLowerCase().trim();
    return this.allAccounts().filter((acc) => {
      const key = acc.subNatureKey || acc.accountType || 'unknown';
      if (type && key !== type) return false;
      if (q)
        return (
          acc.name.toLowerCase().includes(q) ||
          (acc.ledgerCode || '').toLowerCase().includes(q) ||
          (acc.code || '').toLowerCase().includes(q)
        );
      return true;
    });
  });

  totalCount = computed(() => this.allAccounts().length);

  /** TabBarItem[] - الكل + الأنواع المتاحة مع customColor للأيقونة */
  typeTabs = computed(() => {
    const tabs: { value: string; label: string; icon?: string; count?: number; customColor?: string }[] = [
      { value: '', label: 'الكل', icon: 'grid_view', count: this.totalCount() },
    ];
    for (const t of this.availableTypes()) {
      tabs.push({ value: t.key, label: t.label, icon: t.icon, count: t.count, customColor: t.color });
    }
    return tabs;
  });

  protected override onBizIdChange(_bizId: number): void {
    this.load();
  }

  async load() {
    this.loading.set(true);
    try {
      const data = await this.api.getAnalyticalAccounts(this.bizId);
      this.allAccounts.set(data.accounts || []);
      this.subNatures.set(data.subNatures || []);
    } catch (err: unknown) {
      this.toast.error(err instanceof Error ? err.message : 'فشل تحميل البيانات');
    } finally {
      this.loading.set(false);
    }
  }

  getIcon(acc: AnalyticalAccount): string {
    const key = acc.subNatureKey || acc.accountType;
    return acc.subNatureIcon || NATURE_ICONS[key] || 'category';
  }

  getColor(acc: AnalyticalAccount): string {
    const key = acc.subNatureKey || acc.accountType;
    return acc.subNatureColor || NATURE_COLORS[key] || '#6b7280';
  }

  getTypeName(acc: AnalyticalAccount): string {
    const key = acc.subNatureKey || acc.accountType || '';
    return acc.subNatureName || NATURE_LABELS[key] || key;
  }

  // ===== إضافة =====
  openAdd() {
    this.addModel.set({ name: '', natureKey: 'fund' });
    this.showAddModal.set(true);
  }
  closeAdd() {
    this.showAddModal.set(false);
  }

  async submitAdd() {
    const name = this.addModel().name.trim();
    const natureKey = this.addModel().natureKey;
    if (!name) return;
    this.saving.set(true);
    try {
      await this.api.createAnalyticalAccount(this.bizId, { name, natureKey });
      this.toast.success('تم إنشاء الحساب التحليلي');
      this.closeAdd();
      await this.load();
    } catch (err: unknown) {
      this.toast.error(err instanceof Error ? err.message : 'فشل الإنشاء');
    } finally {
      this.saving.set(false);
    }
  }

  // ===== تعديل =====
  openEdit(acc: AnalyticalAccount) {
    this.editingAccount.set(acc);
    this.editModel.set({ name: acc.name });
    this.showEditModal.set(true);
  }
  closeEdit() {
    this.showEditModal.set(false);
    this.editingAccount.set(null);
  }

  async submitEdit() {
    const acc = this.editingAccount();
    const name = this.editModel().name.trim();
    if (!acc || !name) return;
    this.saving.set(true);
    try {
      await this.api.updateAnalyticalAccount(this.bizId, acc.id, { name });
      this.toast.success('تم تعديل الاسم');
      this.closeEdit();
      await this.load();
    } catch (err: unknown) {
      this.toast.error(err instanceof Error ? err.message : 'فشل التعديل');
    } finally {
      this.saving.set(false);
    }
  }

  // ===== حذف =====
  openDelete(acc: AnalyticalAccount) {
    this.deletingAccount.set(acc);
    this.showDeleteModal.set(true);
  }
  closeDelete() {
    this.showDeleteModal.set(false);
    this.deletingAccount.set(null);
  }

  async submitDelete() {
    const acc = this.deletingAccount();
    if (!acc) return;
    this.saving.set(true);
    try {
      await this.api.deleteAnalyticalAccount(this.bizId, acc.id);
      this.toast.success('تم حذف الحساب');
      this.closeDelete();
      await this.load();
    } catch (err: unknown) {
      this.toast.error(err instanceof Error ? err.message : 'فشل الحذف');
    } finally {
      this.saving.set(false);
    }
  }
}
