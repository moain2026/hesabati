import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { AppIconComponent } from '../../icons/app-icon.component';

export interface TabBarItem<T = unknown> {
  /** قيمة التبويب (تستخدم للمقارنة مع activeValue) */
  value: T;
  /** نص التبويب الظاهر للمستخدم */
  label: string;
  /** أيقونة Material — اختيارية */
  icon?: string;
  /** عدّاد يُعرض كشارة بجانب النص — اختياري */
  count?: number | null;
  /** تعطيل التبويب (يُعرض بشفافية ولا يستجيب للنقر) */
  disabled?: boolean;
  /** تخفيف العتامة بصرياً (مثل سنة مالية مقفلة) — يبقى قابلاً للنقر */
  dimmed?: boolean;
  /** لون نص ديناميكي للأيقونة/الشارة (يُمرَّر مباشرة كـ CSS color) */
  customColor?: string | null;
  /** لون خلفية ديناميكي للشارة */
  customBgColor?: string | null;
}

/**
 * مكوّن شريط التبويب الموحّد (Tab Bar)
 *
 * يستبدل النمط المتكرر `valex-tab-btn` في 24+ صفحة.
 *
 * بسطر واحد:
 * ```html
 * <app-tab-bar [tabs]="filterTabs()" [activeValue]="activeFilter()"
 *              (tabChange)="activeFilter.set($event)">
 *   <select>...</select>  <!-- محتوى إضافي اختياري -->
 * </app-tab-bar>
 * ```
 *
 * يدعم:
 * - icons + count badges
 * - disabled state
 * - customColor / customBgColor لحالات ديناميكية (مثل alerts على الفواتير)
 * - wrapInCard=false لدمج مع عناصر أخرى في نفس البطاقة
 */
@Component({
  selector: 'app-tab-bar',
  imports: [AppIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (wrapInCard) {
      <div class="valex-card mb-4">
        <div class="valex-card-body py-3">
          <div class="flex flex-wrap gap-2 items-center justify-between">
            <div class="flex flex-wrap gap-2">
              @for (t of tabs; track trackByValue($index, t)) {
                <button
                  type="button"
                  class="valex-tab-btn"
                  [class.active]="isActive(t.value)"
                  [class.opacity-60]="t.disabled || t.dimmed"
                  [disabled]="t.disabled"
                  (click)="select(t)"
                >
                  @if (t.icon) {
                    <app-icon [icon]="t.icon" [size]="16"></app-icon>
                  }
                  {{ t.label }}
                  @if (showCount(t.count)) {
                    <span
                      class="valex-badge valex-badge-secondary"
                      style="font-size:10px;min-width:18px;height:18px;padding:0 4px"
                      [style.color]="t.customColor || null"
                      [style.background-color]="t.customBgColor || null"
                    >{{ t.count }}</span>
                  }
                </button>
              }
            </div>
            <ng-content />
          </div>
        </div>
      </div>
    } @else {
      <div class="mb-4">
        <div class="flex flex-wrap gap-2 items-center justify-between">
          <div class="flex flex-wrap gap-2">
            @for (t of tabs; track trackByValue($index, t)) {
              <button
                type="button"
                class="valex-tab-btn"
                [class.active]="isActive(t.value)"
                [class.opacity-60]="t.disabled || t.dimmed"
                [disabled]="t.disabled"
                (click)="select(t)"
              >
                @if (t.icon) {
                  <app-icon [icon]="t.icon" [size]="16"></app-icon>
                }
                {{ t.label }}
                @if (showCount(t.count)) {
                  <span
                    class="valex-badge valex-badge-secondary"
                    style="font-size:10px;min-width:18px;height:18px;padding:0 4px"
                    [style.color]="t.customColor || null"
                    [style.background-color]="t.customBgColor || null"
                  >{{ t.count }}</span>
                }
              </button>
            }
          </div>
          <ng-content />
        </div>
      </div>
    }
  `,
})
export class TabBarComponent<T = unknown> {
  @Input() tabs: TabBarItem<T>[] = [];
  @Input() activeValue: T | null = null;
  /** هل يُلَفّ الشريط داخل valex-card (افتراضي: true) */
  @Input() wrapInCard = true;

  @Output() tabChange = new EventEmitter<T>();

  isActive(v: T): boolean {
    return this.activeValue === v;
  }

  select(t: TabBarItem<T>): void {
    if (t.disabled) return;
    this.tabChange.emit(t.value);
  }

  showCount(c: number | null | undefined): boolean {
    return c !== undefined && c !== null;
  }

  trackByValue(_i: number, item: TabBarItem<T>): unknown {
    return item.value;
  }
}
