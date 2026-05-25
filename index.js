{/* <script> */ }
/* ===================== STATE ===================== */
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
  settingsOn: false,
};
let dragSrc = null; // {tabId, bm}

function uid() { return Math.random().toString(36).slice(2, 10); }

/* ===================== PERSIST ===================== */

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

function load() {
  try {
    const s = localStorage.getItem('bm_state');
    if (s) state = JSON.parse(s);
    state.bgImage = localStorage.getItem('bm_bg') || null;
    if (!state.tabs || !state.tabs.length) state.tabs = [{ id: uid(), name: 'Home' }];
    if (!state.bookmarks) state.bookmarks = {};
    if (!state.activeTab || !state.tabs.find(t => t.id === state.activeTab))
      state.activeTab = state.tabs[0].id;
  } catch (e) { }
}


/* ===================== FAVICON ===================== */
function getFaviconUrl(url) {
  try {
    const u = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`;
  } catch { return null; }
}

/* ===================== RENDER ===================== */
function render() {
  renderBg();
  renderTabs();
  renderGrid();
  renderSettings();
  applyTextColor();
  document.body.classList.toggle('settings-on', state.settingsOn);
}


function renderBg() {
  const el = document.getElementById('bg-layer');
  const overlay = state.bgOverlay ?? 0.3;
  document.documentElement.style.setProperty('--bg-overlay', overlay);
  document.getElementById('bg-overlay').value = overlay;
  if (state.bgImage) {
    const pos = state.bgPosition || '50% 50%';
    el.style.background = `url(${state.bgImage}) ${pos}/cover no-repeat`;
    document.getElementById('bg-position-row').style.display = 'flex';
    const [x, y] = pos.split(' ');
    document.getElementById('bg-pos-x').value = parseInt(x);
    document.getElementById('bg-pos-y').value = parseInt(y);
  } else {
    el.style.background = '';
    document.getElementById('bg-position-row').style.display = 'none';
  }
}



function renderTabs() {
  const cont = document.getElementById('tabs-container');
  cont.innerHTML = '';
  state.tabs.forEach(tab => {
    const btn = document.createElement('button');
    btn.className = 'tab-btn' + (tab.id === state.activeTab ? ' active' : '');
    btn.dataset.id = tab.id;

    const nameInput = document.createElement('input');
    nameInput.className = 'tab-name-input';
    nameInput.value = tab.name;
    nameInput.readOnly = !state.settingsOn;
    nameInput.style.pointerEvents = state.settingsOn ? 'auto' : 'none';
    nameInput.addEventListener('change', () => {
      tab.name = nameInput.value || 'Tab';
      save(); renderTabs();
    });
    nameInput.addEventListener('click', e => { if (state.settingsOn) e.stopPropagation(); });

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

    btn.addEventListener('click', () => {
      state.activeTab = tab.id;
      save(); renderTabs(); renderGrid();
    });

    // 設定モード時のみドラッグ有効
    if (state.settingsOn) {
      btn.draggable = true;

      btn.addEventListener('dragstart', e => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('tabId', tab.id);
        setTimeout(() => btn.classList.add('tab-dragging'), 0);
      });

      btn.addEventListener('dragend', () => {
        btn.classList.remove('tab-dragging');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-drag-over'));
      });

      btn.addEventListener('dragover', e => {
        e.preventDefault();
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-drag-over'));
        if (e.dataTransfer.getData('tabId') !== tab.id) btn.classList.add('tab-drag-over');
      });

      btn.addEventListener('dragleave', () => {
        btn.classList.remove('tab-drag-over');
      });

      btn.addEventListener('drop', e => {
        e.preventDefault();
        btn.classList.remove('tab-drag-over');
        const srcId = e.dataTransfer.getData('tabId');
        if (!srcId || srcId === tab.id) return;
        const srcIdx = state.tabs.findIndex(t => t.id === srcId);
        const dstIdx = state.tabs.findIndex(t => t.id === tab.id);
        // 入れ替え
        const tmp = state.tabs[srcIdx];
        state.tabs[srcIdx] = state.tabs[dstIdx];
        state.tabs[dstIdx] = tmp;
        save(); renderTabs();
      });
    }

    cont.appendChild(btn);

  });
}

function renderSettings() {
  const tab = state.tabs.find(t => t.id === state.activeTab);
  document.getElementById('s-cols').value = tab.cols;
  document.getElementById('s-rows').value = tab.rows;
}

// function renderGrid() {
//   const tab = state.tabs.find(t => t.id === state.activeTab);
//   const cols = tab.cols;
//   const rows = tab.rows;
//   const grid = document.getElementById('bookmark-grid');
//   grid.style.setProperty('--cols', cols);
//   grid.style.setProperty('--rows', rows);
//   grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
//   grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
//     grid.innerHTML = '';

//     const bms = getBms();
//     const occupied = { };
//       bms.forEach(bm => {occupied[`${bm.col},${bm.row}`] = bm; });

//     for (let r = 0; r < rows; r++) {
//         for (let c = 0; c < cols; c++) {
//           const key = `${c},${r}`;
//     const bm = occupied[key];
//     if (bm) {
//         grid.appendChild(makeCard(bm));
//           } else {
//         grid.appendChild(makeEmpty(c, r));
//           }
//         }
//       }
//     }

function renderGrid() {
  const track = document.getElementById('grid-track');
  track.innerHTML = '';

  state.tabs.forEach(tab => {
    const page = document.createElement('div');
    page.className = 'grid-page';
    page.dataset.tabId = tab.id;

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



function getBms() {
  return state.bookmarks[state.activeTab] || [];
}
function setBms(list) {
  state.bookmarks[state.activeTab] = list;
}

function makeCard(bm, tabId = state.activeTab) {
  const card = document.createElement('div');
  const list = state.bookmarks[tabId] || [];
  card.className = 'bm-card';
  card.dataset.id = bm.id;
  card.style.gridColumn = bm.col + 1;
  card.style.gridRow = bm.row + 1;
  state.bookmarks[tabId] = list;

  // favicon
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

  if (bm.timer) {
    const badge = document.createElement('div');
    badge.className = 'timer-badge';
    card.appendChild(badge);
  }

  // click (normal mode)
  card.addEventListener('click', () => {
    if (!state.settingsOn) window.open(bm.url, '_blank');
  });

  // drag
  if (state.settingsOn) {
    card.draggable = true;
    card.addEventListener('dragstart', e => {
      dragSrc = { bm };
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      dragSrc = null;
    });
    card.addEventListener('dragover', e => { e.preventDefault(); card.classList.add('drag-over'); });
    card.addEventListener('dragleave', () => { card.classList.remove('drag-over'); });
    card.addEventListener('drop', e => {
      e.preventDefault(); card.classList.remove('drag-over');
      if (!dragSrc || dragSrc.bm.id === bm.id) return;
      swapBm(dragSrc.bm, bm.col, bm.row);
    });
  }
  return card;
}

function makeFallback(name) {
  const el = document.createElement('div');
  el.className = 'bm-favicon-fallback';
  el.textContent = (name || '?')[0].toUpperCase();
  return el;
}

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
      moveBm(dragSrc.bm, c, r);
    });
  }
  return el;
}

function swapBm(src, tc, tr) {
  const list = getBms();
  const target = list.find(b => b.col === tc && b.row === tr);
  const srcBm = list.find(b => b.id === src.id);
  if (!srcBm) return;
  const oc = srcBm.col, or = srcBm.row;
  srcBm.col = tc; srcBm.row = tr;
  if (target) { target.col = oc; target.row = or; }
  save(); renderGrid();
}
function moveBm(src, tc, tr) {
  const list = getBms();
  const srcBm = list.find(b => b.id === src.id);
  if (!srcBm) return;
  srcBm.col = tc; srcBm.row = tr;
  save(); renderGrid();
}

/* ===================== MODAL ===================== */
let modalTarget = null; // null=add, obj=edit
let modalCol = 0, modalRow = 0;
let faviconDebounce = null;
let modalTabId = null;

function openModal(bm, col = 0, row = 0, tabId = state.activeTab) {
  modalTarget = bm;
  modalCol = col; modalRow = row;
  modalTabId = tabId;
  const overlay = document.getElementById('modal-overlay');
  document.getElementById('modal-title').textContent = bm ? 'ブックマークを編集' : 'ブックマークを追加';
  document.getElementById('modal-url').value = bm ? bm.url : '';
  document.getElementById('modal-name').value = bm ? bm.name : '';
  document.getElementById('modal-favicon-preview').innerHTML = '';
  document.getElementById('favicon-upload-field').style.display = 'none'; // リセット
  document.getElementById('modal-favicon-upload').value = '';
  window._customFavicon = null;
  if (bm && bm.favicon && bm.favicon.startsWith('data:')) {
    window._customFavicon = bm.favicon; // カスタムfaviconを復元
  }
  overlay.classList.add('open');
  document.getElementById('modal-url').focus();
  if (bm && bm.favicon) showFaviconPreview(bm.favicon);
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  modalTarget = null;
  window._customFavicon = null; // リセット
}


function showFaviconPreview(src) {
  const p = document.getElementById('modal-favicon-preview');
  const uploadField = document.getElementById('favicon-upload-field');
  p.innerHTML = '';
  const img = document.createElement('img');
  img.src = src;
  img.onerror = () => {
    p.innerHTML = '<span>faviconを自動取得できませんでした</span>';
    uploadField.style.display = 'block'; // アップロード欄を表示
  };
  img.onload = () => {
    // uploadField.style.display = 'none'; // 取得成功時は非表示
    // document.getElementById('modal-favicon-upload').value = '';
    uploadField.style.display = 'block'; // 常に表示
  };
  p.appendChild(img);
  p.appendChild(document.createTextNode(' favicon取得'));
}

document.getElementById('modal-url').addEventListener('input', function () {
  clearTimeout(faviconDebounce);
  faviconDebounce = setTimeout(() => {
    const url = this.value.trim();
    const fUrl = getFaviconUrl(url);
    if (fUrl) showFaviconPreview(fUrl);
    // auto-fill name
    if (!document.getElementById('modal-name').value) {
      try {
        const u = new URL(url);
        document.getElementById('modal-name').value = u.hostname.replace('www.', '');
      } catch { }
    }
  }, 500);
});

document.getElementById('modal-cancel').addEventListener('click', closeModal);
let mousedownOnOverlay = false;

document.getElementById('modal-overlay').addEventListener('mousedown', e => {
  mousedownOnOverlay = (e.target === document.getElementById('modal-overlay'));
});

document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay') && mousedownOnOverlay) closeModal();
});

document.getElementById('modal-ok').addEventListener('click', () => {
  const url = document.getElementById('modal-url').value.trim();
  const name = document.getElementById('modal-name').value.trim();
  if (!url || !name) { toast('URLと名前を入力してください'); return; }

  let fullUrl = url;
  if (!/^https?:\/\//i.test(fullUrl)) fullUrl = 'https://' + fullUrl;

  // const favicon = getFaviconUrl(fullUrl);
  const uploadedFavicon = window._customFavicon || null;
  const favicon = uploadedFavicon || getFaviconUrl(fullUrl);
  const list = getBms();

  if (modalTarget) {
    const bm = list.find(b => b.id === modalTarget.id);
    if (bm) {
      bm.url = fullUrl;
      bm.name = name;
      // URLが変わった場合のみfaviconを更新、変わっていなければ既存を維持
      if (fullUrl !== bm.url || window._customFavicon) {
        bm.favicon = favicon;
      }
    }
  } else {
    // find free slot or use given col/row
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

/* ===================== TAB ADD ===================== */
document.getElementById('add-tab-btn').addEventListener('click', () => {
  const t = { id: uid(), name: `Tab ${state.tabs.length + 1}`, cols: state.cols, rows: state.rows };
  state.tabs.push(t);
  state.activeTab = t.id;
  state.bookmarks[t.id] = [];
  save(); render();
});

/* ===================== SETTINGS TOGGLE ===================== */
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


/* grid size change */
['s-cols', 's-rows'].forEach(id => {
  document.getElementById(id).addEventListener('change', function () {
    const v = parseInt(this.value);
    const tab = state.tabs.find(t => t.id === state.activeTab);
    if (id === 's-cols') tab.cols = Math.max(2, Math.min(12, v));
    else tab.rows = Math.max(1, Math.min(10, v));
    save(); renderGrid();
  });
});


/* ===================== BACKGROUND ===================== */
document.getElementById('bg-btn').addEventListener('click', () => {
  document.getElementById('bg-upload').click();
});

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

document.getElementById('bg-clear-btn').addEventListener('click', () => {
  state.bgImage = null;
  document.getElementById('bg-upload').value = '';
  save(); renderBg();
  toast('背景をクリアしました');
});


function applyTextColor() {
  const isBlack = state.textColor === 'black';
  document.documentElement.style.setProperty('--label-color',
    isBlack ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.92)');

  document.getElementById('text-white-btn').style.background =
    !isBlack ? 'rgba(255,255,255,0.3)' : '';
  document.getElementById('text-black-btn').style.background =
    isBlack ? 'rgba(255,255,255,0.3)' : '';
}


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

/* ===================== TIMER MODAL ===================== */
let timerTarget = null;

function openTimerModal(bm, tabId) {
  timerTarget = bm;
  timerTarget._tabId = tabId;
  const t = bm.timer || { day: 1, hour: 9, minute: 0 };
  document.getElementById('timer-day').value = t.day;
  document.getElementById('timer-hour').value = t.hour;
  document.getElementById('timer-minute').value = t.minute;
  document.getElementById('timer-set-badge').style.display = bm.timer ? 'inline-block' : 'none';
  document.getElementById('timer-overlay').style.display = 'flex';
}

document.getElementById('timer-cancel').addEventListener('click', () => {
  document.getElementById('timer-overlay').style.display = 'none';
});

document.getElementById('timer-clear').addEventListener('click', () => {
  if (!timerTarget) return;
  const list = state.bookmarks[timerTarget._tabId];
  const bm = list.find(b => b.id === timerTarget.id);
  if (bm) delete bm.timer;
  save();
  document.getElementById('timer-overlay').style.display = 'none';
  renderGrid();
  toast('タイマーを削除しました');
});

document.getElementById('timer-ok').addEventListener('click', () => {
  if (!timerTarget) return;
  const day = parseInt(document.getElementById('timer-day').value);
  const hour = parseInt(document.getElementById('timer-hour').value);
  const minute = parseInt(document.getElementById('timer-minute').value);
  const list = state.bookmarks[timerTarget._tabId];
  const bm = list.find(b => b.id === timerTarget.id);
  if (bm) bm.timer = { day, hour, minute };
  save();
  document.getElementById('timer-overlay').style.display = 'none';
  renderGrid();
  toast('タイマーを設定しました');
});

/* ===================== EXPORT / IMPORT ===================== */
document.getElementById('export-btn').addEventListener('click', () => {
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `bookmarks_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  toast('エクスポートしました');
});
document.getElementById('import-btn-trigger').addEventListener('click', () => {
  document.getElementById('import-file').click();
});
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
    } catch { toast('JSONファイルが無効です'); }
  };
  reader.readAsText(file);
  this.value = '';
});

