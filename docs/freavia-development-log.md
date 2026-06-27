# Freavia — 開発ログ

> **Freavia** は、幾何学的なダークテーマを纏った自分専用の最強アウトライナー／ナレッジベース。  
> Next.js 16 (Turbopack) + React + Zustand + Supabase で構築。

---

## プロジェクト概要

| 項目 | 内容 |
|---|---|
| フレームワーク | Next.js 16.2.6 (Turbopack), React |
| 状態管理 | Zustand, useMemos フック (localStorage + Supabase 同期) |
| スタイリング | Tailwind CSS v4 (ダークテーマ固定) |
| DB / Auth | Supabase (PostgreSQL + Row Level Security) |
| ビルド環境 | Windows 11 / PowerShell, `NODE_OPTIONS=--max-old-space-size=4096` |

---

## アップデート履歴

---

### 2026-06-27 06 — チェックボックスの表示/非表示切り替え時に、ノードの完了状態（completed）が意図せずリセットされるバグを修正

**種別**: バグ修正（1行）

#### 原因

`src/hooks/useMemos.ts` の `toggleHasCheckbox` 内のマッパー:

```typescript
// 変更前 — hasCheckbox を false にする際に completed も false にリセットしていた
return { ...n, hasCheckbox: !n.hasCheckbox, completed: n.hasCheckbox ? false : n.completed };
```

`n.hasCheckbox ? false : n.completed` という式は「チェックボックスがあった（true）なら completed を false に」という意味になり、チェックボックスを**外す操作**（true → false）で `completed` が意図せずリセットされていた。

#### 修正

```typescript
// 変更後 — hasCheckbox のみを変更し、completed は一切触らない
return { ...n, hasCheckbox: !n.hasCheckbox };
```

#### ビルド確認

```
npx tsc --noEmit  → エラーなし
npm run build     → ✓ Compiled successfully
```

---

### 2026-06-27 05 — 完了状態の仕様変更（チェックボックスとの連動復旧 ＆ Ctrl+Enterでの単独完了トグル機能の追加）

**種別**: 仕様修正 ＋ 新機能

#### 変更内容

**`src/components/Editor/NoteNode.tsx`**

1. **スタイル関数をリバート**: 前回変更した `editorBodyClassNames` / `editorBodyColorStyle` の `!hasCheckbox` 条件を削除し、`completed=true` であれば `hasCheckbox` の有無に関わらず取り消し線＋グレーアウトを適用する元の仕様に戻した。

2. **Ctrl+Enter / Cmd+Enter ショートカット追加**: ノードにフォーカスがある状態で Ctrl+Enter（Mac は Cmd+Enter）を押すと、チェックボックスの有無に関わらず `onToggleCompleted` を呼び出して `completed` 状態をトグルする。`ADD_SIBLING`（修飾キーなし Enter）と衝突しないよう `e.ctrlKey || e.metaKey` で明示的に分岐。

```typescript
if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
  e.preventDefault();
  onToggleCompleted(node.id);
  return;
}
```

**`src/components/Editor/NodeContextMenu.tsx`**

3. **TASK セクションの完了トグル項目を常時有効化**: `disabled={!node.hasCheckbox}` 条件と `if (node.hasCheckbox)` ガードを削除し、チェックボックスなしノードでも直接 `onToggleCompleted()` を呼び出せるようにした。ショートカットヒント `Ctrl+↵` を表示するよう `kbd` prop も追加。

```jsx
// 変更前: disabled={!node.hasCheckbox} + onClick={() => { if (node.hasCheckbox) onToggleCompleted(); }}
// 変更後:
<MenuItem icon={node.completed ? "↩" : "✓"} active={node.completed}
  kbd="Ctrl+↵"
  onClick={onToggleCompleted}>
```

#### 挙動まとめ

| 操作 | hasCheckbox=true | hasCheckbox=false |
|---|---|---|
| チェックをクリック | completed トグル → 取り消し線 on/off | — |
| Ctrl+Enter | completed トグル → 取り消し線 on/off | completed トグル → 取り消し線 on/off |
| コンテキストメニュー → 完了/未完了 | completed トグル → 取り消し線 on/off | completed トグル → 取り消し線 on/off |

#### ビルド確認

```
npx tsc --noEmit  → エラーなし
npm run build     → ✓ Compiled successfully
```

---

### 2026-06-27 04 — 右下の不要なボックスUIの削除、およびチェックボックスのチェック状態とテキスト完了スタイル（取り消し線）の連動を解除

**種別**: UI削除 ＋ 挙動修正

#### 1. 右下ボックスUIの削除 (`src/app/page.tsx`)

エディタ画面右下に `fixed bottom-10 right-12` で配置されていた装飾ボックスを削除。

```jsx
// 削除
<div className="pointer-events-none fixed bottom-10 right-12 h-48 w-48 border border-zinc-700/70 opacity-[0.15] transition-opacity duration-300 group-hover/app:opacity-40" />
```

#### 2. チェックボックス状態とテキスト完了スタイルの分離 (`src/components/Editor/NoteNode.tsx`)

**変更前の挙動**: `node.completed` が true になると `hasCheckbox` の有無に関わらず、テキストに `line-through` クラスとグレーアウトカラー（`EDITOR_COMPLETED_TEXT_COLOR`）が適用されていた。

**修正後の挙動**:
- `hasCheckbox=true` のノードでチェックを入れても、テキストは通常表示のまま（色・装飾なし）
- `hasCheckbox=false` の standalone completed（コンテキストメニュー等での完了マーク）は従来通り取り消し線 + グレーアウト

```typescript
// editorBodyClassNames
if (completed && !hasCheckbox) return "line-through";  // checkbox時は適用しない

// editorBodyColorStyle
if (node.completed && !node.hasCheckbox) {             // checkbox時は適用しない
  return { color: EDITOR_COMPLETED_TEXT_COLOR, ... };
}
```

#### ビルド確認

```
npx tsc --noEmit  → エラーなし
npm run build     → ✓ Compiled successfully
```

---

