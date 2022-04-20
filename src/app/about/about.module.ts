import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';

import {AboutRoutingModule} from './about-routing.module';
import {AboutComponent} from './about.component';
import {MarkdownModule} from "ngx-markdown";
import {MarkdownRendererModule} from "../modules/markdown-renderer/markdown-renderer.module";


@NgModule({
  declarations: [
    AboutComponent
  ],
  imports: [
    CommonModule,
    AboutRoutingModule,
    MarkdownModule.forRoot(),
    MarkdownRendererModule,
  ]
})
export class AboutModule {
}
