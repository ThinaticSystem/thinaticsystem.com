import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { environment } from 'src/environments/environment';
import {Discography} from "../interfaces/discography";


@Component({
  selector: 'app-discography',
  templateUrl: './discography.component.html',
  styleUrls: ['./discography.component.scss']
})
export class DiscographyComponent implements OnInit {
  discographies!: Discography[];
  environment = environment;

  constructor(
    private httpClient: HttpClient,
    private titleService: Title,
  ) { }

  ngOnInit(): void {
    this.titleService.setTitle('Discography | ㈲しなちくシステム');
    this.httpClient.get<Discography[]>(`${environment.cmsUrl}/discographies`)
    .subscribe((data) => {
      this.discographies = data;
    });
  }
}
