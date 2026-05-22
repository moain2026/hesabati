# 🚨 القواعد الصارمة للتصميم الموحّد — Hesabati

> **هذا المستند إلزامي لكل المساهمين. أي PR يخالف هذه القواعد يُرفض تلقائياً.**

## ⚖️ المبدأ الأساسي

> **"اكتب التكوين فقط — لا تكتب HTML/Form/Modal يدوي أبداً."**

كل صفحة في نظام Hesabati تُبنى من **قوالب موحّدة** مع **Signal Forms**.
لا يُسمح بكتابة `<input>`, `<select>`, `<form>`, `<table>`, أو modal HTML يدوياً في الصفحات.

---

## 📦 القوالب الموحّدة المتاحة

### 1. `<app-crud-page>` — لجميع صفحات CRUD (35 صفحة)
- **متى تستخدم**: قائمة + إضافة + تعديل + حذف
- **أمثلة**: banks, funds, exchanges, wallets, partners, suppliers, customers, accounts...

### 2. `<app-entity-form>` — للنماذج الموحّدة (مدمج داخل `<app-crud-page>`)
- مبني على **Signal Forms** (Angular 20+)
- يدعم 15+ نوع حقل: text, number, email, tel, password, textarea, select, multiselect, checkbox, radio, switch, date, datetime, amount, currency, custom

### 3. `BaseCrudSignalPageComponent` — الـ base class الإلزامي
- يوفّر: loading, saving, showForm, editingId, searchTerm, activeTab signals
- يوفّر: load(), openCreate(), openEdit(), onSave(), onDelete(), closeForm()
- يوفّر: filteredData() computed تلقائياً

---

## ✅ النمط المُلزَم — مثال صفحة CRUD كاملة

```typescript
import { Component } from '@angular/core';
import { CrudPageComponent } from '../../shared/templates/crud-page/crud-page.component';
import { BaseCrudSignalPageComponent } from '../../shared/base-crud-signal-page.component';
import type { CrudPageConfig } from '../../shared/types/crud-page.types';

interface MyEntity { id?: number; name: string; isActive?: boolean; }
interface MyForm { name: string; }

@Component({
  selector: 'app-my-page',
  standalone: true,
  imports: [CrudPageComponent],
  template: `
    <app-crud-page
      [config]="config()"
      [data]="filteredData()"
      [form]="entityForm"
      [loading]="loading()"
      [saving]="saving()"
      [showForm]="showForm()"
      [editingId]="editingId()"
      [activeTab]="activeTab()"
      [searchTerm]="searchTerm()"
      (create)="openCreate()"
      (edit)="openEdit($any($event))"
      (delete)="onDelete($any($event))"
      (save)="onSave()"
      (cancel)="closeForm()"
      (tabChange)="activeTab.set($event)"
      (search)="searchTerm.set($event)"
    />
  `,
})
export class MyPageComponent extends BaseCrudSignalPageComponent<MyEntity, MyForm> {
  config = this.configSignal;

  override getConfig(): CrudPageConfig<MyEntity, MyForm> {
    return {
      title: 'كياناتي',
      icon: 'list',
      columns: [
        { key: 'name', label: 'الاسم', type: 'text' },
        { key: 'isActive', label: 'الحالة', type: 'badge' },
      ],
      defaultForm: { name: '' },
      formFields: [
        { key: 'name', label: 'الاسم', type: 'text', required: true, colSpan: 12 },
      ],
    };
  }

  protected override async loadData() {
    return await this.api.getMyEntities(this.bizId);
  }

  protected override async persistEntity(form: MyForm, id: number | null) {
    if (id) await this.api.updateEntity(this.bizId, id, form);
    else await this.api.createEntity(this.bizId, form);
  }

  protected override async deleteEntity(id: number) {
    await this.api.deleteEntity(this.bizId, id);
  }
}
```

**هذا كل ما تحتاج كتابته. لا HTML. لا modal. لا validation logic.**

---

## 🚫 القواعد الحمراء — ممنوعات مطلقة

### ❌ ممنوع: كتابة HTML للنماذج

```html
<!-- ❌ ممنوع -->
<form>
  <input class="valex-input" [(ngModel)]="form.name" />
  <select [(ngModel)]="form.type">...</select>
</form>
```

```typescript
// ✅ مسموح فقط: تعريف الحقول في getConfig()
formFields: [
  { key: 'name', label: 'الاسم', type: 'text' },
  { key: 'type', label: 'النوع', type: 'select', options: [...] },
],
```

### ❌ ممنوع: كتابة modal للحذف

```html
<!-- ❌ ممنوع -->
@if (showDeleteConfirm()) {
  <div class="valex-modal-overlay">...</div>
}
```

```typescript
// ✅ مدمج تلقائياً في القالب عبر ConfirmDialogService
// فقط نفّذ deleteEntity() — التأكيد يحدث تلقائياً
```

### ❌ ممنوع: validation يدوي

