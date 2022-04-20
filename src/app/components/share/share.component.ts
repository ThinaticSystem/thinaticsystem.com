import {Component, Input, OnInit} from '@angular/core';
import {NotificationService} from "../../service/notification.service";

interface Share {
  text: string;
  url: string;
  copyMsg?: string;
}

@Component({
  selector: 'app-share',
  templateUrl: './share.component.html',
  styleUrls: ['./share.component.scss']
})
export class ShareComponent implements OnInit {
  @Input() share!: Share;

  constructor(
    public Notification: NotificationService
  ) {
  }

  ngOnInit(): void {
  }

}
