/* ===================== STATE ===================== */
//アプリ全体の状態を管理
let state = {
  tabs: [{ id: uid(), name: 'Home', cols: 6, rows: 4 }],
  activeTab: null,
  bookmarks: {},   // tabId -> [{id, url, name, favicon, col, row}]
  cols: 6,
  rows: 4,
  bgImage: null,
  bgOverlay: 0.3,
  textColor: 'white',
  bgPosition: '50% 50%',
  bgGradient: null,
  headerColor: 'white',
  settingsOn: false,
};
//ドラッグ中のカード情報
let dragSrc = null; // {tabId, bm}

//選択可能なグラデーションの定義リスト
const GRADIENTS = [
  { id: 'slate', label: 'Slate', value: 'linear-gradient(0deg, #989898 0%, #596164)' },
  { id: 'dusk', label: 'Dusk', value: 'linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)' },
  { id: 'sunset', label: 'Sunset', value: 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)' },
  { id: 'ocean', label: 'Ocean', value: 'linear-gradient(135deg, #fffeff 0%, #d7fffe 100%)' },
  { id: 'forest', label: 'Forest', value: 'linear-gradient(0deg, #fa709a 0%, #fee140 100%)' },
  { id: 'night', label: 'Night', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { id: 'peach', label: 'Peach', value: 'linear-gradient(135deg, #f78ca0 0%, #fe9a8b 100%)' },
  { id: 'aurora', label: 'Aurora', value: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)' },
  { id: 'phoenix', label: 'Phoenix', value: 'linear-gradient(135deg, #f83600 0%, #f9d423 100%)' },
  { id: 'jpblush', label: 'Jpblush', value: 'linear-gradient(135deg, #ddd6f3 0%, #faaca8 100%)' },
];

function uid() { return Math.random().toString(36).slice(2, 10); }

/* ===================== PERSIST ===================== */
// stateをlocalStorageに保存する（bmImageは容量対策で別キーで管理）
function save() {
  try {
    const { bgImage, ...rest } = state;
    localStorage.setItem('bm_state', JSON.stringify(rest));
  } catch (e) {
    toast('⚠ データの保存に失敗しました（容量不足）');
  }
  // bgImageはbg-uploadハンドラ側で直接管理するためここでは同期のみ
  if (!state.bgImage) localStorage.removeItem('bm_bg');
}

// localStorageからstateを復元する，保存データがない場合は初期状態を維持
function load() {
  try {
    const s = localStorage.getItem('bm_state');
    if (s) state = JSON.parse(s);
    state.bgImage = localStorage.getItem('bm_bg') || null;
    if (!state.tabs || !state.tabs.length) state.tabs = [{ id: uid(), name: 'Home' }];
    if (!state.bookmarks) state.bookmarks = {};
    // 初回起動時のみHomeタブの(0,0)にチュートリアルを追加
    const homeTab = state.tabs[0];
    const alreadySet = (state.bookmarks[homeTab.id] || []).some(b => b.col === 0 && b.row === 0);
    if (!alreadySet) {
      if (!state.bookmarks[homeTab.id]) state.bookmarks[homeTab.id] = [];
      state.bookmarks[homeTab.id].unshift({
        id: uid(),
        url: 'https://lacy-planet-416.notion.site/TeaTab-372afcd7e73d80f48837c05429da4caf',
        name: 'チュートリアル',
        favicon: '',
        col: 0,
        row: 0,
      });
    }
    if (!state.activeTab || !state.tabs.find(t => t.id === state.activeTab))
      state.activeTab = state.tabs[0].id;
  } catch (e) { }
}

/* ===================== TOAST ===================== */
let toastTimer = null; // トースト非表示タイマーのID
//画面下部にトースト通知を2.2秒表示する
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/* ===================== FAVICON ===================== */
//URLからGoogle Favicon APIのURLを生成，URLが無効な場合はnullを返す
function getFaviconUrl(url) {
  try {
    const u = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`;
  } catch { return null; }
}

/* ===================== RENDER ===================== */
//アプリ全体を再描画する（各render関数をまとめて呼び出す）
function render() {
  renderBg();
  renderTabs();
  renderGrid();
  renderSettings();
  renderSwatches();
  applyTextColor();
  applyHeaderColor();
  document.body.classList.toggle('settings-on', state.settingsOn);
}

//state.textColorをCSSに反映し，設定パネルの選択ボタンをハイライト
function applyTextColor() {
  const isBlack = state.textColor === 'black';
  document.documentElement.style.setProperty('--label-color',
    isBlack ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.92)');

  document.getElementById('text-white-btn').style.background =
    !isBlack ? 'rgba(255,255,255,0.3)' : '';
  document.getElementById('text-black-btn').style.background =
    isBlack ? 'rgba(255,255,255,0.3)' : '';
}

//state.headerColorをCSSにクラスに反映し，設定パネルの選択ボタンをハイライト
function applyHeaderColor() {
  const isBlack = state.headerColor === 'black';
  const headerRight = document.getElementById('header-right');
  headerRight.classList.toggle('header-dark', isBlack);
  document.body.classList.toggle('header-dark', isBlack);

  document.getElementById('header-white-btn').style.background =
    !isBlack ? 'rgba(255,255,255,0.3)' : '';
  document.getElementById('header-black-btn').style.background =
    isBlack ? 'rgba(255,255,255,0.3)' : '';
}

//背景レイヤーを現在の状態に合わせて更新
//背景画像　> グラデーション > なし　の優先順位で表示
function renderBg() {
  const el = document.getElementById('bg-layer');
  const overlay = state.bgOverlay ?? 0.3;
  document.documentElement.style.setProperty('--bg-overlay', overlay);
  document.getElementById('bg-overlay').value = overlay;
  if (state.bgImage) {
    //背景画像がある場合：画像を表示し，位置調整UIを表示，グラデーションUIを非表示
    const pos = state.bgPosition || '50% 50%';
    el.style.background = `url(${state.bgImage}) ${pos}/cover no-repeat`;
    document.getElementById('bg-position-row').style.display = 'flex';
    document.getElementById('gradient-swatches').style.display = 'none';
    document.querySelector('.settings-section-label').style.display = 'none';
    const [x, y] = pos.split(' ');
    document.getElementById('bg-pos-x').value = parseInt(x);
    document.getElementById('bg-pos-y').value = parseInt(y);
  } else if (state.bgGradient) {
    //グラデーションが選択されている場合：グラデーションを適用し位置調整UIを非表示
    const g = GRADIENTS.find(x => x.id === state.bgGradient);
    if (g) el.style.background = g.value;
    document.getElementById('bg-position-row').style.display = 'none';
  } else {
    //何もない場合：背景をクリアしグラデーション選択UIを表示
    el.style.background = '';
    document.getElementById('bg-position-row').style.display = 'none';
    document.getElementById('gradient-swatches').style.display = 'flex';
    document.querySelector('.settings-section-label').style.display = 'block';
  }
}

//タブ一覧をDOMに描画する．タブのクリック・リネーム・削除・ドラッグ並び替えを設定
function renderTabs() {
  const cont = document.getElementById('tabs-container');
  cont.innerHTML = '';
  state.tabs.forEach(tab => {
    const btn = document.createElement('button');
    btn.className = 'tab-btn' + (tab.id === state.activeTab ? ' active' : '');
    btn.dataset.id = tab.id;

    //タブ名入力欄：設定モード時のみ編集可
    const nameInput = document.createElement('input');
    nameInput.className = 'tab-name-input';
    nameInput.value = tab.name;
    nameInput.readOnly = !state.settingsOn;
    nameInput.classList.toggle('editable', state.settingsOn);
    nameInput.addEventListener('change', () => {
      tab.name = nameInput.value || 'Tab';
      save(); renderTabs();
    });
    nameInput.addEventListener('click', e => { if (state.settingsOn) e.stopPropagation(); });
    nameInput.addEventListener('dragstart', e => e.stopPropagation());

    //タブ削除ボタン：最後の一つは削除不可
    const delBtn = document.createElement('button');
    delBtn.className = 'tab-del';
    delBtn.textContent = '✕';
    delBtn.title = 'タブ削除';
    delBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (state.tabs.length === 1) { toast('最後のタブは削除できません'); return; }
      openConfirm(
        `「${tab.name}」を削除します。\nこのタブのブックマークもすべて失われます。`,
        () => {
          state.tabs = state.tabs.filter(t => t.id !== tab.id);
          delete state.bookmarks[tab.id];
          if (state.activeTab === tab.id) state.activeTab = state.tabs[0].id;
          save(); render();
        }
      );
    });

    btn.appendChild(nameInput);
    btn.appendChild(delBtn);

    let dragOverTimer = null;

    //カードドラッグ中にタブホバーでタブ切り替え（700msホバーで切り替え）
    btn.addEventListener('dragenter', () => {
      if (!dragSrc) return;
      if (tab.id === state.activeTab) return;
      dragOverTimer = setTimeout(() => {
        state.activeTab = tab.id;
        const newIdx = state.tabs.findIndex(t => t.id === state.activeTab);
        const track = document.getElementById('grid-track');
        track.style.transform = `translateX(-${newIdx * 100}%)`;
        save();
        renderTabs();
        renderGrid();
        renderSettings();
      }, 700); // 700ms ホバーでタブ切り替え
    });

    btn.addEventListener('dragleave', () => {
      clearTimeout(dragOverTimer);
    });
    
    btn.addEventListener('drop', () => {
      clearTimeout(dragOverTimer);
    });
    
    btn.addEventListener('click', () => {
      state.activeTab = tab.id;
      save(); renderTabs(); renderGrid(); renderSettings();
    });

    btn.draggable = true;

    //タブ自体のドラッグ開始：tab-draggingクラスを付与
    btn.addEventListener('dragstart', e => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('tabId', tab.id);
      setTimeout(() => btn.classList.add('tab-dragging'), 0);
    });

    //タブドラッグ終了：挿入インジケーターをすべてリセット
    btn.addEventListener('dragend', () => {
      btn.classList.remove('tab-dragging');
      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('tab-insert-before');
      });
    });

    //タブドラッグ中：マウス位置に応じて挿入位置インジケーターを表示
    btn.addEventListener('dragover', e => {
      e.preventDefault();
      const srcId = e.dataTransfer.getData('tabId');
      if (srcId === tab.id) return;

      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('tab-insert-before', 'tab-insert-after');
      });

      const rect = btn.getBoundingClientRect();
      const mid = rect.left + rect.width / 2;
      if (e.clientX < mid) {
        btn.classList.add('tab-insert-before');
      } else {
        btn.classList.add('tab-insert-after');
      }
    });

    btn.addEventListener('dragleave', () => {
      btn.classList.remove('tab-insert-before', 'tab-insert-after');
    });

    //タブドロップ：ドロップ位置に応じてタブ順を並び替え
    btn.addEventListener('drop', e => {
      e.preventDefault();
      btn.classList.remove('tab-insert-before', 'tab-insert-after');
      const srcId = e.dataTransfer.getData('tabId');
      if (!srcId || srcId === tab.id) return;

      const srcIdx = state.tabs.findIndex(t => t.id === srcId);
      const dstIdx = state.tabs.findIndex(t => t.id === tab.id);

      const rect = btn.getBoundingClientRect();
      const mid = rect.left + rect.width / 2;
      const insertAfter = e.clientX >= mid;

      // srcを一旦取り出す
      const [moved] = state.tabs.splice(srcIdx, 1);

      // 取り出し後のdstIdxを再計算
      const newDstIdx = state.tabs.findIndex(t => t.id === tab.id);
      const insertIdx = insertAfter ? newDstIdx + 1 : newDstIdx;
      state.tabs.splice(insertIdx, 0, moved);

      save(); renderTabs();
    });

    cont.appendChild(btn);

  });
}

//設定パネルの列数・行数の入力欄をアクティブタブの値で更新
function renderSettings() {
  const tab = state.tabs.find(t => t.id === state.activeTab);
  document.getElementById('s-cols').value = tab.cols;
  document.getElementById('s-rows').value = tab.rows;
}

//グラデーション選択スウォッチを描画する．選択中のものにはactiveクラスを付与
function renderSwatches() {
  const container = document.getElementById('gradient-swatches');
  container.innerHTML = '';
  GRADIENTS.forEach(g => {
    const sw = document.createElement('button');
    sw.className = 'grad-swatch' + (state.bgGradient === g.id ? ' active' : '');
    sw.title = g.label;
    sw.style.background = g.value;
    sw.addEventListener('click', () => {
      if (state.bgGradient === g.id) {
        state.bgGradient = null;
      } else {
        state.bgGradient = g.id;
        state.bgImage = null;
        localStorage.removeItem('bm_bg');
        document.getElementById('bg-upload').value = '';
      }
      save();
      renderBg();
      renderSwatches();
    });
    container.appendChild(sw);
  });
}

//全タブのグリッドページをgrid-trackに描画
function renderGrid() {
  const track = document.getElementById('grid-track');
  track.innerHTML = '';

  state.tabs.forEach(tab => {
    //グリッドにgrid-pageを生成
    const page = document.createElement('div');
    page.className = 'grid-page';
    page.dataset.tabId = tab.id;

    //グリッドのスタイルをタブの列数・行数に合わせて設定
    const grid = document.createElement('div');
    grid.id = tab.id === state.activeTab ? 'bookmark-grid' : `grid-${tab.id}`;
    grid.style.display = 'grid';
    grid.style.height = '100%';
    const cols = tab.cols || state.cols;
    const rows = tab.rows || state.rows;
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    grid.style.gap = 'var(--gap)';

    const bms = state.bookmarks[tab.id] || [];
    const occupied = {};
    bms.forEach(bm => { occupied[`${bm.col},${bm.row}`] = bm; });

    //全セルをループし，ぶくまーくがあればカード，なければ空セルを配置
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const bm = occupied[`${c},${r}`];
        if (bm) {
          const card = makeCard(bm, tab.id);
          card.style.gridColumn = c + 1;
          card.style.gridRow = r + 1;
          grid.appendChild(card);
        } else {
          const empty = makeEmpty(c, r, tab.id);
          empty.style.gridColumn = c + 1;
          empty.style.gridRow = r + 1;
          grid.appendChild(empty);
        }
      }
    }

    page.appendChild(grid);
    track.appendChild(page);
  });

  // アクティブタブの位置に即移動
  const idx = state.tabs.findIndex(t => t.id === state.activeTab);
  track.classList.add('no-transition');
  track.style.transform = `translateX(-${idx * 100}%)`;
  requestAnimationFrame(() => track.classList.remove('no-transition'));
}

//アクティブタブのぶくまーく一覧を返す
function getBms() {
  return state.bookmarks[state.activeTab] || [];
}

//アクティブタブのブックマーク一覧をセット
function setBms(list) {
  state.bookmarks[state.activeTab] = list;
}

//ブックマークカードのDOM要素を生成して返す
function makeCard(bm, tabId = state.activeTab) {
  const card = document.createElement('div');
  const list = state.bookmarks[tabId] || [];
  card.className = 'bm-card';
  card.dataset.id = bm.id;
  card.style.gridColumn = bm.col + 1;
  card.style.gridRow = bm.row + 1;
  state.bookmarks[tabId] = list;

  // faviconがあれば画像，なければ頭文字フォールバックを表示
  if (bm.favicon) {
    const img = document.createElement('img');
    img.className = 'bm-favicon';
    img.src = bm.favicon;
    img.onerror = () => { img.replaceWith(makeFallback(bm.name)); };
    card.appendChild(img);
  } else {
    card.appendChild(makeFallback(bm.name));
  }

  const name = document.createElement('div');
  name.className = 'bm-name';
  name.textContent = bm.name;
  card.appendChild(name);

  // actions
  const actions = document.createElement('div');
  actions.className = 'bm-actions';

  const timerBtn = document.createElement('button');
  timerBtn.className = 'bm-action-btn bm-timer-btn';
  timerBtn.textContent = '⏱';
  timerBtn.title = 'タイマー';
  timerBtn.addEventListener('click', e => {
    e.stopPropagation();
    e.preventDefault();
    openTimerModal(bm, tabId);
  });

  const editBtn = document.createElement('button');
  editBtn.className = 'bm-action-btn bm-edit-btn';
  editBtn.textContent = '✎';
  editBtn.title = '編集';
  editBtn.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); openModal(bm); });

  const delBtn = document.createElement('button');
  delBtn.className = 'bm-action-btn bm-del-btn';
  delBtn.textContent = '✕';
  delBtn.title = '削除';
  delBtn.addEventListener('click', e => {
    e.stopPropagation(); e.preventDefault();
    setBms(getBms().filter(b => b.id !== bm.id));
    save(); renderGrid();
  });

  actions.appendChild(timerBtn);
  actions.appendChild(editBtn);
  actions.appendChild(delBtn);
  card.appendChild(actions);

  //タイマー設定済みのカードにはバッジを付与
  if (bm.timer) {
    const badge = document.createElement('div');
    badge.className = 'timer-badge';
    card.appendChild(badge);
  }

  //通常モード時：クリックでＵＲＬを新しいタブで開く
  card.addEventListener('click', () => {
    if (!state.settingsOn) window.open(bm.url, '_blank');
  });

  //設定モード時のみドラッグを可能にする
  if (state.settingsOn) {
    card.draggable = true;
    //ドラッグ開始：dragSrcにカード情報をセット
    card.addEventListener('dragstart', e => {
      dragSrc = { bm, tabId };
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    //ドラッグ終了：dragSrcをリセット
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      dragSrc = null;
    });
    card.addEventListener('dragover', e => { e.preventDefault(); card.classList.add('drag-over'); });
    card.addEventListener('dragleave', () => { card.classList.remove('drag-over'); });
    //ドロップ：カードの位置をswapBmで入れ替え
    card.addEventListener('drop', e => {
      e.preventDefault(); card.classList.remove('drag-over');
      if (!dragSrc || dragSrc.bm.id === bm.id) return;
      swapBm(dragSrc.bm, dragSrc.tabId, bm.col, bm.row, tabId);
    });
  }
  return card;
}

// faviconが取得できない場合のフォールバック要素を生成
function makeFallback(name) {
  const el = document.createElement('div');
  el.className = 'bm-favicon-fallback';
  el.textContent = (name || '?')[0].toUpperCase();
  return el;
}

//空セルのDOM要素を生成して返す．設定モード時はクリックで追加モーダルを開き，ドロップ先にもなる
function makeEmpty(c, r, tabId = state.activeTab) {
  const el = document.createElement('div');
  el.className = 'empty-cell';
  el.style.gridColumn = c + 1;
  el.style.gridRow = r + 1;
  if (state.settingsOn) {
    el.textContent = '＋';
    el.addEventListener('click', () => openModal(null, c, r, tabId));
    el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drag-over'); });
    el.addEventListener('dragleave', () => { el.classList.remove('drag-over'); });
    el.addEventListener('drop', e => {
      e.preventDefault(); el.classList.remove('drag-over');
      if (!dragSrc) return;
      moveBm(dragSrc.bm, dragSrc.tabId, c, r, tabId);
    });
  }
  return el;
}

//カードをドロップ先のセルと入れ替える．タブをまたぐ場合はsrcをdstに移動し，dstが埋まっていればsrcと交換
function swapBm(src, srcTabId, tc, tr, dstTabId) {
  const srcList = state.bookmarks[srcTabId];
  const dstList = state.bookmarks[dstTabId];
  const srcBm = srcList.find(b => b.id === src.id);
  if (!srcBm) return;

  if (srcTabId === dstTabId) {
    // 同タブ内：従来通りswap
    const target = dstList.find(b => b.col === tc && b.row === tr);
    const oc = srcBm.col, or = srcBm.row;
    srcBm.col = tc; srcBm.row = tr;
    if (target) { target.col = oc; target.row = or; }
  } else {
    // 別タブ：srcを移動してdstに追加
    state.bookmarks[srcTabId] = srcList.filter(b => b.id !== src.id);
    const target = dstList.find(b => b.col === tc && b.row === tr);
    if (target) {
      // drop先にカードがある場合はswap（srcTabIdに移動）
      target.col = srcBm.col; target.row = srcBm.row;
      state.bookmarks[srcTabId].push(target);
      state.bookmarks[dstTabId] = dstList.filter(b => b.id !== target.id);
    }
    srcBm.col = tc; srcBm.row = tr;
    state.bookmarks[dstTabId].push(srcBm);
  }
  save(); renderGrid();
}

//カードを空セルへ移動する．タブをまたぐ場合はsrcTabIdから削除してdstTabIdへ追加
function moveBm(src, srcTabId, tc, tr, dstTabId) {
  const srcList = state.bookmarks[srcTabId];
  const srcBm = srcList.find(b => b.id === src.id);
  if (!srcBm) return;

  if (srcTabId !== dstTabId) {
    state.bookmarks[srcTabId] = srcList.filter(b => b.id !== src.id);
    srcBm.col = tc; srcBm.row = tr;
    state.bookmarks[dstTabId].push(srcBm);
  } else {
    srcBm.col = tc; srcBm.row = tr;
  }
  save(); renderGrid();
}

/* ===================== MODAL ===================== */
let modalTarget = null; // 編集対象のbmオブジェクト（新規追加時はnull）
let modalCol = 0, modalRow = 0; // 追加先のグリッド座標
let faviconDebounce = null; // favicon取得のでバウンスタイマーID
let modalTabId = null; // モーダルを開いたタブのID

//ブックマーク追加・編集モーダルを開く（bm=nullなら追加モード）
function openModal(bm, col = 0, row = 0, tabId = state.activeTab) {
  modalTarget = bm;
  modalCol = col; modalRow = row;
  modalTabId = tabId;
  const overlay = document.getElementById('modal-overlay');
  document.getElementById('modal-title').textContent = bm ? 'ブックマークを編集' : 'ブックマークを追加';
  document.getElementById('modal-url').value = bm ? bm.url : '';
  document.getElementById('modal-name').value = bm ? bm.name : '';
  document.getElementById('modal-favicon-preview').innerHTML = '';
  document.getElementById('modal-favicon-upload').value = '';
  window._customFavicon = null;
  if (bm && bm.favicon && bm.favicon.startsWith('data:')) {
    window._customFavicon = bm.favicon; // カスタムfaviconを復元
  }
  overlay.classList.add('open');
  document.getElementById('modal-url').focus();
  if (bm && bm.favicon) showFaviconPreview(bm.favicon);
}

//モーダルを閉じてmodalTargetと_customFaviconをリセット
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  modalTarget = null;
  window._customFavicon = null; // リセット
}

//faviconのプレビュー画像をモーダル内に表示．取得失敗時はエラーメッセージを表示
function showFaviconPreview(src) {
  const p = document.getElementById('modal-favicon-preview');
  const uploadField = document.getElementById('favicon-upload-field');
  p.innerHTML = '';
  const img = document.createElement('img');
  img.src = src;
  img.onerror = () => {
    p.innerHTML = '<span>faviconを自動取得できませんでした</span>';
  };
  img.onload = () => {
  };
  p.appendChild(img);
  p.appendChild(document.createTextNode(' favicon取得'));
}

//URL入力欄：500msでバウンスでfaviconプレビューを更新．表示名が空なら自動補完
document.getElementById('modal-url').addEventListener('input', function () {
  clearTimeout(faviconDebounce);
  faviconDebounce = setTimeout(() => {
    const url = this.value.trim();
    const fUrl = getFaviconUrl(url);
    if (fUrl) showFaviconPreview(fUrl);
    if (!document.getElementById('modal-name').value) {
      try {
        const u = new URL(url);
        document.getElementById('modal-name').value = u.hostname.replace('www.', '');
      } catch { }
    }
  }, 500);
});

//キャンセルボタン：モーダルを閉じる
document.getElementById('modal-cancel').addEventListener('click', closeModal);
let mousedownOnOverlay = false;

//オーバーレイクリックでモーダルを閉じる（mousedownとclickが同じ要素の場合のみ）
document.getElementById('modal-overlay').addEventListener('mousedown', e => {
  mousedownOnOverlay = (e.target === document.getElementById('modal-overlay'));
});

document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay') && mousedownOnOverlay) closeModal();
});

//保存ボタン：バリデーション後にブックマークを追加または更新
document.getElementById('modal-ok').addEventListener('click', () => {
  const url = document.getElementById('modal-url').value.trim();
  const name = document.getElementById('modal-name').value.trim();
  if (!url || !name) { toast('URLと名前を入力してください'); return; }

  let fullUrl = url;
  if (!/^https?:\/\//i.test(fullUrl)) fullUrl = 'https://' + fullUrl;

  const uploadedFavicon = window._customFavicon || null;
  const favicon = uploadedFavicon || getFaviconUrl(fullUrl);
  const list = getBms();

  //編集モード：既存ブックマークを更新（URLが変わった場合のみfaviconも更新）
  if (modalTarget) {
    const bm = list.find(b => b.id === modalTarget.id);
    if (bm) {
      const urlChanged = fullUrl !== bm.url;
      bm.url = fullUrl;
      bm.name = name;
      if (urlChanged || window._customFavicon) {
        bm.favicon = favicon;
      }
    }
  } else {
    //追加モード：指定せるが埋まっていれば空セルを探して追加
    let col = modalCol, row = modalRow;
    const occ = new Set(list.map(b => `${b.col},${b.row}`));
    if (occ.has(`${col},${row}`)) {
      let found = false;
      outer: for (let r = 0; r < state.rows; r++) for (let c = 0; c < state.cols; c++) {
        if (!occ.has(`${c},${r}`)) { col = c; row = r; found = true; break outer; }
      }
      if (!found) { toast('グリッドが満杯です'); return; }
    }
    list.push({ id: uid(), url: fullUrl, name, favicon, col, row });
  }

  setBms(list);
  save(); renderGrid();
  closeModal();
  toast(modalTarget ? '更新しました' : '追加しました');
});

// URLでEnter → 表示名にフォーカス移動
document.getElementById('modal-url').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('modal-name').focus();
  }
});

// 表示名でEnter → 保存ボタンと同じ処理を実行
document.getElementById('modal-name').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('modal-ok').click();
  }
});

//faviconの手動アップロード：base64に変換して_customFaviconに保持し，プレビューを更新
document.getElementById('modal-favicon-upload').addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const p = document.getElementById('modal-favicon-preview');
    p.innerHTML = '';
    const img = document.createElement('img');
    img.src = e.target.result;
    p.appendChild(img);
    p.appendChild(document.createTextNode(' カスタムfavicon'));
    // 保存用にモジュール変数へ退避
    window._customFavicon = e.target.result;
  };
  reader.readAsDataURL(file);
});

/* ===================== TAB ADD ===================== */
//タブ追加ボタン：新しいタブを生成してアクティブ
document.getElementById('add-tab-btn').addEventListener('click', () => {
  const t = { id: uid(), name: `Tab ${state.tabs.length + 1}`, cols: state.cols, rows: state.rows };
  state.tabs.push(t);
  state.activeTab = t.id;
  state.bookmarks[t.id] = [];
  save(); render();
});

/* ===================== SETTINGS TOGGLE ===================== */
//設定ボタン：設定モードのON/OFFを切り替え．設定モードOFF時はパネルも閉じる
document.getElementById('settings-btn').addEventListener('click', () => {
  state.settingsOn = !state.settingsOn;
  document.getElementById('settings-btn').classList.toggle('active', state.settingsOn);
  // パネルは開かない。設定モードOFF時はパネルも閉じる
  if (!state.settingsOn) {
    document.getElementById('settings-panel').classList.remove('open');
  }
  save(); render();
});

// パネルの開閉
document.getElementById('panel-btn').addEventListener('click', () => {
  if (!state.settingsOn) { toast('設定モードをONにしてください'); return; }
  document.getElementById('settings-panel').classList.toggle('open');
});

//列数・行数の入力欄：アクティブタブのサイズを更新してグリッドを再描画
['s-cols', 's-rows'].forEach(id => {
  document.getElementById(id).addEventListener('change', function () {
    const v = parseInt(this.value);
    const tab = state.tabs.find(t => t.id === state.activeTab);
    if (id === 's-cols') tab.cols = Math.max(2, Math.min(12, v));
    else tab.rows = Math.max(1, Math.min(10, v));
    save(); renderGrid();
  });
});

/* ===================== EXPORT / IMPORT ===================== */
//エクスポートボタン：stateをJSONにしてダウンロード
document.getElementById('export-btn').addEventListener('click', () => {
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `bookmarks_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  toast('エクスポートしました');
});
//インポートボタン：非表示のfile inputをトリガーとする
document.getElementById('import-btn-trigger').addEventListener('click', () => {
  document.getElementById('import-file').click();
});
//JSONファイルを読み込んでstateに上書き，アプリを再描画
document.getElementById('import-file').addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const imported = JSON.parse(e.target.result);
      state = imported;
      save(); render();
      toast('インポートしました');

      //4秒間表示する警告トースト（タイマー利用時の注意喚起用）
      function toastLong(msg) {
        const el = document.getElementById('toast');
        el.textContent = msg;
        el.classList.add('show', 'toast-warning');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
          el.classList.remove('show', 'toast-warning');
        }, 4000);
      }
      //タイマー設定済みのブックマークがあれば，ポップアップ許可の注意を表示する
      const hasTimer = Object.values(state.bookmarks).flat().some(bm => bm.timer);
      if (hasTimer) {
        setTimeout(() => {
          toastLong('タイマー機能を利用中です。ポップアップとリダイレクトの許可がオンになっていることを確認してください。');
        }, 2700);
      }

    } catch { toast('JSONファイルが無効です'); }
  };
  reader.readAsText(file);
  this.value = '';
});

