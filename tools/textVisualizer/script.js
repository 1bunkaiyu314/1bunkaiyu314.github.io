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
      <span class="token-word">${space}${tok.text}</span>
      <span class="token-deprel" ${coloredPos(tok.upos)}>${tok.upos}</span>
    `;

    wrap.addEventListener("click", () => handleTokenClick(card, tok, wrap, si));
    tokenRow.appendChild(wrap);
    tokenEls[tok.id] = wrap;
  });

  tokenArea.appendChild(tokenRow);

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

  // ── 詳細パネル
  const detail = document.createElement("div");
  detail.className = "detail-panel";
  card._detail = detail;
  card.appendChild(detail);

  return card;
}

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