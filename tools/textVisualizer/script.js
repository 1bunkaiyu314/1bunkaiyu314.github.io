// ── デモJSON ────────────────────────────────────────────────
async function loadData(file) {
  return await fetch(file).then(res => res.json());
}

// ── テーマ切替 ──────────────────────────────────────────────
const html = document.documentElement;
const themeBtn   = document.getElementById("themeBtn");
const themeLabel = document.getElementById("themeLabel");
const themeIcon  = themeBtn.querySelector(".theme-icon");

themeBtn.addEventListener("click", () => {
  const isDark = html.getAttribute("data-theme") === "dark";
  html.setAttribute("data-theme", isDark ? "light" : "dark");
  themeLabel.textContent = isDark ? "ダークモード" : "ライトモード";
  themeIcon.textContent  = isDark ? "🌙" : "☀️";
  // 開いている矢印を再描画
  document.querySelectorAll(".sentence-card").forEach(card => {
    const sel = card.querySelector(".token-wrap.selected");
    //if (sel) redrawArrow(card);
  });
});

// ── render ──────────────────────────────────────────────────
const coloredPos = (key) => {
  const map = {
    "名詞": "#e0e07e",
    "代名詞": "#e0e07e",

    "動詞": "#e07e7e",
    "助動詞": "#e07e7e",

    "形容詞": "#7ee0bc",

    "副詞": "#867ee0",

  };

  return `style="color:` + map[key] + `"` || None;
};

function render(data) {
  const main = document.getElementById("main");
  main.innerHTML = "";
  data.sentences.forEach((sent, si) => {
    main.appendChild(buildCard(sent, si));
  });
}

async function loadFileList() {
  return await fetch("files.json").then(res => res.json());
}

async function buildFileOptions() {
  const data = await loadFileList();
  const select = document.getElementById("jsonSelect");

  select.innerHTML = data.files
    .map((file, i) => `
      <option value="assets/${file}" ${i === 0 ? "selected" : ""}>
        ${file}
      </option>
    `)
    .join("");

  return data.files;
}

function buildCard(sent, si) {
  const card = document.createElement("div");
  card.className = "sentence-card";
  card._sent = sent; // データ参照

  // ── 番号バー
  const bar = document.createElement("div");
  bar.className = "card-index-bar";
  bar.innerHTML = `<span class="card-num">SENTENCE ${si + 1}</span>`
                + `<span class="card-hint">単語をクリック → headへの矢印と詳細を表示</span>`;
  card.appendChild(bar);

  // ── token-area（tokenRow + SVGオーバーレイのコンテナ）
  const tokenArea = document.createElement("div");
  tokenArea.className = "token-area";

  // ── トークン行
  const tokenRow = document.createElement("div");
  tokenRow.className = "token-row";
  const tokenEls = {};

  sent.tokens.forEach((tok, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "token-wrap";
    wrap.dataset.id = tok.id;

    const noPre = new Set([".", ",", "!", "?", ";", ":", ")", "]", "'s", "n't"]);
    const space = idx > 0 && !noPre.has(tok.text) ? " " : "";

    wrap.innerHTML = `
      <span class="token-word">${tok.text}</span>
      <span class="token-deprel" ${coloredPos(tok.upos)}>${tok.upos}</span>
    `

    wrap.addEventListener("click", () => handleTokenClick(card, tok, wrap, si));
    tokenRow.appendChild(wrap);
    tokenEls[tok.id] = wrap;
  });

  tokenArea.appendChild(tokenRow);
  wrapTokensIntoLines(tokenRow, card);

  // ── SVGオーバーレイ（tokenAreaに絶対配置で重ねる）
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("arc-svg");

  const defs = document.createElementNS("http://www.w3.org/2000/svg","defs");
  const marker = document.createElementNS("http://www.w3.org/2000/svg","marker");
  marker.setAttribute("id", `arrow-${si}`);
  marker.setAttribute("markerWidth","8");
  marker.setAttribute("markerHeight","6");
  marker.setAttribute("refX","7");
  marker.setAttribute("refY","3");
  marker.setAttribute("orient","auto");
  const poly = document.createElementNS("http://www.w3.org/2000/svg","polygon");
  poly.setAttribute("points","0 0, 8 3, 0 6");
  marker.appendChild(poly);
  defs.appendChild(marker);
  svg.appendChild(defs);
  tokenArea.appendChild(svg);

  const syntaxContainer = document.createElement("div");
  syntaxContainer.className = "syntax-container";
  syntaxContainer.id = `syntax-sent-${si}`; // 任意の id
  card._syntaxContainer = syntaxContainer;
  card.appendChild(syntaxContainer);

  card._tokenEls  = tokenEls;
  card._svg       = svg;
  card._tokenArea = tokenArea;
  card._markerId  = `arrow-${si}`;
  card.appendChild(tokenArea);

  // ── 日本語訳
  if (sent.ja_text) {
    const trans = document.createElement("div");
    trans.className = "translation-row";
    trans.innerHTML = `<span class="trans-label">JA</span>${sent.ja_text}`;
    card.appendChild(trans);
  }

  renderSyntaxForCard(card);
  
  // ── 詳細パネル
  const detail = document.createElement("div");
  detail.className = "detail-panel";
  card._detail = detail;
  card.appendChild(detail);

  return card;
}

