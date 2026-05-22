/**
 * ============================================================================
 *  <app-crud-page> — القالب الموحّد الإلزامي لجميع صفحات CRUD
 * ============================================================================
 *
 *  ⚠️ قاعدة صارمة: كل صفحة CRUD في المشروع تستخدم هذا القالب.
 *  لا تكتب <table> أو <form> أو <modal> يدوي.
 *
 *  هذا المكوّن يجمع:
 *  - <app-page-header>          (الترويسة)
 *  - <app-summary-card>          (كروت الإحصائيات)
 *  - <app-tab-bar>              (تبويبات الفلترة)
 *  - حقل البحث الموحّد
 *  - <app-loading-state>        (التحميل)
 *  - <app-empty-state>          (لا توجد بيانات)
 *  - <app-data-table>           (جدول العرض)
 *  - <app-entity-form>          (نموذج Signal Forms)
 *  - ConfirmDialogService       (تأكيد الحذف)
 *
 *  الاستخدام في أي صفحة:
 *    <app-crud-page
 *      [config]="config"
 *      [data]="banks()"
 *      [form]="bankForm"
 *      [loading]="loading()"
 *      [saving]="saving()"
 *      [showForm]="showForm()"
 *      [editingId]="editingId()"
 *      (create)="openCreate()"
 *      (edit)="openEdit($event)"
 *      (delete)="onDelete($event)"
 *      (save)="onSave()"
 *      (cancel)="closeForm()"
 *      (search)="searchTerm.set($event)"
 *      (tabChange)="activeTab.set($event)" />
 * ============================================================================
 */
import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
  computed,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Field } from '@angular/forms/signals';

import { PageHeaderComponent } from '../../components/page-header/page-header';
import { LoadingStateComponent } from '../../components/loading-state/loading-state.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { SummaryCardComponent } from '../../components/summary-card/summary-card.component';
import { TabBarComponent } from '../../components/tab-bar/tab-bar.component';
import { DataTableComponent, type TableColumn } from '../../components/data-table/data-table';
import { EntityFormComponent } from '../entity-form/entity-form.component';
import { AppIconComponent } from '../../icons/app-icon.component';

import type {
  CrudPageConfig,
  CrudColumn,
  CrudTab,
  SummaryCardConfig,
  CrudAction,
} from '../../types/crud-page.types';