### 2026-06-27 03 — ログイン前デフォルト画面のリファクタリング（個人メモの露出を排除し、ミニマルなウェルカムUIへ変更）

**種別**: バグ修正 ＋ UI改善

#### 原因

`page.tsx` の auth ゲート条件が `authConfigured && !authLoading && !user` だったため、Supabase がセッション確認中（`authLoading=true`）の間は条件が false になり、フルエディタが DEFAULT_MEMOS（"Track Memo", "Game Dev", "Ideas"）と共に一瞬描画されていた。

#### 修正内容

**`src/app/page.tsx`**

```typescript
// 変更前
if (authConfigured && !authLoading && !user) {
  return <WelcomeScreen onSignIn={signInWithGoogle} />;
}

// 変更後 — authLoading 中も WelcomeScreen を表示し、DEFAULT_MEMOS のフラッシュを防ぐ
if (authConfigured && (authLoading || !user)) {
  return <WelcomeScreen onSignIn={signInWithGoogle} isLoading={authLoading} />;
}
```

**`src/components/WelcomeScreen.tsx`**

- `isLoading` prop を追加: セッション確認中はサインインボタンを隠し、`AUTHENTICATING` の小さなパルスインジケーターを表示（ユーザーが誤ってボタンを押すことを防ぐ）
- エディタ本体のアンビエント感と統一するグリッドテクスチャをオーバーレイとして追加
- 左上・右下の幾何学デコレーション（ロータス菱形）追加
- `active:scale-[0.98]` でサインインボタンに控えめなフィードバック追加

#### ビルド確認

```
npx tsc --noEmit  → エラーなし
npm run build     → ✓ Compiled successfully
```

---

### 2026-06-27 02 — 折りたたみノード配下の子孫をキーボード移動対象からスキップする修正（カーソル消失バグの完全解決）

**種別**: バグ修正（根本原因）

#### 原因

ArrowUp / ArrowDown によるノード間フォーカス移動は、`querySelectorAll('[data-geo-editor="body"]')` で DOM 上のすべての `contentEditable` 要素を収集し、インデックスで前後を決定していた。しかし、折りたたまれた親ノードの子孫は CSS の `grid-rows-[0fr]` + `overflow-hidden` により画面上は非表示だが **DOM には存在し続ける** ため、クエリで拾われてしまいフォーカスが当たるとカーソルが消えて見えなくなっていた。

#### 修正内容（`src/components/Editor/NoteNode.tsx`）

**① 子孫ラッパーへの識別属性付与**

折りたたみ状態のグリッドコンテナに `data-node-collapsed="true"` を付与。展開時は属性なし（`undefined`）でクリーンを保つ。

```jsx
// 変更前
<div className={cn("grid ...", node.collapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]")}>

// 変更後
<div
  className={cn("grid ...", node.collapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]")}
  data-node-collapsed={node.collapsed ? "true" : undefined}
>
```

**② キーボードハンドラのフィルタリング**

`querySelectorAll` 結果を `.closest('[data-node-collapsed="true"]')` でフィルタし、折りたたまれた祖先の内側にある要素をすべてスキップ。

```typescript
// 変更前
const all = Array.from(
  scope.querySelectorAll<HTMLElement>('[data-geo-editor="body"]:not([contenteditable="false"])'),
);

// 変更後
const all = Array.from(
  scope.querySelectorAll<HTMLElement>('[data-geo-editor="body"]:not([contenteditable="false"])'),
).filter((e) => !e.closest('[data-node-collapsed="true"]'));
```

これにより、キーボード移動の候補リストは「画面上で実際に表示されているノード」のみになる。

#### ビルド確認

```
npx tsc --noEmit  → エラーなし
npm run build     → ✓ Compiled successfully
```

---

### 2026-06-27 01 — ノード間の十字キー移動時のカーソル消失バグ修正 ＆ Ctrl+上下キーによるノード移動機能の追加

**種別**: バグ修正 ＋ 新機能

#### 修正・追加した内容

| # | 内容 | 該当ファイル |
|---|---|---|
| 1 | ArrowUp/Down ノード間移動時のカーソル消失バグ修正 | `NoteNode.tsx` |
| 2 | Ctrl+ArrowUp/Down によるノード（サブツリー）の兄弟間移動機能 | `NoteNode.tsx`, `useMemos.ts`, `treeUtils.ts`, `NodeList.tsx`, `page.tsx` |

#### 詳細

**1. カーソル消失バグの修正 (`src/components/Editor/NoteNode.tsx`)**

従来の実装では、ノード間を ArrowUp/Down で移動する際に `getCaretCharOffset` で取得したオフセット値を次のノードに `setCaretToOffset` で適用していた。しかし、移動先ノードのテキストが元のオフセットより短い場合や、`contentEditable` 要素への focus が非同期的にリセットされる場合に、キャレットが消失する不具合があった。

**修正内容**: オフセット保持を廃止し、以下に変更した。
- ArrowUp（前ノードへ移動）: `setCaretToEnd(prev)` で末尾に配置
- ArrowDown（次ノードへ移動）: `setCaretToStart(next)` で先頭に配置
- いずれも `prev.focus()` / `next.focus()` を呼んだ後、`requestAnimationFrame` 内で再度 `focus()` とキャレット配置を行い、ブラウザの非同期フォーカス処理によるリセットを防ぐ

**2. Ctrl+ArrowUp/Down によるノード移動機能の追加**

- `src/lib/treeUtils.ts` に `moveNodeUp` / `moveNodeDown` を追加: 対象ノード（サブツリー全体）を同一親の前/次の兄弟と入れ替える純粋関数
- `src/hooks/useMemos.ts` に `handleMoveUp` / `handleMoveDown` を追加: `updateActiveNodes` を通じて履歴記録付きで状態を更新
- `src/components/Editor/NoteNode.tsx` の `handleKeyDown` に Ctrl+ArrowUp/Down ハンドラを追加: `e.preventDefault()` でスクロール防止、移動後に `requestAnimationFrame` 内でキャレット位置を維持
- `src/components/Editor/NodeList.tsx` と `src/app/page.tsx` にプロップを配線