// ── 行分割して flex 行を作るユーティリティ ─────────────────
function createLineElement() {
  const line = document.createElement("div");
  line.className = "line";
  return line;
}

/**
 * tokenRow: 元の .token-row 要素（中に .token-wrap 要素が並んでいる想定）
 * card: その文のカード要素（redrawArrow 用に渡す）
 *
 * この関数は token-wrap 要素を取り出して行ごとに再配置する。
 */
// ヘルパ: 要素の左右マージンを取得して合計幅に加える
function getHorizontalMargin(el) {
  const s = getComputedStyle(el);
  return parseFloat(s.marginLeft || 0) + parseFloat(s.marginRight || 0);
}

// ヘルパ: 要素の総幅（幅 + margin）
function getOuterWidth(el) {
  const rect = el.getBoundingClientRect();
  return rect.width + getHorizontalMargin(el);
}

// 行分割の堅牢版
function wrapTokensIntoLines(tokenRow, card) {
  const tokens = Array.from(tokenRow.querySelectorAll(".token-wrap"));
  if (!tokens.length) return;

  // 一旦 tokenRow をクリアして行を作る準備
  tokenRow.innerHTML = "";

  // コンテナ幅（余裕を少し残す）
  const containerWidth = Math.max(0, tokenRow.clientWidth - 2); // tolerance 2px

  // 新しい行を作る関数
  function newLine() {
    const line = document.createElement("div");
    line.className = "line";
    tokenRow.appendChild(line);
    return line;
  }

  let line = newLine();

  // 重要: DOM に一度追加してから幅を測る必要があるため、
  // 各トークンを仮追加して計測する手順を踏む
  tokens.forEach(tok => {
    // もしトークンがまだ DOM に入っていなければ一時追加して計測
    line.appendChild(tok);

    // 強制的に nowrap を維持して幅を測る
    tok.style.whiteSpace = "nowrap";

    // 実際の幅を取得（幅 + margin）
    const tokWidth = getOuterWidth(tok);

    // 現在の行の合計幅を計算
    let total = 0;
    for (let i = 0; i < line.children.length; i++) {
      total += getOuterWidth(line.children[i]);
    }

    // はみ出す場合の処理
    if (total > containerWidth && line.children.length > 1) {
      // 今追加したトークンを取り除き、新しい行へ
      line.removeChild(tok);
      line = newLine();

      // もし単語自体がコンテナ幅を超える場合は折返し許可を与える
      // （長いURLや数字などの対策）
      if (tokWidth > containerWidth) {
        tok.style.whiteSpace = "normal";
        tok.style.maxWidth = (containerWidth - 8) + "px"; // 少し余裕
        tok.style.wordBreak = "break-word";
      } else {
        tok.style.whiteSpace = "nowrap";
      }

      line.appendChild(tok);
    }
  });

  // 最終行を左揃えにする
  const lines = Array.from(tokenRow.querySelectorAll(".line"));
  lines.forEach(l => l.classList.remove("last"));
  if (lines.length) lines[lines.length - 1].classList.add("last");

  // 各行の子要素に flex 固定を入れておく（描画安定化）
  lines.forEach(l => {
    Array.from(l.children).forEach(child => {
      child.style.flex = "0 0 auto";
    });
  });

  // 非同期で矢印を再描画（レイアウト安定後）
  requestAnimationFrame(() => {
    if (card) redrawArrow(card);
  });
}

