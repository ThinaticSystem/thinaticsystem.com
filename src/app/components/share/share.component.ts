import { Component, Input } from '@angular/core';
import { ClipboardModule } from 'ngx-clipboard';
import { NotificationService } from "../../services/notification.service";

interface Share {
  text: string;
  url: string;
  copyMsg?: string;
}

@Component({
  standalone: true,
  selector: 'app-share',
  templateUrl: './share.component.html',
  styleUrls: ['./share.component.scss'],
  imports: [
    ClipboardModule,
  ],
})
export class ShareComponent {
  @Input() share!: Share;

  constructor(
    public Notification: NotificationService
  ) {
  }
}
