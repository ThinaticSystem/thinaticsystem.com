import {Injectable, signal} from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  readonly #loading = signal(true);

  get loading(): boolean {
    return this.#loading();
  }

  set loading(value: boolean) {
    this.#loading.set(value);
  }
}
