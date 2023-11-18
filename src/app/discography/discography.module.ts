import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { NgPipesModule } from 'ngx-pipes';
import { DiscographyRoutingModule } from './discography-routing.module';
import { DiscographyComponent } from './discography.component';


@NgModule({
  declarations: [
    DiscographyComponent,
  ],
  imports: [
    CommonModule,
    DiscographyRoutingModule,
    NgPipesModule,
  ],
})
export class DiscographyModule {
}
