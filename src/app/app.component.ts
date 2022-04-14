import {Component} from '@angular/core';
import {ClipboardService} from 'ngx-clipboard';
import {LoadingService} from "./service/loading.service";
import {environment} from "../environments/environment";
import {NavigateService} from "./service/navigate.service";
import {NotificationService} from "./service/notification.service";

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  // Footerコピーライト表示用西暦取得
  year = new Date().getFullYear();
  enviroment = environment;

  // モバイルメニュー開閉用
  openMenu = false;

  // Navbar用リンク一覧
  headerLinks = [
    {
      name: 'Home',
      url: '/'
    }, {
      name: 'About',
      url: '/about'
    }, {
      name: 'Discography',
      url: '/discography'
    }, {
      name: '用語集',
      url: '/glossary'
    }
  ];

  // Footerリンク一覧
  footerLinks = [
    {
      name: 'ActivityPub',
      url: 'https://honi.club/@ThinaticSystem/'
    }, {
      name: 'SoundCloud',
      url: 'https://soundcloud.com/ThinaticSystem/'
    }, {
      name: 'Discord',
      url: 'https://discord.com/users/260449322183819264'
    }, {
      name: 'Twitter',
      url: 'https://twitter.com/ThinaticSystem/'
    }, {
      name: 'Feed エサ',
      url: 'http://amzn.asia/d8Q1ib7'
    }, {
      name: 'Patreon',
      url: 'https://www.patreon.com/ThinaticSystem'
    }
  ];

  constructor(
    private _clipboardService: ClipboardService,
    public loadingService: LoadingService,
    public navigate: NavigateService,
    public notification: NotificationService,
  ) {
  }

  share(): void {
    this._clipboardService.copy(document.title + '\n' + location.href);
    alert('コピーしました');
  }
}
