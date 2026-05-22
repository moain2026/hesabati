import { Component, inject, signal } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { BaseCrudPageComponent } from '../../shared/base-crud-page.component';
import { PAGE_IMPORTS } from '../../shared/page-imports';

interface PartnerForm { fullName: string; accountId: number | null; sharePercentage: number; phone: string; role: string; notes: string; }
interface Partner {
  id: number; fullName: string; accountId?: number | null; sharePercentage: number | string;
  phone?: string; role?: string; notes?: string; defaultCurrencyId?: number | null;
  isActive?: boolean;
  code?: string;
  accountCode?: string;
  accountLedgerCode?: string;
  accountSequence?: string | number;
  sequenceNumber?: string | number;
  partnerCode?: string;
  partnerSequence?: string | number;
}

@Component({
  selector: 'app-partners',
  standalone: true,
  imports: [...PAGE_IMPORTS],
  templateUrl: './partners.html',
  styleUrl: './partners.scss',
})
export class PartnersComponent extends BaseCrudPageComponent<Partner> {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  business = signal<any>(null);
  partners = signal<Partner[]>([]);
  partnerAccounts = signal<any[]>([]);
  showDeleteConfirm = signal(false);
  deleteTarget = signal<Partner | null>(null);

  accountCurrencies = signal<any[]>([]);
  selectedCurrencyIds = signal<number[]>([]);
  defaultCurrencyId = signal<number | null>(null);

  private readonly defaultForm: PartnerForm = { fullName: '', accountId: null, sharePercentage: 0, phone: '', role: '', notes: '' };
  form: PartnerForm = { ...this.defaultForm };

  protected override onBizIdChange(_bizId: number): void {
    this.load();
  }

  protected override resetForm(): void {
    this.form = { ...this.defaultForm };
    this.accountCurrencies.set([]);
    this.selectedCurrencyIds.set([]);
    this.defaultCurrencyId.set(null);
  }

  protected override populateForm(p: Partner): void {
    this.form = {
      fullName: p.fullName,
      accountId: p.accountId ?? null,
      sharePercentage: Number(p.sharePercentage),
      phone: p.phone || '',
      role: p.role || '',
      notes: p.notes || '',
    };
    this.accountCurrencies.set([]);
    this.selectedCurrencyIds.set([]);
    this.defaultCurrencyId.set(null);
    if (p.accountId) {
      this.onAccountChange(p.accountId).then(() => {
        const allIds = this.accountCurrencies().map((c: any) => c.currencyId);
        this.selectedCurrencyIds.set(allIds);
        if (p.defaultCurrencyId) this.defaultCurrencyId.set(p.defaultCurrencyId);
      });
    }
  }

  /** override لاختيار حساب افتراضي بعد فتح نموذج الإضافة */
  override openAdd(): void {
    super.openAdd();
    const defaultAcc = this.partnerAccounts()[0];
    if (defaultAcc?.id) {
      this.form.accountId = defaultAcc.id;
      this.onAccountChange(defaultAcc.id);
    }
  }

  async load() {
    this.loading.set(true);
    try {
      const [biz, partners, accs] = await Promise.all([
        this.api.getBusiness(this.bizId),
        this.api.getPartners(this.bizId),
        this.api.getAccounts(this.bizId).catch(() => []),
      ]);
      this.business.set(biz);
      this.partners.set(partners);
      this.partnerAccounts.set((accs as any[]).filter((a: any) => a.accountType === 'partner' && a.isLeafAccount === false));
    } catch (e) { console.error(e); }
    this.loading.set(false);
  }

  totalShares() {
    return this.partners().reduce((s, p) => s + Number(p.sharePercentage || 0), 0);
  }

  async save() {
    this.saving.set(true);
    try {
      const data = {
        ...this.form,
        sharePercentage: String(this.form.sharePercentage),
        businessId: this.bizId,
        currencyIds: this.selectedCurrencyIds(),
        defaultCurrencyId: this.defaultCurrencyId(),
      };
      const wasEditing = this.editingId();
      if (wasEditing) {
        await this.api.updatePartner(wasEditing, data);
      } else {
        await this.api.createPartner(this.bizId, data);
      }
      this.closeForm();
      this.toast.success(wasEditing ? 'تم تحديث الشريك بنجاح' : 'تم إضافة الشريك بنجاح');
      await this.load();
    } catch (e: unknown) {
      console.error(e);
      this.toast.error(e instanceof Error ? e.message : 'حدث خطأ أثناء حفظ الشريك');
    }
    this.saving.set(false);
  }

  confirmDelete(p: Partner) {
    this.deleteTarget.set(p);
    this.showDeleteConfirm.set(true);
  }

  async executeDelete() {
    const t = this.deleteTarget();
    if (!t) return;
    try {
      await this.api.deletePartner(t.id);
      this.showDeleteConfirm.set(false);
      this.deleteTarget.set(null);
      this.toast.success('تم حذف الشريك بنجاح');
      await this.load();
    } catch (e: unknown) {
      console.error(e);
      this.toast.error(e instanceof Error ? e.message : 'حدث خطأ أثناء الحذف');
    }
  }

  getShareColor(pct: number): string {
    if (pct >= 50) return '#f59e0b';
    if (pct >= 25) return '#3b82f6';
    return '#22c55e';
  }

  async onAccountChange(accountId: number) {
    if (accountId) {
      try {
        const currencies = await this.api.getAccountCurrencies(accountId);
        this.accountCurrencies.set(currencies || []);
        const allIds = (currencies || []).map((c: any) => c.currencyId);
        this.selectedCurrencyIds.set(allIds);
        this.defaultCurrencyId.set(allIds[0] || null);
      } catch (e) {
        console.error(e);
        this.accountCurrencies.set([]);
      }
    } else {
      this.accountCurrencies.set([]);
      this.selectedCurrencyIds.set([]);
      this.defaultCurrencyId.set(null);
    }
  }

  toggleCurrency(currencyId: number) {
    const ids = [...this.selectedCurrencyIds()];
    const idx = ids.indexOf(currencyId);
    if (idx >= 0) {
      ids.splice(idx, 1);
      if (this.defaultCurrencyId() === currencyId) this.defaultCurrencyId.set(ids[0] || null);
    } else {
      ids.push(currencyId);
    }
    this.selectedCurrencyIds.set(ids);
  }

  setDefaultCurrency(currencyId: number) {
    this.defaultCurrencyId.set(currencyId);
    if (!this.selectedCurrencyIds().includes(currencyId)) {
      this.selectedCurrencyIds.update(ids => [...ids, currencyId]);
    }
  }
}