#### ビルド確認

```
npx tsc --noEmit  → エラーなし
npm run build     → ✓ Compiled successfully
```

---

### 2026-06-23 03 — 外部クリップボードの優先（ペースト干渉の修正）およびノードコピー条件の厳格化

**種別**: バグ修正（重篤・クリップボード干渉）

#### 修正した内容

| # | 現象 | 修正内容 |
|---|---|---|
| 1 | `selectedIds.length === 0`（単なるカーソルフォーカス）でも Ctrl+C/X を押すと `activeId` の単一ノードが勝手に階層コピーされてしまう | `onCopy`/`onCut` の `activeId` フォールバック処理を完全に削除。`selectedIds.length === 0` の場合は即 return し、ブラウザ標準のテキストコピペにすべて委譲。階層コピー・カットは「明示的なノード複数選択中（`selectedIds.length > 0`）」のみで発動 |
| 2 | ノードコピー後、別アプリ／別タブで新しいテキストをコピーしても、ペースト時に古い `_nodeClipboard` のノードデータが優先されてしまう | ノードコピー／カット実行時にそのプレーンテキスト表現を `lastCopiedTextRef`（コンポーネントローカルの ref）に保存しつつシステムクリップボードにも書き込む。`onPaste` 発生時に `e.clipboardData.getData("text/plain")` で取得した実際のクリップボード内容と `lastCopiedTextRef.current` を比較し、不一致なら「外部で新しいコピーが行われた」と判断して `_nodeClipboard` を即時クリアし、`preventDefault` を呼ばずブラウザ標準ペーストに完全に委譲 |

#### 変更ファイル

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `src/app/page.tsx` | 修正 | `lastCopiedTextRef`（`useRef<string \| null>`）を新規追加。`onCopy`/`onCut`: `activeId` フォールバックを削除し `selectedIds.length === 0` で即 return。コピー成功時に `lastCopiedTextRef.current` を更新。`onPaste`: 冒頭で `incomingText !== lastCopiedTextRef.current` を判定し、不一致なら `clearNodeClipboard()` して native paste へ委譲。`handleContextMenuCopy`/`handleContextMenuCut`（右クリックメニュー）も同じ `lastCopiedTextRef` 追跡＋`navigator.clipboard.writeText` 書き込みに統一し、メニュー経由の構造コピー後もキーボード Ctrl+V との整合性を保つよう、`displayNodes` 定義後の位置に移動 |

#### 設計上の重要な判断

- **「最後に書いたのは自分か」で外部コピーを検知**: システムクリップボードの読み取り専用 API には変更検知の仕組みがないため、Freavia自身が最後に書き込んだテキストを `lastCopiedTextRef` として保持し、ペースト時の実際の内容と突き合わせる差分検知方式を採用。これにより別アプリでのコピーを正確に検出できる。
- **カーソルフォーカスだけでは絶対に階層コピーを発動しない**: 単一ノードを編集中の何気ない Ctrl+C は、ユーザーがテキストをコピーしたいという意図である可能性が高いため、明示的な複数ノード選択（Ctrlクリック等）がない限り内部クリップボードに一切触れない仕様に統一。
- **メニュー経由コピーとキーボードコピーの整合性**: 右クリックメニューからの構造コピーもシステムクリップボードへの書き込みと `lastCopiedTextRef` 更新を行うことで、メニューでコピー→キーボードでペーストという混在操作でも誤って「外部コピー」と判定されることを防止。

#### ビルド確認

```
npx tsc --noEmit  → 出力なし（エラーゼロ）
npm run build     → ✓ Compiled successfully
```

---

### 2026-06-23 02 — ログイン前デフォルト画面のリファクタリング（個人メモの露出を排除し、ミニマルなウェルカムUIへ変更）

**種別**: セキュリティ／UX改善

#### 現象

未認証状態（ログイン前）でも `page.tsx` がそのままエディタをレンダリングしており、`useMemos.ts` の `DEFAULT_MEMOS`（"Track Memo"・"Game Dev"・"Ideas" などの具体的な個人メモ内容・ノードデータ）がそのまま画面に表示されてしまっていた。

#### 修正した内容

| # | 内容 |
|---|---|
| 1 | `src/components/WelcomeScreen.tsx` を新規作成。中央に幾何学的なロゴアイコン＋「FREAVIA」ロゴテキスト、サブタイトル「A GEOMETRIC OUTLINER FOR CREATORS.」、その下に「SIGN IN」ボタンのみを配置したミニマルなダークUI |
| 2 | `src/app/page.tsx`: `useAuth()` から `loading`・`configured`・`signInWithGoogle` を追加で分割代入。全フック呼び出し後（コンポーネント末尾の最終 `return` 直前）に `if (authConfigured && !authLoading && !user) return <WelcomeScreen onSignIn={signInWithGoogle} />;` を追加し、未認証時はメモ内容を一切レンダリングしないよう完全にゲート |

#### 変更ファイル

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `src/components/WelcomeScreen.tsx` | 新規 | ログイン前ゲート画面。メモデータを一切含まない、ロゴ・サブタイトル・サインインボタンのみのプレゼンテーショナルコンポーネント |
| `src/app/page.tsx` | 修正 | 認証状態の分割代入を拡張。全Hooks実行後・JSXレンダリング直前に未認証ゲートの早期 return を追加（Hooksのルールに抵触しないよう、条件分岐は全フック呼び出し完了後に配置） |

#### 設計上の重要な判断

- **ローカルモード（Supabase未設定）は対象外**: `authConfigured` が `false`（`NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` 未設定）の場合はログイン概念自体が存在しないため、ゲートをスキップしそのままローカルデータでエディタを表示する。認証バックエンドがある環境でのみ、未ログイン時にウェルカム画面を強制する。
- **Hooksルール厳守**: 早期 return はコンポーネント内の全 Hook 呼び出し（`useMemos`・`useEffect`・`useMemo` 等）が実行された後、最終 JSX の `return` 直前にのみ配置。レンダーごとに呼び出される Hook の数・順序が変わらないことを保証。
- **`DEFAULT_MEMOS` 自体は削除しない**: ログイン後・ローカルモードでの初回起動時シードデータとして引き続き利用するため、データ自体の削除ではなく「未認証画面に表示させない」というゲーティングで対応した。

