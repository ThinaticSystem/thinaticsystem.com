import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { NgClickOutsideDelayOutsideDirective } from 'ng-click-outside2';
import { ClipboardService } from 'ngx-clipboard';
import { Subject, filter, map, takeUntil } from 'rxjs';
import { environment } from "../environments/environment";
import { LoadingService } from "./services/loading.service";
import { NavigateService } from "./services/navigate.service";
import { NotificationService } from "./services/notification.service";

@Component({
  standalone: true,
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [
    CommonModule,
    RouterOutlet,
    NgClickOutsideDelayOutsideDirective,
  ],
})
export class AppComponent implements OnInit, OnDestroy {
  #dispose$ = new Subject<null>();

  // Footerコピーライト表示用西暦取得
  year = new Date().getFullYear();
  enviroment = environment;

  // テーマ切り替え
  darkMode = false;
  inboundMode = false;

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
    private route: ActivatedRoute,
    private _clipboardService: ClipboardService,
    public loadingService: LoadingService,
    public navigate: NavigateService,
    public notification: NotificationService,
  ) {
  }


  ngOnInit(): void {
    if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
      this.darkMode = true;
    }
    if (localStorage.getItem('isInboundMode') === 'true') {
      this.inboundMode = true;
    }

    this.route.queryParamMap
      .pipe(
        filter((map) => map.has('inbound')),
        map((map) => map.get('inbound')!),
        takeUntil(this.#dispose$),
      )
      .subscribe((paramValue) => {
        switch (paramValue) {
          case '1':
            localStorage.setItem('isInboundMode', 'true');
            this.inboundMode = true;
            break;
          case '0':
            localStorage.setItem('isInboundMode', 'false');
            this.inboundMode = false;
            break;
        }
      });
  }

  toggleTheme(): void {
    if (document.documentElement.classList.contains('dark')) {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light');
      this.darkMode = false;
    } else {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark');
      this.darkMode = true;
    }
  }

  share(): void {
    this._clipboardService.copy(document.title + '\n' + location.href);
    alert('コピーしました');
  }

  ngOnDestroy(): void {
    this.#dispose$.next(null);
  }
}
