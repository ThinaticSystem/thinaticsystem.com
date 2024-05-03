import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from 'src/environments/environment';
import { Blog } from "../../interfaces/blog";

@Component({
  standalone: true,
  selector: 'app-blog-card',
  templateUrl: './blog-card.component.html',
  styleUrls: ['./blog-card.component.scss'],
  imports: [
    CommonModule,
    RouterLink,
  ],
})
export class BlogCardComponent {
  @Input() data: Blog | undefined;

  environment = environment;
}