/* ===================== TOAST ===================== */
let toastTimer = null;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/* ===================== CLOCK ===================== */
function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  document.getElementById('clock').textContent = `${h}:${m}:${s}`;
}
updateClock();
setInterval(updateClock, 1000);

/* タイマー用時間確認 */
setInterval(() => {
  const now = new Date();
  if (now.getSeconds() > 5) return; // 毎分0〜5秒の間だけ発火
  Object.values(state.bookmarks).flat().forEach(bm => {
    if (!bm.timer) return;
    if (now.getDay() === bm.timer.day &&
      now.getHours() === bm.timer.hour &&
      now.getMinutes() === bm.timer.minute) {
      window.open(bm.url, '_blank');
    }
  });
}, 10000); // 10秒ごとにチェック

/* ===================== INIT ===================== */
load();
if (!state.activeTab) state.activeTab = state.tabs[0].id;
render();
document.getElementById('settings-btn').classList.toggle('active', state.settingsOn);
// if (state.settingsOn) document.getElementById('settings-panel').style.display = 'block';

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


document.getElementById('bg-overlay').addEventListener('input', function () {
  state.bgOverlay = parseFloat(this.value);
  document.documentElement.style.setProperty('--bg-overlay', state.bgOverlay);
});
document.getElementById('bg-overlay').addEventListener('change', function () {
  save();
});

