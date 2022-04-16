import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';

import {DiscographyRoutingModule} from './discography-routing.module';
import {DiscographyComponent} from './discography.component';
import {OrderModule} from 'ngx-order-pipe';


@NgModule({
  declarations: [
    DiscographyComponent
  ],
  imports: [
    CommonModule,
    DiscographyRoutingModule,
    OrderModule,
  ],
})
export class DiscographyModule {
}
