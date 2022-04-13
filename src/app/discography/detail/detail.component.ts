import { Component, OnInit } from '@angular/core';
import {ActivatedRoute, Router} from "@angular/router";
import {HttpClient} from "@angular/common/http";
import {Discography} from "../../interfaces/discography";
import {environment} from "../../../environments/environment";
import {DomSanitizer, SafeHtml, Title} from "@angular/platform-browser";

@Component({
  selector: 'app-detail',
  templateUrl: './detail.component.html',
  styleUrls: ['./detail.component.scss']
})
export class DetailComponent implements OnInit {
  discography!: Discography;
  environment = environment;
  id?: string | null;

  constructor(
    private titleService: Title,
    private route: ActivatedRoute,
    private httpClient: HttpClient,
    private sanitizer: DomSanitizer,
    private router: Router,
  ) { }

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

  // SoundCloud等のiframe埋め込み用
  getIframe(tag: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(tag);
  }

}
