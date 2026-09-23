import {DOCUMENT} from '@angular/common';
import {afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, input, signal} from '@angular/core';
import {DomSanitizer} from '@angular/platform-browser';
import {readEmbedHtml} from './embed-html';

@Component({
  selector: 'app-media-embed',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let player = admission();
    @if (player.type === 'media') {
      @switch (player.media.provider) {
        @case ('soundcloud') {
          <iframe [src]="player.src" [title]="title() ? title() + ' — SoundCloud' : 'SoundCloudで試聴'" [height]="player.media.height"
            sandbox="allow-scripts allow-same-origin" allow="autoplay"
            loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>
        }
        @case ('spotify') {
          <iframe [src]="player.src" [title]="title() ? title() + ' — Spotify' : 'Spotifyで試聴'" [height]="player.media.height"
            sandbox="allow-scripts allow-same-origin" allow="autoplay; encrypted-media"
            loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>
        }
        @case ('youtube') {
          @if ((widthInPixels() ?? 0) >= 200) {
          <iframe [src]="player.src" [title]="title() ? title() + ' — YouTube' : 'YouTubeで試聴'" class="video"
            sandbox="allow-scripts allow-same-origin" allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>
          } @else {
            <a [href]="player.media.watchUrl" target="_blank" rel="noopener noreferrer">YouTubeで開く</a>
          }
        }
      }
    } @else if (player.type === 'blocked') {
      <p role="status">この試聴プレイヤーは表示できません</p>
    }
  `,
  styles: `:host { display: block; } iframe { display: block; width: 100%; border: 0; } .video { aspect-ratio: 16 / 9; min-height: 200px; }`,
})
export class MediaEmbedComponent {
  readonly html = input<unknown>(null);
  readonly title = input<string | null>(null);
  readonly #document = inject(DOCUMENT);
  readonly #sanitizer = inject(DomSanitizer);
  readonly #host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly #destroy = inject(DestroyRef);
  protected readonly widthInPixels = signal<number | null>(null);

  constructor() {
    afterNextRender(() => {
      // NOTE: Detach too-small players rather than hiding active media without controls.
      const observer = new ResizeObserver(entries => {
        const entry = entries[0];
        if (entry && !this.#destroy.destroyed) this.widthInPixels.set(entry.contentRect.width);
      });
      observer.observe(this.#host.nativeElement);
      this.#destroy.onDestroy(() => observer.disconnect());
    });
  }

  protected readonly admission = computed(() => {
    const parsed = readEmbedHtml(this.html(), this.#document);
    if (parsed.type !== 'media') return parsed;
    // SAFETY: only the closed provider policy's reconstructed URL crosses Angular's ResourceURL boundary.
    return {...parsed, src: this.#sanitizer.bypassSecurityTrustResourceUrl(parsed.media.src)};
  });
}