// ウィンドウリサイズ時に再レイアウトするヘルパー
let _reflowTimer = null;
function reflowAllLines() {
  clearTimeout(_reflowTimer);
  _reflowTimer = setTimeout(() => {
    document.querySelectorAll(".sentence-card").forEach(card => {
      const tokenRow = card.querySelector(".token-row");
      if (tokenRow) wrapTokensIntoLines(tokenRow, card);
      // 矢印も再描画
      redrawArrow(card);
    });
  }, 120);
}
window.addEventListener("resize", reflowAllLines);


// ── クリック処理 ────────────────────────────────────────────
function handleTokenClick(card, tok, wrap, si) {
  const sent     = card._sent;
  const tokenEls = card._tokenEls;
  const detail   = card._detail;
  const alreadySel = wrap.classList.contains("selected");

  // 全選択解除
  Object.values(tokenEls).forEach(el => el.classList.remove("selected","is-head"));
  clearArrow(card);
  detail.classList.remove("open");
  detail.innerHTML = "";

  if (alreadySel) return; // トグル

  // 選択状態セット
  wrap.classList.add("selected");

  // headトークンをハイライト（head=0はroot、矢印なし）
  if (tok.head > 0 && tokenEls[tok.head]) {
    tokenEls[tok.head].classList.add("is-head");
  }

  // 矢印描画
  //drawArrow(card, tok, wrap, si);

  // 詳細パネル
  openDetail(detail, tok, sent);
}

// ── 矢印描画 ─────────────────────────────────────────────────
function drawArrow(card, tok, selectedEl, si) {
  if (tok.head === 0) return;
  const headEl = card._tokenEls[tok.head];
  if (!headEl) return;

  const svg       = card._svg;
  const tokenArea = card._tokenArea;
  const areaRect  = tokenArea.getBoundingClientRect();
  const selRect   = selectedEl.getBoundingClientRect();
  const headRect  = headEl.getBoundingClientRect();

  // tokenArea基準の座標（各トークンの上辺中央を起点に）
  const x1 = selRect.left  - areaRect.left + selRect.width  / 2;
  const y1 = selRect.top   - areaRect.top  + selRect.height / 2;
  const x2 = headRect.left - areaRect.left + headRect.width / 2;
  const y2 = headRect.top  - areaRect.top  + headRect.height / 2;

  // SVGはtokenArea全体を覆う（CSSで100%×100%、overflow:visible）
  // viewBoxはtokenAreaの実サイズに合わせる
  const W = areaRect.width;
  const H = areaRect.height;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

  const accentColor = getComputedStyle(document.documentElement)
                        .getPropertyValue("--arrow-clr").trim();
  svg.querySelector("polygon").setAttribute("fill", accentColor);

  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  
  // 同じ行かどうか
  const sameRow = Math.abs(selRect.top - headRect.top) < selRect.height * 0.6;

  // どちら側に膨らませるか（上 or 下）
  const bendUp = y1 > y2;   // 子が下にある → 上へ膨らませる
  const sign = bendUp ? -1 : 1;

  // offset の大きさ
  const offset = sameRow ? 40 * sign : 0;

  // 必ず4点折れ線
  const pathData = `
    M ${x1} ${y1}
    L ${midX} ${y1 + offset}
    L ${midX} ${y2 + offset}
    L ${x2} ${y2}
  `;



  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", pathData);
  path.setAttribute("stroke", accentColor);
  path.setAttribute("stroke-width", "1.8");
  path.setAttribute("fill", "none");
  path.setAttribute("marker-end", `url(#${card._markerId})`);
  path.setAttribute("opacity", "0.85");
  path.classList.add("dep-arrow");

  // deprelラベル（弧の中間付近）
  const label = document.createElementNS("http://www.w3.org/2000/svg","text");
  label.setAttribute("x", midX);
  label.setAttribute("y", (y1 + y2) / 2 - offset + 4);
  label.setAttribute("text-anchor","middle");
  label.setAttribute("fill", accentColor);
  label.setAttribute("font-size","10");
  label.setAttribute("font-family","IBM Plex Mono, monospace");
  label.setAttribute("opacity","0.95");
  label.textContent = tok.deprel;
  label.classList.add("dep-arrow");

  svg.appendChild(path);
  svg.appendChild(label);
}

