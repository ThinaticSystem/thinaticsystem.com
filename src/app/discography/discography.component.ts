import { Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'app-discography',
  templateUrl: './discography.component.html',
  styleUrls: ['./discography.component.scss']
})
export class DiscographyComponent implements OnInit {

  constructor(
    private titleService: Title,
  ) { }

  ngOnInit(): void {
    this.titleService.setTitle('Discography | ㈲しなちくシステム');
  }

}
