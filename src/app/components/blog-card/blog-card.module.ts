import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {BlogCardComponent} from './blog-card.component';
import {RouterModule} from "@angular/router";


@NgModule({
  declarations: [
    BlogCardComponent
  ],
  exports: [
    BlogCardComponent
  ],
  imports: [
    CommonModule,
    RouterModule
  ]
})
export class BlogCardModule {
}