#### ビルド確認

```
npx tsc --noEmit  → 出力なし（エラーゼロ）
npm run build     → ✓ Compiled successfully
```

---

### 2026-06-23 — テキストメニューからの非同期テキスト貼り付け（Clipboard API）の不具合を修正

**種別**: バグ修正

#### 修正した内容

コンテキストメニューの「📥 貼り付け」が、内部クリップボードが空の場合に通常のプレーンテキストを正しく貼り付けられるよう、`handleContextMenuPaste` を `async/await` ベースのハイブリッド処理に明確化。

| # | 内容 |
|---|---|
| 1 | `handleContextMenuPaste` を `async` 関数に変更。① `pasteNodesAfter(nodeId)` が `true` を返せば階層ペーストとして完了 |
| 2 | ② 内部クリップボードが空（`false` 返却）の場合は `await navigator.clipboard.readText()` でシステムクリップボードのプレーンテキストを取得し、`insertSiblingWithPlainTextAfter(nodeId, text)` でターゲットノード直後に挿入 |
| 3 | クリップボード読み取りの権限拒否・API未対応などのエラーを `try/catch` で確実に捕捉し、何もせず安全に終了（アプリのクラッシュを防止） |

#### 変更ファイル

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `src/app/page.tsx` | 修正 | `handleContextMenuPaste` を `(nodeId: string) => void` から `async (nodeId: string) => Promise<void>` に変更し、`.then()/.catch()` チェーンから `try { await ... } catch {}` 構文に統一。ロジック自体（①構造ペースト優先 → ②プレーンテキストフォールバック）は変更なし、エラーハンドリングと可読性を強化 |

#### 設計上の重要な判断

- **async/await への統一**: Promiseチェーン (`.then/.catch`) から `async/await` + `try/catch` に変更することで、モバイル版 `mobileActionsPaste` と同じコードスタイルに統一し、保守性を向上。
- **NodeContextMenu 側の呼び出しは fire-and-forget で安全**: `onPasteNode()` はメニュー側で同期的に呼ばれ、直後に `onClose()` でメニューがアンマウントされるが、`handleContextMenuPaste` は `page.tsx`（親コンポーネント）側のクロージャのため、メニューのアンマウント後も非同期処理が問題なく完了する。

#### ビルド確認

```
npx tsc --noEmit  → 出力なし（エラーゼロ）
npm run build     → ✓ Compiled successfully
```

---

### 2026-06-22 02 — テキストメニューの挙動をショートカットの優先ロジックと完全同期（文字選択優先）

**種別**: バグ修正 / 一貫性改善

#### 修正した内容

右クリックのコンテキストメニュー「コピー」「切り取り」「貼り付け」が、Ctrl+C/X/V のキーボードショートカットと異なる優先順位で動作していたため統一。

| # | 内容 |
|---|---|
| 1 | `handleContextMenuCopy`/`handleContextMenuCut`: 文字選択中（`window.getSelection().toString().length > 0`）は `document.execCommand("copy"/"cut")` で選択テキストのみを処理し、直後に `clearNodeClipboard()` を呼んで内部構造クリップボードの残留を防止。文字選択なしの場合のみノード階層コピー/カットを実行 |
| 2 | `handleContextMenuPaste`: `pasteNodesAfter(nodeId)` が `false`（内部クリップボードが空、または直前のテキストコピーでクリア済み）を返した場合、`navigator.clipboard.readText()` でシステムクリップボードのプレーンテキストを読み取り `insertSiblingWithPlainTextAfter` でテキストペーストにフォールバック（モバイル版の `mobileActionsPaste` と同じ安全弁パターン） |

#### 変更ファイル

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `src/app/page.tsx` | 修正 | `handleContextMenuCopy`/`handleContextMenuCut` に文字選択時の `clearNodeClipboard()` 呼び出しを追加。`handleContextMenuPaste` をテキストフォールバック対応に拡張し、依存配列に `clearNodeClipboard`/`insertSiblingWithPlainTextAfter` を追加 |

#### 設計上の重要な判断

- **キーボードとメニューで判定ロジックを共通化**: 「① 文字選択 → ブラウザ標準処理＋内部キャッシュクリア／② ノード選択 → 階層コピペ／③ クリップボード空 → プレーンテキストフォールバック」という同一の優先順位を、`onCopy`/`onCut`/`onPaste`（キーボード）と `handleContextMenuCopy`/`Cut`/`Paste`（メニュー）の両方の経路で揃えることで、操作手段によって挙動が異なるという混乱を排除した。

#### ビルド確認

```
npx tsc --noEmit  → 出力なし（エラーゼロ）
npm run build     → ✓ Compiled successfully
```

---

### 2026-06-22 — 通常テキストコピー時の内部キャッシュクリアによるコピペ干渉の完全修正

**種別**: バグ修正（重篤・クリップボード状態残留）

#### 現象

一度ノードを階層コピーすると `_nodeClipboard`（内部構造クリップボード）にデータが残り続ける。その後、無関係な通常のテキストをマウス選択してコピーし、別の場所で Ctrl+V／Win+V しても、古い「最初にコピーしたノード」が階層ペーストされてしまう。

#### 修正した内容

| # | 内容 |
|---|---|
| 1 | `useMemos.ts` に `clearNodeClipboard()` を新規実装し、`_nodeClipboard` を `null` にリセットできるようにフックの返り値として公開 |
| 2 | `page.tsx` の `onCopy`/`onCut` ハンドラの①分岐（`hasTextSelected()` が true のとき＝通常テキストコピー）で `clearNodeClipboard()` を呼び出し、内部キャッシュを即座に破棄 |
| 3 | `onPaste` は既存の優先順位ロジック（①文字選択 ②ノード選択 ③ネイティブ）のままで、`_nodeClipboard` がクリアされていれば `pasteNodesAfter` が `false` を返すため `preventDefault` が発火せず、ブラウザ標準ペースト（Win+V履歴・外部テキスト）に確実に処理が流れる |