/* ===================== BACKGROUND ===================== */
//背景画像変更ボタン：非表示のfile inputをトリガーとする
document.getElementById('bg-btn').addEventListener('click', () => {
  document.getElementById('bg-upload').click();
});

//背景画像ファイル選択：3MB以下かチェック後にbase64化してlocalStorageとstateに保存・反映
document.getElementById('bg-upload').addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;

  // 3MBを超えたら即拒否（base64化すると約1.33倍になるため）
  if (file.size > 3 * 1024 * 1024) {
    toast('⚠ 画像が大きすぎます（3MB以下にしてください）');
    this.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    const newBg = e.target.result;

    // 保存を先に試みる
    try {
      localStorage.setItem('bm_bg', newBg);
    } catch (err) {
      toast('⚠ 容量不足で背景を保存できませんでした');
      this.value = '';
      return; // 保存失敗したら画面にも反映しない
    }

    // 保存成功後に反映
    state.bgImage = newBg;
    renderBg();
    toast('背景を変更しました');
  };
  reader.readAsDataURL(file);
});

//背景クリアボタン：背景画像・グラデーションをリセットする
document.getElementById('bg-clear-btn').addEventListener('click', () => {
  state.bgImage = null;
  state.bgGradient = null;
  document.getElementById('bg-upload').value = '';
  save(); renderBg(); renderSwatches();
  toast('背景をクリアしました');
});

