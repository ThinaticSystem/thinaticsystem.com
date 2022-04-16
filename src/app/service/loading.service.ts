import {Injectable} from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  loading: boolean;

  constructor() {
    this.loading = true;
  }
}