#### 変更ファイル

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `src/hooks/useMemos.ts` | 修正 | `clearNodeClipboard` 関数を追加（`_nodeClipboard = null`）。フックの返り値オブジェクトに追加 |
| `src/app/page.tsx` | 修正 | `useMemos()` から `clearNodeClipboard` を分割代入。`onCopy`/`onCut` の文字選択分岐で呼び出し、依存配列にも追加 |

#### 設計上の重要な判断

- **「最後の操作が勝つ」原則**: 階層コピーで内部クリップボードを満たした後でも、ユーザーが通常のテキストをコピー／カットした時点でその意図を「もうノードはペーストしない」という明示的なシグナルとして扱い、即座にキャッシュを空にする。これにより `_nodeClipboard` の残留が原因のペースト誤爆を構造的に防止する。

#### ビルド確認

```
npx tsc --noEmit  → 出力なし（エラーゼロ）
npm run build     → ✓ Compiled successfully
```

---

### 2026-06-17 03 — Ctrl+C/X/V 判定の優先順位を厳密化（文字選択を最優先）

**種別**: バグ修正（重篤・クリップボード優先順位の取り違え）

#### 修正した内容

前回の修正では「ノード選択コンテキストかどうか」のみで判定していたが、文字選択中かどうかのチェックが抜けていたため、マウスドラッグでの文字選択コピー／Win+V／外部ペーストが依然破壊される経路が残っていた。判定順序を以下の3段階に厳密化：

| 優先度 | 条件 | 挙動 |
|---|---|---|
| ① | `window.getSelection().toString().length > 0`（文字の一部が選択されている） | 無条件でネイティブ挙動に100%委譲。`preventDefault` を一切呼ばない |
| ② | ①に当たらず、`selectedIds.length > 0` またはノード選択モード中 | Freavia独自の階層コピー・カット・ペーストを実行 |
| ③ | ①②いずれにも当たらない（通常の文字入力中など） | 一切介入せず、ブラウザの既定動作（Win+V履歴・外部テキスト貼り付け含む）に完全に流す |

#### 変更ファイル

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `src/app/page.tsx` | 修正 | `onCopy`/`onCut`/`onPaste` 内に `hasTextSelected()` チェックを `isNodeSelectionContext()` より前段に追加。文字選択がある場合は他の判定を一切評価せず即 return する優先順位を明文化 |

#### 設計上の重要な判断

- **判定順序の固定**: 「テキスト選択 → ノード選択 → 何もしない」の3段階を必ずこの順で評価する。ノード複数選択中であっても、たまたまテキストが選択されていればテキストコピペを優先する（これは想定上稀だが、ユーザー操作の直感に従う安全側の挙動）。

#### ビルド確認

```
npx tsc --noEmit  → 出力なし（エラーゼロ）
npm run build     → ✓ Compiled successfully
```

---

### 2026-06-17 02 — Ctrl+C/V/X の操作モード別自動切り替え最適化

**種別**: 改善（クリップボード条件分岐の精密化）

#### 修正した内容

これまで「contentEditable がフォーカス中かどうか」だけでネイティブ／構造コピペを切り替えていたが、複数ノード選択中（Ctrlクリック等）でもテキスト編集中と誤判定されるケースがあった。判定基準を「ノード選択コンテキストかどうか」一本に統一。

| 状態 | 挙動 |
|---|---|
| `selectedIds.length > 0`（Ctrl複数選択）または `effectiveSelectionMode`（ノード選択モード中） | contentEditable のフォーカス有無に関わらず、Ctrl+C/X/V は子ノードを含めた階層コピー・カット・ペーストを実行 |
| 上記いずれにも当たらない（通常のテキスト編集・文字選択のみ） | 内部クリップボード処理を一切介さず、ブラウザ標準のテキストコピペ（Win+V履歴・クロスアプリペースト含む）を素通りさせる |

#### 変更ファイル

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `src/app/page.tsx` | 修正 | `onCopy`/`onCut`/`onPaste` の判定ロジックを `isNativeTextSelection()`（テキスト選択検知）から `isNodeSelectionContext()`（`selectedIds.length > 0 \|\| effectiveSelectionMode`）に置き換え。条件を満たさない場合は `preventDefault` を呼ばず即 return し、ブラウザのネイティブ処理に完全に委譲 |

#### 設計上の重要な判断

- **判定基準の一本化**: 「テキスト選択中か」という間接的な判定から、「ノードが選択されているか／選択モード中か」という直接的な状態判定に変更。これにより、複数ノード選択中に偶然 contentEditable がフォーカスされていても階層操作が正しく発動し、逆に通常編集中は内部クリップボードに一切触れずネイティブ動作（Win+V等）を保証する。

#### ビルド確認

```
npx tsc --noEmit  → 出力なし（エラーゼロ）
npm run build     → ✓ Compiled successfully
```

---

### 2026-06-17 — クリップボード干渉バグ修正（Ctrl+V / Win+V / テキスト選択コピー）

**種別**: バグ修正（重篤）

#### 修正した内容

| # | 現象 | 修正内容 |
|---|---|---|
| 1 | 一度ノードをコピーすると `_nodeClipboard` が残り続け、Win+V や別アプリからのテキストペーストが常にノード貼り付けに上書きされる | `onPaste` に `active?.isContentEditable` ガードを追加。contenteditable がフォーカス中は構造ペーストを完全スキップし、ネイティブテキストペーストにフォールスルー |
| 2 | コンテキストメニューから「コピー」「切り取り」すると、テキストを部分選択していてもノード全体が操作される | `handleContextMenuCopy` / `handleContextMenuCut` の冒頭に `window.getSelection()?.toString()` チェックを追加。テキスト選択中は `document.execCommand("copy"/"cut")` で選択テキストのみを操作し早期リターン |

