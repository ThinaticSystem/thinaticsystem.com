import { CommonModule } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { DomSanitizer, Title } from "@angular/platform-browser";
import { ActivatedRoute, Router } from "@angular/router";
import { ClipboardService } from "ngx-clipboard";
import { MarkdownPipe } from "ngx-markdown";
import { Subject, takeUntil, tap } from 'rxjs';
import { ShareComponent } from "src/app/components/share/share.component";
import { SanitizeHtmlPipe } from "src/app/pipes/sanitize-html.pipe";
import { environment } from "../../../environments/environment";
import { Discography } from "../../interfaces/discography";
import { LoadingService } from "../../services/loading.service";
import { NotificationService } from "../../services/notification.service";

@Component({
  standalone: true,
  selector: 'app-detail',
  templateUrl: './detail.component.html',
  styleUrls: ['./detail.component.scss'],
  imports: [
    CommonModule,
    SanitizeHtmlPipe,
    ShareComponent,
    MarkdownPipe,
  ],
})
export default class DetailComponent implements OnInit, OnDestroy {
  #dispose$ = new Subject<null>();

  discography = signal<Discography | null>(null);
  environment = environment;
  url = location.href;
  id?: string | null;

  constructor(
    private titleService: Title,
    private route: ActivatedRoute,
    private httpClient: HttpClient,
    private sanitizer: DomSanitizer,
    private router: Router,
    private clipboard: ClipboardService,
    public loadingService: LoadingService,
    public Notification: NotificationService,
  ) {
  }

  ngOnInit(): void {
    // 仮タイトル設定
    this.titleService.setTitle('Discography | しなちくシステム');
    // URLからIDを取得
    this.id = this.route.snapshot.paramMap.get('id');

    // IDからDiscographyを取得
    this.httpClient.get<Discography>(`${environment.cmsUrl}/discographies/${this.id}`)
      .pipe(
        tap((data) => {
          this.discography.set(data);
          // タイトル設定
          this.titleService.setTitle(`${data.title} | しなちくシステム`);
        }),
        takeUntil(this.#dispose$),
      )
      .subscribe({
        error: (error) => {
          console.error(error);
          // 詳細情報が存在しない場合はDiscography一覧にリダイレクト
          this.router.navigate(['/discography']);
        },
      });
  }

  ngOnDestroy(): void {
    this.loadingService.loading = true;

    this.#dispose$.next(null);
  }
}