//ヘッダー色・文字色の切り替えボタン
document.getElementById('header-white-btn').addEventListener('click', () => {
  state.headerColor = 'white';
  applyHeaderColor();
  save();
});

document.getElementById('header-black-btn').addEventListener('click', () => {
  state.headerColor = 'black';
  applyHeaderColor();
  save();
});

document.getElementById('text-white-btn').addEventListener('click', () => {
  state.textColor = 'white';
  applyTextColor();
  save();
});

document.getElementById('text-black-btn').addEventListener('click', () => {
  state.textColor = 'black';
  applyTextColor();
  save();
});

//背景画像の水平・垂直位置スライダー：iuputでリアルタイム反映，change保持
['bg-pos-x', 'bg-pos-y'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    const x = document.getElementById('bg-pos-x').value;
    const y = document.getElementById('bg-pos-y').value;
    state.bgPosition = `${x}% ${y}%`;
    const el = document.getElementById('bg-layer');
    el.style.background = `url(${state.bgImage}) ${state.bgPosition}/cover no-repeat`;
  });
  document.getElementById(id).addEventListener('change', () => {
    save();
  });
});

//オーバーレイ暗さスライダー：inputでリアルタイム反映，changeで保存
document.getElementById('bg-overlay').addEventListener('input', function () {
  state.bgOverlay = parseFloat(this.value);
  document.documentElement.style.setProperty('--bg-overlay', state.bgOverlay);
});