```typescript
// ❌ ممنوع
async save() {
  if (!this.form.name?.trim()) {
    this.toast.error('الاسم مطلوب');
    return;
  }
}
```

```typescript
// ✅ مسموح: تعريف declarative في FormFieldConfig
{ key: 'name', label: 'الاسم', type: 'text', required: true }
// Signal Forms يطبّق validation تلقائياً ويُظهر الرسالة
```

### ❌ ممنوع: كتابة `<table>` يدوي

```html
<!-- ❌ ممنوع -->
<table class="valex-table">
  <thead><tr>@for (col of columns; ...){...}</tr></thead>
  <tbody>...</tbody>
</table>
```

```typescript
// ✅ تكوين فقط
columns: [
  { key: 'name', label: 'الاسم', type: 'text' },
  { key: 'balance', label: 'الرصيد', type: 'amount' },
],
```

### ❌ ممنوع: نسخ template من صفحة لأخرى

كل تكرار = استبدله بإضافة feature للقالب الموحّد.

### ❌ ممنوع: استخدام `ngModel` في صفحات CRUD

Signal Forms يحل محل ngModel كلياً.

### ❌ ممنوع: signal مكرر لـ form state

```typescript
// ❌ ممنوع
form = signal({ name: '', ... });

// ✅ القاعدة توفّرها عبر entityForm: Field<T>
```

---

## ✅ القائمة البيضاء — مسموح بها

| نشاط | حكم |
|---|---|
| إضافة حقول جديدة في `FormFieldConfig` | ✅ مسموح |
| إضافة أنواع حقول جديدة (يحتاج تعديل `<app-entity-form>`) | ✅ مسموح |
| إضافة أعمدة جديدة في `CrudColumn` | ✅ مسموح |
| Override `filterByTab()` للسلوك المخصص | ✅ مسموح |
| Override `toFormModel()` للتحويلات المعقدة | ✅ مسموح |
| استخدام `'custom'` type مع `TemplateRef` للحالات الاستثنائية النادرة | ⚠️ مسموح بحذر |
| كتابة CSS مخصص للصفحة | ✅ مسموح |
| إضافة computed signals للحسابات | ✅ مسموح |

---

## 📐 معايير الكود

### حجم الصفحة الموصى به:
- **CRUD page**: ≤ 250 سطر TS، 0 سطر HTML (inline template صغير في @Component)
- **Dashboard page**: ≤ 150 سطر TS، ≤ 50 سطر HTML

### علامات تحذير:
- ⚠️ أي ملف `.html` صفحة > 100 سطر = راجع للتأكد من عدم وجود تكرار
- ⚠️ أي ملف `.ts` صفحة > 300 سطر = راجع لاحتمالية اختصار

---

## 🔍 Checklist قبل كل PR

- [ ] لم أكتب `<input>` أو `<select>` يدوي
- [ ] لم أكتب `<form>` أو modal للحذف
- [ ] لم أستخدم `[(ngModel)]` في صفحة CRUD
- [ ] لم أنسخ template من صفحة أخرى
- [ ] استخدمت `BaseCrudSignalPageComponent` أو القاعدة المناسبة
- [ ] استخدمت `<app-crud-page>` للقوائم
- [ ] عرّفت كل الحقول في `formFields` و `columns`
- [ ] الـ validation declarative في `FormFieldConfig` (required, min, max, pattern)
- [ ] الـ build ينجح بـ 0 errors

---

## 🔄 سياسة الاستثناءات

إذا كان هناك متطلب لا يدعمه القالب الموحّد:
1. **حلّ أولي**: استخدم `type: 'custom'` مع `TemplateRef` لجزء محدد فقط
2. **حلّ نهائي**: أضف الميزة للقالب الموحّد ليستفيد منها الجميع
3. **آخر حلّ**: مناقشة مع فريق Architecture قبل الاستثناء

---

## 📊 الفائدة المتوقعة من الالتزام الصارم

| المقياس | قبل | بعد | التوفير |
|---|---|---|---|
| متوسط حجم صفحة CRUD | 500 سطر | ~110 سطر | **-78%** |
| وقت إنشاء صفحة جديدة | 4 ساعات | 30 دقيقة | **-87%** |
| نسبة التكرار | 22% | <5% | **-77%** |
| اتساق UI/UX | متفاوت | 100% موحّد | **+∞** |
| تعديل UI شامل | 35 ملف | 1 ملف (القالب) | **×35** أسرع |

---

## 🎓 موارد التعلم

- [Angular Signal Forms RFC](https://github.com/angular/angular/discussions/53485)
- ملف types: `frontend/src/app/shared/types/crud-page.types.ts`
- المثال المرجعي: `frontend/src/app/pages/banks/banks.ts` (227 سطر، 0 HTML)
- النسخة القديمة للمقارنة: `banks-legacy.ts.bak` (500 سطر)

---

**آخر تحديث**: 2026-05-22  
**النسخة**: 1.0  
**الحالة**: 🟢 ساري المفعول
