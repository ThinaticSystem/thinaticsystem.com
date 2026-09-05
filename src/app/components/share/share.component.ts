import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { ClipboardModule } from 'ngx-clipboard';
import { NotificationService } from "../../services/notification.service";

interface Share {
  text: string;
  url: string;
  copyMsg?: string;
}

@Component({
    selector: 'app-share',
    templateUrl: './share.component.html',
    styleUrls: ['./share.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [
        ClipboardModule,
    ]
})
export class ShareComponent {
  @Input() share!: Share;

  constructor(
    public Notification: NotificationService
  ) {
  }
}