document.getElementById('bg-overlay').addEventListener('change', function () {
  save();
});

/* ===================== CONFIRM ===================== */
let confirmCallback = null; //削除確認OKボタン押下時に実行するコールバック
//削除確認ダイアログを開く
function openConfirm(msg, onOk) {
  confirmCallback = onOk;
  document.getElementById('confirm-msg').textContent = msg;
  const overlay = document.getElementById('confirm-overlay');
  overlay.classList.add('open');
}

//削除確認ダイアログを閉じてコールバックをリセット
function closeConfirm() {
  document.getElementById('confirm-overlay').classList.remove('open');
  confirmCallback = null;
}

//削除OKボタン：コールバックを実行してダイアログを閉じる
document.getElementById('confirm-ok').addEventListener('click', () => {
  if (confirmCallback) confirmCallback();
  closeConfirm();
});

//キャンセルボタン・オーバーレイクリック：ダイアログを閉じる
document.getElementById('confirm-cancel').addEventListener('click', closeConfirm);

document.getElementById('confirm-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('confirm-overlay')) closeConfirm();
});

/* ===================== TIMER MODAL ===================== */
let timerTarget = null; //タイマー設定対象のブックマーク

//タイマー設定モーダルを開く．設定済みならバッジを表示し，現在時刻をデフォルト値にする
function openTimerModal(bm, tabId) {
  timerTarget = bm;
  timerTarget._tabId = tabId;
  // const t = bm.timer || { day: 1, hour: 9, minute: 0 };
  const now = new Date();
  const t = bm.timer || { day: now.getDay(), hour: now.getHours(), minute: now.getMinutes() };
  document.getElementById('timer-day').value = t.day;
  document.getElementById('timer-hour').value = t.hour;
  document.getElementById('timer-minute').value = t.minute;
  document.getElementById('timer-set-badge').classList.toggle('visible', !!bm.timer);
  document.getElementById('timer-overlay').classList.add('open');
}

