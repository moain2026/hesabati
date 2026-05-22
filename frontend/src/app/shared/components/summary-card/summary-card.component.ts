import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { AppIconComponent } from '../../icons/app-icon.component';

/**
 * بطاقة ملخص خفيفة — تصميم Valex الموحد
 *
 * البديل المُوحَّد عن النمط المتكرر:
 * ```html
 * <div class="valex-card p-4 flex items-center gap-4">
 *   <div class="w-12 h-12 rounded-xl flex items-center justify-center bg-primary/10 text-primary">
 *     <span class="material-icons-round text-2xl">icon</span>
 *   </div>
 *   <div>
 *     <div class="text-2xl font-bold">{{ value }}</div>
 *     <div class="text-sm text-muted">{{ label }}</div>
 *   </div>
 * </div>
 * ```
 *
 * الاستخدام:
 * ```html
 * <app-summary-card
 *   icon="groups"
 *   color="warning"
 *   [value]="partners().length"
 *   label="شريك" />
 *
 * <app-summary-card
 *   icon="pie_chart"
 *   color="primary"
 *   [value]="totalShares()"
 *   valueFormat="percent"
 *   label="إجمالي الحصص" />
 * ```
 *
 * الألوان المدعومة: primary | success | warning | danger | info | secondary | accent
 * أنماط القيمة: number | percent | currency | text
 */
@Component({
  selector: 'app-summary-card',
  imports: [DecimalPipe, AppIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="valex-card p-4 flex items-center" [class.gap-3]="iconSize === 'sm'" [class.gap-4]="iconSize !== 'sm'">
      <div
        class="rounded-xl flex items-center justify-center flex-shrink-0"
        [class.w-10]="iconSize === 'sm'"
        [class.h-10]="iconSize === 'sm'"
        [class.w-12]="iconSize !== 'sm'"
        [class.h-12]="iconSize !== 'sm'"
        [class]="iconBgClass()"
        [style.background]="customColor ? customColor + '1f' : null"
        [style.color]="customColor || null"
      >
        <app-icon [icon]="icon" [size]="iconSize === 'sm' ? 22 : 28"></app-icon>
      </div>
      <div class="min-w-0 flex-1">
        <div
          class="font-bold truncate"
          [class.text-2xl]="valueSize === 'lg'"
          [class.text-xl]="valueSize === 'md'"
          [class.text-base]="valueSize === 'sm'"
        >
          @if (valueFormat === 'percent') {
            {{ asNumber(value) | number: '1.0-2' }}%
          } @else if (valueFormat === 'number') {
            {{ asNumber(value) | number: '1.0-0' }}
          } @else if (valueFormat === 'currency') {
            {{ asNumber(value) | number: '1.0-2' }} <span class="text-xs text-muted">{{ currency }}</span>
          } @else {
            {{ value || '-' }}
          }
        </div>
        <div class="truncate" [class.text-xs]="labelSize === 'sm'" [class.text-sm]="labelSize !== 'sm'" [class]="labelColorClass()">{{ label }}</div>
        @if (subtext) {
          <div class="text-xs font-mono truncate" [class]="subtextClass()">{{ subtext }}</div>
        }
      </div>
    </div>
  `,
})
export class SummaryCardComponent {
  /** اسم أيقونة Material Icons */
  @Input() icon = 'analytics';

  /** لون مُعرَّف مسبقاً (يُستخدم Tailwind classes) */
  @Input() color: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'secondary' | 'accent' | 'muted' = 'primary';

  /** لون مخصص hex/rgb (يتجاوز color إن وُجد) */
  @Input() customColor: string | null = null;

  /** القيمة المعروضة (رقم أو نص) */
  @Input() value: number | string | null | undefined = 0;

  /** نص التسمية تحت القيمة */
  @Input() label = '';

  /** صيغة عرض القيمة */
  @Input() valueFormat: 'number' | 'percent' | 'currency' | 'text' = 'number';

  /** حجم القيمة المعروضة */
  @Input() valueSize: 'lg' | 'md' | 'sm' = 'lg';

  /** حجم الأيقونة (lg=w-12, sm=w-10) */
  @Input() iconSize: 'lg' | 'sm' = 'lg';

  /** حجم الـlabel */
  @Input() labelSize: 'sm' | 'md' = 'md';

  /** لون نص الـlabel (افتراضي: muted) */
  @Input() labelColor: 'muted' | 'primary' | 'success' | 'warning' | 'danger' | 'info' = 'muted';

  /** عملة للعرض إذا valueFormat='currency' */
  @Input() currency = '';

  /** نص إضافي تحت الـlabel (مثل المبلغ الإجمالي) */
  @Input() subtext: string | null = null;

  /** لون الـsubtext (يطابق لون البطاقة افتراضياً) */
  @Input() subtextColor: 'inherit' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'muted' = 'inherit';

  subtextClass(): string {
    const c = this.subtextColor === 'inherit' ? this.color : this.subtextColor;
    const map: Record<string, string> = {
      primary: 'text-primary',
      success: 'text-success',
      warning: 'text-warning',
      danger: 'text-danger',
      info: 'text-info',
      muted: 'text-muted',
      secondary: 'text-secondary',
      accent: 'text-accent',
    };
    return map[c] || 'text-muted';
  }

  iconBgClass(): string {
    if (this.customColor) return '';
    const map: Record<string, string> = {
      primary: 'bg-primary/10 text-primary',
      success: 'bg-success/10 text-success',
      warning: 'bg-warning/10 text-warning',
      danger: 'bg-danger/10 text-danger',
      info: 'bg-info/10 text-info',
      secondary: 'bg-secondary/10 text-secondary',
      accent: 'bg-accent/10 text-accent',
      muted: 'bg-muted/10 text-muted',
    };
    return map[this.color] || map['primary'];
  }

  labelColorClass(): string {
    const map: Record<string, string> = {
      muted: 'text-muted',
      primary: 'text-primary',
      success: 'text-success',
      warning: 'text-warning',
      danger: 'text-danger',
      info: 'text-info',
    };
    return map[this.labelColor] || 'text-muted';
  }

  asNumber(v: number | string | null | undefined): number {
    if (v === null || v === undefined) return 0;
    const n = typeof v === 'string' ? parseFloat(v) : v;
    return isNaN(n) ? 0 : n;
  }
}
