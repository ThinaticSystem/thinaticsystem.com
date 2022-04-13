import { Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'app-honi',
  templateUrl: './honi.component.html',
  styleUrls: ['./honi.component.scss']
})
export class HoniComponent implements OnInit {

  constructor(
    private titleService: Title,
  ) { }

  ngOnInit(): void {
    this.titleService.setTitle('ほに-用語集 | しなちくシステム');
  }

}