//キャンセルボタン：モーダルを閉じる
document.getElementById('timer-cancel').addEventListener('click', () => {
  document.getElementById('timer-overlay').classList.remove('open');
});

//タイマー削除ボタン：タイマー設定を消してグリッドを更新する
document.getElementById('timer-clear').addEventListener('click', () => {
  if (!timerTarget) return;
  const list = state.bookmarks[timerTarget._tabId];
  const bm = list.find(b => b.id === timerTarget.id);
  if (bm) delete bm.timer;
  save();
  document.getElementById('timer-overlay').classList.remove('open');
  renderGrid();
  toast('タイマーを削除しました');
});

//保存ボタン：曜日・時間・分をブックマークに保存してグリッドを更新
document.getElementById('timer-ok').addEventListener('click', () => {
  if (!timerTarget) return;
  const day = parseInt(document.getElementById('timer-day').value);
  const hour = parseInt(document.getElementById('timer-hour').value);
  const minute = parseInt(document.getElementById('timer-minute').value);
  const list = state.bookmarks[timerTarget._tabId];
  const bm = list.find(b => b.id === timerTarget.id);
  if (bm) bm.timer = { day, hour, minute };
  save();
  document.getElementById('timer-overlay').classList.remove('open');
  renderGrid();
  toast('タイマーを設定しました');
});

