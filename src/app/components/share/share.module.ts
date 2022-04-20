import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ShareComponent} from './share.component';
import {ClipboardModule} from "ngx-clipboard";


@NgModule({
  declarations: [
    ShareComponent
  ],
  exports: [
    ShareComponent
  ],
  imports: [
    CommonModule,
    ClipboardModule,
  ]
})
export class ShareModule {
}
