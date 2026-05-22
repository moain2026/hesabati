import { Component, signal, inject } from '@angular/core';
import { NgClass, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../services/auth.service';
import { BasePageComponent } from '../../shared/base-page.component';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header';
import { TabBarComponent } from '../../shared/components/tab-bar/tab-bar.component';

interface SidebarSection {
  id: number;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
}

interface SidebarItem {
  id: number;
  sectionId: number;
  screenKey: string;
  label: string;
  icon: string;
  color: string | null;
  route: string;
  sortOrder: number;
  sectionName: string;
}

interface UserConfig {
  configId: number;
  itemId: number;
  label: string;
  icon: string;
  screenKey: string;
  sectionName: string;
  sectionId: number;
  isVisible: boolean;
  customSortOrder: number;
}

interface AppUser {
  id: number;
  username: string;
  fullName: string;
  role: string;
  isActive: boolean;
}

@Component({
  selector: 'app-sidebar-settings',
  standalone: true,
  imports: [FormsModule, NgClass, NgFor, PageHeaderComponent, LoadingStateComponent, EmptyStateComponent, TabBarComponent],
  templateUrl: './sidebar-settings.html',
  styleUrl: './sidebar-settings.scss',
})
export class SidebarSettingsComponent extends BasePageComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  override bizId = 0;
  activeTab = signal<'users' | 'sections' | 'items'>('users');
  readonly mainTabs = [
    { value: 'users'    as const, label: 'صلاحيات المستخدمين', icon: 'people' },
    { value: 'sections' as const, label: 'الأقسام',            icon: 'folder' },
    { value: 'items'    as const, label: 'الشاشات',            icon: 'list' },
  ];

  // Users tab
  users = signal<AppUser[]>([]);
  selectedUser = signal<AppUser | null>(null);
  userConfigs = signal<UserConfig[]>([]);
  savingUser = signal(false);

  // Sections tab
  sections = signal<SidebarSection[]>([]);
  showSectionForm = signal(false);
  editingSection = signal<SidebarSection | null>(null);
  sectionForm = signal({ name: '', icon: 'folder', color: '#6366f1', sortOrder: 0 });

  // Items tab
  allItems = signal<SidebarItem[]>([]);
  showItemForm = signal(false);
  editingItem = signal<SidebarItem | null>(null);
  itemForm = signal({
    sectionId: 0,
    screenKey: '',
    label: '',
    icon: 'circle',
    color: '',
    route: '',
    sortOrder: 0,
  });

  // Drag state
  draggedIndex = signal<number | null>(null);
  dragOverIndex = signal<number | null>(null);

  // Copy & Reset
  showCopyModal = signal(false);
  copyFromUserId = signal<number | null>(null);
  copyToUserId = signal<number | null>(null);
  copying = signal(false);
  resetting = signal(false);

  // Search & Filter
  searchQuery = signal('');
  filterSection = signal('all');

  loading = signal(true);
  message = signal('');
  messageType = signal<'success' | 'error'>('success');

  protected onBizIdChange(_bizId: number): void {
    this.loadData();
  }

  async loadData() {
    this.loading.set(true);
    this.message.set('');
    try {
      const [users, sections, items] = await Promise.all([
        this.api.getUsers(),
        this.api.getSidebarSections(this.bizId),
        this.api.getSidebarItems(this.bizId),
      ]);
      this.users.set(users);
      this.sections.set(sections);
      this.allItems.set(items);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل تحميل البيانات';
      this.message.set(msg);
      this.messageType.set('error');
      this.toast.error(msg, 'خطأ');
    } finally {
      this.loading.set(false);
    }
  }

  // ==================== Users Tab ====================
  async selectUser(user: AppUser) {
    this.selectedUser.set(user);
    try {
      const rawConfigs = await this.api.getUserSidebar(this.bizId, user.id);

      // بناء القائمة من الأقسام والشاشات الحقيقية (مصدر الحقيقة)
      const realSections = this.sections();
      const realItems = this.allItems();

      // تحويل configs من الخادم إلى Map للبحث السريع
      const configByItemId = new Map<number, any>();
      const configByScreenKey = new Map<string, any>();
      for (const c of rawConfigs) {
        if (c.itemId) configByItemId.set(c.itemId, c);
        if (c.screenKey) configByScreenKey.set(c.screenKey, c);
      }

      const mergedConfigs: UserConfig[] = [];

      // لكل قسم حقيقي → لكل عنصر حقيقي يتبعه
      for (const section of realSections) {
        const sectionItems = realItems.filter((item) => item.sectionId === section.id);
        for (const item of sectionItems) {
          // البحث عن config موجود لهذا العنصر
          const existing = configByItemId.get(item.id) || configByScreenKey.get(item.screenKey);
          if (existing) {
            mergedConfigs.push({
              configId: existing.configId || 0,
              itemId: existing.itemId || item.id,
              label: item.label, // نستخدم الاسم الحقيقي من العنصر
              icon: item.icon,
              screenKey: item.screenKey,
              sectionName: section.name, // نستخدم اسم القسم الحقيقي
              sectionId: section.id,
              isVisible: existing.isVisible ?? true,
              customSortOrder: existing.customSortOrder ?? item.sortOrder ?? 0,
            });
            // حذف من الـ maps لتتبع العناصر الإضافية
            configByItemId.delete(item.id);
            if (item.screenKey) configByScreenKey.delete(item.screenKey);
          } else {
            // عنصر حقيقي ليس له config بعد → عرض كافتراضي
            mergedConfigs.push({
              configId: 0,
              itemId: item.id,
              label: item.label,
              icon: item.icon,
              screenKey: item.screenKey,
              sectionName: section.name,
              sectionId: section.id,
              isVisible: true, // افتراضي: ظاهر
              customSortOrder: item.sortOrder || 0,
            });
          }
        }
      }

      // أي عناصر إضافية من getUserSidebar لا تطابق عنصراً في allItems (مثل شاشات مخصصة قديمة)
      for (const [, cfg] of configByItemId) {
        // البحث عن القسم المناسب
        const sectionName = cfg.sectionName || 'أخرى';
        const sectionId = cfg.sectionId || 0;
        mergedConfigs.push({
          configId: cfg.configId || 0,
          itemId: cfg.itemId,
          label: cfg.label || 'عنصر غير معروف',
          icon: cfg.icon || 'circle',
          screenKey: cfg.screenKey || '',
          sectionName,
          sectionId,
          isVisible: cfg.isVisible ?? true,
          customSortOrder: cfg.customSortOrder ?? 0,
        });
      }

      this.userConfigs.set(mergedConfigs);
    } catch (err) {
      console.error(err);
    }
  }

  toggleItemVisibility(itemId: number) {
    const configs = this.userConfigs().map((c) =>
      c.itemId === itemId ? { ...c, isVisible: !c.isVisible } : c,
    );
    this.userConfigs.set(configs);
  }

  toggleAllInSection(sectionId: number, visible: boolean) {
    const configs = this.userConfigs().map((c) =>
      c.sectionId === sectionId ? { ...c, isVisible: visible } : c,
    );
    this.userConfigs.set(configs);
  }

  getSectionNames(): string[] {
    const names: string[] = [];
    for (const c of this.userConfigs()) {
      if (!names.includes(c.sectionName)) names.push(c.sectionName);
    }
    return names;
  }

  getItemsForSection(sectionName: string): UserConfig[] {
    return this.userConfigs()
      .filter((c) => c.sectionName === sectionName)
      .sort((a, b) => a.customSortOrder - b.customSortOrder);
  }

  getSectionId(sectionName: string): number {
    const item = this.userConfigs().find((c) => c.sectionName === sectionName);
    return item?.sectionId || 0;
  }

  isSectionAllVisible(sectionName: string): boolean {
    return this.getItemsForSection(sectionName).every((c) => c.isVisible);
  }

  isSectionNoneVisible(sectionName: string): boolean {
    return this.getItemsForSection(sectionName).every((c) => !c.isVisible);
  }

  // Drag & Drop for reordering items within a section
  onDragStart(event: DragEvent, index: number, sectionName: string) {
    this.draggedIndex.set(index);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', `${sectionName}:${index}`);
    }
  }

  onDragOver(event: DragEvent, index: number) {
    event.preventDefault();
    this.dragOverIndex.set(index);
  }

  onDragLeave() {
    this.dragOverIndex.set(null);
  }

  onDrop(event: DragEvent, dropIndex: number, sectionName: string) {
    event.preventDefault();
    const data = event.dataTransfer?.getData('text/plain');
    if (!data) return;

    const [sourceSec, sourceIdxStr] = data.split(':');
    if (sourceSec !== sectionName) return; // Only reorder within same section

    const sourceIdx = Number.parseInt(sourceIdxStr, 10);
    const sectionItems = this.getItemsForSection(sectionName);
    const item = sectionItems[sourceIdx];
    if (!item) return;

    // Reorder
    const newItems = [...sectionItems];
    newItems.splice(sourceIdx, 1);
    newItems.splice(dropIndex, 0, item);

    // Update sort orders
    const updatedConfigs = this.userConfigs().map((c) => {
      if (c.sectionName === sectionName) {
        const newIdx = newItems.findIndex((ni) => ni.itemId === c.itemId);
        return { ...c, customSortOrder: newIdx };
      }
      return c;
    });

    this.userConfigs.set(updatedConfigs);
    this.draggedIndex.set(null);
    this.dragOverIndex.set(null);
  }

  onDragEnd() {
    this.draggedIndex.set(null);
    this.dragOverIndex.set(null);
  }

  async saveUserConfig() {
    const user = this.selectedUser();
    if (!user) return;

    this.savingUser.set(true);
    try {
      // إرسال فقط العناصر التي لها configId > 0 (موجودة في الخادم)
      // العناصر ذات configId === 0 تبقى للعرض فقط حتى يُنشأ لها سجل
      const items = this.userConfigs()
        .filter((c) => c.configId > 0)
        .map((c) => ({
          id: c.configId,
          sidebarItemId: c.itemId,
          isVisible: c.isVisible,
          customSortOrder: c.customSortOrder,
        }));
      await this.api.updateUserSidebar(this.bizId, user.id, { items });
      this.showMessage('تم حفظ إعدادات التبويب بنجاح', 'success');
    } catch (err) {
      this.showMessage('حدث خطأ أثناء الحفظ', 'error');
    } finally {
      this.savingUser.set(false);
    }
  }

  // ==================== Sections Tab ====================
  openSectionForm(section?: SidebarSection) {
    if (section) {
      this.editingSection.set(section);
      this.sectionForm.set({
        name: section.name,
        icon: section.icon,
        color: section.color || '#6366f1',
        sortOrder: section.sortOrder,
      });
    } else {
      this.editingSection.set(null);
      const maxOrder = Math.max(0, ...this.sections().map((s) => s.sortOrder));
      this.sectionForm.set({ name: '', icon: 'folder', color: '#6366f1', sortOrder: maxOrder + 1 });
    }
    this.showSectionForm.set(true);
  }

  closeSectionForm() {
    this.showSectionForm.set(false);
    this.editingSection.set(null);
  }

  async saveSection() {
    const form = this.sectionForm();
    if (!form.name.trim()) return;

    try {
      const editing = this.editingSection();
      if (editing) {
        await this.api.updateSidebarSection(editing.id, form);
        this.showMessage('تم تحديث القسم بنجاح', 'success');
      } else {
        await this.api.createSidebarSection(this.bizId, form);
        this.showMessage('تم إضافة القسم بنجاح', 'success');
      }
      this.closeSectionForm();
      await this.loadData();
    } catch (err) {
      this.showMessage('حدث خطأ', 'error');
    }
  }

  async deleteSection(section: SidebarSection) {
    const confirmed = await this.toast.confirm({
      title: 'تأكيد الحذف',
      message: `هل تريد حذف القسم "${section.name}"؟ سيتم حذف جميع العناصر بداخله.`,
      type: 'danger',
    });
    if (!confirmed) return;
    try {
      await this.api.deleteSidebarSection(section.id);
      this.showMessage('تم حذف القسم', 'success');
      await this.loadData();
    } catch (err) {
      this.showMessage('حدث خطأ أثناء الحذف', 'error');
    }
  }

  // ==================== Items Tab ====================
  openItemForm(item?: SidebarItem) {
    if (item) {
      this.editingItem.set(item);
      this.itemForm.set({
        sectionId: item.sectionId,
        screenKey: item.screenKey,
        label: item.label,
        icon: item.icon,
        color: item.color || '',
        route: item.route,
        sortOrder: item.sortOrder,
      });
    } else {
      this.editingItem.set(null);
      this.itemForm.set({
        sectionId: this.sections().length > 0 ? this.sections()[0].id : 0,
        screenKey: '',
        label: '',
        icon: 'circle',
        color: '',
        route: '',
        sortOrder: 0,
      });
    }
    this.showItemForm.set(true);
  }

  closeItemForm() {
    this.showItemForm.set(false);
    this.editingItem.set(null);
  }

  async saveItem() {
    const form = this.itemForm();
    if (!form.label.trim() || !form.screenKey.trim()) return;

    try {
      const editing = this.editingItem();
      if (editing) {
        await this.api.updateSidebarItem(editing.id, form);
        this.showMessage('تم تحديث العنصر بنجاح', 'success');
      } else {
        await this.api.createSidebarItem(form);
        this.showMessage('تم إضافة العنصر بنجاح', 'success');
      }
      this.closeItemForm();
      await this.loadData();
    } catch (err) {
      this.showMessage('حدث خطأ', 'error');
    }
  }

  async deleteItem(item: SidebarItem) {
    const confirmed = await this.toast.confirm({
      title: 'تأكيد الحذف',
      message: `هل تريد حذف العنصر "${item.label}"؟`,
      type: 'danger',
    });
    if (!confirmed) return;
    try {
      await this.api.deleteSidebarItem(item.id);
      this.showMessage('تم حذف العنصر', 'success');
      await this.loadData();
    } catch (err) {
      this.showMessage('حدث خطأ أثناء الحذف', 'error');
    }
  }

  getItemsBySection(sectionId: number): SidebarItem[] {
    return this.allItems().filter((i) => i.sectionId === sectionId);
  }

  getSectionNameById(id: number): string {
    return this.sections().find((s) => s.id === id)?.name || '';
  }

  getRoleLabel(role: string): string {
    switch (role) {
      case 'admin':
        return 'مدير النظام';
      case 'accountant':
        return 'محاسب';
      case 'manager':
        return 'مدير محطة';
      case 'viewer':
        return 'مشاهد';
      default:
        return 'مستخدم';
    }
  }

  getRoleIcon(role: string): string {
    switch (role) {
      case 'admin':
        return 'admin_panel_settings';
      case 'accountant':
        return 'calculate';
      case 'manager':
        return 'manage_accounts';
      case 'viewer':
        return 'visibility';
      default:
        return 'person';
    }
  }

  // Common icons list for selection
  commonIcons = [
    'dashboard',
    'bolt',
    'receipt_long',
    'receipt',
    'account_balance_wallet',
    'category',
    'savings',
    'menu_book',
    'currency_exchange',
    'groups',
    'handshake',
    'warehouse',
    'local_shipping',
    'balance',
    'assessment',
    'warning',
    'tune',
    'settings',
    'home',
    'folder',
    'circle',
    'payments',
    'people',
    'summarize',
    'arrow_forward',
    'inventory_2',
    'analytics',
    'space_dashboard',
    'dashboard_customize',
    'admin_panel_settings',
    'account_balance',
    'wallet',
    'folder_open',
    'label',
  ];

  commonColors = [
    { value: '#6366f1', label: 'بنفسجي' },
    { value: '#3b82f6', label: 'أزرق' },
    { value: '#06b6d4', label: 'سماوي' },
    { value: '#10b981', label: 'أخضر' },
    { value: '#22c55e', label: 'أخضر فاتح' },
    { value: '#f59e0b', label: 'ذهبي' },
    { value: '#f97316', label: 'برتقالي' },
    { value: '#ef4444', label: 'أحمر' },
    { value: '#ec4899', label: 'وردي' },
    { value: '#8b5cf6', label: 'بنفسجي فاتح' },
    { value: '#a855f7', label: 'أرجواني' },
    { value: '#14b8a6', label: 'فيروزي' },
    { value: '#64748b', label: 'رمادي' },
    { value: '#0ea5e9', label: 'أزرق فاتح' },
    { value: '#d946ef', label: 'فوشيا' },
    { value: '#84cc16', label: 'ليموني' },
  ];

  // ==================== Copy Config ====================
  openCopyModal() {
    this.copyFromUserId.set(null);
    this.copyToUserId.set(null);
    this.showCopyModal.set(true);
  }

  async copyConfig() {
    const from = this.copyFromUserId();
    const to = this.copyToUserId();
    if (!from || !to) return;
    if (from === to) {
      this.showMessage('لا يمكن النسخ لنفس المستخدم', 'error');
      return;
    }

    const confirmed = await this.toast.confirm({
      title: 'تأكيد النسخ',
      message: 'سيتم استبدال إعدادات المستخدم المستهدف بالكامل. هل تريد المتابعة؟',
      type: 'warning',
    });
    if (!confirmed) return;

    this.copying.set(true);
    try {
      const result = await this.api.copySidebarConfig(this.bizId, from, to);
      this.showMessage(`تم نسخ ${result.copiedCount} إعداد بنجاح`, 'success');
      this.showCopyModal.set(false);
      // إعادة تحميل إعدادات المستخدم المحدد إذا كان هو المستهدف
      const sel = this.selectedUser();
      if (sel && sel.id === to) await this.selectUser(sel);
    } catch (e: unknown) {
      this.showMessage(e instanceof Error ? e.message : 'خطأ في نسخ الإعدادات', 'error');
    } finally {
      this.copying.set(false);
    }
  }

  // ==================== Reset Config ====================
  async resetConfig(userId: number) {
    const user = this.users().find((u) => u.id === userId);
    const confirmed = await this.toast.confirm({
      title: 'إعادة تعيين',
      message: `هل تريد إعادة تعيين إعدادات التبويب لـ "${user?.fullName || user?.username}"؟ سيتم إظهار جميع العناصر بالترتيب الافتراضي.`,
      type: 'warning',
    });
    if (!confirmed) return;

    this.resetting.set(true);
    try {
      const result = await this.api.resetSidebarConfig(this.bizId, userId);
      this.showMessage(`تم إعادة التعيين بنجاح (${result.itemCount} عنصر)`, 'success');
      const sel = this.selectedUser();
      if (sel && sel.id === userId) await this.selectUser(sel);
    } catch (e: unknown) {
      this.showMessage(e instanceof Error ? e.message : 'خطأ في إعادة التعيين', 'error');
    } finally {
      this.resetting.set(false);
    }
  }

  // ==================== Search & Filter ====================
  getFilteredItemsForSection(sectionName: string): UserConfig[] {
    let items = this.getItemsForSection(sectionName);
    const q = this.searchQuery().toLowerCase().trim();
    if (q) {
      items = items.filter(
        (c) => c.label.toLowerCase().includes(q) || c.screenKey.toLowerCase().includes(q),
      );
    }
    return items;
  }

  getFilteredSectionNames(): string[] {
    const filter = this.filterSection();
    let names = this.getSectionNames();
    if (filter !== 'all') {
      names = names.filter((n) => n === filter);
    }
    // إذا كان هناك بحث، أظهر فقط الأقسام التي فيها نتائج
    const q = this.searchQuery().toLowerCase().trim();
    if (q) {
      names = names.filter((n) => this.getFilteredItemsForSection(n).length > 0);
    }
    return names;
  }

  getVisibleCount(): number {
    return this.userConfigs().filter((c) => c.isVisible).length;
  }

  getHiddenCount(): number {
    return this.userConfigs().filter((c) => !c.isVisible).length;
  }

  private showMessage(text: string, type: 'success' | 'error') {
    this.message.set(text);
    this.messageType.set(type);
    setTimeout(() => this.message.set(''), 3000);
  }
}
