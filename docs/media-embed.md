# Media embed boundary

CMSの`demo.iframe`は実行可能HTMLではなく、既存データ形式からplayer URLを取り出すための入力としてのみ扱う

## Allowed content

2026-09-12の公開CMS読取は13release・21demo行で、20個のiframeとnull1個を確認した。固定互換性fixtureは`test/fixtures/observed-media-embeds.ts`である

- SoundCloud: `https://w.soundcloud.com/player/`。内部`url`は`https://api.soundcloud.com/tracks/<digits>`のみ。boolean表示設定と6桁colorのみを再構築し、`auto_play=false`とする。通常166px、visual300px
- Spotify: `https://open.spotify.com/embed/track/<22-character-id>`のみ。`utm_source`は受け付けるが出力しない。高さ80px
- YouTube: `https://www.youtube.com/embed/<11-character-id>`または`www.youtube-nocookie.com`。queryなし。元のprivacy-mode hostを維持する。幅が足りる場合は16:9とし、高さは公式最小値の200px以上とする。container幅が200px未満または初回計測前はiframeを生成せず、同じ検証済み動画IDから組み立てた「YouTubeで開く」linkを表示する。幅が縮んだ際はiframeを取り外し、操作できない音声だけを残さない。ResizeObserverはcomponent破棄時にdisconnectする

HTTPS以外、userinfo、非標準port、fragment、duplicate query、未登録host/path/queryを拒否する。未知provider/album/playlist/query等は暗黙に許可せず、追加する際に実データ・公式仕様・攻撃fixtureを確認する

## Trust boundary

`readEmbedHtml`は長さを制限した文字列をinert template内で解析し、単独のHTML iframe以外を拒否する。CMS nodeをlive DOMへ挿入せず、`srcdoc`・event属性付きiframeも拒否する。URL以外のCMS属性、style、class、sandbox、permissionsを転送しない

`admitPlayerUrl`は閉じたprovider policyからURLを再構築する。`MediaEmbedComponent`の唯一のResourceURL trust siteはこの出力だけを受ける。generic `SanitizeHtmlPipe`はAngularのHTML sanitizerを使い、HTML trust bypassを行わない。空欄は空表示、拒否された値は固定文言で表示する

iframeのsandbox/allow/referrerpolicy等はAngular template内の静的属性である。sandboxは`allow-scripts allow-same-origin`のみで、top navigation、popups、forms、downloads、presentationは許可しない。SoundCloudはautoplay permission、Spotifyはautoplay/encrypted-media、YouTubeはautoplay/encrypted-media/fullscreen/picture-in-pictureを明示する。permissionは自動再生要求そのものではなく、承認URLにautoplayを要求するqueryは出力しない

`strict-origin-when-cross-origin`でorigin referrerを保つ。第三者playerのlogin、外部リンク、アプリ起動、share等はsandboxにより動かない場合がある。第三者iframe内部の実装、サービス稼働、音声出力、account別制約はこのpolicyの証明範囲外である

## Verification and limitations

通常colocated testで公開CMSの20iframeの受入れと空欄1件、URL/HTML攻撃、タイトルescape、許可→拒否→空欄、provider置換を検査する。browser試験はactual Angular production artifactと明示的なfixture playerを使用し、未知の外部通信をabort・記録する。fixtureでの埋め込み・sandbox確認を実際のSoundCloud/Spotify/YouTube再生成功とは呼ばない

既存の8修正と今回の`unsafe-html-content`は`test/product-repairs.json`へ追跡する。known-defectの未修正caseが0件になってもrunnerをskipしない。`resolvedCheck`は4個の通常security regressionをauthoritative reporter付きで実行し、正確なcase/file/count/正常exitとerror不存在を要求する。旧expected-failure validatorと履歴baseline controlsは変更しない

性能閾値、Home CTA/notice、本番設定、依存versionはこの修正の変更対象ではない。先行8修正の固定performance gate FAILを本修正で解消したとは主張しない

## Official references

- https://angular.dev/best-practices/security
- https://angular.dev/errors/NG0910
- https://developers.google.com/youtube/player_parameters
- https://developer.spotify.com/documentation/embeds
- https://developers.soundcloud.com/docs/api/html5-widget

取得した公式文書とhash、CMS rawと全件数、編集前source archive、RED/GREEN実行ログは`.artifacts/embed-policy-2026-09-11T23-57-59.143Z/`に保持する。公開・CMS write・第三者playerの実再生・人手screen-reader受入は行っていない
