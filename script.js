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

const DB_NAME = 'meiwoGachaDB';
const CASE_STORE = 'caseImages';

let cards = [];
let currentSlotIndex = null;
let hasDrawnThisLoad = false;
let currentCard = null;

const RARITY_LABEL = {
  common: '普通',
  rare: '稀有',
  legendary: '傳說'
};

// ---------- IndexedDB（收藏相片） ----------
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
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

// ---------- 卡池 ----------
async function loadCards() {
  const res = await fetch('cards.json');
  cards = await res.json();
}

// ---------- 抽卡頁 ----------
function renderCard(card) {
  const imgHtml = card.image
    ? `<img src="${card.image}" alt="${card.name}" crossorigin="anonymous" onerror="this.parentElement.innerHTML='<span class=\\'placeholder\\'>${card.emoji || '🍺'}</span>'">`
    : `<span class="placeholder" style="font-size: 5rem;">${card.emoji || '🍺'}</span>`;

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

// ---------- 抽卡（每次載入一次） ----------
function drawCard() {
  if (hasDrawnThisLoad) {
    hint.textContent = '每人限抽一張，多謝支持梅窩好老土！';
    return;
  }

  const card = cards[Math.floor(Math.random() * cards.length)];
  currentCard = card;
  renderCard(card);
  hasDrawnThisLoad = true;

  drawBtn.disabled = true;
  drawBtn.textContent = '已抽卡';
  hint.textContent = '每人限抽一張，想再抽請再掃 QR code。';
}

// ---------- 下載卡片（保證原封不動） ----------
saveBtn.addEventListener('click', async () => {
  if (!currentCard) return;

  if (!currentCard.image) {
    hint.textContent = '呢張卡冇圖片可以下載。';
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = '下載中…';

  try {
    const response = await fetch(currentCard.image);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    
    const extension = currentCard.image.split('.').pop() || 'jpg';
    // 刪走「原相」字眼，直接用卡名同時間做檔案名
    const fileName = `${currentCard.name}-${Date.now()}.${extension}`;

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);

    saveBtn.textContent = '已下載！';
    hint.textContent = '卡片已下載，去相簿睇吓啦。';

    setTimeout(() => {
      saveBtn.disabled = false;
      saveBtn.textContent = '下載卡片'; // 改做下載卡片
    }, 3000);
  } catch (error) {
    console.error('下載失敗:', error);
    const link = document.createElement('a');
    link.href = currentCard.image;
    link.download = `${currentCard.name}-${Date.now()}.jpg`; // 後備方案都刪走原相字眼
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    saveBtn.disabled = false;
    saveBtn.textContent = '下載卡片'; // 改做下載卡片
    hint.textContent = '已嘗試開啟圖片，請長按圖片儲存。';
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

  hasDrawnThisLoad = false;
  drawBtn.disabled = false;
  drawBtn.textContent = '抽卡';
}

drawBtn.addEventListener('click', () => {
  if (cards.length) drawCard();
});

init();