/* ===================== SEARCH ===================== */
//検索入力欄：全タブのカードをリアルタイムでフィルタリングし，最も左の一致カードのタブへ移動
document.getElementById('search-input').addEventListener('input', function () {
  const q = this.value.trim().toLowerCase();
  const pages = document.querySelectorAll('.grid-page');

  if (!q) {
    pages.forEach(page => {
      page.querySelectorAll('.bm-card').forEach(c => c.style.opacity = '');
      page.querySelectorAll('.empty-cell').forEach(e => e.style.opacity = '');
    });
    return;
  }

  // 全タブから一致カードを収集し、最も左上（col小→row小）の一致を記録
  let bestMatch = null; // { tabId, col, row }

  pages.forEach(page => {
    const tabId = page.dataset.tabId;
    page.querySelectorAll('.empty-cell').forEach(e => e.style.opacity = '0');
    page.querySelectorAll('.bm-card').forEach(card => {
      const name = card.querySelector('.bm-name')?.textContent.toLowerCase() || '';
      const hit = name.includes(q);
      card.style.opacity = hit ? '1' : '0.15';
      if (hit) {
        const bm = (state.bookmarks[tabId] || []).find(b => b.id === card.dataset.id);
        if (bm) {
          if (!bestMatch ||
            bm.col < bestMatch.col ||
            (bm.col === bestMatch.col && bm.row < bestMatch.row)) {
            bestMatch = { tabId, col: bm.col, row: bm.row };
          }
        }
      }
    });
  });

  // 一致カードのタブが現在と異なる場合はタブを切り替える
  if (bestMatch && bestMatch.tabId !== state.activeTab) {
    state.activeTab = bestMatch.tabId;
    const newIdx = state.tabs.findIndex(t => t.id === state.activeTab);
    const track = document.getElementById('grid-track');
    track.style.transform = `translateX(-${newIdx * 100}%)`;
    save();
    renderTabs();
    renderSettings();
  }
});