let confirmCallback = null;

function openConfirm(msg, onOk) {
  confirmCallback = onOk;
  document.getElementById('confirm-msg').textContent = msg;
  const overlay = document.getElementById('confirm-overlay');
  overlay.style.display = 'flex';
}

function closeConfirm() {
  document.getElementById('confirm-overlay').style.display = 'none';
  confirmCallback = null;
}

document.getElementById('confirm-ok').addEventListener('click', () => {
  if (confirmCallback) confirmCallback();
  closeConfirm();
});
document.getElementById('confirm-cancel').addEventListener('click', closeConfirm);
document.getElementById('confirm-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('confirm-overlay')) closeConfirm();
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

// 既存のスワイプ処理をすべて削除して以下に置き換え
(function () {
  const outer = document.getElementById('grid-outer');
  let startX = 0, startY = 0;
  let currentX = 0;
  let isDragging = false;
  let isHorizontal = null;

  function getTrack() { return document.getElementById('grid-track'); }
  function getIdx() { return state.tabs.findIndex(t => t.id === state.activeTab); }
  function getBase() { return getIdx() * 100; }

  outer.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    currentX = 0;
    isDragging = true;
    isHorizontal = null;
    getTrack().classList.add('no-transition');
  }, { passive: true });

  outer.addEventListener('touchmove', e => {
    if (!isDragging) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;

    // 最初の動きで縦横を判定
    if (isHorizontal === null && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      isHorizontal = Math.abs(dx) > Math.abs(dy);
    }
    if (!isHorizontal) return;

    currentX = dx;
    const idx = getIdx();
    const tabCount = state.tabs.length;

    // 端のタブは抵抗感を持たせる
    let move = currentX;
    if ((idx === 0 && move > 0) || (idx === tabCount - 1 && move < 0)) {
      move = move * 0.2;
    }

    const pct = (move / outer.offsetWidth) * 100;
    getTrack().style.transform = `translateX(${-getBase() + pct}%)`;
  }, { passive: true });

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
    // グリッドは再レンダリングせずtransformだけ更新
  }, { passive: true });
})();