#### 変更ファイル

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `src/app/page.tsx` | 修正 | `onPaste`: `document.activeElement?.isContentEditable` が true の場合は即 return（Win+V・クロスアプリペースト・通常テキスト編集を完全保護）。`handleContextMenuCopy`/`handleContextMenuCut`: テキスト選択中は `document.execCommand` でブラウザ標準動作を実行して return、選択なしの場合のみ階層コピペ処理へ進む |

#### 設計上の重要な判断

- **構造ペーストの発動条件を厳格化**: `_nodeClipboard` にデータがあっても、contenteditable がアクティブな場合はネイティブペーストを一切妨害しない。構造ペーストが発動するのは「ブロック選択モード中」や「ノードからフォーカスが外れた状態」のみ。
- **コンテキストメニューの `onMouseDown` と連携**: NodeContextMenu は `onMouseDown` で `e.preventDefault()` を呼ぶことでボタンクリック時もブラウザのテキスト選択を保持する。この仕様を利用し、コピーボタンクリック時点で `window.getSelection().toString()` が選択テキストを返す。

#### ビルド確認

```
npx tsc --noEmit  → 出力なし（エラーゼロ）
npm run build     → ✓ Compiled successfully
```

---

### 2026-06-15 — コンテキストメニューUIバグ修正・Ctrl+C/V 階層コピペ完全対応

**種別**: バグ修正

#### 修正した内容

| # | 内容 | 種別 |
|---|---|---|
| 1 | コンテキストメニューの「カードを追加」「表を追加」が絵文字アイコン二重表示になっていたバグを修正 | バグ修正 |
| 2 | Ctrl+C / Ctrl+X がブロック選択なし（単一フォーカスノード）でも階層コピー・カットできるよう修正 | バグ修正 |
| 3 | Ctrl+V（paste イベント）が完全に未実装だったため、内部クリップボードからの階層ペーストを追加 | バグ修正 |

#### 変更ファイル

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `src/i18n/messages.ts` | 修正 | `ctx.addCard`・`ctx.addTable` のEN/JA翻訳文から絵文字プレフィックスを削除（絵文字は `NodeContextMenu` の `icon` prop 側で一元管理） |
| `src/app/page.tsx` | 修正 | `onCopy`/`onCut`: `selectedIds` が空の場合も `activeId`（フォーカス中ノード）にフォールバックして階層コピー実行。`onPaste`: `document.addEventListener("paste", ...)` を新規追加。`pasteNodesAfter(activeId)` が `true` を返した場合のみ `preventDefault()` し、`_nodeClipboard` が空の場合はブラウザ標準テキストペーストにフォールスルー |

#### 設計上の重要な判断

- **Ctrl+V フォールスルー設計**: 内部クリップボード (`_nodeClipboard`) が空の場合は `pasteNodesAfter` が `false` を返すため `preventDefault()` を呼ばない。これにより、階層データがない場合はブラウザのネイティブテキストペーストが通常通り動作する。
- **絵文字の二重管理を排除**: i18nメッセージ文字列に絵文字を含めるとコンポーネント側の `icon` prop と重複する。絵文字はUI層（`NodeContextMenu.tsx` の `icon` prop）のみで管理し、翻訳文は純粋なラベル文字列とする。

#### ビルド確認

```
npx tsc --noEmit  → 出力なし（エラーゼロ）
npm run build     → ✓ Compiled successfully
```

---

### 2026-06-11 — アウトライナー操作性の強化（階層コピペ・複数選択Cut修正）

**種別**: バグ修正 / 新機能

#### 修正・実装した内容

| # | 内容 | 種別 |
|---|---|---|
| 1 | 階層構造（子・孫ノード）を含む構造コピペ機能の実装 | 新機能 |
| 2 | Ctrl複数選択時の切り取り（Cut）が1ノードしか削除されないバグを修正 | バグ修正 |
| 3 | 複数選択ノードをペースト時に文頭に余分なスペースが入るバグを修正 | バグ修正 |
| 4 | 右クリックメニュー（コンテキストメニュー）に「コピー」「切り取り」「貼り付け」ボタンを追加 | 新機能 |

#### 変更ファイル

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `src/hooks/useMemos.ts` | 修正 | モジュールレベル内部クリップボード `_nodeClipboard` を追加。`collectSelectionRoots`・`cloneTreeWithFreshIds` ヘルパーを追加。`storeSelectedToClipboard`・`deleteSelectedNodes`・`pasteNodesAfter` 関数を追加。`insertSiblingWithPlainTextAfter` で各行を `trimStart()` するよう修正 |
| `src/app/page.tsx` | 修正 | `collectSelectedText` を深さ正規化（最小深さ=0）+ 各行 `.trim()` に改修。desktop `onCopy` イベントを構造クリップボード対応に更新。desktop `onCut` イベントハンドラを新規追加（これまで未実装）。モバイルのコピー/カット/ペーストを構造クリップボード優先ロジックに更新。`handleContextMenuCopy`・`handleContextMenuCut`・`handleContextMenuPaste` を追加し `NodeList` へ配線 |
| `src/i18n/messages.ts` | 修正 | `ctx.copy`, `ctx.cut`, `ctx.paste` を EN/JA 両方に追加 |
| `src/components/Editor/NodeContextMenu.tsx` | 修正 | `onCopyNode`・`onCutNode`・`onPasteNode` props 追加。STRUCTURE セクション末尾にクリップボードアクションバーを追加（📋/✂️/📥 ボタン） |
| `src/components/Editor/NoteNode.tsx` | 修正 | `onCopyNode`・`onCutNode`・`onPasteNode` props 追加。NodeContextMenu・子ノードへ伝達 |
| `src/components/Editor/NodeList.tsx` | 修正 | 同 props を追加・伝達 |

#### 設計上の重要な判断

