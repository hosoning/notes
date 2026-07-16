// --- 狀態管理與變數初始化 ---
let notes = JSON.parse(localStorage.getItem('notes')) || [];
let activeNoteId = null;

// DOM 元素
const listView = document.getElementById('list-view');
const editorView = document.getElementById('editor-view');
const notesList = document.getElementById('notes-list');
const noteCount = document.getElementById('note-count');
const editor = document.getElementById('editor');
const noteTimestamp = document.getElementById('note-timestamp');
const searchInput = document.getElementById('search-input');

// 彈出層
const overlay = document.getElementById('overlay');
const formatSheet = document.getElementById('format-sheet');
const settingsSheet = document.getElementById('settings-sheet');
const shareSheet = document.getElementById('share-sheet');

// --- 核心初始化與渲染 ---
function init() {
  renderNotesList();
  setupEventListeners();
}

function saveNotesToStorage() {
  localStorage.setItem('notes', JSON.stringify(notes));
  renderNotesList();
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  return date.toLocaleDateString('zh-TW', options);
}

// 渲染清單
function renderNotesList(filterText = '') {
  notesList.innerHTML = '';
  
  // 按照最後修改時間排序
  const sortedNotes = [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
  const filtered = sortedNotes.filter(note => {
    const text = (note.title + ' ' + note.content).toLowerCase();
    return text.includes(filterText.toLowerCase());
  });

  noteCount.textContent = `${filtered.length} 個備忘錄`;

  if (filtered.length === 0) {
    notesList.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-secondary);">沒有備忘錄</div>`;
    return;
  }

  filtered.forEach(note => {
    const item = document.createElement('div');
    item.className = 'ios-list-item';
    item.addEventListener('click', () => openNote(note.id));

    const dateStr = new Date(note.updatedAt).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });
    
    item.innerHTML = `
      <div class="item-title">${note.title || '新備忘錄'}</div>
      <div class="item-meta">
        <span>${dateStr}</span>
        <span class="item-desc">${note.content.substring(0, 40) || '沒有其他文字'}</span>
      </div>
    `;
    notesList.appendChild(item);
  });
}

// --- 視圖控制與編輯 ---
function openNote(id) {
  const note = notes.find(n => n.id === id);
  if (!note) return;
  activeNoteId = id;

  editor.innerHTML = note.htmlContent || note.content;
  noteTimestamp.textContent = formatDate(note.updatedAt);

  // iOS 滑動切換動畫
  listView.classList.add('inactive');
  listView.classList.remove('active');
  editorView.classList.add('active');
}

function backToList() {
  saveCurrentNote();
  listView.classList.add('active');
  listView.classList.remove('inactive');
  editorView.classList.remove('active');
  activeNoteId = null;
}

