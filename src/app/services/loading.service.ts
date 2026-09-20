import {DestroyRef, Injectable, inject, signal} from '@angular/core';
import {NavigationStart, NavigationEnd, NavigationCancel, NavigationError, NavigationSkipped, Router} from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  readonly #loading = signal(false);
  #contentGeneration = 0;
  readonly #navigating = signal(false);
  readonly #feedbackVisible = signal(false);
  readonly #feedbackExiting = signal(false);
  #navigationId: number | null = null;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #dwellTimer: ReturnType<typeof setTimeout> | null = null;
  #exitTimer: ReturnType<typeof setTimeout> | null = null;
  #destroyed = false;

  constructor() {
    const subscription = inject(Router).events.subscribe(event => {
      if (event instanceof NavigationStart) {
        this.#navigationId = event.id;
        this.#navigating.set(true);
      } else if ((event instanceof NavigationEnd || event instanceof NavigationCancel ||
        event instanceof NavigationError || event instanceof NavigationSkipped) && event.id === this.#navigationId) {
        this.#navigating.set(false);
      }
      this.syncFeedback();
    });
    inject(DestroyRef).onDestroy(() => {
      this.#destroyed = true;
      subscription.unsubscribe();
      this.clearTimer();
      if (this.#dwellTimer !== null) clearTimeout(this.#dwellTimer);
      this.#dwellTimer = null;
      this.cancelExit();
      this.#feedbackVisible.set(false);
    });
    this.syncFeedback();
  }

  /** Pending route resolution and pending page content are independent owners. */
  get loading(): boolean {
    return this.#loading() || this.#navigating();
  }

  set loading(value: boolean) {
    if (this.#destroyed) return;
    this.#contentGeneration++;
    this.#loading.set(value);
    this.syncFeedback();
  }

  /** Release only this content owner; stale finalizers cannot settle a newer route's work. */
  beginContentLoad(): () => void {
    this.loading = true;
    const generation = this.#contentGeneration;
    return () => {
      if (generation === this.#contentGeneration) this.loading = false;
    };
  }

  /** Presentation may outlive pending work; it never delays router/request completion. */
  get feedbackVisible(): boolean {
    return this.#feedbackVisible();
  }

  get feedbackExiting(): boolean {
    return this.#feedbackExiting();
  }

  private syncFeedback(): void {
    if (this.#destroyed) return;
    if (!this.loading) {
      this.clearTimer();
      if (this.#feedbackVisible() && this.#dwellTimer === null) this.startExit();
      return;
    }
    this.cancelExit();
    if (this.#timer !== null || this.#feedbackVisible()) return;
    this.#timer = setTimeout(() => {
      this.#timer = null;
      if (this.#destroyed || !this.loading) return;
      this.#feedbackVisible.set(true);
      // NOTE: A wait ending just after 200ms must not produce a one-frame flash.
      this.#dwellTimer = setTimeout(() => {
        this.#dwellTimer = null;
        this.syncFeedback();
      }, 240);
    }, 200);
  }

  private startExit(): void {
    if (this.#exitTimer !== null) return;
    this.#feedbackExiting.set(true);
    // NOTE: Matches the CSS exit; a new pending owner cancels this presentation timer.
    this.#exitTimer = setTimeout(() => {
      this.#exitTimer = null;
      if (this.#destroyed || this.loading) return;
      this.#feedbackVisible.set(false);
      this.#feedbackExiting.set(false);
    }, 180);
  }

  private cancelExit(): void {
    if (this.#exitTimer !== null) clearTimeout(this.#exitTimer);
    this.#exitTimer = null;
    this.#feedbackExiting.set(false);
  }

  private clearTimer(): void {
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = null;
  }
}
