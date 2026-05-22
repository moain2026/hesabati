/**
 * ============================================================================
 *  <app-icon> — مكوّن الأيقونة الذكي (Smart Icon Component)
 * ============================================================================
 *  ⚡ يكشف تلقائياً نوع الأيقونة:
 *     - Iconify (يحتوي ":") → <iconify-icon icon="fluent-emoji:bank">
 *     - Material legacy     → <span class="material-icons-round">account_balance</span>
 *
 *  ✅ Zoneless-ready: OnPush + Signals
 *  ✅ Backward-compatible: تعمل مع الأيقونات القديمة بدون تعديل
 *
 *  Usage:
 *    <app-icon icon="fluent-emoji:bank" size="32"></app-icon>
 *    <app-icon icon="account_balance"></app-icon>  ← legacy، يُترجم تلقائياً
 * ============================================================================
 */
import { CUSTOM_ELEMENTS_SCHEMA, ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { normalizeIcon, isIconifyIcon } from './icon-registry';

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    @if (useIconify()) {
      <iconify-icon
        [attr.icon]="iconName()"
        [attr.width]="size()"
        [attr.height]="size()"
        [style.font-size.px]="size()"
        [style.vertical-align]="'middle'"
      ></iconify-icon>
    } @else {
      <span class="material-icons-round" [style.font-size.px]="size()">{{ iconName() }}</span>
    }
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }
    iconify-icon {
      display: inline-block;
    }
  `],
})
export class AppIconComponent {
  /** اسم الأيقونة — يدعم Iconify (fluent-emoji:bank) أو Material legacy (account_balance) */
  readonly icon = input.required<string>();

  /** الحجم بالبيكسل (افتراضي 24) */
  readonly size = input<number | string>(24);

  /** الاسم النهائي بعد التطبيع (auto-mapping من Material → Fluent) */
  readonly iconName = computed(() => normalizeIcon(this.icon()));

  /** هل نستخدم iconify-icon أم الـ material legacy؟ */
  readonly useIconify = computed(() => isIconifyIcon(this.iconName()));
}
