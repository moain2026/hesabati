import { DecimalPipe, DatePipe, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LoadingStateComponent } from './components/loading-state/loading-state.component';
import { EmptyStateComponent } from './components/empty-state/empty-state.component';
import { StatusBadgeComponent } from './components/status-badge/status-badge.component';
import { PageHeaderComponent } from './components/page-header/page-header';
import { DataTableComponent } from './components/data-table/data-table';
import { FilterBarComponent } from './components/filter-bar/filter-bar';
import { StatCardComponent } from './components/stat-card/stat-card.component';
import { SummaryCardComponent } from './components/summary-card/summary-card.component';

/**
 * الاستيرادات المشتركة لجميع صفحات CRUD.
 * استخدم: imports: [...PAGE_IMPORTS, ...أي مكوّنات إضافية]
 */
export const PAGE_IMPORTS = [
  FormsModule,
  DecimalPipe,
  DatePipe,
  NgClass,
  LoadingStateComponent,
  EmptyStateComponent,
  StatusBadgeComponent,
  PageHeaderComponent,
  DataTableComponent,
  FilterBarComponent,
  StatCardComponent,
  SummaryCardComponent,
] as const;

// Re-exports للراحة
export { PageHeaderComponent } from './components/page-header/page-header';
export { DataTableComponent } from './components/data-table/data-table';
export type { TableColumn } from './components/data-table/data-table';
export { FilterBarComponent } from './components/filter-bar/filter-bar';
export { StatCardComponent } from './components/stat-card/stat-card.component';
export { SummaryCardComponent } from './components/summary-card/summary-card.component';
export { ConfirmDialogService } from './components/confirm-dialog/confirm-dialog.service';