- **内部クリップボード (`_nodeClipboard`)**: モジュールレベル変数に `NoteNode[]`（サブツリーごと）を保持。ページリロードで消えるが、通常操作では問題なし。Zustand store にしないのは、ペーストが Undo/Redo と干渉しないよう管理を明示的に分離するため。
- **構造ペーストのID採番**: `cloneTreeWithFreshIds` で全ノードに `makeId()` による新 ID を割り当て、重複を防止。
- **深さ正規化**: `collectSelectedText` は選択ノードの最小深さを 0 にリマップするため、選択がどの階層から始まっても文頭タブが入らない。
- **desktop Cut 追加**: これまで `onCopy` イベントのみ補足していたため、`Ctrl+X` は単一フォーカスノードの native cut しか動作しなかった。`onCut` ハンドラを追加し選択全ノードを一括削除するよう修正。
- **モバイルペースト**: 内部クリップボードが空の場合のみ `navigator.clipboard.readText()` で外部テキストにフォールバック。

#### ビルド確認

```
npx tsc --noEmit  → 出力なし（エラーゼロ）
npm run build     → ✓ Compiled successfully in 2.7s
```

---

### 2026-06-10 — ループ型チェックリスト機能の実装

**種別**: 新機能

#### 概要

チェックリストノードに自動リセット間隔（1時間 / 1日）を設定できる機能を実装。  
設定した時間が経過すると `completed` が自動的に `false` にリセットされ、繰り返しタスクに活用できる。

#### 変更ファイル

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `src/types/note.ts` | 修正 | `ResetInterval` 型（`"none" \| "1hour" \| "1day"`）追加。`NoteNode` に `resetInterval?` / `checkedAt` フィールド追加。`createNode` / `normalizeNode` / `cloneNoteTreeForPersistence` を対応 |
| `src/i18n/messages.ts` | 修正 | `ctx.autoReset`, `ctx.autoResetOff`, `ctx.autoReset1h`, `ctx.autoReset1d` を EN/JA 両方に追加 |
| `src/hooks/useMemos.ts` | 修正 | `toggleCompleted` を更新して `checkedAt` をセット。`setResetInterval` 関数追加。`resetExpiredTasks` 関数追加（`setMemos` 直接呼び出しで Undo 履歴を汚染しない）。60秒間隔の定期実行 `useEffect` 追加 |
| `src/components/Editor/NodeContextMenu.tsx` | 修正 | `onSetResetInterval` prop 追加。TASK セクション末尾にリセット間隔セレクタ UI 追加（OFF / 1h / 1d の 3 ボタン） |
| `src/components/Editor/NoteNode.tsx` | 修正 | `onSetResetInterval` prop 追加。チェックボックス横に 🔄 インジケーター追加、子ノードへ props を伝達 |
| `src/components/Editor/NodeList.tsx` | 修正 | `onSetResetInterval` prop を追加・伝達 |
| `src/app/page.tsx` | 修正 | `setResetInterval` を `useMemos` から destructure し `NodeList` へ渡す |

#### データスキーマ

```typescript
export type ResetInterval = "none" | "1hour" | "1day";

// NoteNode への追加フィールド
resetInterval?: ResetInterval;  // undefined / "none" はリセットなし
checkedAt: string | null;       // ISO 文字列。チェック時にセット、解除時に null
```

#### UI 仕様

- 右クリックメニュー → TASK セクション → チェックボックス ON 時のみ「🔄 自動リセット」行を表示
- 選択肢: `OFF` / `1h` / `1d`（現在の設定をハイライト）
- 定期リセット設定済みタスクのチェックボックス横に 🔄 を表示

#### リセットロジック

- `resetExpiredTasks` はアプリ起動時（`isHydrated` 直後）と 60 秒間隔で実行
- `completed === true` かつ `resetInterval` 設定済みかつ `checkedAt` から指定時間経過した場合のみリセット
- `setMemos` 直接呼び出し（`updateActiveNodes` を経由しない）で Undo 履歴を汚染しない

#### ビルド確認

```
npx tsc --noEmit  → 出力なし（エラーゼロ）
npm run build     → ✓ Compiled successfully in 5.2s
```

---

### 2026-06-10 — 汎用テーブル（表）機能の実装

**種別**: 新機能

#### 概要

ノード単位でスプレッドシート型テーブルをアタッチできる機能を実装。  
既存のテキストエディタ・カーソル挙動に一切干渉しない独立コンポーネント設計。

#### 変更ファイル

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `src/types/note.ts` | 修正 | `TableColumn`, `TableRow`, `TableData` 型追加。`NoteNode.tableData?` フィールド追加。`normalizeTableData()` 追加。`createNode` / `normalizeNode` / `cloneNoteTreeForPersistence` を対応 |
| `src/i18n/messages.ts` | 修正 | `ctx.addTable`, `table.badge`, `table.removeTable`, `table.removeTableConfirm`, `table.addColumn`, `table.addRow`, `table.colPh` を EN/JA 両方に追加 |
| `src/components/Editor/TableNodeCard.tsx` | 新規 | テーブル UI コンポーネント。列追加・名前変更・削除、行追加・削除、セル編集、削除確認ダイアログ、ダークテーマ対応 |
| `src/hooks/useMemos.ts` | 修正 | `addTableToNode`, `removeTable`, `addTableColumn`, `renameTableColumn`, `removeTableColumn`, `addTableRow`, `removeTableRow`, `patchTableCell` の 8 CRUD 関数を追加 |
| `src/components/Editor/NodeContextMenu.tsx` | 修正 | `onAddTable` prop 追加。NODE セクションに「📊 表を追加」メニュー項目を追加（テーブル未付与時のみ表示） |
| `src/components/Editor/NoteNode.tsx` | 修正 | テーブル 8 props 追加、`TableNodeCard` をノート欄の下にマウント、子ノードへ props を伝達 |
| `src/components/Editor/NodeList.tsx` | 修正 | テーブル props を NodeList → NoteNode へフル配線 |
| `src/app/page.tsx` | 修正 | `useMemos` からテーブル関数を destructure し `NodeList` へ渡す |

#### データスキーマ

```typescript
interface TableColumn { id: string; label: string; }
interface TableRow    { id: string; cells: Record<string, string>; }
interface TableData   { columns: TableColumn[]; rows: TableRow[]; }

// NoteNode への追加フィールド
tableData?: TableData;  // cardData / pluginData / gameData と独立して共存可能
```

