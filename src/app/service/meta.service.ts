import { Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

@Injectable({
  providedIn: 'root'
})
export class MetaService {

  constructor(
    private titleService: Title,
    private metaService: Meta,
  ) { }

  setMeta(metaData) {
    this.titleService.setTitle(metaData.title + ' | ㈲しなちくシステム');
  }
}
