import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { DomSanitizer, SafeHtml, Title } from '@angular/platform-browser';
import { environment } from 'src/environments/environment';

export interface Discographies {
  title: string;
  discographyDemoComponent: Demo[];
  detailComponent: Detail[];
  url: string;
  release: string;
}

interface Demo {
  title: string;
  iframe: string;
}

interface Detail {
  title: string;
  body: string;
  url: string;
}

@Component({
  selector: 'app-discography',
  templateUrl: './discography.component.html',
  styleUrls: ['./discography.component.scss']
})
export class DiscographyComponent implements OnInit {
  discographies!: Discographies[];

  constructor(
    private httpClient: HttpClient,
    private titleService: Title,
    private sanitizer: DomSanitizer,
  ) { }

  ngOnInit(): void {
    this.titleService.setTitle('Discography | ㈲しなちくシステム');
    this.httpClient.get<Discographies[]>(`${environment.cmsUrl}/discographies`)
    .subscribe((data) => {
      this.discographies = data;
    });
  }

  getIframe(tag: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(tag);
  }
}
