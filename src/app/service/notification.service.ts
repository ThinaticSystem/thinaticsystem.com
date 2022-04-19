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

  show(message: string | undefined) {
    this.showNotification = true;
    this.message = message ? message : 'コピーしました！';

    setTimeout(() => {
      this.showNotification = false;
    }, 3000);
  }
}
