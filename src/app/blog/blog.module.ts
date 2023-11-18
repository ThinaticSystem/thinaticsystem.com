import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MarkdownModule } from "ngx-markdown";
import { NgxPaginationModule } from "ngx-pagination";
import { NgPipesModule } from 'ngx-pipes';
import { BlogCardModule } from "../components/blog-card/blog-card.module";
import { ShareModule } from "../components/share/share.module";
import { MarkdownRendererModule } from "../modules/markdown-renderer/markdown-renderer.module";
import { ArticleComponent } from "./article/article.component";
import { BlogRoutingModule } from './blog-routing.module';
import { IndexComponent } from "./index/index.component";
import { TagComponent } from "./tag/tag.component";

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
    MarkdownRendererModule,
    NgxPaginationModule,
    NgPipesModule,
  ]
})
export class BlogModule {
}