// タッチパッド二本指横スクロールでタブ切り替え
(function () {
  const outer = document.getElementById('grid-outer');
  let wheelLocked = false;

  outer.addEventListener('wheel', e => {
    // 縦スクロールは無視、横方向のみ反応
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;

    e.preventDefault();

    if (wheelLocked) return;
    wheelLocked = true;
    setTimeout(() => { wheelLocked = false; }, 600);

    const idx = state.tabs.findIndex(t => t.id === state.activeTab);

    if (e.deltaX > 0 && idx < state.tabs.length - 1) {
      state.activeTab = state.tabs[idx + 1].id;
    } else if (e.deltaX < 0 && idx > 0) {
      state.activeTab = state.tabs[idx - 1].id;
    } else {
      return;
    }

    const newIdx = state.tabs.findIndex(t => t.id === state.activeTab);
    const track = document.getElementById('grid-track');
    track.style.transform = `translateX(-${newIdx * 100}%)`;
    save();
    renderTabs();
  }, { passive: false });
})();
//
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
  });
})();
//

//マウスホイールでタブ切り替え
document.getElementById('grid-outer').addEventListener('wheel', e => {
  e.preventDefault();
  const idx = state.tabs.findIndex(t => t.id === state.activeTab);
  if (e.deltaY < 0 && idx > 0) {
    state.activeTab = state.tabs[idx - 1].id;
  } else if (e.deltaY > 0 && idx < state.tabs.length - 1) {
    state.activeTab = state.tabs[idx + 1].id;
  } else return;
  const newIdx = state.tabs.findIndex(t => t.id === state.activeTab);
  const track = document.getElementById('grid-track');
  track.style.transform = `translateX(-${newIdx * 100}%)`;
  save();
  renderTabs();
}, { passive: false });

// </script>