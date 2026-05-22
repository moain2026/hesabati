import { Component, inject } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { BasePageComponent } from '../../shared/base-page.component';
import { PAGE_IMPORTS } from '../../shared/page-imports';

interface RateForm { fromCurrencyId: string; toCurrencyId: string; rate: string; effectiveDate: string; source: string; notes: string; }
interface CurrencyForm { code: string; nameAr: string; symbol: string; exchangeRate: string; minRate: string; maxRate: string; isDefault: boolean; }

@Component({
  selector: 'app-exchange-rates',
  standalone: true,
  imports: [...PAGE_IMPORTS],
  templateUrl: './exchange-rates.html',
  styleUrl: './exchange-rates.scss',
})
export class ExchangeRatesComponent extends BasePageComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  // بيانات
  rates: any[] = [];
  currencies: any[] = [];
  activeTab: 'currencies' | 'rates' | 'converter' | 'revaluation' = 'currencies';
  readonly tabBarItems = [
    { value: 'currencies'  as const, label: 'العملات',        icon: 'paid' },
    { value: 'rates'       as const, label: 'أسعار الصرف',   icon: 'currency_exchange' },
    { value: 'converter'   as const, label: 'محول العملات',  icon: 'swap_horiz' },
    { value: 'revaluation' as const, label: 'إعادة التقييم', icon: 'assessment' },
  ];
  exchangeDiffAccount: { exists: boolean; accountId?: number } = { exists: false };

  // نموذج سعر الصرف
  showRateForm = false;
  rateEditId: number | null = null;
  rateForm: any = { fromCurrencyId: '', toCurrencyId: '', rate: '', effectiveDate: new Date().toISOString().split('T')[0], source: 'manual', notes: '' };

  // نموذج العملة
  showCurrencyForm = false;
  currencyEditId: number | null = null;
  currencyForm: any = { code: '', nameAr: '', symbol: '', exchangeRate: '1', minRate: '', maxRate: '', isDefault: false };

  // محول العملات
  convertFrom = ''; convertTo = ''; convertAmount = 1000; convertResult: number | null = null;

  // إعادة التقييم
  revalPreview: any = null;
  revalLoading = false;
  revalDate = new Date().toISOString().split('T')[0];
  revalExecuted = false;

  protected onBizIdChange(_bizId: number): void {
    this.load();
  }

  async load() {
    this.currencies = await this.api.getAllCurrencies();
    this.rates = await this.api.getExchangeRates(this.bizId);
    this.exchangeDiffAccount = await this.api.getExchangeDiffAccount(this.bizId);
  }

  get activeCurrencies() { return this.currencies.filter(c => c.isActive !== false); }
  get inactiveCurrencies() { return this.currencies.filter(c => c.isActive === false); }
  get defaultCurrency() { return this.currencies.find(c => c.isDefault); }

  getSourceCount(source: string): number {
    return this.rates.filter(r => r.source === source).length;
  }

  getCurrencyName(id: number): string {
    const c = this.currencies.find(c => c.id === id);
    return c ? (c.nameAr || c.code) : String(id);
  }

  // ===== عملات =====
  openCurrencyForm(currency?: any) {
    if (currency) {
      this.currencyEditId = currency.id;
      this.currencyForm = {
        code: currency.code, nameAr: currency.nameAr, symbol: currency.symbol,
        exchangeRate: currency.exchangeRate, minRate: currency.minRate || '',
        maxRate: currency.maxRate || '', isDefault: currency.isDefault,
      };
    } else {
      this.currencyEditId = null;
      this.currencyForm = { code: '', nameAr: '', symbol: '', exchangeRate: '1', minRate: '', maxRate: '', isDefault: false };
    }
    this.showCurrencyForm = true;
  }

  async saveCurrency() {
    try {
      const data = { ...this.currencyForm };
      if (!data.minRate) delete data.minRate;
      if (!data.maxRate) delete data.maxRate;
      if (this.currencyEditId) {
        await this.api.updateCurrency(this.currencyEditId, data);
      } else {
        await this.api.createCurrency(data);
      }
      this.toast.success('تم الحفظ بنجاح');
      this.showCurrencyForm = false;
      this.load();
    } catch (e: any) {
      this.toast.error(e?.error?.error || 'حدث خطأ');
    }
  }

  async removeCurrency(id: number) {
    if (confirm('هل تريد تعطيل هذه العملة؟')) {
      await this.api.deleteCurrency(id);
      this.toast.success('تم تعطيل العملة');
      this.load();
    }
  }

  async reactivateCurrency(id: number) {
    await this.api.updateCurrency(id, { isActive: true });
    this.toast.success('تم تفعيل العملة');
    this.load();
  }

  // ===== أسعار الصرف =====
  openRateForm(rate?: any) {
    if (rate) {
      this.rateEditId = rate.id;
      this.rateForm = { fromCurrencyId: rate.fromCurrencyId, toCurrencyId: rate.toCurrencyId, rate: rate.rate, effectiveDate: rate.effectiveDate, source: rate.source, notes: rate.notes || '' };
    } else {
      this.rateEditId = null;
      this.rateForm = { fromCurrencyId: '', toCurrencyId: '', rate: '', effectiveDate: new Date().toISOString().split('T')[0], source: 'manual', notes: '' };
    }
    this.showRateForm = true;
  }

  async saveRate() {
    try {
      const data = { ...this.rateForm, fromCurrencyId: Number(this.rateForm.fromCurrencyId), toCurrencyId: Number(this.rateForm.toCurrencyId), rate: String(this.rateForm.rate) };
      if (this.rateEditId) { await this.api.updateExchangeRate(this.bizId, this.rateEditId, data); }
      else { await this.api.createExchangeRate(this.bizId, data); }
      this.toast.success('تم الحفظ بنجاح');
      this.showRateForm = false;
      this.rateEditId = null;
      this.load();
    } catch (e: any) {
      this.toast.error(e?.error?.error || 'حدث خطأ');
    }
  }

  async removeRate(id: number) {
    if (confirm('حذف سعر الصرف؟')) {
      await this.api.deleteExchangeRate(this.bizId, id);
      this.toast.success('تم الحذف');
      this.load();
    }
  }

  // ===== محول العملات =====
  async convert() {
    try {
      const res = await this.api.convertCurrency(this.bizId, Number(this.convertFrom), Number(this.convertTo), this.convertAmount);
      this.convertResult = res.convertedAmount;
    } catch {
      this.convertResult = null;
      this.toast.error('لا يوجد سعر صرف بين هاتين العملتين');
    }
  }

  // ===== إعادة التقييم =====
  async loadRevalPreview() {
    this.revalLoading = true;
    this.revalExecuted = false;
    try {
      this.revalPreview = await this.api.previewRevaluation(this.bizId, this.revalDate);
    } catch (e: any) {
      this.toast.error(e?.message || 'فشل تحميل المعاينة');
      this.revalPreview = null;
    }
    this.revalLoading = false;
  }

  async executeReval() {
    const confirmed = confirm('هل تريد تنفيذ إعادة التقييم؟ سيتم إنشاء قيد محاسبي تلقائي.');
    if (!confirmed) return;
    this.revalLoading = true;
    try {
      this.revalPreview = await this.api.executeRevaluation(this.bizId, this.revalDate);
      this.revalExecuted = true;
      this.toast.success('تم تنفيذ إعادة التقييم بنجاح');
    } catch (e: any) {
      this.toast.error(e?.message || 'فشل تنفيذ إعادة التقييم');
    }
    this.revalLoading = false;
  }
}