function clearArrow(card) {
  card._svg.querySelectorAll(".dep-arrow").forEach(el => el.remove());
}

function redrawArrow(card) {
  const sel = card.querySelector(".token-wrap.selected");
  if (!sel) return;
  const tok = card._sent.tokens.find(t => t.id === parseInt(sel.dataset.id));
  if (!tok) return;
  clearArrow(card);
  drawArrow(card, tok, sel, 0);
}

// ── 詳細パネル内容構築 ───────────────────────────────────────
function openDetail(detail, tok, sent) {
  const headTok = tok.head > 0
    ? sent.tokens.find(t => t.id === tok.head)
    : null;

  detail.innerHTML = `
    <div class="detail-inner">
      <div class="detail-word-heading">
        ${tok.text}
        <span class="detail-id"># ${tok.id}</span>
      </div>
      <div class="detail-row">
        <span class="detail-key">原形</span>
        <span class="detail-val">${tok.lemma}</span>
      </div>
      <div class="detail-row">
        <span class="detail-key">汎用品詞</span>
        <span class="detail-val" ${coloredPos(tok.upos)}>${tok.upos}</span>
      </div>
      <div class="detail-row">
        <span class="detail-key">言語固有品詞</span>
        <span class="detail-val">${tok.xpos || "—"}</span>
      </div>
      <div class="detail-row">
        <span class="detail-key">依存関係</span>
        <span class="detail-val">${tok.deprel}</span>
      </div>
      <div class="detail-row">
        <span class="detail-key">文法的特徴</span>
        <span class="detail-val">${tok.ufeats}</span>
      </div>
      <div class="detail-row">
        <span class="detail-key">親</span>
        <span class="detail-val accent">${headTok ? `${headTok.text} (# ${headTok.id})` : "— (root)"}</span>
      </div>
    </div>
  `;
  detail.classList.add("open");
}

/* ---------- JSON -> 括弧可視化を1カード分レンダリングする ---------- */
function mapTypeToClass(type) {
  const t = String(type || "").toLowerCase();
  if (t.includes("名詞") || t.includes("np")) return "np";
  if (t.includes("前置詞") || t.includes("pp")) return "pp";
  if (t.includes("形容詞") || t.includes("adj")) return "adjp";
  if (t.includes("副詞") || t.includes("adv")) return "advp";
  if (t.includes("節") || t.includes("clause") || t.includes("ccomp") || t.includes("root")) return "clause";
  return "phrase";
}

function renderSyntaxForCard(card) {
  // card._sent は buildCard でセット済み
  const sent = card._sent;
  const container = card._syntaxContainer;
  if (!sent || !container) return;
  container.innerHTML = ""; // クリア

  // build token elements
  const tokens = sent.tokens || [];
  const n = tokens.length;
  const tokenEls = new Array(n + 1);
  tokens.forEach(tok => {
    const span = document.createElement("span");
    span.className = "token";
    span.dataset.tid = tok.id;
    span.textContent = tok.text;
    tokenEls[tok.id] = span;
  });

  // collect spans from head_span
// ===== 重複除去して spans を作る（必ずこれに置換） =====
  const spanMap = new Map(); // key -> span obj

  tokens.forEach(tok => {
    const hs = tok.head_span;
    if (!hs || !Array.isArray(hs.token_ids) || hs.token_ids.length === 0) return;
    const start = hs.token_ids[0];
    const end = hs.token_ids[hs.token_ids.length - 1];
    // 一意キー: head_id|start|end
    const key = `${hs.head_id}|${start}|${end}`;
    if (!spanMap.has(key)) {
      spanMap.set(key, {
        head_id: hs.head_id,
        type: hs.type || "phrase",
        label: hs.label || "",
        start,
        end,
        token_ids: hs.token_ids.slice()
      });
    }
  });

  // spans 配列を作る（外側→内側の順で安定）
  const spans = Array.from(spanMap.values());
  spans.sort((a,b) => (b.end - b.start) - (a.end - a.start));


  // opens/closes maps
  const opens = {}, closes = {};
  spans.forEach(s => { (opens[s.start] = opens[s.start] || []).push(s); (closes[s.end] = closes[s.end] || []).push(s); });
  Object.keys(opens).forEach(k => opens[k].sort((a,b) => (b.end - b.start) - (a.end - a.start)));

  // build nested DOM
  const rootInline = document.createElement("span");
  const stack = [rootInline];
  for (let i = 1; i <= n; i++) {
    (opens[i] || []).forEach(s => {
      const el = document.createElement("span");
      el.className = "span-unit " + mapTypeToClass(s.type);
      el.dataset.id = s.head_id;
      el.dataset.type = s.type;
      el.dataset.label = s.label;
      stack[stack.length - 1].appendChild(el);
      stack.push(el);
    });

    const tokenEl = tokenEls[i];
    if (tokenEl) {
      const parent = stack[stack.length - 1];
      if (parent.childNodes.length > 0) parent.appendChild(document.createTextNode(" "));
      parent.appendChild(tokenEl.cloneNode(true));
    }

    (closes[i] || []).forEach(s => {
      while (stack.length > 1) {
        const top = stack.pop();
        if (String(top.dataset.id) === String(s.head_id)) break;
      }
    });
  }
  while (stack.length > 1) stack.pop();

  container.appendChild(rootInline);

  // interactions
  setupSyntaxInteractions(container);
}

/* ---------- ハイライトのイベント処理（カード単位で使える） ---------- */
function setupSyntaxInteractions(root) {
  let lockedId = null;
  root.addEventListener("mouseover", e => {
    const el = e.target.closest(".span-unit");
    if (!el) return;
    const id = el.dataset.id;
    if (!id) return;
    root.querySelectorAll(`.span-unit[data-id="${id}"]`).forEach(x => x.classList.add("highlight"));
  });
  root.addEventListener("mouseout", e => {
    const el = e.target.closest(".span-unit");
    if (!el) return;
    const id = el.dataset.id;
    if (!id) return;
    root.querySelectorAll(`.span-unit[data-id="${id}"]`).forEach(x => {
      if (!lockedId || String(lockedId) !== String(id)) x.classList.remove("highlight");
    });
  });
  root.addEventListener("click", e => {
    const el = e.target.closest(".span-unit");
    if (!el) return;
    const id = el.dataset.id;
    if (!id) return;
    if (lockedId && String(lockedId) === String(id)) {
      lockedId = null;
      root.querySelectorAll(".span-unit.highlight").forEach(x => x.classList.remove("highlight"));
    } else {
      root.querySelectorAll(".span-unit.highlight").forEach(x => x.classList.remove("highlight"));
      lockedId = id;
      root.querySelectorAll(`.span-unit[data-id="${id}"]`).forEach(x => x.classList.add("highlight"));
    }
  });
}

// ── ファイル読み込み ────────────────────────────────────────
document.getElementById("jsonFile").addEventListener("change", function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try { render(JSON.parse(ev.target.result)); }
    catch(err) { alert("JSON解析エラー: " + err.message); }
  };
  reader.readAsText(file);
});

document.getElementById("jsonSelect").addEventListener("change", async e => {
  const file = e.target.value;

  const data = await fetch(file).then(res => res.json());

  render(data);
});

// ── 起動 ───────────────────────────────────────────────────
(async () => {
  const files = await buildFileOptions();

  const select = document.getElementById("jsonSelect");

  const file = select.value || files?.[0];

  if (file) {
    const data = await loadData(file);
    render(data);
  }
})();