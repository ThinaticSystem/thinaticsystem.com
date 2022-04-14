import {Injectable} from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  showNotification: boolean;
  message: string;

  constructor() {
    this.showNotification = false;
    this.message = '';
  }

  show(message: string) {
    this.showNotification = true;
    this.message = message;

    setTimeout(() => {
      this.showNotification = false;
    }, 3000);
  }
}
