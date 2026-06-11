// =====================================================
// spec-engine.js  —  MISUMI スペック↔WYS連動エンジン
// 本番: WYS HTML に <script src="spec-engine.js" defer> で読み込む
// マッピングデータ: <div id="spechl-mapping" data-series="..." data-mapping='...'>
// 開発: chrome拡張 content.js と同一ロジック（LocalStorageフォールバック付き）
// =====================================================

(function() {
  'use strict';
  if (window.__specHighlightInjected) {
    document.getElementById('spechl-style')?.remove();
    document.getElementById('spechl-indicator')?.remove();
    document.getElementById('spechl-badge')?.remove();
    document.getElementById('pn-float')?.remove();
    document.querySelectorAll('.spechl-svg-overlay').forEach(e => e.remove());
    document.querySelectorAll('.spechl-dim-popup').forEach(e => e.remove());
    document.querySelectorAll('.spechl-dim-badge').forEach(e => e.remove());
    document.querySelectorAll('.spechl-dim-value-text').forEach(e => e.remove());
  }
  window.__specHighlightInjected = true;

  // ===== CSS注入（外部spechl.cssがロード済みの場合はスキップ） =====
  if (!document.querySelector('link[href*="spechl"]')) {
  const css = document.createElement('style');
  css.id = 'spechl-style';
  css.textContent = `
    @keyframes spechl-blink {
      0%   { background-color: rgba(0,64,152,0.1); }
      50%  { background-color: rgba(0,64,152,0.35); }
      100% { background-color: rgba(0,64,152,0.1); }
    }
    .spechl-active {
      animation: spechl-blink .8s ease-in-out infinite !important;
      outline: 2px solid #004098 !important;
      outline-offset: -1px;
      position: relative; z-index: 1;
    }
    body:not(.spechl-disabled) .spechl-spec-hover {
      background: #ecf3fc !important;
      box-shadow: inset 3px 0 0 #004098 !important;
    }
    #spechl-indicator {
      position: fixed; left: 16px; bottom: 20px;
      background: #004098; color: #fff;
      padding: 10px 18px; border-radius: 8px;
      font-size: 13px; font-weight: 700;
      font-family: Meiryo UI, sans-serif;
      box-shadow: 0 4px 16px rgba(0,0,0,.3);
      z-index: 10000; opacity: 0;
      transform: translateY(10px);
      transition: opacity .2s, transform .2s;
      pointer-events: none;
    }
    #spechl-indicator.visible { opacity:1; transform:translateY(0); }

    .spechl-confirmed-row td {
      background: rgba(0,64,152,0.08) !important;
    }
    .spechl-confirmed-value {
      background: rgba(0,200,100,0.15) !important;
      outline: 2px solid #00aa55 !important;
      font-weight: 700 !important;
    }
    .spechl-confirmed-cross {
      background: rgba(255,200,0,0.2) !important;
      outline: 2px solid #cc9900 !important;
    }
    .spechl-confirmed-type .fontType {
      color: #fff !important; background: #004098;
      padding: 1px 6px; border-radius: 3px;
    }

    /* SVGオーバーレイ */
    .spechl-svg-overlay {
      position: absolute; top: 0; left: 0;
      pointer-events: none; z-index: 10;
    }
    .spechl-dim-label { pointer-events: all; cursor: pointer; }
    .spechl-dim-label rect { transition: opacity .15s; }
    .spechl-dim-label:hover rect { opacity: 1 !important; }

    /* 寸法入力ポップアップ */
    .spechl-dim-popup {
      position: absolute; background: #fff;
      border: 2px solid #004098; border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0,0,0,.2);
      z-index: 10001; min-width: 180px;
      font-family: Meiryo UI, sans-serif;
    }
    .spechl-dim-popup-header {
      display: flex; justify-content: space-between; align-items: center;
      background: #004098; color: #fff; padding: 5px 10px;
      border-radius: 6px 6px 0 0; font-size: 12px; font-weight: 700;
    }
    .spechl-dim-popup-close {
      background: none; border: none; color: #fff;
      font-size: 16px; cursor: pointer;
    }
    .spechl-dim-popup-body {
      padding: 8px 10px; display: flex; align-items: center; gap: 6px;
    }
    .spechl-dim-popup-body select {
      padding: 5px 8px; border: 1px solid #004098; border-radius: 4px;
      font-size: 13px; min-width: 100px;
    }
    .spechl-dim-popup-body input[type=number] {
      width: 70px; padding: 5px 8px; border: 1px solid #004098;
      border-radius: 4px; font-size: 13px; text-align: center;
    }

    /* 寸法バッジ */
    .spechl-dim-badge {
      position: absolute; padding: 2px 8px; border-radius: 10px;
      background: #004098; color: #fff; font-size: 11px; font-weight: 700;
      box-shadow: 0 2px 6px rgba(0,0,0,.2); z-index: 11;
      pointer-events: none; white-space: nowrap;
      animation: spechl-badge-pop .3s ease;
    }
    .spechl-dim-badge-red { background: #cc0000; }
    @keyframes spechl-badge-pop { 0%{transform:scale(0)} 50%{transform:scale(1.2)} 100%{transform:scale(1)} }

    /* 型式フローティングウインドウ */
    #pn-float {
      position: fixed; bottom: 20px; right: 70px;
      width: 320px; background: linear-gradient(135deg,#001830,#002855);
      border: 2px solid #004098; border-radius: 10px;
      z-index: 10000; box-shadow: 0 8px 32px rgba(0,0,0,.4);
      font-family: Meiryo UI, sans-serif; overflow: hidden;
      animation: pnFloatIn .4s ease;
    }
    #pn-float::before {
      content:''; position:absolute; top:0; left:0; right:0; height:3px;
      background: linear-gradient(90deg,#004098,#00c8ff,#004098);
      background-size: 200% 100%;
      animation: pnShimmer 3s ease infinite;
    }
    @keyframes pnFloatIn { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
    @keyframes pnShimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
    #pn-float.collapsed .pn-float-body { display:none; }
    .pn-float-header {
      display:flex; align-items:center; gap:8px;
      padding:7px 12px; background:rgba(0,64,152,.3);
      cursor:move; user-select:none;
    }
    #pn-float.dragging { opacity:.8; box-shadow:0 12px 40px rgba(0,0,0,.5); }
    #pn-float.dragging .pn-float-header { cursor:grabbing; }
    .pn-float-header::before {
      content:'⋮⋮'; color:rgba(255,255,255,.4);
      font-size:10px; margin-right:2px; letter-spacing:-2px;
    }
    .pn-float-title { font-size:11px; color:#88aacc; font-weight:700; flex:1; }
    .pn-status {
      font-size:10px; font-weight:700; padding:2px 8px; border-radius:10px;
    }
    .pn-status.pending { background:#553300; color:#ffaa00; }
    .pn-status.partial { background:#003355; color:#00c8ff; }
    .pn-status.complete { background:#004020; color:#00ff88; }
    .pn-float-btn {
      background:none; border:1px solid #335577; color:#88aacc;
      width:20px; height:20px; border-radius:4px; font-size:13px;
      cursor:pointer; display:flex; align-items:center; justify-content:center;
    }
    .pn-float-btn:hover { background:rgba(255,255,255,.1); }
    .pn-float-clear {
      background:none; border:1px solid #553333; color:#cc8888;
      padding:1px 7px; border-radius:4px; font-size:10px; cursor:pointer;
      font-family:inherit;
    }
    .pn-float-clear:hover { background:rgba(255,80,80,.2); color:#ff8888; }
    .pn-float-body { padding:8px 12px 12px; }
    .pn-display {
      display:flex; align-items:center; gap:2px; flex-wrap:wrap;
      font-family:Consolas,Monaco,monospace; font-size:16px; font-weight:700;
      padding:6px 0; min-height:38px;
    }
    .pn-seg.set { cursor:help; }
    .pn-seg.opt { cursor:help; }
    .pn-seg {
      padding:3px 7px; border-radius:4px; transition:all .3s;
    }
    .pn-seg.pending { color:#556677; background:rgba(255,255,255,.05); border:1px dashed #334455; }
    .pn-seg.set { color:#fff; background:#004098; border:1px solid #0060e0; animation:pnSegPop .4s ease; }
    .pn-seg.opt { color:#445566; background:transparent; border:1px dashed #2a3a4a; font-size:13px; }
    .pn-seg.opt.set { color:#fff; background:#006644; border:1px solid #00aa66; font-size:20px; }
    @keyframes pnSegPop { 0%{transform:scale(1)} 50%{transform:scale(1.15);background:#0070cc} 100%{transform:scale(1)} }
    .pn-sep { color:#445566; font-size:16px; margin:0 1px; }
    .pn-guide { margin-top:6px; padding-top:6px; border-top:1px solid #1a3050; }
    .pn-guide-title { font-size:10px; color:#6688aa; margin-bottom:4px; font-weight:700; }
    .pn-guide-sub { margin-top:6px; padding-top:5px; border-top:1px dashed #1a3050; }
    .pn-guide-sub-title { font-size:9px; color:#445566; margin-bottom:3px; font-weight:700; letter-spacing:.3px; }
    .pn-guide-item {
      display:inline-flex; align-items:center; gap:3px; font-size:10px;
      padding:3px 8px; border-radius:12px; margin:2px;
    }
    .pn-guide-item.req { background:rgba(255,170,0,.15); color:#ffaa00; border:1px solid rgba(255,170,0,.3); cursor:pointer; }
    .pn-guide-item.req:hover { background:rgba(255,170,0,.3); transform:translateY(-1px); }
    .pn-guide-item.sub { background:rgba(100,180,255,.08); color:#6699bb; border:1px solid rgba(100,180,255,.2); cursor:pointer; font-size:9px; }
    .pn-guide-item.sub:hover { background:rgba(100,180,255,.18); color:#88bbdd; }
    .pn-guide-item.done { background:rgba(0,255,100,.1); color:#44aa66; border:1px solid rgba(0,255,100,.15); text-decoration:line-through; opacity:.5; pointer-events:none; }
    .pn-complete-msg {
      margin-top:6px; padding:6px 10px; background:rgba(0,255,100,.1);
      border:1px solid rgba(0,255,100,.3); border-radius:6px;
      color:#00ff88; font-size:11px; font-weight:700; text-align:center;
    }
    #spechl-badge {
      position:fixed; top:10px; right:10px;
      background:linear-gradient(135deg,#001830,#004098);
      color:#fff; padding:6px 14px; border-radius:20px;
      font-size:11px; font-family:Meiryo UI,sans-serif;
      z-index:10000; box-shadow:0 2px 8px rgba(0,0,0,.3);
      display:flex; align-items:center; gap:8px;
    }
    #spechl-badge.off {
      background:linear-gradient(135deg,#333,#666);
      opacity:0.8;
    }
    #spechl-badge .spechl-toggle-switch {
      display:inline-flex; align-items:center;
      width:34px; height:18px; border-radius:10px;
      background:rgba(0,255,100,.3); position:relative;
      cursor:pointer; transition:background .2s;
      border:1px solid rgba(255,255,255,.4);
    }
    #spechl-badge.off .spechl-toggle-switch { background:rgba(255,255,255,.15); }
    #spechl-badge .spechl-toggle-knob {
      position:absolute; top:1px; left:1px;
      width:14px; height:14px; border-radius:50%;
      background:#fff; transition:transform .2s;
      box-shadow:0 1px 3px rgba(0,0,0,.3);
    }
    #spechl-badge.off .spechl-toggle-knob { transform:translateX(16px); background:#ccc; }
    #spechl-badge .spechl-badge-label { font-weight:700; cursor:pointer; }
    #spechl-badge .spechl-badge-close {
      opacity:.6; cursor:pointer; font-size:12px;
      padding:0 4px; border-left:1px solid rgba(255,255,255,.3);
    }
    #spechl-badge .spechl-badge-close:hover { opacity:1; }
    body.spechl-disabled .spechl-active,
    body.spechl-disabled .spechl-confirmed-row,
    body.spechl-disabled .spechl-confirmed-value,
    body.spechl-disabled .spechl-confirmed-cross,
    body.spechl-disabled .spechl-confirmed-type { all: unset !important; }
    body.spechl-disabled #spechl-indicator,
    body.spechl-disabled .spechl-svg-overlay,
    body.spechl-disabled .spechl-dim-badge,
    body.spechl-disabled #pn-float,
    body.spechl-disabled .spechl-click-toast,
    body.spechl-disabled .spechl-dim-popup { display:none !important; }
    body.spechl-disabled .spechl-clickable-row { cursor:default !important; }
    /* マッチ失敗スペックの表示 */
    .spechl-no-match { position:relative; }
    .spechl-no-match::after {
      content:'規格表対応なし';
      position:absolute; top:6px; right:8px;
      background:rgba(160,160,160,0.15); color:#888;
      padding:1px 8px; border-radius:10px;
      font-size:9px; font-weight:700;
      border:1px solid rgba(160,160,160,0.3);
      pointer-events:none;
    }
    .spechl-matched { position:relative; }

    /* ステータスメッセージ（右下常時表示） */
    #spechl-status {
      position:fixed; bottom:20px; left:20px;
      background:rgba(255,170,0,0.95); color:#fff;
      padding:6px 14px; border-radius:16px;
      font-size:11px; font-weight:700;
      font-family:Meiryo UI,sans-serif;
      z-index:9999; max-width:360px;
      box-shadow:0 2px 8px rgba(0,0,0,.2);
      animation:fadeIn .3s ease;
    }
    #spechl-status.info { background:rgba(0,64,152,0.9); }
    @keyframes fadeIn { from{opacity:0} to{opacity:1} }

    .spechl-clickable-row { cursor:pointer; }
    body:not(.spechl-disabled) .spechl-clickable-row:hover td { background:rgba(0,64,152,0.08) !important; }
    .spechl-row-clicked td { animation:spechl-row-flash .5s ease !important; }
    /* D寸選択後：非該当行を淡く、該当行を微ハイライト */
    .spechl-row-inactive td { opacity:0.22; transition:opacity 0.15s; }
    .spechl-row-active td { background:rgba(0,167,74,0.06) !important; }
    @keyframes spechl-row-flash {
      0%{background:rgba(0,64,152,0.05)} 40%{background:rgba(0,200,100,0.25)} 100%{background:rgba(0,64,152,0.05)}
    }
    .spechl-click-toast {
      position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
      background:rgba(0,64,152,0.95); color:#fff;
      padding:14px 28px; border-radius:10px;
      font-size:15px; font-weight:700; font-family:Meiryo UI,sans-serif;
      box-shadow:0 8px 24px rgba(0,0,0,.3); z-index:10002;
      animation:spechl-toast-in .3s ease; pointer-events:none;
    }
    @keyframes spechl-toast-in {
      from{opacity:0;transform:translate(-50%,-50%) scale(.9)} to{opacity:1;transform:translate(-50%,-50%) scale(1)}
    }
  `;
  document.head.appendChild(css);
  } // end CSS injection guard

  // ===== 共通要素 =====
  const indicator = document.createElement('div');
  indicator.id = 'spechl-indicator';
  document.body.appendChild(indicator);

  const badge = document.createElement('div');
  badge.id = 'spechl-badge';
  badge.innerHTML = `
    <span class="spechl-badge-label">✨ スペック↔WYS連動</span>
    <span class="spechl-toggle-switch" title="機能ON/OFFを切り替え">
      <span class="spechl-toggle-knob"></span>
    </span>
    <span class="spechl-badge-state">ON</span>
    <span class="spechl-badge-close" title="バッジを閉じる">✕</span>
  `;
  document.body.appendChild(badge);

  // ON/OFF切り替え
  const toggleSwitch = badge.querySelector('.spechl-toggle-switch');
  const stateLabel = badge.querySelector('.spechl-badge-state');
  const toggleHandler = () => {
    const isOff = document.body.classList.toggle('spechl-disabled');
    badge.classList.toggle('off', isOff);
    stateLabel.textContent = isOff ? 'OFF' : 'ON';
  };
  toggleSwitch.addEventListener('click', toggleHandler);
  badge.querySelector('.spechl-badge-label').addEventListener('click', toggleHandler);
  stateLabel.addEventListener('click', toggleHandler);
  badge.querySelector('.spechl-badge-close').addEventListener('click', (e) => {
    e.stopPropagation();
    badge.remove();
  });

  // ===== テキストマッチ（汎用化: 全カテゴリ対応） =====
  // specName側と WYSヘッダー側の表記パターンを広く網羅
  // OFF状態かチェック
  const isDisabled = () => document.body.classList.contains('spechl-disabled');

  const RULES = [
    // 軸径D系 (D, D1, ΦD, 軸径, 刃径, シャンク径, 外径)
    { p:/軸径.*[Dd]|[Dd].*[φ(]|刃径|シャンク径|外径|直径|^D$|^d$/,
      w:[/^D\d*$/,/^d\d*$/,/^D公差/,/^Φd?\d*$/i,/^刃径/,/^シャンク径/,/^外径/,/^直径/,/^φ\d*$/i] },
    // 長さL系 (L, L1, ℓ, 全長, 刃長)
    { p:/長さ.*[Ll]|[Ll].*mm|全長|刃長|^L$|^ℓ$/,
      w:[/^L\d*$/,/^ℓ\d*$/,/^全長/,/^刃長/,/^l\d*$/] },
    // 材質
    { p:/材質|材料/, w:[/材質/,/^材料$/,/\[ ?M ?\] ?材質/] },
    // 硬度
    { p:/硬度/, w:[/硬度/,/\[ ?H ?\]/] },
    // 表面処理
    { p:/表面処理|仕上/, w:[/表面処理/,/^仕上$/,/\[ ?S ?\]/] },
    // めねじM系 (単独M、並目M、M×P)
    { p:/めねじ.*\[M\]|めねじ.*M\(|^M$|M×P/,
      w:[/^M$/,/M\(並目\)/,/M×P/,/^\[M\]/] },
    // めねじN系（M(並目)・N(並目)選択のような結合ヘッダーにもマッチ）
    { p:/めねじ.*\[N\]|めねじ.*N\(|^N$/, w:[/^N$/,/N\(並目\)/,/N.*並目/,/^N\d/] },
    // D公差 / 公差
    { p:/D公差|公差/, w:[/^D公差$/,/公差$/,/^[Tt]公差$/] },
    // Type / 型式
    { p:/タイプ|Type|型式|型番/i, w:[/^Type$/i,/^型式$/,/^型番$/] },
    // P (ピッチ / 位置)
    { p:/ピッチ|^P$|位置/, w:[/^P$/,/^P・/,/ピッチ/] },
    // 板厚 / 厚み
    { p:/板厚|厚み|厚さ/, w:[/板厚/,/厚[みさ]/,/^T$/] },
    // 幅
    { p:/幅|^W$/, w:[/^W$/,/幅$/] },
    // 高さ
    { p:/高[さ度]|^H$/, w:[/^H$/,/高さ$/] },
    // R (コーナーR)
    { p:/^R$|コーナー/, w:[/^R$/] },
    // 重量
    { p:/重量|質量/, w:[/重量/,/質量/] },
  ];

  // テキスト正規化（<sub>, <br>, 空白, カッコ内公差等を統一）
  function normalizeText(el) {
    if (!el) return '';
    // clonedで<sub>等をテキスト化
    const clone = el.cloneNode(true);
    // <sub>タグを添字としてインライン化 (D<sub>1</sub> → D1)
    clone.querySelectorAll('sub').forEach(s => { s.replaceWith(s.textContent); });
    clone.querySelectorAll('sup').forEach(s => { s.replaceWith(s.textContent); });
    // <br>を空白に
    clone.querySelectorAll('br').forEach(br => br.replaceWith(' '));
    let txt = clone.textContent.trim();
    // 複数空白を1つに
    txt = txt.replace(/\s+/g, ' ');
    // カッコ内の公差情報 (h6), (p6) 等は削除してメインの記号だけ取得できるよう別途
    return txt;
  }

  // 1つのセルから複数の候補テキストを抽出（全体 + カッコ前の主要部分）
  function extractTexts(el) {
    const full = normalizeText(el);
    const results = [full.replace(/\s+/g, '')]; // 空白除去版
    // カッコ前の主要部分 (例: "D (h6)" → "D")
    const main = full.split(/[（(]/)[0].trim();
    if (main && main !== full) results.push(main.replace(/\s+/g, ''));
    return [...new Set(results)];
  }

  // =====================================================
  // レイヤー2: スコアリングマッチング
  // =====================================================
  // 日本語↔記号の同義語辞書
  const SYNONYMS = [
    ['軸径','D'], ['直径','D'], ['外径','D'], ['刃径','D'], ['シャンク径','d'],
    ['長さ','L'], ['全長','L'], ['刃長','ℓ'],
    ['材質','material'], ['材料','material'],
    ['硬度','hardness'], ['表面処理','surface'], ['仕上','surface'],
    ['板厚','T'], ['厚さ','T'], ['厚み','T'],
    ['幅','W'], ['高さ','H'],
    ['ピッチ','P'], ['質量','weight'], ['重量','weight'],
    ['めねじ','M'],
  ];

  // specNameから寸法記号を抽出 (例: "軸径 D(φ)" → ["D"])
  function extractSymbolsFromSpec(specName) {
    const syms = new Set();
    // [ M ] 材質, [M](mm) 等のカッコ内記号
    const bracketMatches = specName.matchAll(/\[\s*([A-Za-zℓΦ]\d*)\s*\]/g);
    for (const m of bracketMatches) syms.add(m[1]);
    // (φ), (M) 等の小カッコ
    const parenMatches = specName.matchAll(/[（(]\s*([A-Za-zℓΦ]\d*)\s*[）)]/g);
    for (const m of parenMatches) syms.add(m[1]);
    // 単独の大文字/小文字記号（スペース区切り）
    const tokenMatches = specName.matchAll(/(?:^|\s)([A-Zℓd]\d*)(?:\s|$|\()/g);
    for (const m of tokenMatches) syms.add(m[1]);
    // 日本語→記号の変換
    SYNONYMS.forEach(([jp, sym]) => {
      if (specName.includes(jp)) syms.add(sym);
    });
    return [...syms];
  }

  // 2つの文字列の類似度スコア (0-100)
  function similarity(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 100;
    const aLow = a.toLowerCase();
    const bLow = b.toLowerCase();
    if (aLow === bLow) return 95;
    if (aLow.includes(bLow) || bLow.includes(aLow)) {
      return 80 - Math.abs(a.length - b.length) * 3;
    }
    // 編集距離ベースの類似度
    const dist = levenshtein(aLow, bLow);
    const maxLen = Math.max(a.length, b.length);
    return Math.max(0, Math.round(100 * (1 - dist / maxLen)) - 20);
  }

  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (m === 0) return n; if (n === 0) return m;
    const dp = Array.from({length:m+1}, () => new Array(n+1).fill(0));
    for (let i=0;i<=m;i++) dp[i][0]=i;
    for (let j=0;j<=n;j++) dp[0][j]=j;
    for (let i=1;i<=m;i++) for (let j=1;j<=n;j++) {
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j-1], dp[i-1][j], dp[i][j-1]);
    }
    return dp[m][n];
  }

  // スコアリングマッチング: specNameと全WYSヘッダーテキストを照合
  function scoreMatch(specName, headerTextMap) {
    // headerTextMap: [{ text, cell, table }]
    const symbols = extractSymbolsFromSpec(specName);
    const scores = [];

    headerTextMap.forEach(h => {
      let best = 0;
      // (1) 完全一致・部分一致
      best = Math.max(best, similarity(specName, h.text));
      // (2) 抽出した記号との一致
      symbols.forEach(sym => {
        if (h.text === sym) best = Math.max(best, 90);
        if (new RegExp(`^${sym}\\d*$`).test(h.text)) best = Math.max(best, 85);
        if (h.text.includes(sym)) best = Math.max(best, 70);
      });
      // (3) 部分文字列含有
      SYNONYMS.forEach(([jp, sym]) => {
        if (specName.includes(jp) && (h.text === sym || h.text.includes(jp))) {
          best = Math.max(best, 75);
        }
      });

      if (best >= 60) scores.push({ ...h, score: best });
    });

    return scores.sort((a,b) => b.score - a.score);
  }

  // =====================================================
  // レイヤー3: 学習キャッシュ（localStorage）
  // =====================================================
  const CACHE_KEY = 'spechl-mapping-cache-v1';
  function loadCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); }
    catch(e) { return {}; }
  }
  function saveCache(cache) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch(e) {}
  }
  function getCategoryKey() {
    // URLからシリーズコードを取得し、先頭6桁をカテゴリキーとして使用
    const m = location.pathname.match(/detail\/(\d+)/);
    return m ? m[1].substring(0, 6) : 'default';
  }

  // マッピングをキャッシュに保存
  function cacheMapping(specName, headerText, confidence) {
    const cache = loadCache();
    const key = getCategoryKey();
    if (!cache[key]) cache[key] = {};
    if (!cache[key][specName]) cache[key][specName] = [];
    // 既存なら更新、なければ追加
    const existing = cache[key][specName].find(e => e.header === headerText);
    if (existing) {
      existing.confidence = Math.max(existing.confidence, confidence);
      existing.lastUsed = Date.now();
    } else {
      cache[key][specName].push({ header: headerText, confidence, lastUsed: Date.now() });
    }
    saveCache(cache);
  }

  function getCachedMappings(specName) {
    const cache = loadCache();
    const key = getCategoryKey();
    return (cache[key] && cache[key][specName]) || [];
  }

  // テーブルのグリッド再構築: colspan/rowspan両方を正確にハンドル
  const gridCache = new WeakMap();
  function buildGrid(table) {
    if (gridCache.has(table)) return gridCache.get(table);
    const grid = [];
    const rows = table.querySelectorAll('tr');
    rows.forEach((tr, rowIdx) => {
      if (!grid[rowIdx]) grid[rowIdx] = [];
      let colIdx = 0;
      for (const cell of tr.cells) {
        while (grid[rowIdx][colIdx] !== undefined) colIdx++;
        const cs = cell.colSpan || 1;
        const rs = cell.rowSpan || 1;
        for (let r = 0; r < rs; r++) {
          if (!grid[rowIdx + r]) grid[rowIdx + r] = [];
          for (let c = 0; c < cs; c++) {
            grid[rowIdx + r][colIdx + c] = cell;
          }
        }
        colIdx += cs;
      }
    });
    gridCache.set(table, grid);
    return grid;
  }

  function gci(c) {
    const table = c.closest('table');
    if (!table) return -1;
    const grid = buildGrid(table);
    // grid内で最初にこのcellが出現する列を返す
    for (let r = 0; r < grid.length; r++) {
      for (let col = 0; col < (grid[r]||[]).length; col++) {
        if (grid[r][col] === c) return col;
      }
    }
    return -1;
  }

  function gcc(t, ti) {
    const grid = buildGrid(t);
    const seen = new Set();
    const result = [];
    grid.forEach(row => {
      const cell = row[ti];
      if (cell && !seen.has(cell)) {
        seen.add(cell);
        result.push(cell);
      }
    });
    return result;
  }

  // colSpan を考慮してヘッダーが束ねる全列のセルを返す
  // 例: M (colspan=7, サブヘッダー純数字・同種) → 7列全て
  // 例: 型式 (colspan=3, サブヘッダー Type(colspan=2)|D) → Type と同じルールの列だけ (2列)
  function gccSpanned(table, headerCell) {
    const ci = gci(headerCell);
    if (ci < 0) return [];
    const span = headerCell.colSpan || 1;

    if (span > 1) {
      const grid = buildGrid(table);
      const headerRowIdx = grid.findIndex(row => row[ci] === headerCell);
      if (headerRowIdx >= 0 && headerRowIdx + 1 < grid.length) {
        const subRow = grid[headerRowIdx + 1] || [];

        // 各列のサブヘッダーセルを取得
        const colToSub = new Map();
        for (let c = ci; c < ci + span; c++) {
          const sub = subRow[c];
          if (sub && sub !== headerCell) colToSub.set(c, sub);
        }

        // サブヘッダーごとにマッチするルールインデックスを判定
        const getRuleIdx = (cell) => {
          const texts = extractTexts(cell);
          for (let i = 0; i < RULES.length; i++) {
            for (const t of texts) {
              if (RULES[i].w.some(wp => wp.test(t))) return i;
            }
          }
          return -1; // ルールなし（純数字等）
        };

        const uniqueSubs = [...new Set(colToSub.values())];
        if (uniqueSubs.length > 1) {
          const ruleSet = new Set(uniqueSubs.map(getRuleIdx));
          if (ruleSet.size > 1) {
            // 異なるルールのサブヘッダーが混在（型式: Type|D 等）
            // → 先頭サブヘッダーと同じルールに属する列だけ返す
            const firstRuleIdx = getRuleIdx(colToSub.get(ci) || uniqueSubs[0]);
            const seen = new Set();
            for (let c = ci; c < ci + span; c++) {
              const sub = colToSub.get(c);
              const idx = sub ? getRuleIdx(sub) : -1;
              if (idx === firstRuleIdx) gcc(table, c).forEach(cell => seen.add(cell));
            }
            return [...seen];
          }
        }
      }
    }

    // 同種サブヘッダー（M/N 等）→ 全列スパン
    const seen = new Set();
    for (let c = ci; c < ci + span; c++) {
      gcc(table, c).forEach(cell => seen.add(cell));
    }
    return [...seen];
  }

  // ===== 状態管理 =====
  const state = { type:null, D:null, L:null, M:null, N:null, lastConfirmedPartNo:null };
  const wysRowByD = {}; // D値 → { lRange:{min,max,text}, mVals:[] } のWYS制約マップ

  // ===== WYSスキャン（汎用化: パターンA/B-1/B-2/C全対応） =====
  function scanWys() {
    const cache = [];
    const tables = new Set();

    // パターンA: FA標準 (headerCell/bodyCell/coloredCell)
    document.querySelectorAll('.headerCell, .bodyCell, .coloredCell').forEach(c => {
      const t = c.closest('table'); if(t) tables.add(t);
    });
    // パターンB: m-table
    document.querySelectorAll('.m-table, table.m-table').forEach(t => tables.add(t));
    // パターンC: .wysiwyg_area 配下の全table（汎用フォールバック）
    document.querySelectorAll('[class*="wysiwyg"] table, [class*="wys"] table').forEach(t => tables.add(t));
    // 最後のフォールバック: legacy common配下のtable
    document.querySelectorAll('[class*="common_common"] table, [class*="LegacyStyledHtml"] table').forEach(t => tables.add(t));

    tables.forEach(table => {
      // ヘッダーセル候補の収集（3パターン）
      const headerCells = new Set();

      // (1) .headerCell クラスを持つセル
      table.querySelectorAll('.headerCell').forEach(c => headerCells.add(c));
      // (2) <th> 要素（パターンB-1: m-table + thead）
      table.querySelectorAll('th').forEach(c => headerCells.add(c));
      // (3) 最初の行の <td>（パターンB-2: td擬似ヘッダー、または単純テーブル）
      const firstRow = table.querySelector('tr');
      if (firstRow) {
        firstRow.querySelectorAll('td').forEach(c => {
          const texts = extractTexts(c);
          // 短いテキスト（寸法記号・ヘッダー的）なら候補に
          if (texts[0] && texts[0].length <= 10) headerCells.add(c);
        });
      }
      // (4) thead配下の全td
      table.querySelectorAll('thead td').forEach(c => headerCells.add(c));

      // 各候補セルに対してマッチング
      headerCells.forEach(cell => {
        const texts = extractTexts(cell);
        texts.forEach(text => {
          if (!text || text.length > 25) return;
          RULES.forEach(rule => {
            rule.w.forEach(wp => {
              if (wp.test(text)) {
                // colSpan対応: M(colspan=7)等、複数列を束ねるヘッダーの全列セルを収集
                const cc = gccSpanned(table, cell);
                // 重複チェック
                if (!cache.some(c => c.cells[0] === cell && c.mp === rule.p)) {
                  cache.push({ mp: rule.p, ht: text, cells: [cell, ...cc], table });
                }
              }
            });
          });
        });
      });
    });

    console.log(`[SpecHL] ${tables.size} tables scanned, ${cache.length} column mappings found`);
    return cache;
  }

  // 全ヘッダー一覧（ルール未マッチ含む）― 手動マッピング用に全列を把握
  function buildFullHeaderMap() {
    const result = [];
    const seen = new Set();
    const tables = new Set();

    document.querySelectorAll('.headerCell, .bodyCell, .coloredCell').forEach(c => {
      const t = c.closest('table'); if(t) tables.add(t);
    });
    document.querySelectorAll('.m-table, table.m-table').forEach(t => tables.add(t));
    document.querySelectorAll('[class*="wysiwyg"] table, [class*="wys"] table').forEach(t => tables.add(t));
    document.querySelectorAll('[class*="common_common"] table, [class*="LegacyStyledHtml"] table').forEach(t => tables.add(t));

    tables.forEach(table => {
      const headerCells = new Set();
      table.querySelectorAll('.headerCell').forEach(c => headerCells.add(c));
      table.querySelectorAll('th').forEach(c => headerCells.add(c));
      const firstRow = table.querySelector('tr');
      if (firstRow) firstRow.querySelectorAll('td').forEach(c => headerCells.add(c));
      table.querySelectorAll('thead td').forEach(c => headerCells.add(c));

      headerCells.forEach(cell => {
        const texts = extractTexts(cell);
        texts.forEach(text => {
          if (!text || text.length > 25) return;
          const key = text + '::' + (table._id || (table._id = Math.random()));
          if (seen.has(key)) return;
          seen.add(key);
          // colSpan対応: M(colspan=7)等の全列セルを収集
          const cc = gccSpanned(table, cell);
          result.push({ text, cells: [cell, ...cc], table });
        });
      });
    });
    console.log(`[SpecHL] Full header map: ${result.length} headers total`);
    return result;
  }

  // ===== Feature1: スペックホバー→列HL（階層マッチング） =====
  function attachHoverHL(cache) {
    // ヘッダーテキスト→該当セル群のマップを構築（スコアリング用）
    const headerMap = cache.map(c => ({ text: c.ht, cells: c.cells, pattern: c.mp, table: c.table }));

    // 全WYSヘッダー（ルール未マッチ含む）のマップ ― 手動マッピング用
    const fullHeaderMap = buildFullHeaderMap();

    // マッチ結果をスペックフレームごとにキャッシュ
    const frameMatchCache = new WeakMap();

    // 手動マッピング（管理UIからのオーバーライド）ストレージキー
    const getManualKey = () => {
      const m = location.pathname.match(/detail\/(\d+)/);
      return `spec-mapping-admin-${m ? m[1] : 'default'}`;
    };
    const loadManual = () => {
      try { return JSON.parse(localStorage.getItem(getManualKey()) || '{}'); }
      catch(e) { return {}; }
    };

    document.querySelectorAll('[class*="SpecFrame_frame"]').forEach(frame => {
      const nameEl = frame.querySelector('[class*="SpecFrame_specName"],[class*="SpecFrame_heading"] span,[class*="RohsSpecFrame_specName"]');
      if(!nameEl) return;
      const sn = nameEl.textContent.trim();

      // ==== 階層マッチング ====
      let matched = [];
      let matchSource = '';

      // === レイヤー0: 手動マッピング（管理UIから設定）があれば最優先 ===
      const manualData = loadManual();
      if (manualData[sn] && manualData[sn].wysHeaders && manualData[sn].wysHeaders.length > 0) {
        const manualHeaders = manualData[sn].wysHeaders;
        const manualMatched = [];
        manualHeaders.forEach(headerText => {
          // filter() で全テーブルの全一致を取得（find()は最初の1件のみ返すため複数列対応に不十分）
          const allFound = fullHeaderMap.filter(h => h.text === headerText);
          allFound.forEach(found => {
            manualMatched.push({ ...found, ht: found.text, score: 100, source: 'manual' });
          });
        });
        if (manualMatched.length > 0) {
          matched = manualMatched;
          matchSource = 'manual';
        }
      }

      // このspecの選択肢を先に取得（値オーバーラップ判定で使用）
      const specOpts = [];
      frame.querySelectorAll('[role="checkbox"]').forEach(cb => {
        const t = cb.textContent.trim();
        if (t && t.length <= 15) specOpts.push(t);
      });

      // === 値オーバーラップ計算ヘルパー ===
      const calcOverlap = (cells) => {
        let overlap = 0;
        let total = 0;
        cells.slice(1).forEach(cell => {
          const t = (cell.textContent || '').trim();
          if (!t || t === '−' || t === '-' || t === '&nbsp;') return;
          total++;
          if (specOpts.includes(t)) overlap++;
          else {
            // "M5" のような接頭辞付き
            const nm = t.match(/^[A-Za-zΦφ]?(\d+(?:\.\d+)?)/);
            if (nm && specOpts.includes(nm[1])) overlap++;
          }
        });
        return { overlap, total, ratio: total > 0 ? overlap / total : 0 };
      };

      // レイヤー1: ルールベース（+値オーバーラップで絞り込み）※手動マッピングがあればスキップ
      const ruleMatches = matched.length === 0 ? cache.filter(c => c.mp.test(sn)) : [];
      if (ruleMatches.length > 0) {
        if (ruleMatches.length > 1 && specOpts.length > 0) {
          const scored = ruleMatches.map(m => {
            const ov = calcOverlap(m.cells);
            return { ...m, ...ov };
          });
          // 最高スコア優先（比率×絶対数）
          scored.sort((a, b) => (b.ratio * b.overlap) - (a.ratio * a.overlap));
          const best = scored[0];

          // 最高が "ほぼ完全一致" (ratio>=0.7 かつ overlap>=3) なら単独採用
          if (best.ratio >= 0.7 && best.overlap >= 3) {
            matched = [{ ...best, score: 100, source: 'rule' }];
          }
          // 最高が2位より大きく上回るなら単独採用（overlapで差2以上、or ratio差0.3以上）
          else if (scored[1] && (best.overlap - scored[1].overlap >= 2 || best.ratio - scored[1].ratio >= 0.3)) {
            matched = [{ ...best, score: 100, source: 'rule' }];
          }
          // それ以外はtop2まで採用
          else {
            matched = scored.slice(0, 2).filter(s => s.overlap > 0).map(m => ({ ...m, score: 100, source: 'rule' }));
            if (matched.length === 0) matched = [{ ...best, score: 100, source: 'rule' }];
          }
        } else if (ruleMatches.length === 1 && specOpts.length > 0) {
          // 単一候補でも、値オーバーラップが極端に低ければ棄却
          const ov = calcOverlap(ruleMatches[0].cells);
          if (ov.overlap >= 2 || ov.ratio >= 0.3) {
            matched = [{ ...ruleMatches[0], score: 100, source: 'rule' }];
          } else {
            matched = []; // 棄却 → レイヤー2/2.5にフォールバック
          }
        } else {
          matched = ruleMatches.map(m => ({ ...m, score: 100, source: 'rule' }));
        }
        if (matched.length > 0) matchSource = 'rule';
      }

      // レイヤー1.5: 値オーバーラップマッチ（ルールで見つからない or 棄却された場合）
      // 「大頭部高さ H」→ L1 のように、テキスト類似性はないが値が一致するケースに対応
      if (matched.length === 0 && specOpts.length >= 3) {
        const scored = cache.map(c => {
          const ov = calcOverlap(c.cells);
          return { ...c, ...ov };
        }).filter(s => s.overlap >= Math.min(3, specOpts.length * 0.6));
        if (scored.length > 0) {
          scored.sort((a, b) => (b.ratio * b.overlap) - (a.ratio * a.overlap));
          const best = scored[0];
          if (best.ratio >= 0.7 || best.overlap >= specOpts.length * 0.8) {
            matched = [{ ...best, score: Math.round(best.ratio * 100), source: 'value-overlap' }];
            matchSource = 'value-overlap';
          }
        }
      }

      // レイヤー2: スコアリング（ルールで見つからない場合）
      if (matched.length === 0) {
        const scored = scoreMatch(sn, headerMap);
        if (scored.length > 0 && scored[0].score >= 60) {
          // Top3だけ採用
          matched = scored.slice(0, 3).map(s => ({
            ht: s.text, cells: s.cells, table: s.table, score: s.score, source: 'score'
          }));
          matchSource = 'score';
        }
      }

      // レイヤー3: キャッシュから復元（補完）
      // 手動マッピングが設定済みの場合はキャッシュを使わない
      // （キャッシュが古い誤マッチを引き継いで汚染するのを防ぐ）
      if (matchSource !== 'manual') {
        const cached = getCachedMappings(sn);
        if (cached.length > 0) {
          cached.forEach(c => {
            const headerInfo = headerMap.find(h => h.text === c.header);
            if (headerInfo && !matched.some(m => m.ht === c.header)) {
              matched.push({
                ht: c.header, cells: headerInfo.cells, table: headerInfo.table,
                score: c.confidence, source: 'cache'
              });
              if (!matchSource) matchSource = 'cache';
            }
          });
        }
      }

      // マッチ状態のクラス付与（ホバーイベントは常に登録 → 後から手動マッピングで有効化可能）
      if (matched.length === 0) {
        frame.classList.add('spechl-no-match');
      } else {
        frame.classList.add('spechl-matched');
      }

      // マッチ結果をキャッシュに保存（学習）
      if (matchSource !== 'cache') {
        matched.forEach(m => cacheMapping(sn, m.ht, m.score));
      }

      frameMatchCache.set(frame, matched);

      // ハイライト対象セル算出: マッチした列の全セルを対象にする
      // 値ベースの絞り込みをやめることで歯抜けを解消し、列全体をハイライト
      const resolveHighlightCells = () => {
        const cellsToHL = [];
        matched.forEach(m => {
          m.cells.forEach(cell => cellsToHL.push(cell));
        });
        return cellsToHL;
      };

      // 自動マッチ結果を保存
      const autoMatched = [...matched];
      const autoMatchSource = matchSource;

      let hoverCells = [];

      // ホバー時に手動マッピングを都度チェック（リロード不要で反映）
      const getCurrentMatched = () => {
        const manualData2 = loadManual();
        if (manualData2[sn] && manualData2[sn].wysHeaders && manualData2[sn].wysHeaders.length > 0) {
          const manualResults = [];
          manualData2[sn].wysHeaders.forEach(headerText => {
            const allFound = fullHeaderMap.filter(h => h.text === headerText);
            if (allFound.length > 0) {
              allFound.forEach(found => {
                manualResults.push({ ...found, ht: found.text, score: 100, source: 'manual', cells: found.cells });
              });
            } else {
              // fullHeaderMap に見つからない場合はDOM直接スキャン（動的ロード対策）
              const freshMap = buildFullHeaderMap();
              freshMap.filter(h => h.text === headerText).forEach(found => {
                manualResults.push({ ...found, ht: found.text, score: 100, source: 'manual', cells: found.cells });
              });
            }
          });
          // 手動マッピングが設定されている場合は結果が空でも autoMatched にフォールバックしない
          // → autoMatched にキャッシュ由来の誤列が混入しても影響を受けない
          return { matched: manualResults, source: 'manual' };
        }
        return { matched: autoMatched, source: autoMatchSource };
      };

      frame.addEventListener('mouseenter', () => {
        if (isDisabled()) return;
        frame.classList.add('spechl-spec-hover');
        const current = getCurrentMatched();
        matched = current.matched;
        matchSource = current.source;
        hoverCells = resolveHighlightCells();
        hoverCells.forEach(c => c.classList.add('spechl-active'));
        const avgScore = matched.length > 0 ? Math.round(matched.reduce((s,m)=>s+m.score,0) / matched.length) : 0;
        const srcLabel = { rule:'ルール', score:'テキスト類似', cache:'キャッシュ', 'value-overlap':'値オーバーラップ', 'manual':'手動設定' }[matchSource] || '';
        indicator.innerHTML = `↓「${sn}」→ 規格表「${matched.map(m=>m.ht).join('」「')}」列の該当値をハイライト中 <span style="opacity:0.7;font-size:11px;margin-left:8px">[${srcLabel} ${avgScore}% / ${hoverCells.length}セル]</span>`;
        indicator.classList.add('visible');
      });
      frame.addEventListener('mouseleave', () => {
        if (isDisabled()) return;
        frame.classList.remove('spechl-spec-hover');
        hoverCells.forEach(c => c.classList.remove('spechl-active'));
        hoverCells = [];
        indicator.classList.remove('visible');
      });
    });

    console.log('[SpecHL] Hierarchical matching attached (rule → score → cache)');
  }

  // ===== Feature2: SVGオーバーレイ（対応済み商品のみ） =====
  // 座標定義DB（商品コード先頭6桁をキーに）
  const DRAWING_COORDS_DB = {
    // リニアシャフト系（drw_21.gif パターン）
    '110300': {
      imgPattern: /drw_/,
      size: { w: 615, h: 393 },
      labels: [
        { dim:'D', x:403, y:101, w:32, h:22, color:'#004098' },
        { dim:'D', x:453, y:283, w:32, h:22, color:'#004098' },
        { dim:'L', x:236, y:159, w:55, h:20, color:'#004098' },
        { dim:'L', x:236, y:351, w:55, h:20, color:'#004098' },
        { dim:'M', x:62,  y:101, w:30, h:22, color:'#cc0000' },
        { dim:'M', x:62,  y:283, w:30, h:22, color:'#cc0000' },
        { dim:'N', x:420, y:283, w:30, h:22, color:'#cc0000' },
      ],
    },
    // 他商品カテゴリの座標は今後追加
  };

  // drawings 配列を取得（旧フォーマット自動移行込み）
  function loadDrawingsData(seriesCode) {
    let sm = {};
    try { sm = getMappingData(seriesCode); } catch(e) {}
    if (sm.drawings && sm.drawings.length > 0) return sm.drawings;
    return [{ imgPattern: sm.imgPattern || 'drw_', drawingLabels: sm.drawingLabels || [] }];
  }

  // SVG位置更新関数を集約（highlightConfirmed後のリフロー対策）
  window.__spechlUpdateAllSvgPos = window.__spechlUpdateAllSvgPos || [];

  function attachSvgOverlay() {
    const seriesMatch = location.pathname.match(/detail\/(\d+)/);
    if (!seriesMatch) return;
    const seriesCode = seriesMatch[1];
    const categoryKey = seriesCode.substring(0, 6);
    const svgNS = 'http://www.w3.org/2000/svg';

    // 登録済みインデックスを管理（同一indexの二重登録を防ぐ）
    const attachedIndices = new Set();

    // 描画更新イベント: 全インデックスを再描画 & 新規追加分もアタッチ
    window.addEventListener('spechl-drawing-updated', () => {
      attachAllDrawings();
      // 既存の各SVGを最新のラベルデータで再描画
      attachedIndices.forEach(idx => rebuildOne(idx));
    });

    // drawingIdx ごとの rebuild 関数を保持
    const rebuildFns = {};

    function rebuildOne(drawingIdx) {
      if (rebuildFns[drawingIdx]) rebuildFns[drawingIdx]();
    }

    function attachAllDrawings() {
      const drawings = loadDrawingsData(seriesCode);
      drawings.forEach((_, idx) => attachOneDrawingOverlay(idx));
    }

    function attachOneDrawingOverlay(drawingIdx) {
      if (attachedIndices.has(drawingIdx)) return; // 登録済みはスキップ

      const drawings = loadDrawingsData(seriesCode);
      const entry = drawings[drawingIdx];
      if (!entry || !entry.imgPattern) return;

      const drawingImg = document.querySelector(`img[src*="${entry.imgPattern}"]`);
      if (!drawingImg) return;

      attachedIndices.add(drawingIdx);

      function buildOverlay() {
        // この描画インデックスのSVGだけ削除（他インデックスのSVGは維持）
        document.querySelectorAll(`.spechl-svg-overlay[data-drawing-idx="${drawingIdx}"]`)
          .forEach(el => el.remove());

        let cur = {};
        try { cur = getMappingData(seriesCode); } catch(e) {}

        const curDrawings = (cur.drawings && cur.drawings.length > 0)
          ? cur.drawings
          : [{ imgPattern: cur.imgPattern || 'drw_', drawingLabels: cur.drawingLabels || [] }];
        const curEntry = curDrawings[drawingIdx];
        if (!curEntry) return;

        let curLabels, curW, curH;
        if (curEntry.drawingLabels && curEntry.drawingLabels.length > 0) {
          const vb = (curEntry.drawingLabels[0].viewBox || '0 0 615 393').split(' ');
          curW = parseInt(vb[2]) || 615;
          curH = parseInt(vb[3]) || 393;
          curLabels = curEntry.drawingLabels.map(lb => ({
            dim: lb.dim, x: lb.x, y: lb.y,
            w: lb.w || 32, h: lb.h || 22,
            color: lb.color || '#004098',
            rotation: lb.rotation || 0,
            fontSize: lb.fontSize || 14
          }));
        } else if (drawingIdx === 0) {
          const coordDef = DRAWING_COORDS_DB[categoryKey];
          if (!coordDef) {
            console.log(`[SpecHL] 外形図[0] ラベル未設定（${categoryKey}）`);
            return;
          }
          curW = coordDef.size.w;
          curH = coordDef.size.h;
          curLabels = coordDef.labels;
        } else {
          return;
        }

        const svg = document.createElementNS(svgNS, 'svg');
        svg.classList.add('spechl-svg-overlay');
        svg.setAttribute('data-drawing-idx', String(drawingIdx));
        svg.setAttribute('viewBox', `0 0 ${curW} ${curH}`);
        svg.setAttribute('preserveAspectRatio', 'none');

        // position:fixed + getBoundingClientRect() で配置
        // → ページスクロールに追従してズレる問題を解消（absolute+offsetTopはcontainer依存でスクロール時にズレる）
        // position:fixed — rAFループで毎フレーム getBoundingClientRect() を読んで追従
        const imgRect = drawingImg.getBoundingClientRect();
        svg.style.cssText = [
          'position:fixed',
          `top:${imgRect.top}px`,
          `left:${imgRect.left}px`,
          `width:${imgRect.width}px`,
          `height:${imgRect.height}px`,
          'pointer-events:none',
          'z-index:10',
        ].join(';');

        curLabels.forEach((lb, labelIdx) => {
          const g = document.createElementNS(svgNS, 'g');
          g.classList.add('spechl-dim-label');
          g.setAttribute('data-dim', lb.dim);
          g.style.cssText = 'pointer-events:all;cursor:grab;';

          const applyRotation = () => {
            if (lb.rotation) {
              g.setAttribute('transform', `rotate(${lb.rotation}, ${lb.x + lb.w / 2}, ${lb.y + lb.h / 2})`);
            } else {
              g.removeAttribute('transform');
            }
          };
          applyRotation();

          const rect = document.createElementNS(svgNS, 'rect');
          rect.setAttribute('x', lb.x); rect.setAttribute('y', lb.y);
          rect.setAttribute('width', lb.w); rect.setAttribute('height', lb.h);
          rect.setAttribute('rx', '4');
          rect.setAttribute('fill', 'none');
          rect.setAttribute('pointer-events', 'all');

          const text = document.createElementNS(svgNS, 'text');
          text.setAttribute('x', lb.x + lb.w / 2); text.setAttribute('y', lb.y + lb.h - 5);
          text.setAttribute('text-anchor', 'middle');
          text.setAttribute('font-size', String(lb.fontSize || 14));
          text.setAttribute('fill', lb.color);
          text.setAttribute('font-weight', 'bold');
          text.setAttribute('font-family', 'Arial');
          text.setAttribute('stroke', 'white');
          text.setAttribute('stroke-width', '1');
          text.setAttribute('paint-order', 'stroke fill');
          text.textContent = lb.dim;

          let dragging = false, didDrag = false;
          let dragStartX = 0, dragStartY = 0, startLbX = 0, startLbY = 0;

          g.addEventListener('mousedown', (e) => {
            if (isDisabled()) return;
            e.stopPropagation(); e.preventDefault();
            dragging = true; didDrag = false;
            dragStartX = e.clientX; dragStartY = e.clientY;
            startLbX = lb.x; startLbY = lb.y;
            g.style.cursor = 'grabbing';

            const onMove = (ev) => {
              if (!dragging) return;
              const dx = ev.clientX - dragStartX;
              const dy = ev.clientY - dragStartY;
              if (!didDrag && Math.hypot(dx, dy) < 4) return;
              didDrag = true;
              const svgRect = svg.getBoundingClientRect();
              const scaleX = curW / svgRect.width;
              const scaleY = curH / svgRect.height;
              lb.x = Math.round(startLbX + dx * scaleX);
              lb.y = Math.round(startLbY + dy * scaleY);
              rect.setAttribute('x', lb.x); rect.setAttribute('y', lb.y);
              text.setAttribute('x', lb.x + lb.w / 2); text.setAttribute('y', lb.y + lb.h - 5);
              applyRotation();
            };

            const onUp = () => {
              if (!dragging) return;
              dragging = false;
              g.style.cursor = 'grab';
              document.removeEventListener('mousemove', onMove);
              document.removeEventListener('mouseup', onUp);
              if (didDrag) {
                try {
                  const data = getMappingData(seriesCode);
                  const dList = (data.drawings && data.drawings.length > 0)
                    ? data.drawings
                    : [{ imgPattern: data.imgPattern || 'drw_', drawingLabels: data.drawingLabels || [] }];
                  if (dList[drawingIdx] && dList[drawingIdx].drawingLabels[labelIdx]) {
                    dList[drawingIdx].drawingLabels[labelIdx].x = lb.x;
                    dList[drawingIdx].drawingLabels[labelIdx].y = lb.y;
                    data.drawings = dList;
                    localStorage.setItem(`spec-mapping-admin-${seriesCode}`, JSON.stringify(data, null, 2));
                  }
                } catch(e) {}
              } else {
                if (!isDisabled()) openDimPopup(lb.dim, g);
              }
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
          });

          // ホバー: ビューポート内なら該当スペックをハイライト、外ならエッジにヒント表示
          let hoverTimer = null;
          g.addEventListener('mouseenter', () => {
            if (isDisabled()) return;
            hoverTimer = setTimeout(() => {
              const specName = getSpecNameForDim(lb.dim);
              if (!specName) return;
              const frame = Array.from(document.querySelectorAll('[class*="SpecFrame_frame"]'))
                .find(f => {
                  const nameEl = f.querySelector('[class*="SpecFrame_specName"],[class*="SpecFrame_heading"] span');
                  return nameEl && nameEl.textContent.trim() === specName;
                });
              if (!frame) return;
              // ヌメッとスクロールでスペックパネルへ誘導
              _smoothScrollToCenter(frame, 750);
              // スクロール中にオレンジハイライトをフェードイン
              setTimeout(() => {
                frame.style.transition = 'outline .2s, box-shadow .2s, background .2s';
                frame.style.outline = '3px solid #FF8A00';
                frame.style.outlineOffset = '-1px';
                frame.style.boxShadow = '0 0 16px rgba(255,138,0,0.35), 0 0 4px rgba(255,138,0,0.5)';
                frame.style.background = 'rgba(255,138,0,0.08)';
                g._specFrame = frame;
              }, 200);
            }, 300);
          });
          g.addEventListener('mouseleave', () => {
            clearTimeout(hoverTimer);
            if (g._specFrame) {
              g._specFrame.style.outline = '';
              g._specFrame.style.outlineOffset = '';
              g._specFrame.style.boxShadow = '';
              g._specFrame.style.background = '';
              g._specFrame = null;
            }
            if (g._hint) { g._hint.remove(); g._hint = null; }
          });

          g.appendChild(rect); g.appendChild(text);
          svg.appendChild(g);
        });

        document.body.appendChild(svg);
        console.log(`[SpecHL] SVG overlay[${drawingIdx}] attached`);
      } // end buildOverlay

      // 毎フレーム getBoundingClientRect() で SVG を画像にピッタリ追従させる
      // スクロール・リフロー・React再レンダリングのどれにも対応できる最も確実な方法
      const trackSvgPosition = () => {
        const svgEl = document.querySelector(`.spechl-svg-overlay[data-drawing-idx="${drawingIdx}"]`);
        if (!svgEl) { rafTrackId = requestAnimationFrame(trackSvgPosition); return; }
        const r = drawingImg.getBoundingClientRect();
        svgEl.style.top    = r.top    + 'px';
        svgEl.style.left   = r.left   + 'px';
        svgEl.style.width  = r.width  + 'px';
        svgEl.style.height = r.height + 'px';
        rafTrackId = requestAnimationFrame(trackSvgPosition);
      };
      let rafTrackId = requestAnimationFrame(trackSvgPosition);

      // resize時は念のためupdateSvgPosも登録（rAFループで十分だが念押し）
      const updateSvgPos = () => {};
      window.addEventListener('resize', updateSvgPos, { passive: true });
      window.__spechlUpdateAllSvgPos.push(updateSvgPos);

      rebuildFns[drawingIdx] = buildOverlay;
      buildOverlay();
    } // end attachOneDrawingOverlay

    attachAllDrawings();

    // ポップアップ外クリックで閉じる
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.spechl-dim-popup') && !e.target.closest('.spechl-dim-label')) {
        document.querySelectorAll('.spechl-dim-popup').forEach(p => p.remove());
      }
    });
  }

  // スペックパネルの現在表示選択肢を取得（D選択後のMISUMI絞り込み済み値を使う）
  function readSpecCurrentOptions(namePattern) {
    const frame = Array.from(document.querySelectorAll('[class*="SpecFrame_frame"]'))
      .find(f => {
        const nameEl = f.querySelector('[class*="SpecFrame_specName"],[class*="SpecFrame_heading"] span');
        return nameEl && namePattern.test(nameEl.textContent.trim());
      });
    if (!frame) return null;

    // チェックボックス型（D・M・N）: 現在表示されている選択肢をそのまま取得
    const checkboxEls = frame.querySelectorAll('[role="checkbox"],[aria-checked]');
    if (checkboxEls.length) {
      const options = Array.from(checkboxEls)
        .map(el => el.textContent.trim().replace(/^[φMNΦm]/, ''))
        .filter(v => /^\d/.test(v));
      return { type: 'list', options };
    }

    // 数値入力型（L）: NumericSpecField_range 要素を優先（[25-150/0.1mm単位] 形式）
    const rangeEl = frame.querySelector('[class*="NumericSpecField_range"]');
    if (rangeEl) {
      const rt = rangeEl.textContent;
      const m = rt.match(/(\d+(?:\.\d+)?)\s*[-〜～~]\s*(\d+(?:\.\d+)?)/);
      if (m) {
        const stepM = rt.match(/\/(\d+(?:\.\d+)?)/);
        const step = stepM ? parseFloat(stepM[1]) : 1;
        return { type: 'range', min: parseFloat(m[1]), max: parseFloat(m[2]), text: `${m[1]}〜${m[2]}`, step };
      }
    }
    // フォールバック: placeholder または近傍テキストから範囲を取得（〜/～/~/- 形式）
    const input = frame.querySelector('input');
    if (input) {
      const sources = [
        input.placeholder,
        ...Array.from(frame.querySelectorAll('span,p,div')).map(el => el.textContent.trim())
      ];
      const rangeText = sources.find(t => /\d+\s*[-〜～~]\s*\d+/.test(t));
      if (rangeText) {
        const m = rangeText.match(/(\d+(?:\.\d+)?)\s*[-〜～~]\s*(\d+(?:\.\d+)?)/);
        if (m) return { type: 'range', min: parseFloat(m[1]), max: parseFloat(m[2]), text: `${m[1]}〜${m[2]}`, step: 1 };
      }
    }
    return null;
  }

  // D選択中のWYS行から直接L範囲を読み取る（最も確実な方法）
  function getLRangeForCurrentD() {
    if (!state.D) return null;
    const row = document.querySelector(`[data-spechl-dval="${state.D}"]`);
    if (!row) return null;
    let lRange = null;
    row.querySelectorAll('td, .bodyCell, .coloredCell').forEach(cell => {
      if (lRange) return;
      const text = (cell.querySelector('.fontType')?.textContent || cell.textContent).trim();
      const m = text.match(/(\d+)\s*[〜～~]\s*(\d+)/);
      if (m) lRange = { min: parseInt(m[1]), max: parseInt(m[2]), text: `${m[1]}〜${m[2]}` };
    });
    return lRange;
  }

  // ヌメッとしたスクロール（cubic-ease-in-out、duration ms）
  function _smoothScrollToCenter(el, duration) {
    // 最近傍のスクロール可能な祖先を探す
    let container = el.parentElement;
    while (container && container !== document.documentElement) {
      const s = getComputedStyle(container);
      if (/auto|scroll/.test(s.overflow + s.overflowY) && container.scrollHeight > container.clientHeight) break;
      container = container.parentElement;
    }
    if (!container || container === document.documentElement) container = document.documentElement;

    const cRect = container === document.documentElement
      ? { top: 0 } : container.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const offset = eRect.top - cRect.top - container.clientHeight / 2 + el.offsetHeight / 2;
    const startTop = container.scrollTop;
    const endTop = startTop + offset;
    const t0 = performance.now();

    function easeInOutCubic(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2; }
    (function tick(now) {
      const p = Math.min((now - t0) / duration, 1);
      container.scrollTop = startTop + (endTop - startTop) * easeInOutCubic(p);
      if (p < 1) requestAnimationFrame(tick);
    })(performance.now());
  }

  // 外形図dimラベル確定後、対応スペックフレームをブルーハイライト（ホバーでスクロール済み前提）
  function scrollToSpecForDim(dim) {
    const specName = getSpecNameForDim(dim);
    if (!specName) return;
    requestAnimationFrame(() => {
      const frame = Array.from(document.querySelectorAll('[class*="SpecFrame_frame"]'))
        .find(f => {
          const nameEl = f.querySelector('[class*="SpecFrame_specName"],[class*="SpecFrame_heading"] span');
          return nameEl && nameEl.textContent.trim() === specName;
        });
      if (!frame) return;
      // 確定時はブルーハイライトのみ（スクロールはホバー時に済み）
      frame.style.transition = 'outline .2s, box-shadow .2s, background .2s';
      frame.style.outline = '3px solid #004098';
      frame.style.outlineOffset = '-1px';
      frame.style.boxShadow = '0 0 16px rgba(0,64,152,0.35), 0 0 4px rgba(0,64,152,0.5)';
      frame.style.background = 'rgba(0,64,152,0.06)';
      setTimeout(() => {
        frame.style.outline = '';
        frame.style.outlineOffset = '';
        frame.style.boxShadow = '';
        frame.style.background = '';
      }, 2500);
    });
  }

  // マッピングデータ取得（本番: WYS HTML の data-mapping 優先 / 開発: LocalStorage フォールバック）
  // data-mapping の新フォーマット { mappings:{...}, drawingLabels:[...] } を
  // LocalStorage互換のフラット形式（スペック名がトップレベルキー）に正規化して返す
  function getMappingData(srCode) {
    const el = document.getElementById('spechl-mapping');
    if (el && el.dataset.series === srCode && el.dataset.mapping) {
      try {
        const parsed = JSON.parse(el.dataset.mapping);
        if (parsed.mappings && typeof parsed.mappings === 'object') {
          return {
            ...parsed.mappings,
            drawingLabels: parsed.drawingLabels || [],
            imgPattern: parsed.imgPattern || 'drw_',
            ...(parsed.drawings ? { drawings: parsed.drawings } : {}),
          };
        }
        return parsed;
      } catch(e) {}
    }
    try { return JSON.parse(localStorage.getItem(`spec-mapping-admin-${srCode}`) || '{}'); } catch(e) {}
    return {};
  }

  // マッピングデータから dim 記号に対応するスペック名を取得（シリーズ依存）
  // 「M(並目)・N(並目)選択」のような結合ヘッダーでも、N を dim に持つスペックを正しく返す
  function getSpecNameForDim(dim) {
    const srCode = (location.pathname.match(/detail\/(\d+)/) || [])[1];
    if (!srCode) return null;
    try {
      const saved = getMappingData(srCode);
      for (const [specName, m] of Object.entries(saved)) {
        if (!m || typeof m !== 'object') continue;
        const headers = m.wysHeaders || (m.wysHeader ? [m.wysHeader] : []);
        if (headers.some(h => {
          // 先頭の記号を先にチェック（高速パス）
          const firstSym = (h.match(/^([A-Za-z]+)/) || [])[1];
          if (firstSym === dim) return true;
          // 結合ヘッダー対応: ヘッダー内に dim が含まれる場合
          // ただし「スペック名自体も dim に関係している」ことを確認する
          // → M スペックが "M(並目)・N(並目)" ヘッダーで N に誤マッチするのを防ぐ
          const dimInHeader = new RegExp('(?:^|[^A-Za-z])' + dim + '(?:[^A-Za-z]|$)').test(h);
          const dimInSpecName = new RegExp('(?:^|[^A-Za-z])' + dim + '(?:[^A-Za-z]|$)', 'i').test(specName);
          return dimInHeader && dimInSpecName;
        })) return specName;
      }
    } catch(e) {}
    return null;
  }

  function openDimPopup(dim, labelEl) {
    document.querySelectorAll('.spechl-dim-popup').forEach(p => p.remove());

    const popup = document.createElement('div');
    popup.className = 'spechl-dim-popup';
    // シリーズのマッピングからスペック名を取得。なければフォールバック表記
    const fallbackTitles = {D:'D (軸径 / 外径)',L:'全長 L',M:'めねじ M',N:'めねじ N'};
    const specTitle = getSpecNameForDim(dim) || fallbackTitles[dim];

    // マッピングで紐付けられたスペック名を使ってスペックパネルから選択肢/範囲を読む
    // これがマッピングツールを source of truth にする中心ロジック
    const mappedSpecName = getSpecNameForDim(dim);

    // スペック名を完全一致の正規表現に変換して readSpecCurrentOptions に渡す
    function readByMappedSpec() {
      if (!mappedSpecName) return null;
      const escaped = mappedSpecName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return readSpecCurrentOptions(new RegExp('^' + escaped + '$'));
    }

    // フォールバック用パターン（マッピング未設定シリーズ向け）
    const fallbackPatterns = {
      D: /軸径.*D|外径.*D|^D$|D.*φ|D[\(（]/,
      L: /長さ.*L|^L$|L[\(（]mm|^L\(|L.*mm/,
      M: /めねじ.*\[M\]|めねじ.*M\(/,
      N: /めねじ.*\[N\]|めねじ.*N\(/,
    };

    // マッピング優先、なければフォールバックパターン
    const specData = readByMappedSpec()
      || (fallbackPatterns[dim] ? readSpecCurrentOptions(fallbackPatterns[dim]) : null);

    let bodyHTML = '';
    if (specData && specData.type === 'range') {
      // 数値入力型（取付側外径D / 長さL / 数値系スペック共通）
      const { min, max, step = 1, text } = specData;
      const rangeText = text || `${min}〜${max}`;
      // L のみ WYS DOM からの補完フォールバックを維持
      const effectiveMin = min || (dim === 'L' ? (getLRangeForCurrentD() || wysRowByD[state.D]?.lRange)?.min || 20 : 0);
      const effectiveMax = max || (dim === 'L' ? (getLRangeForCurrentD() || wysRowByD[state.D]?.lRange)?.max || 150 : 999);
      bodyHTML = `<input type="number" placeholder="${rangeText}" min="${effectiveMin}" max="${effectiveMax}" step="${step}" id="spechl-dim-input">`
        + `<span style="font-size:11px;color:#666">mm (${rangeText} / ${step}単位)</span>`;
    } else {
      // チェックボックス型 or フォールバック
      const fallbackOpts = { D:['6','8','10','12','13','15','16','18','20'], M:['3','4','5','6','8','10','12'], N:['3','4','5','6','8','10','12'] };
      const opts = (specData && specData.options && specData.options.length)
        ? specData.options
        : (fallbackOpts[dim] || []);
      const prefix = dim === 'N' ? 'N' : dim === 'M' ? 'M' : 'φ';
      const hint = (dim === 'M' || dim === 'N') && state.D ? ` — D${state.D}の有効値` : '';
      bodyHTML = `<select id="spechl-dim-input"><option value="">選択${hint}</option>`
        + opts.map(v => `<option value="${v}"${state[dim]===v?' selected':''}>${prefix}${v}</option>`).join('') + '</select>';
    }

    popup.innerHTML = `
      <div class="spechl-dim-popup-header">
        <span>${specTitle} を選択</span>
        <button class="spechl-dim-popup-close" onclick="this.closest('.spechl-dim-popup').remove()">×</button>
      </div>
      <div class="spechl-dim-popup-body">${bodyHTML}</div>
    `;

    // SVG が document.body 配下になったため、スクロール量を加算してページ絶対座標で配置
    const rect = labelEl.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    popup.style.position = 'absolute';
    popup.style.left = Math.min(rect.left + scrollX + 40, document.documentElement.clientWidth - 220) + 'px';
    popup.style.top  = Math.max(rect.top  + scrollY - 10, scrollY + 4) + 'px';
    document.body.appendChild(popup);

    const input = popup.querySelector('#spechl-dim-input');
    input.focus();

    const apply = () => {
      const val = input.value;
      if (!val) return;
      state[dim] = val;
      showDimBadgesGlobal(dim, val);
      syncToSpecPanel(dim, val);
      updatePartNumber();
      highlightConfirmed();
      try { popup.remove(); } catch(e) {}
      // 外形図→スペックパネル相互連動: 対応スペックフレームへスクロール＆ハイライト
      scrollToSpecForDim(dim);
    };

    if (input.tagName === 'INPUT') {
      // 数値入力型（L・range型D）: blur / Enter で確定
      input.addEventListener('blur', apply);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') apply(); });
    } else {
      // select型（リスト型D・M・N）: change で即確定
      input.addEventListener('change', apply);
    }
  }

  function showDimBadges(dim, value) {
    // HTMLバッジ（旧方式）は削除
    document.querySelectorAll(`.spechl-dim-badge[data-dim="${dim}"]`).forEach(b => b.remove());

    // ラベルテキスト生成
    const specName = getSpecNameForDim(dim) || '';
    const unitMatch = specName.match(/\(\s*(mm)\s*\)/i);
    const unit = unitMatch ? unitMatch[1] : '';
    const label = `${dim}=${value}${unit}`;
    const isRed = dim === 'M' || dim === 'N';
    const svgNS = 'http://www.w3.org/2000/svg';

    // SVGの g 要素内に値テキストを直接描画（SVGがrAFで追従するためバッジも自動追従）
    document.querySelectorAll(`.spechl-dim-label[data-dim="${dim}"]`).forEach(g => {
      // 既存の値テキストを削除
      g.querySelectorAll('.spechl-dim-value-text').forEach(t => t.remove());

      const rect = g.querySelector('rect');
      if (!rect) return;
      const rx = parseFloat(rect.getAttribute('x')) || 0;
      const ry = parseFloat(rect.getAttribute('y')) || 0;
      const rh = parseFloat(rect.getAttribute('height')) || 22;
      const rw = parseFloat(rect.getAttribute('width')) || 32;
      const fs = parseFloat(g.querySelector('text')?.getAttribute('font-size') || '14');

      const vt = document.createElementNS(svgNS, 'text');
      vt.classList.add('spechl-dim-value-text');
      vt.setAttribute('x', rx + rw + 3);
      vt.setAttribute('y', ry + rh - 4);
      vt.setAttribute('font-size', String(Math.max(fs - 2, 10)));
      vt.setAttribute('fill', isRed ? '#cc0000' : '#004098');
      vt.setAttribute('font-weight', 'bold');
      vt.setAttribute('font-family', 'Arial');
      vt.setAttribute('stroke', 'white');
      vt.setAttribute('stroke-width', '2');
      vt.setAttribute('paint-order', 'stroke fill');
      vt.setAttribute('pointer-events', 'none');
      vt.textContent = label;
      g.appendChild(vt);
    });
  }

  // ===== Feature3: 選定結果可視化 =====
  function highlightConfirmed() {
    document.querySelectorAll('.spechl-confirmed-row,.spechl-confirmed-value,.spechl-confirmed-cross,.spechl-confirmed-type').forEach(c => {
      c.classList.remove('spechl-confirmed-row','spechl-confirmed-value','spechl-confirmed-cross','spechl-confirmed-type');
    });

    const type = state.type;
    const dVal = state.D;
    const mVal = state.M;
    const nVal = state.N;

    // Type行ハイライト
    if (type) {
      document.querySelectorAll('.fontType').forEach(ft => {
        if (ft.textContent.trim() === type) {
          const td = ft.closest('td');
          if (td) {
            td.classList.add('spechl-confirmed-type');
            const row = td.closest('tr');
            if (row) row.querySelectorAll('td').forEach(c => {
              if (!c.classList.contains('spechl-confirmed-type')) c.classList.add('spechl-confirmed-row');
            });
          }
        }
      });
    }

    if (!dVal) return;

    // D公差テーブルのD行
    document.querySelectorAll('.coloredCell').forEach(cell => {
      if (cell.textContent.trim() === dVal) {
        cell.classList.add('spechl-confirmed-value');
        const row = cell.closest('tr');
        if (row) row.querySelectorAll('.coloredCell').forEach(c => {
          if (c !== cell) c.classList.add('spechl-confirmed-row');
        });
      }
    });

    // 寸法テーブルのD行
    document.querySelectorAll('.fontType').forEach(ft => {
      if (ft.textContent.trim() === dVal) {
        const td = ft.closest('td');
        if (!td) return;
        const next = td.nextElementSibling;
        if (next && /〜/.test(next.textContent)) {
          td.classList.add('spechl-confirmed-value');
          const row = td.closest('tr');
          if (row) {
            row.classList.add('spechl-confirmed-row');
            // M・N 交差ハイライト（M/Nは同一結合列に共存するためどちらも独立して表示）
            const nVal = state.N;
            row.querySelectorAll('.fontType').forEach(ft2 => {
              if (ft2 === ft) return;
              const t = ft2.textContent.trim();
              if (mVal && t === mVal) ft2.closest('td')?.classList.add('spechl-confirmed-cross');
              if (nVal && t === nVal) ft2.closest('td')?.classList.add('spechl-confirmed-cross');
            });


          }
        }
      }
    });

    // スペック選択時、WYS該当行を自動スクロール（WYS→スペック同期中は除く）
    if (!window.__specHLSyncing) {
      const target =
        document.querySelector('.spechl-confirmed-value:not(.coloredCell), .spechl-confirmed-type') ||
        document.querySelector('.spechl-confirmed-value');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
    updateWysRowFilter();

    // WYS行スタイル変化によるレイアウトリフロー後に外形図SVG位置を再計算
    requestAnimationFrame(() => {
      (window.__spechlUpdateAllSvgPos || []).forEach(fn => fn());
    });
  }

  // ===== Feature4: 型式フローティングウインドウ =====
  function createPartNumberFloat() {
    const float = document.createElement('div');
    float.id = 'pn-float';
    float.innerHTML = `
      <div class="pn-float-header">
        <span class="pn-float-title">型式（動的生成）</span>
        <span class="pn-status pending" id="pn-status">未確定</span>
        <button class="pn-float-clear" id="pn-clear">クリア</button>
        <button class="pn-float-btn" id="pn-toggle">−</button>
      </div>
      <div class="pn-float-body" id="pn-body">
        <div class="pn-display" id="pn-display">
          <span class="pn-seg pending">スペック未選定</span>
        </div>
        <div id="pn-guide">
          <div class="pn-guide-title">次に選定する項目:</div>
          <div id="pn-guide-primary"></div>
          <div id="pn-guide-secondary" class="pn-guide-sub" style="display:none;">
            <div class="pn-guide-sub-title">▾ これらからも絞り込み可能</div>
            <div id="pn-guide-secondary-items"></div>
          </div>
        </div>
        <div class="pn-complete-msg" id="pn-complete" style="display:none">全項目選定完了</div>
      </div>
    `;
    document.body.appendChild(float);

    document.getElementById('pn-toggle').addEventListener('click', () => {
      float.classList.toggle('collapsed');
      document.getElementById('pn-toggle').textContent = float.classList.contains('collapsed') ? '+' : '−';
    });

    document.getElementById('pn-clear').addEventListener('click', clearAll);

    // MISUMIの「すべて解除」ボタンと連動
    const misumiClearAttached = new WeakSet();
    const attachMisumiClearListener = () => {
      document.querySelectorAll('button[class*="SpecPanel_clearAll"]').forEach(btn => {
        if (misumiClearAttached.has(btn)) return;
        misumiClearAttached.add(btn);
        btn.addEventListener('click', clearAll);
      });
    };
    attachMisumiClearListener();
    new MutationObserver(attachMisumiClearListener)
      .observe(document.body, { childList: true, subtree: true });

    // === ドラッグ可能化 ===
    const header = float.querySelector('.pn-float-header');
    let isDragging = false;
    let dragOffsetX = 0, dragOffsetY = 0;

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      isDragging = true;
      const rect = float.getBoundingClientRect();
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;
      float.classList.add('dragging');
      float.style.right = 'auto';
      float.style.bottom = 'auto';
      float.style.left = rect.left + 'px';
      float.style.top = rect.top + 'px';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      let newX = e.clientX - dragOffsetX;
      let newY = e.clientY - dragOffsetY;
      const rect = float.getBoundingClientRect();
      const maxX = window.innerWidth - rect.width;
      const maxY = window.innerHeight - rect.height;
      newX = Math.max(0, Math.min(newX, maxX));
      newY = Math.max(0, Math.min(newY, maxY));
      float.style.left = newX + 'px';
      float.style.top = newY + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        float.classList.remove('dragging');
        try {
          localStorage.setItem('pn-float-pos', JSON.stringify({
            left: float.style.left, top: float.style.top
          }));
        } catch(e) {}
      }
    });

    try {
      const saved = JSON.parse(localStorage.getItem('pn-float-pos') || 'null');
      if (saved && saved.left && saved.top) {
        float.style.right = 'auto';
        float.style.bottom = 'auto';
        float.style.left = saved.left;
        float.style.top = saved.top;
      }
    } catch(e) {}
  }

  // =====================================================
  // WYS規格表の列順を取得（スペック並び替え用）
  // =====================================================
  // TYPE系列の表記揺れを判定
  const TYPE_LABEL_REGEX = /^(TYPE|Type|型式|型番|品番|部品番号|形式|型名)$/i;

  // 注文例テーブルを検出して列順を返す。見つからなければ空配列。
  function getOrderExampleColumnOrder() {
    const candidateTables = new Set();
    document.querySelectorAll('.headerCell, .bodyCell, .coloredCell').forEach(c => {
      const t = c.closest('table'); if(t) candidateTables.add(t);
    });
    document.querySelectorAll('.m-table').forEach(t => candidateTables.add(t));
    document.querySelectorAll('[class*="wysiwyg"] table, [class*="common_common"] table').forEach(t => candidateTables.add(t));

    // 先頭セルが TYPE/型式/型番/品番 で始まる小さなテーブルを探す
    let bestTable = null;
    let bestRow = null;
    candidateTables.forEach(table => {
      const firstRow = table.querySelector('tr');
      if (!firstRow) return;
      const cells = firstRow.querySelectorAll('th, td');
      if (cells.length < 2) return;
      const firstText = extractTexts(cells[0])[0] || '';
      if (!TYPE_LABEL_REGEX.test(firstText)) return;
      // 注文例は通常2〜3行の小さなテーブル
      const rowCount = table.querySelectorAll('tr').length;
      if (rowCount > 5) return;
      bestTable = table;
      bestRow = firstRow;
    });

    if (!bestTable || !bestRow) return [];

    const order = [];
    const seen = new Set();
    bestRow.querySelectorAll('th, td').forEach(cell => {
      const texts = extractTexts(cell);
      texts.forEach(t => {
        if (!t || t === '-' || t === '−') return;
        if (seen.has(t)) return;
        seen.add(t);
        order.push(t);
      });
    });
    return order;
  }

  function getWysColumnOrder() {
    // 注文例テーブル優先
    const orderExample = getOrderExampleColumnOrder();
    if (orderExample.length > 0) return orderExample;

    // 対象テーブル候補を全て収集
    const candidateTables = new Set();
    document.querySelectorAll('.headerCell, .bodyCell, .coloredCell').forEach(c => {
      const t = c.closest('table'); if(t) candidateTables.add(t);
    });
    document.querySelectorAll('.m-table').forEach(t => candidateTables.add(t));
    document.querySelectorAll('[class*="wysiwyg"] table, [class*="common_common"] table').forEach(t => candidateTables.add(t));

    if (candidateTables.size === 0) return [];

    // 各テーブルをスコアリング: 寸法記号(D/L/M/N/H/T/P/W/R)が多いほど重要
    const dimSymRegex = /^[DdLlMNHTPWRCℓΦ]\d*$/;
    let bestTable = null;
    let bestScore = -1;

    candidateTables.forEach(table => {
      let score = 0;
      // ヘッダー候補（.headerCell / <th> / 最初の行の<td>）
      const headers = new Set();
      table.querySelectorAll('.headerCell, th').forEach(c => headers.add(c));
      const firstRow = table.querySelector('tr');
      if (firstRow) firstRow.querySelectorAll('td').forEach(c => headers.add(c));

      headers.forEach(cell => {
        const texts = extractTexts(cell);
        texts.forEach(t => {
          if (dimSymRegex.test(t)) score += 3;     // D/L/M/N等の記号 = 高得点
          if (/材質|硬度|表面処理|Type|型式/.test(t)) score += 2;
          if (t.length > 0 && t.length <= 10) score += 1; // ヘッダーぽい
        });
      });
      if (score > bestScore) { bestScore = score; bestTable = table; }
    });

    if (!bestTable) return [];

    // 選ばれたテーブルから列順を取得
    // 最初のヘッダー行から順序を取得
    const order = [];
    const seenTexts = new Set();

    // ヘッダー行を探す: thead > tr、または<th>を含むtr、または<tr>の1つ目
    let headerRows = [];
    const thead = bestTable.querySelector('thead');
    if (thead) {
      thead.querySelectorAll('tr').forEach(r => headerRows.push(r));
    } else {
      // <th>を含む行、または .headerCell を含む行
      bestTable.querySelectorAll('tr').forEach(r => {
        if (r.querySelector('th') || r.querySelector('.headerCell')) {
          headerRows.push(r);
        }
      });
      // 見つからない場合は先頭行
      if (headerRows.length === 0) {
        const fr = bestTable.querySelector('tr');
        if (fr) headerRows.push(fr);
      }
    }

    // 各ヘッダー行のセルを左→右の順で取得
    headerRows.forEach(row => {
      row.querySelectorAll('th, td').forEach(cell => {
        const texts = extractTexts(cell);
        texts.forEach(t => {
          if (t && !seenTexts.has(t)) {
            order.push(t);
            seenTexts.add(t);
          }
        });
      });
    });

    return order;
  }

  // =====================================================
  // 動的スペック読み取り: スペックパネルから全項目と選択値を取得
  // =====================================================
  // 外部（WYS/外形図クリック）から設定されたオーバーライド値
  window.__specValueOverrides = window.__specValueOverrides || {};
  // DOM が一度でも override と一致したか（confirmed）を記録。
  // confirmed 後のみ、DOM との乖離で override を削除する（= ユーザーが直接スペックパネルで変更したと判断）。
  // これにより React の再レンダリングが遅れて DOM=旧値のままのときに、polling が誤って override を消すのを防ぐ。
  window.__specValueOverridesConfirmed = window.__specValueOverridesConfirmed || {};
  // clearAll() 後は null オーバーライドをセンチネルとして使う（フラグ方式は廃止）

  function readAllSpecs() {
    const specs = [];
    document.querySelectorAll('[class*="SpecFrame_frame"]').forEach(frame => {
      // RoHS/chemSHERPAなどは除外
      if (frame.className && /RohsSpecFrame|ChemSherpa/.test(frame.className)) return;
      if (frame.closest('[class*="RohsSpecFrame"],[class*="ChemSherpa"]')) return;

      const nameEl = frame.querySelector('[class*="SpecFrame_specName"],[class*="SpecFrame_heading"] span');
      if (!nameEl) return;
      const name = nameEl.textContent.trim();

      // 非スペック系をフィルタ
      if (/CAD|出荷日|days|chemSHERPA|RoHS/i.test(name)) return;

      // 選択値の取得
      let value = null;
      let valueDisplay = null;

      // (0) オーバーライド優先 (WYS/外形図からの即時反映)
      // null は clearAll() がセットする「クリア済みセンチネル」。DOM を読まず hasValue=false を返す。
      const hasOverride = window.__specValueOverrides[name] !== undefined;
      if (hasOverride) {
        value = window.__specValueOverrides[name]; // null の場合は value=null のまま
        valueDisplay = value;
      }

      // (1) aria-checked="true" のチェックボックス系（override がない場合のみ）
      if (!hasOverride) {
        const checked = frame.querySelectorAll('[aria-checked="true"]');
        if (checked.length > 0) {
          value = checked[0].textContent.trim();
          valueDisplay = value;
        }
      }
      // (2) 数値入力フィールド (NumericSpecField)（override がない場合のみ）
      if (!value && !hasOverride) {
        const numInput = frame.querySelector('[class*="NumericSpecField_textField"],[class*="NumericField_textField"]');
        if (numInput && numInput.value && numInput.value.trim()) {
          value = numInput.value.trim();
          valueDisplay = value;
        }
      }

      // プレフィックス/サフィックスの推定
      // [M], [N], (φ) 等の記号をspecNameから抽出
      let prefix = '';
      const bracketMatch = name.match(/\[\s*([A-Za-zΦφ]\d*)\s*\]/);
      const parenMatch = name.match(/[（(]\s*([A-Za-zΦφ]\d*)\s*[）)]/);
      if (bracketMatch && /^M|^N/.test(bracketMatch[1])) prefix = bracketMatch[1].charAt(0);
      else if (parenMatch && /^[Φφ]/.test(parenMatch[1])) prefix = 'φ';

      // 選択肢（options）の収集: スペック項目内の全チェックボックス値
      const options = [];
      frame.querySelectorAll('[role="checkbox"]').forEach(cb => {
        const t = cb.textContent.trim();
        if (t && t.length <= 15) options.push(t);
      });
      // 数値レンジ（例: [20-150/1mm単位]）の抽出
      const rangeEl = frame.querySelector('[class*="NumericSpecField_range"]');
      let numericRange = null;
      if (rangeEl) {
        const m = rangeEl.textContent.match(/\[?(\d+)\s*[-~〜]\s*(\d+)/);
        if (m) numericRange = { min: parseInt(m[1]), max: parseInt(m[2]) };
      }

      specs.push({
        name,
        value,
        valueDisplay: value ? (prefix + value) : null,
        frame,
        prefix,
        hasValue: !!value,
        options,           // ['6','8','10','12',...]
        numericRange,      // { min: 20, max: 150 } or null
      });
    });

    // === WYS規格表 or 注文例テーブルの列順に合わせてソート ===
    const wysOrder = getWysColumnOrder();
    if (wysOrder.length > 0) {
      const isTypeLabel = (txt) => TYPE_LABEL_REGEX.test(txt);

      // 各スペックにWYS順序スコアを付与
      specs.forEach(sp => {
        let bestIdx = -1;

        // (0) TYPE系スペックは注文例の先頭「型式」ラベルにマッチ
        const isTypeSpec = /^(タイプ|Type|型式|型番|品番|形式|型名)$/i.test(sp.name.trim());
        if (isTypeSpec) {
          for (let i = 0; i < wysOrder.length; i++) {
            if (isTypeLabel(wysOrder[i])) { bestIdx = i; break; }
          }
        }

        // (1) 階層マッチング: ルール優先
        if (bestIdx === -1 && !isTypeSpec) {
          for (const rule of RULES) {
            if (rule.p.test(sp.name)) {
              for (let i = 0; i < wysOrder.length; i++) {
                const txt = wysOrder[i];
                if (rule.w.some(wp => wp.test(txt))) {
                  if (bestIdx === -1 || i < bestIdx) bestIdx = i;
                }
              }
              if (bestIdx !== -1) break;
            }
          }
        }

        // (2) スコアリング: ルールで見つからない場合
        if (bestIdx === -1 && !isTypeSpec) {
          const headerMap = wysOrder.map((text, i) => ({ text, idx: i }));
          const scored = scoreMatch(sp.name, headerMap);
          if (scored.length > 0 && scored[0].score >= 60) {
            bestIdx = scored[0].idx;
          }
        }

        // TYPE系は常に最優先
        if (isTypeSpec) bestIdx = -1;

        sp.wysOrder = bestIdx;
        sp.isTypeSpec = isTypeSpec;
      });

      // ソート: TYPE系(-1) → WYS順 → マッチなし(9999)は最後
      specs.sort((a, b) => {
        const ao = a.wysOrder >= -1 && a.wysOrder !== undefined ? a.wysOrder : 9999;
        const bo = b.wysOrder >= -1 && b.wysOrder !== undefined ? b.wysOrder : 9999;
        return ao - bo;
      });
    } else {
      // 注文例もWYS規格表もない場合でも、TYPE系は先頭に固定
      specs.forEach(sp => {
        sp.isTypeSpec = /^(タイプ|Type|型式|型番|品番|形式|型名)$/i.test(sp.name.trim());
      });
      specs.sort((a, b) => {
        if (a.isTypeSpec && !b.isTypeSpec) return -1;
        if (!a.isTypeSpec && b.isTypeSpec) return 1;
        return 0;
      });
    }

    return specs;
  }

  // 型式表示の動的再構築
  function rebuildPartNumberDisplay() {
    const display = document.getElementById('pn-display');
    if (!display) return;

    const specs = readAllSpecs();
    if (specs.length === 0) {
      display.innerHTML = '<span class="pn-seg pending">スペック項目未検出</span>';
      return;
    }

    // 型式表示を動的生成
    display.innerHTML = '';

    // 注文例テーブルから取得した列順（TYPE系ラベルを含む）
    const orderExample = getOrderExampleColumnOrder();
    const typeLabel = (orderExample.length > 0 && TYPE_LABEL_REGEX.test(orderExample[0]))
      ? orderExample[0] : 'TYPE';

    // specs 配列は readAllSpecs() 内で注文例の列順にソート済み。
    // 選定／未選定にかかわらず同じ順序で描画することで、選定開始後も並びが崩れない。
    const renderSeg = (className, text, title) => {
      const seg = document.createElement('span');
      seg.className = 'pn-seg ' + className;
      seg.textContent = text;
      if (title) seg.title = title;
      display.appendChild(seg);
    };
    const renderSep = () => {
      const sep = document.createElement('span');
      sep.className = 'pn-sep';
      sep.textContent = '-';
      display.appendChild(sep);
    };

    const placeholderFor = (sp) => {
      if (sp.isTypeSpec) return typeLabel;
      if (orderExample.length > 0 && typeof sp.wysOrder === 'number' &&
          sp.wysOrder >= 0 && sp.wysOrder < orderExample.length) {
        return orderExample[sp.wysOrder] + '?';
      }
      const symMatch = sp.name.match(/[\[（(]?\s*([A-Za-zΦφ]\d*)\s*[\]）)]?/);
      return (symMatch ? symMatch[1] : '?') + '?';
    };

    // === partNoPosition 独自レンダリングパス ===
    // マッピング管理UIで型式順を手動設定している場合、orderExample に依存せず独自描画
    {
      const srMatch = location.pathname.match(/detail\/(\d+)/);
      const srCode = srMatch ? srMatch[1] : null;
      const manualPos = {};     // specName → partNoPosition(数値)
      const manualSym = {};     // specName → WYSヘッダー先頭アルファベット（プレースホルダー用）
      if (srCode) {
        try {
          const manual = getMappingData(srCode);
          Object.entries(manual).forEach(([n, m]) => {
            if (m.partNoPosition != null) manualPos[n] = m.partNoPosition;
            const hdr = (m.wysHeaders && m.wysHeaders[0]) || m.wysHeader || '';
            const dimMatch = hdr.match(/^([A-Za-z]+)/);
            if (dimMatch) manualSym[n] = dimMatch[1];
          });
        } catch(e) {}
      }
      if (Object.keys(manualPos).length > 0) {
        // TYPE セグメント（先頭固定）
        const typeSpec = specs.find(s => s.isTypeSpec);
        if (typeSpec && typeSpec.hasValue) {
          renderSeg('set', typeSpec.valueDisplay, typeSpec.name);
        } else {
          renderSeg('pending', typeLabel, null);
        }
        // partNoPosition 順でスペック描画（TYPE は先頭で処理済みなので除外、φ プレフィックスも除去）
        specs
          .filter(sp => manualPos[sp.name] != null && !sp.isTypeSpec)
          .sort((a, b) => manualPos[a.name] - manualPos[b.name])
          .forEach(sp => {
            renderSep();
            if (sp.hasValue) {
              renderSeg('set', sp.value, sp.name);
            } else {
              // スペック名のカッコ記号を優先（"外径（N）"→"N"）、なければWYSヘッダーにフォールバック
              const symFromName = (sp.name.match(/[\[（(]\s*([A-Za-z]\d*)\s*[\]）)]/) || [])[1];
              const sym = symFromName || manualSym[sp.name] || '?';
              renderSeg('opt', sym + '?', sp.name);
            }
          });
        return specs;
      }
    }

    let firstSeg = true;
    if (orderExample.length > 0) {
      orderExample.forEach((colLabel, colIdx) => {
        const sp = specs.find(s => s.wysOrder === colIdx);
        if (!firstSeg) renderSep();
        firstSeg = false;
        if (sp && sp.hasValue) {
          renderSeg('set', sp.valueDisplay, sp.name);
        } else if (sp) {
          renderSeg('opt', placeholderFor(sp), sp.name);
        } else if (TYPE_LABEL_REGEX.test(colLabel)) {
          renderSeg('pending', colLabel, null);
        } else {
          renderSeg('pending', colLabel + '?', null);
        }
      });

      specs.forEach(sp => {
        const idx = sp.wysOrder;
        if (typeof idx === 'number' && idx >= 0 && idx < orderExample.length) return;
        if (sp.isTypeSpec && orderExample.some((c, i) => TYPE_LABEL_REGEX.test(c))) return;
        if (!firstSeg) renderSep();
        firstSeg = false;
        if (sp.hasValue) renderSeg('set', sp.valueDisplay, sp.name);
        else renderSeg('opt', placeholderFor(sp), sp.name);
      });
    } else {
      specs.forEach(sp => {
        if (!firstSeg) renderSep();
        firstSeg = false;
        if (sp.hasValue) renderSeg('set', sp.valueDisplay, sp.name);
        else renderSeg('opt', placeholderFor(sp), sp.name);
      });
      if (firstSeg) {
        const hint = document.createElement('span');
        hint.className = 'pn-sep';
        hint.style.marginLeft = '8px';
        hint.style.color = '#888';
        hint.textContent = '(スペック未選定)';
        display.appendChild(hint);
      }
    }

    return specs;
  }

  function updatePartNumber() {
    // スペックパネルから全項目をスキャンして動的に表示を更新
    const specs = rebuildPartNumberDisplay();
    if (!specs) return;

    // state（旧FA固定スロット）も同期維持（SVGオーバーレイや規格表連動のため）
    specs.forEach(sp => {
      if (!sp.hasValue) return;
      if (/軸径.*D|D.*φ/.test(sp.name) && /^\d+$/.test(sp.value)) state.D = sp.value;
      else if (/長さ.*L/.test(sp.name)) state.L = sp.value;
      else if (/めねじ.*\[M\]|めねじ.*M\(/.test(sp.name)) state.M = sp.value;
      else if (/めねじ.*\[N\]|めねじ.*N\(/.test(sp.name)) state.N = sp.value;
      else if (/^(タイプ|Type)$/i.test(sp.name.trim())) state.type = sp.value;
    });

    // ステータス更新
    const setCount = specs.filter(s => s.hasValue).length;
    const totalCount = specs.length;
    const statusEl = document.getElementById('pn-status');
    if (statusEl) {
      if (setCount === 0) {
        statusEl.textContent = '未確定';
        statusEl.className = 'pn-status pending';
      } else if (setCount < totalCount) {
        statusEl.textContent = `${setCount}/${totalCount}`;
        statusEl.className = 'pn-status partial';
      } else {
        statusEl.textContent = '確定';
        statusEl.className = 'pn-status complete';
      }
    }

    // ガイド（未選定項目）の動的生成
    const guidePrimary = document.getElementById('pn-guide-primary');
    const guideSecondaryWrap = document.getElementById('pn-guide-secondary');
    const guideSecondaryItems = document.getElementById('pn-guide-secondary-items');
    const guide = document.getElementById('pn-guide');
    const complete = document.getElementById('pn-complete');
    if (guidePrimary) {
      // マッピングデータから partNoPosition / isAdditionalWork を取得
      const srMatchG = location.pathname.match(/detail\/(\d+)/);
      const srCodeG = srMatchG ? srMatchG[1] : null;
      let mappingDataG = {};
      if (srCodeG) {
        try { mappingDataG = getMappingData(srCodeG); } catch(e) {}
      }

      const makeItem = (sp, cls) => {
        const item = document.createElement('span');
        item.className = `pn-guide-item ${cls}`;
        const shortName = sp.name.length > 14 ? sp.name.substring(0, 13) + '…' : sp.name;
        item.textContent = cls === 'req' ? `→ ${shortName}` : shortName;
        item.title = sp.name;
        if (sp.frame) {
          item.addEventListener('click', () => {
            sp.frame.scrollIntoView({ behavior: 'smooth', block: 'center' });
            sp.frame.style.transition = 'box-shadow 0.3s';
            sp.frame.style.boxShadow = cls === 'req'
              ? 'inset 0 0 12px rgba(255,170,0,0.4)'
              : 'inset 0 0 10px rgba(100,180,255,0.25)';
            setTimeout(() => { sp.frame.style.boxShadow = ''; }, 2000);
          });
        }
        return item;
      };

      const unset = specs.filter(s => !s.hasValue);
      const hasPosData = Object.values(mappingDataG).some(m => m && typeof m === 'object' && m.partNoPosition != null);

      if (hasPosData) {
        // primary: partNoPosition 設定あり → position 順
        const primaryUnset = unset
          .filter(s => { const m = mappingDataG[s.name]; return m && typeof m === 'object' && m.partNoPosition != null; })
          .sort((a, b) => mappingDataG[a.name].partNoPosition - mappingDataG[b.name].partNoPosition);

        // secondary: マッピングあり・partNoPosition なし
        const secondaryUnset = unset.filter(s => {
          const m = mappingDataG[s.name];
          return m && typeof m === 'object' && m.partNoPosition == null;
        });

        guidePrimary.innerHTML = '';
        primaryUnset.forEach(sp => guidePrimary.appendChild(makeItem(sp, 'req')));

        if (guideSecondaryItems) guideSecondaryItems.innerHTML = '';
        secondaryUnset.forEach(sp => guideSecondaryItems && guideSecondaryItems.appendChild(makeItem(sp, 'sub')));
        if (guideSecondaryWrap) guideSecondaryWrap.style.display = secondaryUnset.length > 0 ? 'block' : 'none';

        if (guide) guide.style.display = (primaryUnset.length > 0 || secondaryUnset.length > 0) ? 'block' : 'none';
      } else {
        // フォールバック: マッピング未設定 → 全件を primary に表示（従来動作）
        guidePrimary.innerHTML = '';
        unset.slice(0, 8).forEach(sp => guidePrimary.appendChild(makeItem(sp, 'req')));
        if (unset.length > 8) {
          const more = document.createElement('span');
          more.className = 'pn-guide-item';
          more.style.cssText = 'color:#88aacc;background:transparent;border:none;';
          more.textContent = `他 ${unset.length - 8} 項目`;
          guidePrimary.appendChild(more);
        }
        if (guideSecondaryWrap) guideSecondaryWrap.style.display = 'none';
        if (guide) guide.style.display = unset.length > 0 ? 'block' : 'none';
      }
    }
    if (complete) complete.style.display = (setCount >= totalCount && totalCount > 0) ? 'block' : 'none';

    // 型番確定トースト（partNoPosition が設定されたスペックが全部埋まった瞬間に発火）
    {
      const srMatch2 = location.pathname.match(/detail\/(\d+)/);
      const srCode2 = srMatch2 ? srMatch2[1] : null;
      if (srCode2) {
        try {
          const saved2 = getMappingData(srCode2);
          const posSpecNames = Object.entries(saved2)
            .filter(([, m]) => m && typeof m === 'object' && m.partNoPosition != null)
            .map(([name]) => name);
          if (posSpecNames.length > 0) {
            const allFilled = posSpecNames.every(name => specs.some(s => s.name === name && s.hasValue));
            const currentPartNo = [...document.querySelectorAll('#pn-display .pn-seg.set')]
              .map(s => s.textContent.trim()).join('-');
            if (allFilled && currentPartNo && currentPartNo !== state.lastConfirmedPartNo) {
              state.lastConfirmedPartNo = currentPartNo;
              showPartNoConfirmedToast(currentPartNo);
            } else if (!allFilled) {
              state.lastConfirmedPartNo = null;
            }
          }
        } catch(e) {}
      }
    }
  }

  // ===== 型番確定トースト =====
  function showPartNoConfirmedToast(partNoText) {
    const existing = document.getElementById('spechl-partno-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'spechl-partno-toast';
    toast.style.cssText = [
      'position:fixed', 'bottom:28px', 'left:50%', 'transform:translateX(-50%)',
      'background:#0a1a10', 'border:1.5px solid #22c55e', 'border-radius:12px',
      'padding:14px 18px', 'min-width:280px', 'max-width:440px', 'z-index:2147483647',
      'box-shadow:0 8px 32px rgba(0,0,0,.5)', 'font-family:"Meiryo UI",sans-serif',
      'animation:spechlToastIn .25s ease',
    ].join(';');

    toast.innerHTML = `
      <style>
        @keyframes spechlToastIn{from{opacity:0;transform:translateX(-50%) translateY(16px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        @keyframes spechlToastOut{from{opacity:1}to{opacity:0;transform:translateX(-50%) translateY(10px)}}
      </style>
      <div style="display:flex;align-items:flex-start;gap:10px;">
        <span style="font-size:22px;line-height:1.1;flex-shrink:0;">✅</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:11px;color:#86efac;font-weight:700;margin-bottom:4px;">型番が確定しました</div>
          <div style="font-size:16px;font-weight:700;color:#fff;letter-spacing:1px;word-break:break-all;">${partNoText}</div>
        </div>
        <button id="spechl-toast-close" style="background:none;border:none;color:#4b6070;font-size:18px;cursor:pointer;padding:0 2px;line-height:1;flex-shrink:0;">✕</button>
      </div>
    `;
    document.body.appendChild(toast);

    const dismiss = () => {
      toast.style.animation = 'spechlToastOut .2s ease forwards';
      setTimeout(() => toast.remove(), 200);
    };
    toast.querySelector('#spechl-toast-close').addEventListener('click', dismiss);
    setTimeout(dismiss, 4000);
  }

  // ===== スペックパネルのチェック変更を監視 =====
  function watchSpecChanges() {
    // MutationObserverでスペック選択の変化を監視
    const specPanel = document.querySelector('[class*="SpecPanel_panel"]');
    if (!specPanel) return;

    const observer = new MutationObserver(() => {
      // WYS/外形図からのsync中はスペック監視を停止（stateの上書きを防止）
      if (window.__specHLSyncing) return;
      // 選択されたスペック値をスキャン
      document.querySelectorAll('[class*="SpecFrame_frame"]').forEach(frame => {
        const nameEl = frame.querySelector('[class*="SpecFrame_specName"],[class*="SpecFrame_heading"] span');
        if (!nameEl) return;
        const name = nameEl.textContent.trim();

        // チェックされた値を取得（チェックなしなら state を null に）
        const checked = frame.querySelectorAll('[aria-checked="true"]');
        const val = checked.length > 0 ? checked[0].textContent.trim() : null;

        // オーバーライド管理:
        //   null センチネル（clearAll後）: ユーザーが新たに選択した場合のみ解除
        //   DOM が override と一致 → confirmed をセット
        //   confirmed 後に乖離 → override 解除（ユーザー直接変更とみなす）
        //   confirmed 前の乖離は React 再レンダリング遅延なので無視
        if (window.__specValueOverrides[name] !== undefined) {
          if (window.__specValueOverrides[name] === null) {
            // クリア済みセンチネル: クリア時と異なる値が選択された場合のみ解除
            const clearedVal = (window.__specHLClearedValues || {})[name];
            if (val !== null && val !== clearedVal) {
              delete window.__specValueOverrides[name];
              delete window.__specValueOverridesConfirmed[name];
            }
          } else if (val === window.__specValueOverrides[name]) {
            window.__specValueOverridesConfirmed[name] = true;
          } else if (window.__specValueOverridesConfirmed[name] && val !== null) {
            delete window.__specValueOverrides[name];
            delete window.__specValueOverridesConfirmed[name];
          }
        }

        if (/軸径.*D|D.*φ/.test(name) && val !== state.D) {
          state.D = val; if (val) showDimBadgesGlobal('D', val);
        } else if (/長さ.*L|L.*mm/.test(name) && val !== state.L) {
          state.L = val; if (val) showDimBadgesGlobal('L', val);
        } else if (/めねじ.*\[M\]|めねじ.*M\(/.test(name) && !/MD|MSC/.test(name) && val !== state.M) {
          state.M = val; if (val) showDimBadgesGlobal('M', val);
        } else if (/めねじ.*\[N\]|めねじ.*N\(/.test(name) && !/ND|NSC/.test(name) && val !== state.N) {
          state.N = val; if (val) showDimBadgesGlobal('N', val);
        } else if (/^(タイプ|Type)$/i.test(name.trim()) && val !== state.type) {
          state.type = val;
        }
      });
      updatePartNumber();
      highlightConfirmed();
    });

    observer.observe(specPanel, { attributes:true, subtree:true, attributeFilter:['aria-checked'] });

    // 長さL等: Reactが制御するinputはイベントリスナーで拾えないため、ポーリングで監視
    let lastValues = {};

    // blur/Enterで即時確定（ポーリング500ms遅延の解消）
    const numericListenerAttached = new WeakSet();
    const attachNumericInputListeners = () => {
      document.querySelectorAll('[class*="SpecFrame_frame"]').forEach(frame => {
        const nameEl = frame.querySelector('[class*="SpecFrame_specName"],[class*="SpecFrame_heading"] span');
        if (!nameEl) return;
        const name = nameEl.textContent.trim();
        frame.querySelectorAll('input[type="text"],input[type="number"]').forEach(input => {
          if (numericListenerAttached.has(input)) return;
          numericListenerAttached.add(input);
          const handleCommit = () => {
            if (window.__specHLSyncing) return;
            const val = input.value.trim();
            if (!val) return;
            const key = name + '_' + Array.from(input.parentElement.children).indexOf(input);
            if (val === lastValues[key]) return;
            lastValues[key] = val;
            // nullセンチネル解除
            if (window.__specValueOverrides[name] === null) delete window.__specValueOverrides[name];
            // L寸の場合はstate/badge更新（スペック名は「長さ」「長さ（L）」「L(mm)」等）
            if (/長さ|^L$/.test(name) && state.L !== val) {
              state.L = val;
              showDimBadgesGlobal('L', val);
            }
            // スペック名によらずパネルを即時更新
            updatePartNumber();
            highlightConfirmed();
          };
          // Enter後にMISUMIが描画した候補を自動クリックして2段階確定を1段階に短縮
          const autoClickRenderedOption = (val) => {
            const obs = new MutationObserver(() => {
              const options = frame.querySelectorAll('[role="checkbox"],[role="option"],[aria-checked]');
              const match = [...options].find(o => {
                const t = o.textContent.trim().replace(/mm$/, '');
                return t === val || t === val + 'mm';
              });
              if (match) {
                obs.disconnect();
                if (match.getAttribute('aria-checked') !== 'true') match.click();
              }
            });
            obs.observe(frame, { childList: true, subtree: true, characterData: true });
            // 3秒以内に候補が現れなければ諦める
            setTimeout(() => obs.disconnect(), 3000);
          };
          const handleEnter = (e) => {
            if (e.key !== 'Enter') return;
            const val = input.value.trim();
            if (!val) return;
            // blur を呼んで MISUMI の React ハンドラを起動
            input.blur();
            handleCommit();
            autoClickRenderedOption(val);
          };
          input.addEventListener('blur', handleCommit);
          input.addEventListener('keydown', handleEnter);
        });
      });
    };
    attachNumericInputListeners();

    setInterval(() => {
      // WYS/外形図からのsync中はスペック監視を停止
      if (window.__specHLSyncing) return;
      // Reactが動的に生成したinputに都度リスナーを付与
      attachNumericInputListeners();
      document.querySelectorAll('[class*="SpecFrame_frame"]').forEach(frame => {
        const nameEl = frame.querySelector('[class*="SpecFrame_specName"],[class*="SpecFrame_heading"] span');
        if (!nameEl) return;
        const name = nameEl.textContent.trim();

        // NumericSpecField / NumericField / FilterByRange 内のinputを全てチェック
        frame.querySelectorAll('input[type="text"],input[type="number"]').forEach(input => {
          const val = input.value.trim();
          const key = name + '_' + Array.from(input.parentElement.children).indexOf(input);

          if (val && val !== lastValues[key]) {
            lastValues[key] = val;

            if (/長さ.*L|L.*mm/.test(name)) {
              // null センチネルがある場合は解除してから反映
              if (window.__specValueOverrides[name] === null) delete window.__specValueOverrides[name];
              state.L = val;
              showDimBadgesGlobal('L', val);
              updatePartNumber();
              highlightConfirmed();
              console.log('[SpecHL] L value detected: ' + val);
            }
          }
        });

        // aria-checkedもポーリングで拾う（MutationObserverの補完）
        const checked = frame.querySelectorAll('[aria-checked="true"]');
        const val = checked.length > 0 ? checked[0].textContent.trim() : null;

        // オーバーライド管理（MutationObserverと同じロジック）
        if (window.__specValueOverrides[name] !== undefined) {
          if (window.__specValueOverrides[name] === null) {
            const clearedVal = (window.__specHLClearedValues || {})[name];
            if (val !== null && val !== clearedVal) {
              delete window.__specValueOverrides[name];
              delete window.__specValueOverridesConfirmed[name];
            }
          } else if (val === window.__specValueOverrides[name]) {
            window.__specValueOverridesConfirmed[name] = true;
          } else if (window.__specValueOverridesConfirmed[name] && val !== null) {
            delete window.__specValueOverrides[name];
            delete window.__specValueOverridesConfirmed[name];
          }
        }

        if (/軸径.*D|D.*φ/.test(name) && val !== state.D) {
          state.D = val; if (val) showDimBadgesGlobal('D', val);
          updatePartNumber(); highlightConfirmed();
        } else if (/めねじ.*\[M\]|めねじ.*M\(/.test(name) && !/MD|MSC/.test(name) && val !== state.M) {
          state.M = val; if (val) showDimBadgesGlobal('M', val);
          updatePartNumber(); highlightConfirmed();
        } else if (/めねじ.*\[N\]|めねじ.*N\(/.test(name) && !/ND|NSC/.test(name) && val !== state.N) {
          state.N = val; if (val) showDimBadgesGlobal('N', val);
          updatePartNumber(); highlightConfirmed();
        } else if (/^(タイプ|Type)$/i.test(name.trim()) && val !== state.type) {
          state.type = val;
          updatePartNumber(); highlightConfirmed();
        }
      });

      // 動的スキャン: FA固定マッチに該当しないスペックも型式ウィンドウに反映
      // （変化検知のためハッシュ化して前回と比較）
      const specs = readAllSpecs();
      const hash = specs.map(s => s.name + '=' + (s.value||'')).join('|');
      if (hash !== lastSpecHash) {
        lastSpecHash = hash;
        updatePartNumber();
      }
    }, 500);

    console.log('[SpecHL] Polling spec values every 500ms');
  }
  let lastSpecHash = '';

  function showDimBadgesGlobal(dim, value) {
    showDimBadges(dim, value);
  }

  // ===== WYS行フィルター + 外形図SVGラベル連動 =====
  function updateWysRowFilter() {
    // WYS表: state.D に合わない行を dim
    document.querySelectorAll('[data-spechl-dval]').forEach(row => {
      const rowD = row.dataset.spechlDval;
      if (state.D) {
        if (rowD === state.D) {
          row.classList.remove('spechl-row-inactive');
          row.classList.add('spechl-row-active');
        } else {
          row.classList.add('spechl-row-inactive');
          row.classList.remove('spechl-row-active');
        }
      } else {
        row.classList.remove('spechl-row-inactive', 'spechl-row-active');
      }
    });

    // 既存のサブテキストがあれば削除（以前のバージョンの残骸クリーンアップ）
    document.querySelectorAll('.spechl-label-sub').forEach(el => el.remove());
  }

  // ===== クリア =====
  function clearAll() {
    // MISUMIの「すべて解除」と相互連動（無限ループ防止フラグ）
    if (!clearAll._running) {
      clearAll._running = true;
      const misumiClearBtn = document.querySelector('button[class*="SpecPanel_clearAll"]');
      if (misumiClearBtn) misumiClearBtn.click();
      clearAll._running = false;
    }
    state.type = state.D = state.L = state.M = state.N = null;
    window.__specValueOverridesConfirmed = {};

    // 現在のDOM選択値に null オーバーライド（クリア済みセンチネル）をセット。
    // これにより readAllSpecs() は DOM を読まず hasValue=false を返す。
    // ユーザーが新たに値を選んだ瞬間にセンチネルが消え、以降は正常にDOM読取りに戻る。
    const nullOverrides = {};
    const clearedValues = {};
    document.querySelectorAll('[class*="SpecFrame_frame"]').forEach(frame => {
      const nameEl = frame.querySelector('[class*="SpecFrame_specName"],[class*="SpecFrame_heading"] span');
      if (!nameEl) return;
      const name = nameEl.textContent.trim();
      if (/CAD|出荷日|days|chemSHERPA|RoHS/i.test(name)) return;
      const checked = frame.querySelectorAll('[aria-checked="true"]');
      const numInput = frame.querySelector('[class*="NumericSpecField_textField"],[class*="NumericField_textField"]');
      const curVal = checked.length > 0 ? checked[0].textContent.trim()
        : (numInput && numInput.value.trim() ? numInput.value.trim() : null);
      if (curVal) {
        nullOverrides[name] = null;      // センチネル
        clearedValues[name] = curVal;   // クリア時の値を記憶
      }
    });
    window.__specValueOverrides = nullOverrides;
    window.__specHLClearedValues = clearedValues;

    document.querySelectorAll('.spechl-dim-badge').forEach(b => b.remove());
    document.querySelectorAll('.spechl-confirmed-row,.spechl-confirmed-value,.spechl-confirmed-cross,.spechl-confirmed-type').forEach(c => {
      c.classList.remove('spechl-confirmed-row','spechl-confirmed-value','spechl-confirmed-cross','spechl-confirmed-type');
    });
    updatePartNumber();
    updateWysRowFilter();
  }

  // ===== Feature5: WYS規格表の行クリック → スペック反映（全パターン対応） =====
  function attachWysRowClick() {
    // 寸法規格テーブル（D列を持つテーブル）を全パターンから探す
    const allTables = new Set();
    document.querySelectorAll('.headerCell, .bodyCell, .coloredCell').forEach(c => {
      const t = c.closest('table'); if(t) allTables.add(t);
    });
    document.querySelectorAll('.m-table').forEach(t => allTables.add(t));
    document.querySelectorAll('[class*="wysiwyg"] table, [class*="common_common"] table').forEach(t => allTables.add(t));

    allTables.forEach(table => {
      // D列を持つ寸法テーブルかチェック（全ヘッダー候補から）
      let hasDCol = false;
      const headerCandidates = new Set();
      table.querySelectorAll('.headerCell, th').forEach(c => headerCandidates.add(c));
      const firstRow = table.querySelector('tr');
      if (firstRow) firstRow.querySelectorAll('td').forEach(c => headerCandidates.add(c));

      headerCandidates.forEach(cell => {
        const texts = extractTexts(cell);
        texts.forEach(t => {
          if (/^D\d*$/.test(t)) hasDCol = true;
        });
      });

      // D公差テーブルもクリッカブルに
      let isDToleranceTable = false;
      headerCandidates.forEach(cell => {
        const txt = extractTexts(cell)[0] || '';
        if (txt === 'D公差') isDToleranceTable = true;
      });

      if (!hasDCol && !isDToleranceTable) return;

      // スペック項目の選択肢を取得（動的判定のため）
      const allSpecs = readAllSpecs();
      const dSpec = allSpecs.find(s => /軸径.*D|^D$|D.*φ/.test(s.name));
      const mSpec = allSpecs.find(s => /めねじ.*\[M\]|めねじ.*M\(/.test(s.name) && !/MD|MSC/.test(s.name));
      const dOptions = dSpec ? dSpec.options : ['6','8','10','12','13','15','16','18','20'];
      const mOptions = mSpec ? mSpec.options : ['3','4','5','6','8','10','12'];

      // データ行にクリックイベントを付与
      table.querySelectorAll('tr').forEach(row => {
        // ヘッダー行はスキップ
        if (row.querySelector('.headerCell')) return;

        // D値を含むセルがあるか
        let dVal = null;
        let lVal = null;
        let mVals = [];

        row.querySelectorAll('td, .bodyCell, .coloredCell').forEach(cell => {
          const ft = cell.querySelector('.fontType');
          const text = ft ? ft.textContent.trim() : cell.textContent.trim();

          // D値: スペック項目「軸径 D」の選択肢と一致する値
          if (!dVal && text && dOptions.includes(text)) {
            dVal = text;
          }
          // L範囲（例: 20〜150、25～150mm など表記ゆれを許容）
          const lmTmp = text.match(/(\d+)\s*[〜～~]\s*(\d+)/);
          if (lmTmp) {
            lVal = `${lmTmp[1]}〜${lmTmp[2]}`;
          }
          // M値: mOptions に含まれる値（D値は除く）
          if (text && mOptions.includes(text) && !dOptions.includes(text) && !mVals.includes(text)) {
            mVals.push(text);
          }
        });

        if (!dVal) return;

        row.classList.add('spechl-clickable-row');
        row.dataset.spechlDval = dVal;

        // WYS制約マップに登録（初回のみ。同一D行が複数ある場合はマージ）
        if (!wysRowByD[dVal]) {
          const lm = lVal ? lVal.match(/(\d+)\s*[〜～~]\s*(\d+)/) : null;
          wysRowByD[dVal] = { lRange: lm ? { min: parseInt(lm[1]), max: parseInt(lm[2]), text: `${lm[1]}〜${lm[2]}` } : null, mVals: [] };
        }
        mVals.forEach(v => { if (!wysRowByD[dVal].mVals.includes(v)) wysRowByD[dVal].mVals.push(v); });

        row.addEventListener('click', (e) => {
          if (isDisabled()) return;
          // クリックされたセルを特定
          const clickedCell = e.target.closest('td');
          const clickedText = clickedCell ? (clickedCell.querySelector('.fontType')?.textContent.trim() || clickedCell.textContent.trim()) : '';

          // L範囲セルをクリックした場合 → L値入力ポップアップ
          const lRangeMatchClick = clickedText.match(/(\d+)\s*[〜～~]\s*(\d+)/);
          if (clickedCell && lRangeMatchClick) {
            const match = lRangeMatchClick;
            {
              e.stopPropagation();
              if (dVal && state.D !== dVal) {
                state.D = dVal;
                showDimBadgesGlobal('D', dVal);
                syncToSpecPanel('D', dVal);
              }
              showLInputPopup(clickedCell, parseInt(match[1]), parseInt(match[2]), dVal);
              return;
            }
          }

          // M値セルをクリックした場合（数値3〜12）
          if (clickedCell && mOptions.includes(clickedText) && clickedText !== dVal) {
            if (dVal && state.D !== dVal) {
              state.D = dVal;
              showDimBadgesGlobal('D', dVal);
              syncToSpecPanel('D', dVal);
            }
            state.M = clickedText;
            showDimBadgesGlobal('M', clickedText);
            syncToSpecPanel('M', clickedText);
            showClickToast(`D = ${dVal}, M = ${clickedText} をセットしました`);
            row.classList.remove('spechl-row-clicked');
            row.offsetHeight;
            row.classList.add('spechl-row-clicked');
            updatePartNumber();
            highlightConfirmed();
            return;
          }

          // それ以外（D値クリック等）→ D値をセット
          row.classList.remove('spechl-row-clicked');
          row.offsetHeight;
          row.classList.add('spechl-row-clicked');

          state.D = dVal;
          showDimBadgesGlobal('D', dVal);
          syncToSpecPanel('D', dVal);
          showClickToast(`D = ${dVal} をセットしました`);

          updatePartNumber();
          highlightConfirmed();

          console.log('[SpecHL] Row clicked: D=' + dVal);
        });
      });

      // Type/材質テーブルの行もクリッカブルに
      if (!hasDCol && !isDToleranceTable) return;
    });

    // Type表（headerCellに「Type」を含むテーブル）
    allTables.forEach(table => {
      let isTypeTable = false;
      table.querySelectorAll('.headerCell').forEach(cell => {
        if (/^Type$/i.test(cell.textContent.trim())) isTypeTable = true;
      });
      if (!isTypeTable) return;

      table.querySelectorAll('tr').forEach(row => {
        if (row.querySelector('.headerCell')) return;
        const fonts = row.querySelectorAll('.fontType');
        if (fonts.length === 0) return;

        // SFAT/SFAW等のType値を探す
        let typeVal = null;
        fonts.forEach(ft => {
          const t = ft.textContent.trim();
          if (/^(S?S?FAT|S?S?FAW|RSFAT|RSFAW)$/.test(t) && !typeVal) typeVal = t;
        });
        if (!typeVal) return;

        row.classList.add('spechl-clickable-row');
        row.addEventListener('click', () => {
          if (isDisabled()) return;
          row.classList.remove('spechl-row-clicked');
          row.offsetHeight;
          row.classList.add('spechl-row-clicked');

          state.type = typeVal;
          syncToSpecPanel('type', typeVal);
          showClickToast(`Type = ${typeVal} をセットしました`);
          updatePartNumber();
          highlightConfirmed();
        });
      });
    });

    console.log('[SpecHL] WYS row click attached');
  }

  // ===== スペックパネルへの値反映（共通関数） =====
  function syncToSpecPanel(dim, value) {
    // マッピングから正確なスペック名を取得（シリーズ依存）→ 完全一致パターン
    const mappedSpecName = (dim !== 'type') ? getSpecNameForDim(dim) : null;
    const fallbackPatterns = {
      D:    /軸径.*D|D.*φ|外径.*D|取付側外径/,
      L:    /長さ.*L|L.*mm/,
      M:    /めねじ.*\[M\]|めねじ.*M/,
      N:    /めねじ.*\[N\]|めねじ.*N/,
      type: /^(タイプ|Type)$/i,
    };
    const pattern = mappedSpecName
      ? new RegExp('^' + mappedSpecName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$')
      : (fallbackPatterns[dim] || null);
    if (!pattern) return;

    document.querySelectorAll('[class*="SpecFrame_frame"]').forEach(frame => {
      const nameEl = frame.querySelector('[class*="SpecFrame_specName"],[class*="SpecFrame_heading"] span,[class*="RohsSpecFrame_specName"]');
      if (!nameEl) return;
      const name = nameEl.textContent.trim();
      if (!pattern.test(name)) return;
      if ((dim === 'M' || dim === 'N') && /MD|ND|MSC|NSC/.test(name)) return;

      window.__specValueOverrides[name] = value;
      window.__specValueOverridesConfirmed[name] = false;

      // NumericSpecField（数値入力型）か checkbox 型かを DOM で判定
      const numInput = frame.querySelector('[class*="NumericSpecField_textField"],[class*="NumericField_textField"]');
      if (numInput) {
        // 数値入力型（L・取付側外径D等）
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(numInput, value);
        numInput.dispatchEvent(new Event('input',  { bubbles: true }));
        numInput.dispatchEvent(new Event('change', { bubbles: true }));
        numInput.dispatchEvent(new Event('blur',   { bubbles: true }));
        frame.style.transition = 'box-shadow 0.3s';
        frame.style.boxShadow = 'inset 0 0 12px rgba(0,200,100,0.4)';
        setTimeout(() => { frame.style.boxShadow = ''; }, 1000);
      } else {
        // チェックボックス型（軸径D・M・N・type）
        window.__specHLSyncing = true;

        const allCbs = frame.querySelectorAll('[role="checkbox"]');
        const otherChecked = [...allCbs].filter(cb =>
          cb.textContent.trim() !== value && cb.getAttribute('aria-checked') === 'true'
        );
        const target = [...allCbs].find(cb => cb.textContent.trim() === value);

        otherChecked.forEach(cb => cb.click());

        if (target) {
          if (target.getAttribute('aria-checked') !== 'true') target.click();
          requestAnimationFrame(() => {
            const t2 = [...frame.querySelectorAll('[role="checkbox"]')]
              .find(cb => cb.textContent.trim() === value);
            if (t2 && t2.getAttribute('aria-checked') !== 'true') t2.click();
          });
        } else {
          const link = [...frame.querySelectorAll('[class*="specValueLink"]')]
            .find(l => l.textContent.trim() === value);
          if (link) link.click();
        }

        frame.style.transition = 'box-shadow 0.3s';
        frame.style.boxShadow = 'inset 0 0 12px rgba(0,200,100,0.4)';
        setTimeout(() => { frame.style.boxShadow = ''; }, 1000);
        setTimeout(() => { window.__specHLSyncing = false; }, 200);
      }
    });
  }

  function showLInputPopup(cell, min, max, dVal) {
    // 既存ポップアップ削除
    document.querySelectorAll('.spechl-dim-popup').forEach(p => p.remove());

    const popup = document.createElement('div');
    popup.className = 'spechl-dim-popup';
    popup.innerHTML = `
      <div class="spechl-dim-popup-header">
        <span>全長 L を入力（D=${dVal}）</span>
        <button class="spechl-dim-popup-close" onclick="this.closest('.spechl-dim-popup').remove()">×</button>
      </div>
      <div class="spechl-dim-popup-body">
        <input type="number" id="spechl-l-input" placeholder="${min}～${max}" min="${min}" max="${max}" style="width:80px;padding:5px 8px;border:1px solid #004098;border-radius:4px;font-size:14px;text-align:center;">
        <span style="font-size:11px;color:#666">mm [${min}-${max}/1mm単位]</span>
      </div>
    `;

    // セルの位置に表示
    const rect = cell.getBoundingClientRect();
    popup.style.position = 'fixed';
    popup.style.left = rect.left + 'px';
    popup.style.top = (rect.bottom + 4) + 'px';
    document.body.appendChild(popup);

    const input = popup.querySelector('#spechl-l-input');
    input.focus();

    const apply = () => {
      const val = input.value.trim();
      if (!val || val < min || val > max) return;
      state.L = val;
      showDimBadgesGlobal('L', val);
      syncToSpecPanel('L', val);
      showClickToast(`D = ${dVal}, L = ${val}mm をセットしました`);
      updatePartNumber();
      highlightConfirmed();
      popup.remove();
    };

    input.addEventListener('blur', () => { setTimeout(() => { if (document.body.contains(popup)) apply(); }, 200); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') apply(); });

    // 外部クリックで閉じる
    setTimeout(() => {
      document.addEventListener('click', function handler(e) {
        if (!popup.contains(e.target) && document.body.contains(popup)) {
          popup.remove();
          document.removeEventListener('click', handler);
        }
      });
    }, 100);
  }

  function showStatusMessage(msg, type = 'info') {
    let el = document.getElementById('spechl-status');
    if (!el) {
      el = document.createElement('div');
      el.id = 'spechl-status';
      document.body.appendChild(el);
    }
    el.className = type;
    el.textContent = '⚠ ' + msg;
  }

  function showClickToast(msg) {
    // 既存トースト削除
    document.querySelectorAll('.spechl-click-toast').forEach(t => t.remove());
    const toast = document.createElement('div');
    toast.className = 'spechl-click-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1200);
  }

  // ===== 初期化 =====
  // ===== 管理者用コマンド（グローバル公開） =====
  window.specHL = {
    // 現在のマッチングキャッシュを表示
    showCache: () => {
      const cache = loadCache();
      console.table(Object.entries(cache).flatMap(([cat, specs]) =>
        Object.entries(specs).flatMap(([sn, headers]) =>
          headers.map(h => ({ category: cat, specName: sn, header: h.header, confidence: h.confidence }))
        )
      ));
      return cache;
    },
    // キャッシュをJSONでエクスポート
    exportCache: () => {
      const json = JSON.stringify(loadCache(), null, 2);
      console.log('=== MAPPING CACHE EXPORT ===');
      console.log(json);
      // クリップボードに自動コピー
      try {
        navigator.clipboard.writeText(json);
        console.log('✓ クリップボードにコピーされました');
      } catch(e) {}
      return json;
    },
    // JSONからインポート
    importCache: (json) => {
      try {
        const data = typeof json === 'string' ? JSON.parse(json) : json;
        saveCache(data);
        console.log('✓ インポート完了。ページをリロードして反映してください');
      } catch(e) { console.error('インポート失敗:', e); }
    },
    // 手動でマッピング追加
    addMapping: (specName, headerText, confidence = 100) => {
      cacheMapping(specName, headerText, confidence);
      console.log(`✓ 追加: "${specName}" → "${headerText}" (${confidence}%)`);
    },
    // キャッシュクリア
    clearCache: () => {
      localStorage.removeItem(CACHE_KEY);
      console.log('✓ キャッシュをクリアしました');
    },
    // マッチ失敗したspecNameを一覧化
    showUnmatched: () => {
      const unmatched = [];
      document.querySelectorAll('[class*="SpecFrame_frame"]').forEach(frame => {
        const nameEl = frame.querySelector('[class*="SpecFrame_specName"],[class*="SpecFrame_heading"] span');
        if (!nameEl) return;
        const sn = nameEl.textContent.trim();
        if (!frame.classList.contains('spechl-matched')) {
          unmatched.push(sn);
        }
      });
      console.table(unmatched);
      return unmatched;
    },
  };

  function init() {
    const iv = setInterval(() => {
      // パターンA/B/C全てを検知
      const tables = document.querySelectorAll('.headerCell, .m-table, [class*="wysiwyg"] table, [class*="common_common"] table');
      const specs = document.querySelectorAll('[class*="SpecFrame_frame"]');
      if (tables.length > 0 && specs.length > 0) {
        clearInterval(iv);
        console.log('[SpecHL] Content loaded. Initializing all features...');
        const cache = scanWys();
        attachHoverHL(cache);
        attachSvgOverlay();
        attachWysRowClick();
        createPartNumberFloat();
        updatePartNumber();
        watchSpecChanges();
        updateWysRowFilter(); // 初期ロード時点の選択状態を反映
        console.log('[SpecHL] All features ready!');
      }
    }, 1000);
    setTimeout(() => clearInterval(iv), 30000);
  }

  // admin-ui.js から呼び出すためのAPI公開
  window.__specHLReadAll = readAllSpecs;
  window.__specHLGetCached = getCachedMappings;

  // 手動マッピング変更時の再適用（ハイライトをリセットして再構築）
  window.__specHLReapplyHover = function() {
    // 既存のイベントリスナーをクリアするのは難しいので、
    // ページ再読み込み推奨だが、シンプルな対応として:
    // mouseenter/leaveは次回のホバーから新マッピングが読まれる
  };
  window.__specHLSetManualMapping = function(specName, headers) {
    // localStorage側の変更はadmin-ui.jsが既に実施済み
    // content.js側のホバー処理はloadManual()経由で毎回localStorageを読むので即反映される
  };

  init();
})();
