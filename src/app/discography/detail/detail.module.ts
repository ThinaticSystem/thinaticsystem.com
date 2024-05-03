import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { MarkdownModule } from "ngx-markdown";
import { ShareComponent } from 'src/app/components/share/share.component';
import { SanitizeHtmlPipe } from "../../pipes/sanitize-html.pipe";
import { DetailRoutingModule } from './detail-routing.module';
import { DetailComponent } from './detail.component';


@NgModule({
  declarations: [
    DetailComponent,
    SanitizeHtmlPipe
  ],
  imports: [
    CommonModule,
    DetailRoutingModule,
    ShareComponent,
    MarkdownModule.forRoot(),
  ],
})
export class DetailModule {
}
