import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';

import {DetailRoutingModule} from './detail-routing.module';
import {DetailComponent} from './detail.component';
import {MarkdownModule} from "ngx-markdown";
import {ClipboardModule} from "ngx-clipboard";
import {SanitizeHtmlPipe} from "../../pipes/sanitize-html.pipe";


@NgModule({
  declarations: [
    DetailComponent,
    SanitizeHtmlPipe
  ],
  imports: [
    CommonModule,
    DetailRoutingModule,
    MarkdownModule.forRoot(),
    ClipboardModule,
  ],
})
export class DetailModule {
}
