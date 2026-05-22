import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';

export interface TabBarItem<T = unknown> {
  /** قيمة التبويب (تستخدم للمقارنة مع activeValue) */
  value: T;
  /** نص التبويب الظاهر للمستخدم */
  label: string;
  /** أيقونة Material — اختيارية */
  icon?: string;
  /** عدّاد يُعرض كشارة بجانب النص — اختياري */
  count?: number | null;
}

/**
 * مكوّن شريط التبويب الموحّد (Tab Bar)
 *
 * يستبدل النمط المتكرر:
 * ```html
 * <div class="valex-card mb-4">
 *   <div class="valex-card-body py-3">
 *     <div class="flex flex-wrap gap-2 ...">
 *       @for (t of tabs; track t.value) {
 *         <button class="valex-tab-btn" [class.active]="activeFilter() === t.value"
 *                 (click)="activeFilter.set(t.value)">
 *           <span class="material-icons-round">{{ t.icon }}</span>
 *           {{ t.label }}
 *           <span class="valex-badge ...">{{ t.count }}</span>
 *         </button>
 *       }
 *     </div>
 *   </div>
 * </div>
 * ```
 *
 * بسطر واحد:
 * ```html
 * <app-tab-bar [tabs]="getFilterTabs()" [activeValue]="activeFilter()"
 *              (tabChange)="activeFilter.set($event)">
 *   <select>...</select>  <!-- محتوى إضافي اختياري -->
 * </app-tab-bar>
 * ```
 */
@Component({
  selector: 'app-tab-bar',
  standalone: true,
  imports: [],
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
                  (click)="select(t.value)"
                >
                  @if (t.icon) {
                    <span class="material-icons-round" style="font-size:16px">{{ t.icon }}</span>
                  }
                  {{ t.label }}
                  @if (showCount(t.count)) {
                    <span
                      class="valex-badge valex-badge-secondary"
                      style="font-size:10px;min-width:18px;height:18px;padding:0 4px"
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
                (click)="select(t.value)"
              >
                @if (t.icon) {
                  <span class="material-icons-round" style="font-size:16px">{{ t.icon }}</span>
                }
                {{ t.label }}
                @if (showCount(t.count)) {
                  <span
                    class="valex-badge valex-badge-secondary"
                    style="font-size:10px;min-width:18px;height:18px;padding:0 4px"
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

  select(v: T): void {
    this.tabChange.emit(v);
  }

  showCount(c: number | null | undefined): boolean {
    return c !== undefined && c !== null;
  }

  trackByValue(_i: number, item: TabBarItem<T>): unknown {
    return item.value;
  }
}