@Component({
  selector: 'app-crud-page',
  imports: [
    FormsModule,
    PageHeaderComponent,
    LoadingStateComponent,
    EmptyStateComponent,
    SummaryCardComponent,
    TabBarComponent,
    DataTableComponent,
    EntityFormComponent,
    AppIconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './crud-page.component.html',
  styleUrl: './crud-page.component.scss',
})
export class CrudPageComponent<TEntity extends { id?: number } = any, TForm extends Record<string, any> = any> {
  // ============ INPUTS ============

  /** التكوين الكامل للصفحة */
  config = input.required<CrudPageConfig<TEntity, TForm>>();

  /** البيانات المعروضة (مفلترة أو لا) */
  data = input.required<TEntity[]>();

  /** كائن Signal Form (من form() API) */
  form = input<Field<TForm> | null>(null);

  /** هل يحمّل القائمة؟ */
  loading = input<boolean>(false);

  /** هل يحفظ النموذج؟ */
  saving = input<boolean>(false);

  /** هل النموذج مفتوح؟ */
  showForm = input<boolean>(false);

  /** المعرّف قيد التعديل (null = جديد) */
  editingId = input<number | null>(null);

  /** التبويب النشط */
  activeTab = input<string>('all');

  /** نص البحث */
  searchTerm = input<string>('');

  // ============ OUTPUTS ============

  /** فتح نموذج إنشاء */
  create = output<void>();

  /** فتح نموذج تعديل */
  edit = output<TEntity>();

  /** طلب حذف */
  delete = output<TEntity>();

  /** حفظ النموذج */
  save = output<void>();

  /** إلغاء النموذج */
  cancel = output<void>();

  /** تغيير التبويب */
  tabChange = output<string>();

  /** تغيير البحث */
  search = output<string>();

  // ============ COMPUTED ============

  /** قراءة التبويبات (مع تحويل count إذا كان دالة) */
  resolvedTabs = computed(() => {
    const t = this.config().tabs;
    if (!t) return [];
    const raw = typeof t === 'function' ? t() : t;
    // تحويل لتطابق TabBarItem: count يجب أن يكون number | null
    return raw.map((tab) => ({
      value: tab.value,
      label: tab.label,
      icon: tab.icon,
      count: typeof tab.count === 'function' ? tab.count() : (tab.count ?? null),
      disabled: tab.disabled,
      dimmed: tab.dimmed,
      customColor: tab.customColor,
      customBgColor: tab.customBgColor,
    }));
  });

  /** قراءة كروت الإحصائيات */
  resolvedSummaryCards = computed<SummaryCardConfig[]>(() => {
    const s = this.config().summaryCards;
    if (!s) return [];
    const cards = typeof s === 'function' ? s() : s;
    return cards.map((c) => ({
      ...c,
      value: typeof c.value === 'function' ? c.value() : c.value,
    }));
  });

  /** هل توجد كروت إحصائيات؟ */
  hasSummaryCards = computed(() => this.resolvedSummaryCards().length > 0);

  /** هل توجد تبويبات؟ */
  hasTabs = computed(() => this.resolvedTabs().length > 0);

  /** عنوان النموذج */
  formTitle = computed(() => {
    const cfg = this.config();
    const isEdit = this.editingId() !== null;
    if (cfg.formTitle) return isEdit ? cfg.formTitle.edit : cfg.formTitle.create;
    return isEdit ? `تعديل ${cfg.title}` : `إضافة ${cfg.title}`;
  });

  /** هل النموذج في وضع التعديل؟ */
  isEditing = computed(() => this.editingId() !== null);

  /** أعمدة data-table المُحوَّلة (للنوع البسيط) */
  tableColumns = computed<TableColumn[]>(() => {
    return this.config().columns.map((c) => ({
      key: String(c.key),
      label: c.label,
      type: this.mapColumnType(c),
    }));
  });

  /** أيقونة الصفحة */
  pageIcon = computed(() => this.config().icon || 'list');

  /** نص زر الإضافة */
  createLabel = computed(() => this.config().createLabel || `${this.config().title} جديد`);

  /** هل الإضافة مفعّلة؟ */
  canCreate = computed(() => this.config().enableCreate !== false);

  /** هل التعديل مفعّل؟ */
  canEdit = computed(() => this.config().enableEdit !== false);

  /** هل الحذف مفعّل؟ */
  canDelete = computed(() => this.config().enableDelete !== false);

  /** Grid class للـ summary cards */
  summaryGridClass = computed(() => {
    const n = this.resolvedSummaryCards().length;
    if (n <= 2) return 'grid-cols-1 sm:grid-cols-2';
    if (n === 3) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
    return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';
  });

  // ============ HANDLERS ============

  onCreate(): void {
    this.create.emit();
  }

  onEdit(row: TEntity): void {
    this.edit.emit(row);
  }

  onDelete(row: TEntity): void {
    this.delete.emit(row);
  }

  onSave(): void {
    this.save.emit();
  }

  onCancel(): void {
    this.cancel.emit();
  }

  onTabChange(value: string): void {
    this.tabChange.emit(value);
  }

  onSearch(value: string): void {
    this.search.emit(value);
  }

  // ============ HELPERS ============

  private mapColumnType(col: CrudColumn<TEntity>): TableColumn['type'] {
    switch (col.type) {
      case 'badge':
        return 'badge';
      case 'amount':
      case 'currency':
        return 'amount';
      case 'date':
      case 'datetime':
        return 'date';
      default:
        return 'text';
    }
  }
}
