import { Component, OnInit } from '@angular/core';
import { ClipboardService } from 'ngx-clipboard';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  cookie = false;

  constructor(
    private _clipboardService: ClipboardService,
  ) {}

  share(): void {
    this._clipboardService.copy(document.title + '\n' + location.href);
    alert('コピーしました');
  }
}
