# メディア埋め込みの境界

CMSの`demo.iframe`は、実行可能なHTMLとして扱わない。  
既存のデータ形式からplayer URLを取り出すための入力としてだけ扱う。

## 許可するコンテンツ

2026-09-12の公開CMS読み取りでは、13件のreleaseと21行のdemoを調べた。  
20個のiframeと1個のnullを確認した。

互換性確認用の固定fixtureは`test/fixtures/observed-media-embeds.ts`に置く。

### providerごとのURLと表示

- **SoundCloud**

  `https://w.soundcloud.com/player/`を許可する。  
  内部の`url`は`https://api.soundcloud.com/tracks/<digits>`だけを受け付ける。

  booleanの表示設定と6桁のcolorだけを再構築し、`auto_play=false`にする。  
  高さは通常166px、visualでは300pxとする。

- **Spotify**

  `https://open.spotify.com/embed/track/<22-character-id>`だけを許可する。  
  `utm_source`は受け付けるが出力しない。高さは80pxとする。

- **YouTube**

  `https://www.youtube.com/embed/<11-character-id>`を許可する。  
  同じ形式でhostが`www.youtube-nocookie.com`のURLも許可する。  
  queryは付けず、元のprivacy-mode hostを維持する。

  幅が足りる場合は16:9とし、高さは公式最小値の200px以上にする。  
  container幅が200px未満の場合や初回計測前はiframeを生成せず、同じ検証済み動画IDから組み立てた「YouTubeで開く」リンクを表示する。

  幅が縮んだ際はiframeを取り外し、操作できない音声だけを残さない。  
  ResizeObserverはcomponent破棄時にdisconnectする。

### 共通の拒否条件

次のURLは拒否する。

- HTTPS以外
- userinfo付き
- 非標準port付き
- fragment付き
- queryの重複
- 未登録のhost/path/query

未知のproviderやalbum、playlist、queryなどを暗黙に許可しない。  
許可範囲を追加する際は、次の根拠を確認する。

- 実データ
- 公式仕様
- 攻撃fixture

## 信頼境界

### CMS入力からURLの承認まで

- **HTMLの解析**

  `readEmbedHtml`は、長さを制限した文字列をinert template内で解析する。  
  単独のHTML iframe以外を拒否し、`srcdoc`やevent属性が付いたiframeも拒否する。

  CMS nodeをlive DOMへ挿入しない。  
  URL以外のCMS属性は転送しない。次の属性も引き継がない。

  - style
  - class
  - sandbox
  - permissions

- **player URLの再構築**

  `admitPlayerUrl`は、許可範囲を閉じたprovider policyからURLを再構築する。  
  `MediaEmbedComponent`内でResourceURLを信頼する唯一の箇所は、この出力だけを受け付ける。

- **汎用HTMLのサニタイズ**

  汎用の`SanitizeHtmlPipe`はAngularのHTML sanitizerを使い、HTML trust bypassを行わない。

- **空欄と拒否値の表示**

  空欄は空表示とし、拒否した値には固定文言を表示する。

### iframeに与える権限

iframeのsandbox/allow/referrerpolicyなどは、Angular template内の静的属性として定義する。  
sandboxは`allow-scripts allow-same-origin`だけを指定し、次の操作は許可しない。

- top navigation
- popups
- forms
- downloads
- presentation

providerごとのpermissionは次のとおり。

| provider | 明示するpermission |
| --- | --- |
| SoundCloud | autoplay |
| Spotify | autoplay/encrypted-media |
| YouTube | autoplay/encrypted-media/fullscreen/picture-in-picture |

permissionの付与は、自動再生の要求そのものではない。  
承認したURLには、autoplayを要求するqueryを出力しない。

`strict-origin-when-cross-origin`でorigin referrerを保つ。

### 第三者playerの制約

sandboxによって、第三者playerの次の機能が動かない場合がある。

- login
- 外部リンク
- アプリ起動
- shareなど

次の項目は、このpolicyの証明範囲に含めない。

- 第三者iframe内部の実装
- サービスの稼働
- 音声出力
- account別の制約

## 検証と限界

### 自動テストの範囲

通常のcolocated testでは、次の動作を検査する。

- 公開CMSの20個のiframeの受け入れ
- 空欄1件の表示
- URL/HTML攻撃の拒否
- タイトルのescape
- 許可→拒否→空欄の遷移
- providerの置換

ブラウザ試験では、実際のAngular production artifactと、明示的に用意したfixture playerを使う。  
未知の外部通信はabortし、記録する。

fixtureでの埋め込みやsandboxの確認を、実際のSoundCloud/Spotify/YouTubeの再生成功とは呼ばない。

### 修正履歴とrunnerの判定

既存の8修正と今回の`unsafe-html-content`は、`test/product-repairs.json`で追跡する。  
known-defectの未修正caseが0件になっても、runnerをskipしない。

`resolvedCheck`は、authoritative reporter付きで4個の通常security regressionを実行し、次の条件を要求する。

- case/file/countの正確な一致
- 正常exit
- errorがないこと

旧expected-failure validatorと履歴baseline controlsは変更しない。

### 変更しない範囲

次の項目は、この修正の変更対象に含めない。

- 性能閾値
- Home CTA/notice
- 本番設定
- 依存version

先行8修正の固定performance gate FAILを、本修正で解消したとは主張しない。

### 証拠の保存先と未実施項目

証拠は`.artifacts/embed-policy-2026-09-11T23-57-59.143Z/`に保持する。

- 取得した公式文書とhash
- CMS rawと全件数
- 編集前source archive
- RED/GREEN実行ログ

次の作業は行っていない。

- 公開
- CMSへのwrite
- 第三者playerの実再生
- 人手によるscreen-reader受入

## 公式資料

- [Angularのセキュリティ](https://angular.dev/best-practices/security)
- [AngularのNG0910](https://angular.dev/errors/NG0910)
- [YouTubeのplayer parameters](https://developers.google.com/youtube/player_parameters)
- [Spotifyの埋め込み](https://developer.spotify.com/documentation/embeds)
- [SoundCloudのHTML5 widget](https://developers.soundcloud.com/docs/api/html5-widget)
