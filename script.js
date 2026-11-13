const introScreen = document.getElementById('intro-screen');
const gachaScreen = document.getElementById('gacha-screen');
const collectionScreen = document.getElementById('collection-screen');

const startBtn = document.getElementById('start-btn');
const collectionBtn = document.getElementById('collection-btn');
const backBtn = document.getElementById('back-btn');

const cardArea = document.getElementById('card-area');
const displayCase = document.getElementById('display-case');
const uploadInput = document.getElementById('upload-input');

const drawBtn = document.getElementById('draw-btn');
const saveBtn = document.getElementById('save-btn');
const hint = document.getElementById('hint');

const STORAGE_KEY = 'meiwo_beer_card_id';
const COOKIE_KEY = 'meiwo_beer_drawn';
const DB_NAME = 'meiwoGachaDB';
const DB_STORE = 'draws';
const CASE_STORE = 'caseImages';

let cards = [];
let currentSlotIndex = null;

const RARITY_LABEL = {
  common: '普通',
  rare: '稀有',
  legendary: '傳說'
};

// ---------- Cookie ----------
function setCookie(name, value, days = 3650) {
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${d.toUTCString()};path=/;SameSite=Lax`;
}
function getCookie(name) {
  const m = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[2]) : null;
}

// ---------- IndexedDB ----------
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE);
      }
      if (!db.objectStoreNames.contains(CASE_STORE)) {
        db.createObjectStore(CASE_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(store, key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet(store, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGetAllKeys(store) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAllKeys();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(store, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---------- 已抽記錄 ----------
async function getDrawnId() {
  const ls = localStorage.getItem(STORAGE_KEY);
  if (ls) return ls;
  const ck = getCookie(COOKIE_KEY);
  if (ck) return ck;
  try {
    const idb = await idbGet(DB_STORE, STORAGE_KEY);
    if (idb) return idb;
  } catch (e) {}
  return null;
}

async function saveDrawnId(id) {
  localStorage.setItem(STORAGE_KEY, id);
  setCookie(COOKIE_KEY, id);
  try { await idbSet(DB_STORE, STORAGE_KEY, id); } catch (e) {}
}

// ---------- 卡池 ----------
async function loadCards() {
  const res = await fetch('cards.json');
  cards = await res.json();
}

// ---------- 抽卡頁 ----------
function renderCard(card) {
  const imgHtml = card.image
    ? `<img src="${card.image}" alt="${card.name}" onerror="this.parentElement.innerHTML='<span class=\\'placeholder\\'>${card.emoji || '🍺'}</span>'">`
    : `<span class="placeholder">${card.emoji || '🍺'}</span>`;

  cardArea.innerHTML = `
    <div class="card card-front rarity-${card.rarity}" id="card-to-save">
      <div class="card-img-wrap">${imgHtml}</div>
      <div class="card-name">${card.name}</div>
      <div class="card-desc">${card.text}</div>
      <span class="card-rarity">${RARITY_LABEL[card.rarity] || '普通'}</span>
    </div>
  `;

  saveBtn.hidden = false;
}

function lockDraw() {
  drawBtn.disabled = true;
  drawBtn.textContent = '你已抽過卡';
  hint.textContent = '每部裝置限抽一張，多謝支持梅窩好老土爽皮啤酒！';
}

async function drawCard() {
  const already = await getDrawnId();
  if (already) {
    const card = cards.find(c => c.id === already);
    if (card) renderCard(card);
    lockDraw();
    return;
  }

  const card = cards[Math.floor(Math.random() * cards.length)];
  await saveDrawnId(card.id);
  renderCard(card);
  lockDraw();
}

// ---------- 儲存卡面 ----------
saveBtn.addEventListener('click', async () => {
  const cardEl = document.getElementById('card-to-save');
  if (!cardEl) return;

  saveBtn.disabled = true;
  saveBtn.textContent = '儲存中…';

  try {
    const images = cardEl.querySelectorAll('img');
    await Promise.all(
      [...images].map(img =>
        img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })
      )
    );

    const canvas = await html2canvas(cardEl, { scale: 3, backgroundColor: '#f5efe2', useCORS: true });
    const dataUrl = canvas.toDataURL('image/png');
    const fileName = `梅窩好老土-${Date.now()}.png`;

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    saveBtn.textContent = '已儲存！';
    hint.textContent = '卡面已儲存，去相簿睇吓啦。';

    setTimeout(() => {
      saveBtn.disabled = false;
      saveBtn.textContent = '儲存卡面';
    }, 3000);
  } catch (e) {
    console.error(e);
    saveBtn.disabled = false;
    saveBtn.textContent = '儲存卡面';
    hint.textContent = '儲存失敗，可以長按卡面試吓手動儲存。';
  }
});

// ---------- 展示櫃 ----------
function addSlotToCase(container, index, dataUrl) {
  const slot = document.createElement('div');
  slot.className = 'case-slot' + (dataUrl ? '' : ' empty');
  slot.dataset.index = index;

  if (dataUrl) {
    slot.innerHTML = `
      <img src="${dataUrl}" alt="收藏相片" />
      <button class="delete-btn" title="刪除">✕</button>
    `;
    slot.querySelector('.delete-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      await idbDelete(CASE_STORE, index);
      await renderDisplayCase();
    });
  } else {
    slot.innerHTML = `
      <span class="plus-icon">＋</span>
      <span class="slot-text">上傳相片<br />放入展示櫃</span>
    `;
    slot.addEventListener('click', () => {
      currentSlotIndex = index;
      uploadInput.click();
    });
  }

  container.appendChild(slot);
}

async function renderDisplayCase() {
  displayCase.innerHTML = '';

  const keys = (await idbGetAllKeys(CASE_STORE)) || [];
  keys.sort((a, b) => a - b);

  if (keys.length === 0) {
    addSlotToCase(displayCase, 0, null);
  } else {
    for (const key of keys) {
      const data = await idbGet(CASE_STORE, key);
      addSlotToCase(displayCase, key, data);
    }
  }

  const addBtn = document.createElement('button');
  addBtn.className = 'add-slot-btn';
  addBtn.textContent = '＋ 新增一格';
  addBtn.addEventListener('click', async () => {
    const allKeys = (await idbGetAllKeys(CASE_STORE)) || [];
    const nextKey = allKeys.length ? Math.max(...allKeys) + 1 : 0;
    await idbSet(CASE_STORE, nextKey, null);
    await renderDisplayCase();
  });
  displayCase.appendChild(addBtn);
}

// ---------- 上傳相片 ----------
uploadInput.addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file || currentSlotIndex === null) return;

  const reader = new FileReader();
  reader.onload = async () => {
    const dataUrl = reader.result;
    await idbSet(CASE_STORE, currentSlotIndex, dataUrl);
    currentSlotIndex = null;
    uploadInput.value = '';
    await renderDisplayCase();
  };
  reader.readAsDataURL(file);
});

// ---------- 螢幕切換 ----------
function showScreen(screen) {
  introScreen.classList.add('hidden');
  gachaScreen.classList.add('hidden');
  collectionScreen.classList.add('hidden');
  screen.classList.remove('hidden');
}

startBtn.addEventListener('click', () => {
  showScreen(gachaScreen);
});

collectionBtn.addEventListener('click', async () => {
  await renderDisplayCase();
  showScreen(collectionScreen);
});

backBtn.addEventListener('click', () => {
  showScreen(introScreen);
});

// ---------- 初始化 ----------
async function init() {
  try {
    await loadCards();
  } catch (e) {
    hint.textContent = '卡池載入失敗，請重新整理。';
    return;
  }

  if (!cards.length) {
    hint.textContent = '卡池暫時未有卡。';
    return;
  }

  const drawnId = await getDrawnId();
  if (drawnId) {
    const card = cards.find(c => c.id === drawnId);
    if (card) {
      renderCard(card);
      lockDraw();
      return;
    }
  }

  drawBtn.disabled = false;
}

drawBtn.addEventListener('click', () => {
  if (cards.length) drawCard();
});

init();