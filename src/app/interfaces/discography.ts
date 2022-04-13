
export interface Discography {
  title: string;
  demoComponent: Demo[];
  detailComponent: Detail[];
  buyComponent: Buy[];
  dlComponent: Dl[];
  detail: string;
  url: string;
  release: string;
  artwork: Artwork;
}

interface Demo {
  title: string;
  iframe: string;
}

interface Detail {
  title: string;
  body: string;
  url: string;
}

export interface Buy {
  id: number;
  store: string;
  url: string;
}

export interface Dl {
  id: number;
  name: string;
  url: string;
}

export interface Artwork {
  alternativeText: string;
  width: number;
  height: number;
  formats: ArtworkFormats;
  url: string;
}
export interface ArtworkFormats {
  large: ArtworkAllSize;
  small: ArtworkAllSize;
  medium: ArtworkAllSize;
  thumbnail: ArtworkAllSize;
}
export interface ArtworkAllSize {
  ext: string;
  url: string;
  hash: string;
  mime: string;
  name: string;
  path?: null;
  size: number;
  width: number;
  height: number;
}

