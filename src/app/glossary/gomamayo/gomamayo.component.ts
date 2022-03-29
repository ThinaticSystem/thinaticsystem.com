import { Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'app-gomamayo',
  templateUrl: './gomamayo.component.html',
  styleUrls: ['./gomamayo.component.scss']
})
export class GomamayoComponent implements OnInit {

  constructor(
    private titleService: Title,
  ) { }

  ngOnInit(): void {
    this.titleService.setTitle('ゴママヨ-用語集 | ㈲しなちくシステム');
  }

}
