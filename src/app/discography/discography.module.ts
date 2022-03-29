import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { DiscographyRoutingModule } from './discography-routing.module';
import { DiscographyComponent } from './discography.component';


@NgModule({
  declarations: [
    DiscographyComponent
  ],
  imports: [
    CommonModule,
    DiscographyRoutingModule
  ]
})
export class DiscographyModule { }