#### UI 仕様

- テーブルはノード本文・ノート欄の **下部**に独立マウント（`CustomNodeCard` と同アーキテクチャ）
- 列ヘッダーはインライン編集可能（`<input>`）
- セルは `onChange` でリアルタイム更新、`onBlur` で `"immediate"` 履歴コミット
- テーブル削除は確認ダイアログ付き（誤操作防止）
- 右クリックメニュー → NODE セクション → 「📊 表を追加」でアタッチ
- `readOnly` モード（共有閲覧者）では全編集 UI が非表示

#### ビルド確認

```
npx tsc --noEmit  → 出力なし（エラーゼロ）
npm run build     → ✓ Compiled successfully in 3.0s
```

---

### 2026-06-08〜09 — エディタ致命的バグ修正 6件

**種別**: バグ修正

#### 修正したバグ

| # | バグ内容 | 根本原因 | 修正内容 |
|---|---|---|---|
| 1 | Glossary オーバーレイの ON/OFF トグルが効かない（常に生テキスト表示） | `g` フラグ付き module-level 正規表現の `lastIndex` 競合 + SSR 時の `localStorage` 読み取り | `GlossaryOverlay.tsx`: 呼び出しごとに `new RegExp()` を生成。`glossaryStore.ts`: `"use client"` 追加・SSR セーフ初期化 |
| 2 | ペーストがカーソル位置ではなくテキスト先頭に入る | `savedSelectionRef` が DOM ノード参照を保存 → `el.innerHTML` 書き換えで参照が無効化 | `NoteNode.tsx`: キャレット保存をキャラクタオフセット整数に変更（`getCaretCharOffset` / `setCaretToOffset`） |
| 3 | 文章途中で Enter を押すと後半テキストが消える | 同上（DOM 参照無効化） | Enter ハンドラを `Range.extractContents()` ベースに書き換え。`splitNode` 関数を `useMemos.ts` に追加 |
| 4 | Shift+Tab でノードが消える | `unindentNode` のアルゴリズム調査→明確な再現条件が見つからず | 保留（不定期発生・低優先度） |
| 5 | 長い単語が container からはみ出す | `break-words` では word boundary のない文字列に非対応 | エディタ div と GlossaryOverlay に `[overflow-wrap:anywhere]` (Tailwind 任意値) を追加 |
| 6 | ビルド確認 | — | `npx tsc --noEmit` エラーゼロ、`npm run build` 成功を確認 |

#### 主要変更ファイル

- `src/components/Editor/GlossaryOverlay.tsx` — 正規表現の共有状態バグ修正
- `src/stores/glossaryStore.ts` — `"use client"` + SSR セーフ初期化
- `src/components/Editor/NoteNode.tsx` — キャレット保存方式の変更、Enter キー split ロジック
- `src/hooks/useMemos.ts` — `splitNode` 関数追加

---

### 2026-06-08 — インライン用語解説（Glossary）オーバーレイ 実装

**種別**: 新機能

#### 概要

`[[単語:解説]]` 記法でノード本文に用語定義を埋め込み、非フォーカス時にインタラクティブなオーバーレイとして表示する機能。

#### 仕様

| 項目 | 内容 |
|---|---|
| 記法 | `[[単語:解説]]` （コロンは半角 `:` / 全角 `：` / パイプ `\|` に対応） |
| 表示条件 | エディタが非フォーカス状態 かつ 用語パターンが存在する場合 |
| オーバーレイ | ホバーでツールチップ表示（用語説明）、クリックで編集モード復帰 |
| ON/OFF | コンテキストメニュー → NODE → 「📖 用語解説オーバーレイ」トグル |
| 永続化 | `localStorage` (`freavia-glossary-enabled`) に状態保存 |

#### 変更ファイル

- `src/components/Editor/GlossaryOverlay.tsx` — オーバーレイ本体
- `src/stores/glossaryStore.ts` — Zustand ストア（ON/OFF 状態管理）
- `src/components/Editor/NoteNode.tsx` — マウント・表示条件
- `src/components/Editor/NodeContextMenu.tsx` — トグル UI 追加

---

### 過去の主要実装（詳細記録以前）

#### UI / UX ブラッシュアップ

- **スクロールバーのカスタム**: 極細化（幅 4px）、ダークテーマ対応カラー
- **サイドバー境界線の z-index 修正**: コンテキストメニュー等の重なり問題を解決
- **コンテキストメニューのアコーディオン化**: 各セクション（STRUCTURE / TASK / NODE / TEXT / STYLE）をアコーディオン形式で折りたたみ可能に。文字色を明るくし視認性向上
- **カラーパレットの整理**: 不要なプリセットカラーを非表示

#### コア機能（既存）

- **アウトライン編集**: ノードの追加・削除・インデント・アンインデント、ドラッグ並び替え
- **ノードタイプ**: 標準テキスト / プラグインカード / ゲーム仕様カード / カスタムカード
- **テーマシステム**: ノード行ごとの背景色・見出しレベル・チェックボックス対応
- **画像アタッチ**: ドラッグ&ドロップ / クリップボードペースト → Supabase Storage アップロード
- **フォーカスモード**: 特定ノードにズームイン（パンくずリスト付き）
- **多言語対応**: 日本語・英語の切り替え（`src/i18n/messages.ts`）
- **クラウド同期**: Supabase Auth + PostgreSQL によるリアルタイム同期
- **履歴管理**: Undo / Redo（ワークスペーススナップショット方式）
- **バックアップ**: JSON エクスポート / インポート

---

## 今後の実装候補

> このセクションは随時更新する。

- [ ] モバイル UX のさらなる改善（フローティングツールバー）
- [ ] テーブルのドラッグ＆ドロップによる列・行の並び替え
- [ ] Glossary オーバーレイのホバーアニメーション改善
- [ ] Shift+Tab ノード消失バグの根本原因特定と修正

---

*最終更新: 2026-06-10 (ループ型チェックリスト追加)*
