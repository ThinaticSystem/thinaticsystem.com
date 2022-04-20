import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {BlogRoutingModule} from './blog-routing.module';
import {IndexComponent} from "./index/index.component";
import {ArticleComponent} from "./article/article.component";
import {MarkdownModule} from "ngx-markdown";
import {OrderModule} from "ngx-order-pipe";
import {ShareModule} from "../components/share/share.module";
import {NgxPaginationModule} from "ngx-pagination";
import {TagComponent} from "./tag/tag.component";
import {BlogCardModule} from "../components/blog-card/blog-card.module";

@NgModule({
  declarations: [
    IndexComponent,
    TagComponent,
    ArticleComponent,
  ],
  imports: [
    CommonModule,
    BlogRoutingModule,
    ShareModule,
    BlogCardModule,
    MarkdownModule.forRoot(),
    NgxPaginationModule,
    OrderModule,
  ]
})
export class BlogModule {
}
