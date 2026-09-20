import {Injectable, signal} from '@angular/core';
import type {OnDestroy} from '@angular/core';

@Injectable({providedIn: 'root'})
export class NotificationService implements OnDestroy {
  readonly #showNotification = signal(false);
  readonly #message = signal('');

  // NOTE: Timer expiry and repeated copy successes must update the zoneless shell without another click.
  get showNotification(): boolean { return this.#showNotification(); }
  set showNotification(value: boolean) { this.#showNotification.set(value); }
  get message(): string { return this.#message(); }
  #timer: ReturnType<typeof setTimeout> | null = null;
  #destroyed = false;

  show(message: string | undefined): void {
    if (this.#destroyed) return;
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.showNotification = true;
    this.#message.set(message || 'コピーしました！');
    this.#timer = setTimeout(() => {
      this.#timer = null;
      this.showNotification = false;
    }, 3_000);
  }

  ngOnDestroy(): void {
    this.#destroyed = true;
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = null;
    this.showNotification = false;
  }
}
