import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';

import {DetailRoutingModule} from './detail-routing.module';
import {DetailComponent} from './detail.component';
import {MarkdownModule} from "ngx-markdown";
import {SanitizeHtmlPipe} from "../../pipes/sanitize-html.pipe";
import {ShareModule} from "../../components/share/share.module";


@NgModule({
  declarations: [
    DetailComponent,
    SanitizeHtmlPipe
  ],
  imports: [
    CommonModule,
    DetailRoutingModule,
    ShareModule,
    MarkdownModule.forRoot(),
  ],
})
export class DetailModule {
}