function createNewNote() {
  const newNote = {
    id: Date.now().toString(),
    title: '新備忘錄',
    content: '',
    htmlContent: '<div><br></div>',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  notes.unshift(newNote);
  saveNotesToStorage();
  openNote(newNote.id);
  editor.focus();
}

function saveCurrentNote() {
  if (!activeNoteId) return;
  const noteIndex = notes.findIndex(n => n.id === activeNoteId);
  if (noteIndex === -1) return;

  const htmlContent = editor.innerHTML;
  
  // 取得純文字用於縮圖標題與預覽
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;
  const textContent = tempDiv.textContent || tempDiv.innerText || "";
  
  // 將第一行設為標題
  const lines = textContent.trim().split('\n');
  const title = lines[0] ? lines[0].substring(0, 30) : '新備忘錄';

  notes[noteIndex].title = title;
  notes[noteIndex].content = textContent;
  notes[noteIndex].htmlContent = htmlContent;
  notes[noteIndex].updatedAt = Date.now();

  saveNotesToStorage();
}

function deleteActiveNote() {
  if (!activeNoteId) return;
  notes = notes.filter(n => n.id !== activeNoteId);
  saveNotesToStorage();
  backToList();
}

// --- iOS 樣式格式化功能 ---
function executeFormat(command, value = null) {
  document.execCommand(command, false, value);
  editor.focus();
}

// --- 長圖導出功能 ---
function exportAsLongImage() {
  const container = document.getElementById('note-editor-container');
  
  // 建立一個臨時白底容器，以確保導出的圖片乾淨美觀
  const clone = container.cloneNode(true);
  clone.style.width = '390px'; // 模擬 iPhone 寬度
  clone.style.position = 'fixed';
  clone.style.top = '-9999px';
  clone.style.left = '-9999px';
  clone.style.background = '#ffffff'; // 高質感白底
  clone.style.color = '#000000';      // 黑字
  clone.style.height = 'auto';
  clone.style.padding = '30px';
  
  // 調整克隆內部文字顏色以配適白底
  const noteDate = clone.querySelector('.note-date');
  if (noteDate) noteDate.style.color = '#8e8e93';
  const textEditor = clone.querySelector('#editor');
  if (textEditor) {
    textEditor.style.color = '#000000';
    textEditor.style.caretColor = '#ff9f0a';
  }

  document.body.appendChild(clone);

  // 等待圖片載入完畢再進行繪製
  setTimeout(() => {
    html2canvas(clone, {
      useCORS: true,
      scale: 2, // 提高解析度（視網膜級別）
      backgroundColor: '#ffffff'
    }).then(canvas => {
      const link = document.createElement('a');
      link.download = `備忘錄_${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      document.body.removeChild(clone);
      closeAllSheets();
    });
  }, 300);
}

// --- 數據導入與導出 (JSON 備份) ---
function exportData() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(notes));
  const dlAnchorElem = document.createElement('a');
  dlAnchorElem.setAttribute("href", dataStr);
  dlAnchorElem.setAttribute("download", `iOS_Notes_Backup_${Date.now()}.json`);
  dlAnchorElem.click();
  closeAllSheets();
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    try {
      const importedNotes = JSON.parse(event.target.result);
      if (Array.isArray(importedNotes)) {
        notes = importedNotes;
        saveNotesToStorage();
        alert('備忘錄數據導入成功！');
      } else {
        alert('無效的數據格式！');
      }
    } catch (err) {
      alert('讀取檔案失敗！');
    }
    closeAllSheets();
  };
  reader.readAsText(file);
}

// --- 彈出層操作 (Bottom Sheets) ---
function openSheet(sheet) {
  overlay.classList.add('active');
  sheet.classList.add('open');
}

function closeAllSheets() {
  overlay.classList.remove('active');
  formatSheet.classList.remove('open');
  settingsSheet.classList.remove('open');
  shareSheet.classList.remove('open');
}

// --- 事件綁定 ---
function setupEventListeners() {
  // 路由與主流程
  document.getElementById('new-note-btn').addEventListener('click', createNewNote);
  document.getElementById('back-to-list').addEventListener('click', backToList);
  document.getElementById('delete-note-btn').addEventListener('click', deleteActiveNote);
  
  // 即時保存
  editor.addEventListener('input', saveCurrentNote);

  // 搜尋功能
  searchInput.addEventListener('input', (e) => {
    renderNotesList(e.target.value);
  });

  // 底欄觸發器
  document.getElementById('format-btn').addEventListener('click', () => openSheet(formatSheet));
  document.getElementById('import-export-btn').addEventListener('click', () => openSheet(settingsSheet));
  document.getElementById('share-btn').addEventListener('click', () => openSheet(shareSheet));
  
  overlay.addEventListener('click', closeAllSheets);
  document.getElementById('close-format').addEventListener('click', closeAllSheets);
  document.getElementById('close-settings').addEventListener('click', closeAllSheets);
  document.getElementById('close-share').addEventListener('click', closeAllSheets);

  // 格式化指令
  document.querySelectorAll('.format-style-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      executeFormat(btn.dataset.command, btn.dataset.value);
    });
  });
  document.querySelectorAll('.format-inline-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      executeFormat(btn.dataset.command);
    });
  });

  // 插入圖片
  const imgBtn = document.getElementById('insert-img-btn');
  const imgLoader = document.getElementById('image-loader');
  imgBtn.addEventListener('click', () => imgLoader.click());
  imgLoader.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(event) {
        const imgHtml = `<img src="${event.target.result}" alt="image"><br>`;
        executeFormat('insertHTML', imgHtml);
      };
      reader.readAsDataURL(file);
    }
  });

  // 數據與導出長圖
  document.getElementById('export-long-img-btn').addEventListener('click', exportAsLongImage);
  document.getElementById('export-data-btn').addEventListener('click', exportData);
  
  const triggerImport = document.getElementById('trigger-import-btn');
  const fileInput = document.getElementById('import-file-input');
  triggerImport.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', importData);
}

// 運行應用
init();