/* ===================== CLOCK ===================== */
//時計を現在時刻で更新する（HH:MM:SS形式）
function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  document.getElementById('clock').textContent = `${h}:${m}:${s}`;
}
//初期表示と1秒ごとの更新を設定
updateClock();
setInterval(updateClock, 1000);

// タイマー発火チェック：4秒ごとに全ブックマークのタイマーを確認し，時刻が一致すればURLを開く
const _firedTimers = new Set();

setInterval(() => {
  const now = new Date();
  const sec = now.getSeconds();
  if (sec > 5) return;

  const key = `${now.getDay()}-${now.getHours()}-${now.getMinutes()}`;

  Object.values(state.bookmarks).flat().forEach(bm => {
    if (!bm.timer) return;
    const bmKey = `${bm.id}-${key}`;
    if (_firedTimers.has(bmKey)) return; // 既に発火済み

    if (now.getDay() === bm.timer.day &&
        now.getHours() === bm.timer.hour &&
        now.getMinutes() === bm.timer.minute) {
      _firedTimers.add(bmKey);
      window.open(bm.url, '_blank');
    }
  });
}, 4000);

/* ===================== TAB 移動 ===================== */
// スワイプでタブを切り替える（タッチデバイス用）
(function () {
  const outer = document.getElementById('grid-outer');
  let startX = 0, startY = 0;
  let currentX = 0;
  let isDragging = false;
  let isHorizontal = null;

  function getTrack() { return document.getElementById('grid-track'); }
  function getIdx() { return state.tabs.findIndex(t => t.id === state.activeTab); }
  function getBase() { return getIdx() * 100; }

  //タッチ開始：開始座標を記録し，トランジションを無効化
  outer.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    currentX = 0;
    isDragging = true;
    isHorizontal = null;
    getTrack().classList.add('no-transition');
  }, { passive: true });

  //タッチ移動：縦横を判定し，横スワイプの場合のみトラックを追従
  outer.addEventListener('touchmove', e => {
    if (!isDragging) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;

    // 最初の4px移動で横スワイプか縦スクロールかを判定する
    if (isHorizontal === null && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      isHorizontal = Math.abs(dx) > Math.abs(dy);
    }
    if (!isHorizontal) return;

    currentX = dx;
    const idx = getIdx();
    const tabCount = state.tabs.length;

    // 端のタブは0.2倍で抵抗感を持たせる
    let move = currentX;
    if ((idx === 0 && move > 0) || (idx === tabCount - 1 && move < 0)) {
      move = move * 0.2;
    }

    const pct = (move / outer.offsetWidth) * 100;
    getTrack().style.transform = `translateX(${-getBase() + pct}%)`;
  }, { passive: true });

  //タッチ終了：25%以上スワイプでタブを切り替え
  outer.addEventListener('touchend', e => {
    if (!isDragging || !isHorizontal) { isDragging = false; return; }
    isDragging = false;

    const track = getTrack();
    track.classList.remove('no-transition');

    const idx = getIdx();
    const THRESHOLD = outer.offsetWidth * 0.25; // 25%以上で切り替え

    if (currentX < -THRESHOLD && idx < state.tabs.length - 1) {
      state.activeTab = state.tabs[idx + 1].id;
    } else if (currentX > THRESHOLD && idx > 0) {
      state.activeTab = state.tabs[idx - 1].id;
    }

    const newIdx = state.tabs.findIndex(t => t.id === state.activeTab);
    track.style.transform = `translateX(-${newIdx * 100}%)`;
    save();
    renderTabs();
    renderSettings();
    // グリッドは再レンダリングせずtransformだけ更新
  }, { passive: true });
})();

