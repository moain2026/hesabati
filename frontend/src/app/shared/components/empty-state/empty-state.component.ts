import { Component, input, output } from '@angular/core';
import { AppIconComponent } from '../../icons/app-icon.component';

/**
 * مكوّن الحالة الفارغة — تصميم Valex
 * الاستخدام: <app-empty-state icon="inbox" title="لا توجد بيانات" (addClick)="openForm()" />
 */
@Component({
  selector: 'app-empty-state',
  imports: [AppIconComponent],
  template: `
    <div class="valex-empty-state">
      <div class="empty-icon-wrap">
        <app-icon [icon]="icon()" [size]="48"></app-icon>
      </div>
      <h3 class="empty-title">{{ title() }}</h3>
      @if (subtitle()) {
        <p class="empty-subtitle">{{ subtitle() }}</p>
      }
      @if (actionLabel()) {
        <button class="valex-btn valex-btn-primary mt-3" (click)="addClick.emit()">
          <app-icon icon="fluent-emoji:plus" [size]="16"></app-icon>
          {{ actionLabel() }}
        </button>
      }
    </div>
  `,
  styles: [`
    :host { display: contents; }
    .valex-empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem 1.5rem;
      text-align: center;
      gap: 0.5rem;
    }
    .empty-icon-wrap {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background-color: rgba(var(--color-primaryrgb), 0.08);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 0.75rem;
    }
    .empty-icon {
      font-size: 2.5rem;
      color: var(--color-textmuted);
    }
    .empty-title {
      font-size: 1rem;
      font-weight: 600;
      color: var(--color-defaulttextcolor);
      margin: 0;
      font-family: var(--font-primary);
    }
    .empty-subtitle {
      font-size: 0.875rem;
      color: var(--color-textmuted);
      margin: 0.25rem 0 0;
      max-width: 320px;
      font-family: var(--font-primary);
    }
    .mt-3 { margin-top: 1rem; }
  `],
})
export class EmptyStateComponent {
  icon        = input<string>('inbox');
  title       = input<string>('لا توجد بيانات');
  subtitle    = input<string>('');
  actionLabel = input<string>('');
  addClick    = output<void>();
}
