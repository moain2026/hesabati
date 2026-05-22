import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from './components/toast/toast';
import { ConfirmModalComponent } from './components/confirm-modal/confirm-modal';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastComponent, ConfirmModalComponent],
  template: `
    <router-outlet />
    <app-toast />
    <app-confirm-modal />
  `,
  // ⚠️ :host = block + height 100% + overflow-y:auto
  // - height: 100% لتمكين sub-layouts (business-layout) باستخدام 100vh
  // - overflow-y: auto لصفحات بدون business-layout (login, businesses)
  // - business-layout يضع overflow: hidden محلياً لأنه يدير scroll بنفسه
  styles: [`
    :host {
      display: block;
      height: 100%;
      width: 100%;
      overflow-y: auto;
      overflow-x: hidden;
    }
  `],
})
export class App {}