//ホイール・タッチパッドでタブを切り替える（横方向：タッチパッド，縦方向：マウスホイール）
(function () {
  const outer = document.getElementById('grid-outer');
  let wheelLocked = false; // 連続切り替えを防ぐロックフラグ

  outer.addEventListener('wheel', e => {
    const isHorizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);

    // 横方向（タッチパッドの二本指スワイプ）：600msロックで切り替え
    if (isHorizontal) {
      e.preventDefault();
      if (wheelLocked) return;
      wheelLocked = true;
      setTimeout(() => { wheelLocked = false; }, 600);

      const idx = state.tabs.findIndex(t => t.id === state.activeTab);
      if (e.deltaX > 0 && idx < state.tabs.length - 1) {
        state.activeTab = state.tabs[idx + 1].id;
      } else if (e.deltaX < 0 && idx > 0) {
        state.activeTab = state.tabs[idx - 1].id;
      } else return;

      // 縦方向（マウスホイール）：100msロックで切り替え
    } else {
      e.preventDefault();
      if (wheelLocked) return;
      wheelLocked = true;
      setTimeout(() => { wheelLocked = false; }, 100);

      const idx = state.tabs.findIndex(t => t.id === state.activeTab);
      if (e.deltaY > 0 && idx < state.tabs.length - 1) {
        state.activeTab = state.tabs[idx + 1].id;
      } else if (e.deltaY < 0 && idx > 0) {
        state.activeTab = state.tabs[idx - 1].id;
      } else return;
    }

    const newIdx = state.tabs.findIndex(t => t.id === state.activeTab);
    const track = document.getElementById('grid-track');
    track.style.transform = `translateX(-${newIdx * 100}%)`;
    save();
    renderTabs();
    renderSettings();
  }, { passive: false });
})();

// キーボード左右矢印キーでタブ切り替え
(function () {
  document.addEventListener('keydown', e => {
    // 入力中は無視
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

    const idx = state.tabs.findIndex(t => t.id === state.activeTab);

    if (e.key === 'ArrowRight' && idx < state.tabs.length - 1) {
      state.activeTab = state.tabs[idx + 1].id;
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      state.activeTab = state.tabs[idx - 1].id;
    } else {
      return;
    }

    const newIdx = state.tabs.findIndex(t => t.id === state.activeTab);
    const track = document.getElementById('grid-track');
    track.style.transform = `translateX(-${newIdx * 100}%)`;
    save();
    renderTabs();
    renderSettings();
  });
})();

// キーボードショートカット E で設定モードON/OFF
document.addEventListener('keydown', e => {
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
  if (e.key !== 'e' && e.key !== 'E') return;
  state.settingsOn = !state.settingsOn;
  document.getElementById('settings-btn').classList.toggle('active', state.settingsOn);
  if (!state.settingsOn) {
    document.getElementById('settings-panel').classList.remove('open');
  }
  save(); render();
});

/* ===================== INIT ===================== */
load();     // localStorageからstateを復元
if (!state.activeTab) state.activeTab = state.tabs[0].id;     //activeTabが未設定なら先頭タブを選択
render();     //初回描画
document.getElementById('settings-btn').classList.toggle('active', state.settingsOn);     //設定ボタンの初期状態を反映