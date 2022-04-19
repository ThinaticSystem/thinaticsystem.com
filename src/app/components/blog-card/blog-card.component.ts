import {Component, Input, OnInit} from '@angular/core';
import {environment} from 'src/environments/environment';
import {Blog} from "../../interfaces/blog";

@Component({
  selector: 'app-blog-card',
  templateUrl: './blog-card.component.html',
  styleUrls: ['./blog-card.component.scss']
})
export class BlogCardComponent implements OnInit {
  @Input() data: Blog | undefined;

  environment = environment;

  constructor() {
  }

  ngOnInit(): void {
  }

}
