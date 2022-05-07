import {Component} from '@angular/core';
import {ClipboardService} from 'ngx-clipboard';
import {LoadingService} from "./services/loading.service";
import {environment} from "../environments/environment";
import {NavigateService} from "./services/navigate.service";
import {NotificationService} from "./services/notification.service";

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
      name: 'Blog',
      url: '/blog'
    }, {
      name: 'Discography',
      url: '/discography'
    }, {
      name: 'Vocabulary',
      url: '/glossary'
    }
  ];

  // Footerリンク一覧
  footerLinks = [
    {
      name: 'ActivityPub',
      url: 'https://honi.club/@ThinaticSystem'
    }, {
      name: 'SoundCloud',
      url: 'https://soundcloud.com/thinaticsystem'
    }, {
      name: 'Discord',
      url: 'https://discord.com/users/260449322183819264'
    }, {
      name: 'Twitter',
      url: 'https://twitter.com/ThinaticSystem'
    }, {
      name: 'Instagram',
      url: 'https://www.instagram.com/thinaticsystem/'
    }, {
      name: 'Patreon',
      url: 'https://www.patreon.com/ThinaticSystem'
    }, {
      name: 'エサをやる',
      url: 'http://amzn.asia/d8Q1ib7'
    }
  ];

  constructor(
    private _clipboardService: ClipboardService,
    public loadingService: LoadingService,
    public navigate: NavigateService,
    public notification: NotificationService,
  ) {
  }


  toggleTheme(): void {
    if (document.documentElement.classList.contains('dark')) {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark');
    }
  }

  share(): void {
    this._clipboardService.copy(document.title + '\n' + location.href);
    alert('コピーしました');
  }
}
