import {Component, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from "@angular/router";
import {HttpClient} from "@angular/common/http";
import {Discography} from "../../interfaces/discography";
import {environment} from "../../../environments/environment";
import {DomSanitizer, Title} from "@angular/platform-browser";
import {LoadingService} from "../../services/loading.service";
import {ClipboardService} from "ngx-clipboard";
import {NotificationService} from "../../services/notification.service";

@Component({
  selector: 'app-detail',
  templateUrl: './detail.component.html',
  styleUrls: ['./detail.component.scss']
})
export class DetailComponent implements OnInit, OnDestroy {
  discography!: Discography;
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
      .subscribe((data) => {
        this.discography = data;
        // タイトル設定
        this.titleService.setTitle(`${this.discography.title} | しなちくシステム`);
      }, (error) => {
        // 詳細情報が存在しない場合はDiscography一覧にリダイレクト
        this.router.navigate(['/discography']);
      });
  }

  ngOnDestroy(): void {
    this.loadingService.loading = true;
  }
}
