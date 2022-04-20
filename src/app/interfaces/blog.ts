export interface Blog {
  id: number;
  title: string;
  body: string;
  published_at: string;
  created_at: string;
  updated_at: string;
  blogTags?: (BlogTagsEntity | null)[] | null;
  eyecatch?: Eyecatch | null;
}

export interface BlogTagsEntity {
  id?: number;
  tag: string;
}

interface Eyecatch {
  id: number;
  name: string;
  alternativeText: string;
  caption: string;
  width: number;
  height: number;
  formats: Formats;
  hash: string;
  ext: string;
  mime: string;
  size: number;
  url: string;
  previewUrl?: null;
  provider: string;
  provider_metadata?: null;
  created_at: string;
  updated_at: string;
}

interface Formats {
  large: LargeOrSmallOrMediumOrThumbnail;
  small: LargeOrSmallOrMediumOrThumbnail;
  medium: LargeOrSmallOrMediumOrThumbnail;
  thumbnail: LargeOrSmallOrMediumOrThumbnail;
}

interface LargeOrSmallOrMediumOrThumbnail {
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
