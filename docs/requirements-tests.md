# 要件とテストの対応記録

この一覧は、既存の不具合を未修正として登録した当時の記録を残す。  
表の結果は修正前のbaselineに対する評価で、現在も同じ項目が失敗するという意味ではない。

要件を実際に検証した証拠と、実装のひな形を確認するテストを区別する。  
ここでのPASSは、名前を挙げた動作を決定的なfixtureで検査したことだけを示す。

次の受入を完了したとは扱わない。

- live CMSでの動作
- 本番Cloudflareでの動作
- 人手による表示確認
- screen-readerでの受入

## 当時の結果と検証範囲

| 要件・境界 | 実行可能な証拠 | 当時の結果と範囲 |
| --- | --- | --- |
| Blogの空レスポンス | `src/app/blog/index/index.component.spec.ts` | PASS: 決定的な空list/count fixtureで、componentに描画された状態まで確認 |
| BlogのHTTP失敗 | `src/known-defects/requirements.debt.spec.ts` (`blog-http-error-loading`) | DEBT FAIL: 実際のHTTP errorでloadingが残り、回復可能な失敗状態がない。既存のproduct debtとして保持 |
| Blogの同時ページ変更 | `src/known-defects/requirements.debt.spec.ts` (`blog-concurrent-page-order`) | DEBT FAIL: 遅れて届いた古いレスポンスが最新ページを上書きする。既存のproduct debtとして保持 |
| Articleのroute parameter変更 | `src/known-defects/requirements.debt.spec.ts` (`article-route-parameter-transition`) | DEBT FAIL: baselineは初期snapshotしか読まない。既存のproduct debtとして保持 |
| Articleの404と500 | `src/app/blog/article/article.component.spec.ts` と `src/known-defects/requirements.debt.spec.ts` | PARTIAL: 決定的なfixtureで404のredirectと500の非redirectを確認。404のerror経路ではloadingを解除できず、product debtが残る |
| Article/tagの入れ子ナビゲーション | `src/known-defects/blog-card.nested-anchor.spec.ts` | REGISTERED FAIL: 両方の意味上の遷移先とkeyboardの停止位置をassertする。既存のnested-anchor不具合は意図的に未修正 |
| Markdown/HTMLの実行可能コンテンツ | `src/app/pipes/sanitize-html.pipe.spec.ts` と `src/known-defects/requirements.debt.spec.ts` | PARTIAL: 正当なiframe/HTMLの保持fixtureは成功。unsafe contentはsecurity-review failureとして登録したままで、修正済みとは扱わない |
| Clipboardの拒否 | `src/app/components/share/share.component.spec.ts` | PASS: 限定した合成rejected-copy eventで成功通知を呼ばない契約を確認。実ブラウザの拒否経路とerror-message方針は未定義 |
| 通知の寿命 | `src/known-defects/requirements.debt.spec.ts` (`notification-replacement-lifetime`) | DEBT FAIL: 最初のtimerが差し替え後の通知を早く隠す。既存のproduct debtとして保持 |
| Discographyの画像失敗・空結果 | `src/known-defects/requirements.debt.spec.ts` | DEBT FAIL: baselineはload eventだけを待ち、0件やimage-error時のloadingを終了できない。既存のproduct debtとして保持 |
| 日付境界の意味 | `src/app/components/blog-card/blog-card.component.spec.ts` | PASS: host runtimeのtime zone解釈を明示し、安定したUTC時点で確認。time zone方針の変更には新たな判断が必要 |
| iframeのallowlist方針 | `src/app/pipes/sanitize-html.pipe.spec.ts` と `src/known-defects/requirements.debt.spec.ts` | PARTIAL: 正当なiframeを保持。provider別allowlist方針は未定義で、unsafe bypassはsecurity-review failureのまま |
| live CMS / patron API | ブラウザ・delivery scriptsは管理下のloopback fixtureを使用 | NOT RUN: live account/dataへのアクセスは意図的に対象外 |
| 表示とscreen-reader操作 | Browser smokeでaxe・keyboard・focusの観察を記録 | NOT RUN: 人手による表示確認と代表的なscreen-reader操作は未実施 |

ClipboardのPASSは、実ブラウザでclipboardが拒否される一連の操作を証明しない。  
利用者に示す明示的なエラーメッセージの方針も、当時は未定義だった。

## baselineの失敗を扱う仕組み

通常suiteの生成テストは、Angularの接続を記録するものとして保持する。  
ただし、上の表にある境界の検証証拠には使わない。

DEBT FAILは、baselineで見つかった失敗を保持した結果で、要件を満たしたという意味ではない。  
修正には別途の範囲承認と、対象を絞ったassertionを必要とする。

known-defect suiteには通常の失敗するassertionを置き、`test/known-defects.json`で評価する。  
skip/todo/failsによる判定の反転は使わない。

### reporterが出力する証拠

対応するVitest 4 reporterは、次の情報を構造化して出力する。

- assertionの識別情報
- error名
- 発生元
- source上の位置

### adapterの受け入れ条件

- **describe階層の一致**

  固定した階層の意味付けに従い、複数のdescribe suiteを受け付ける。  
  assertionの識別には、`file`と各祖先suiteを使う。

- **件数の整合**

  suiteとtestのcounterがreportと一致することを要求する。

- **終了statusの一致**

  子processがstatus 1で終了することを要求する。

次の結果は拒否する。

- 未知のassertion識別情報
- test以外を発生元とするassertion
- 規定外のerror種別
- runner/setup error
- 想定外のPASS

### 実runnerでのprobe

実際のrunnerを使うprobeは、次の結果を対象とする。

- assertion
- test-body TypeError
- beforeEach TypeError
- afterEach TypeError
- 未処理の非同期TypeError
