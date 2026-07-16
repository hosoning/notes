// --- 狀態與變數 ---
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

// 彈出底欄
const overlay = document.getElementById('overlay');
const formatSheet = document.getElementById('format-sheet');
const moreSheet = document.getElementById('more-sheet');
const shareSheet = document.getElementById('share-sheet');

function init() {
  renderNotesList();
  setupEventListeners();
}

function saveNotesToStorage() {
  localStorage.setItem('notes', JSON.stringify(notes));
  renderNotesList();
}

// 格式化日期為截圖樣式 (e.g. "16 July 2026 at 17:13")
function formatDate(timestamp) {
  const date = new Date(timestamp);
  const day = date.getDate();
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year} at ${hours}:${minutes}`;
}

// 渲染列表
function renderNotesList(filterText = '') {
  notesList.innerHTML = '';
  const sortedNotes = [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
  const filtered = sortedNotes.filter(note => {
    const text = (note.title + ' ' + note.content).toLowerCase();
    return text.includes(filterText.toLowerCase());
  });

  noteCount.textContent = `${filtered.length} 個備忘錄`;

  if (filtered.length === 0) {
    notesList.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-muted);">沒有備忘錄</div>`;
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
        <span style="color: #8e8e93;">${note.content.substring(0, 30) || '無額外文字'}</span>
      </div>
    `;
    notesList.appendChild(item);
  });
}

// 開啟備忘錄
function openNote(id) {
  const note = notes.find(n => n.id === id);
  if (!note) return;
  activeNoteId = id;

  editor.innerHTML = note.htmlContent || `<div>${note.content}</div>`;
  noteTimestamp.textContent = formatDate(note.updatedAt);

  listView.classList.add('inactive');
  editorView.classList.add('active');
}

// 返回
function backToList() {
  saveCurrentNote();
  listView.classList.remove('inactive');
  editorView.classList.remove('active');
  activeNoteId = null;
}

// 新增備忘錄
function createNewNote() {
  const newId = Date.now().toString();
  const newNote = {
    id: newId,
    title: '新備忘錄',
    content: '',
    htmlContent: '<div><br></div>',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  notes.unshift(newNote);
  saveNotesToStorage();
  openNote(newId);
  editor.focus();
}

// 實時保存
function saveCurrentNote() {
  if (!activeNoteId) return;
  const noteIndex = notes.findIndex(n => n.id === activeNoteId);
  if (noteIndex === -1) return;

  const htmlContent = editor.innerHTML;
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;
  const textContent = tempDiv.textContent || tempDiv.innerText || "";
  
  const lines = textContent.trim().split('\n');
  const title = lines[0] ? lines[0].substring(0, 30) : '新備忘錄';

  notes[noteIndex].title = title;
  notes[noteIndex].content = textContent;
  notes[noteIndex].htmlContent = htmlContent;
  notes[noteIndex].updatedAt = Date.now();

  saveNotesToStorage();
}

// 刪除
function deleteActiveNote() {
  if (!activeNoteId) return;
  notes = notes.filter(n => n.id !== activeNoteId);
  saveNotesToStorage();
  closeAllSheets();
  backToList();
}

// 格式化命令
function executeFormat(command, value = null) {
  document.execCommand(command, false, value);
  editor.focus();
}

// --- 分享與導出長圖 ---
function exportAsLongImage() {
  const container = document.getElementById('note-editor-container');
  
  // 建立複製容器（消除滾動條，獲得完整長度）
  const clone = container.cloneNode(true);
  clone.style.width = '390px'; // 精準還原 iPhone 寬度
  clone.style.position = 'fixed';
  clone.style.top = '-9999px';
  clone.style.left = '-9999px';
  clone.style.background = '#ffffff';
  clone.style.color = '#000000';
  clone.style.height = 'auto';
  clone.style.padding = '35px 25px';
  
  // 修正複製件的內距
  clone.style.paddingTop = '30px';
  clone.style.paddingBottom = '30px';

  document.body.appendChild(clone);

  setTimeout(() => {
    html2canvas(clone, {
      useCORS: true,
      scale: 2, // 視網膜畫質
      backgroundColor: '#ffffff'
    }).then(canvas => {
      const link = document.createElement('a');
      link.download = `備忘錄長圖_${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      document.body.removeChild(clone);
      closeAllSheets();
    });
  }, 300);
}

// 數據管理 (JSON)
function exportData() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(notes));
  const dlAnchorElem = document.createElement('a');
  dlAnchorElem.setAttribute("href", dataStr);
  dlAnchorElem.setAttribute("download", `iCloud_Notes_Backup_${Date.now()}.json`);
  dlAnchorElem.click();
  closeAllSheets();
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(event) {
    try {
      const imported = JSON.parse(event.target.result);
      if (Array.isArray(imported)) {
        notes = imported;
        saveNotesToStorage();
        alert('備忘錄導入成功！');
      }
    } catch (err) {
      alert('無效的備份檔案。');
    }
    closeAllSheets();
  };
  reader.readAsText(file);
}

// 彈出層開關
function openSheet(sheet) {
  overlay.classList.add('active');
  sheet.classList.add('open');
}

function closeAllSheets() {
  overlay.classList.remove('active');
  formatSheet.classList.remove('open');
  moreSheet.classList.remove('open');
  shareSheet.classList.remove('open');
}

// --- 事件處理 ---
function setupEventListeners() {
  document.getElementById('new-note-btn').addEventListener('click', createNewNote);
  document.getElementById('back-to-list').addEventListener('click', backToList);
  document.getElementById('delete-note-btn').addEventListener('click', deleteActiveNote);
  
  // 編輯器內的快捷鍵：新建
  document.getElementById('new-note-from-editor-btn').addEventListener('click', () => {
    saveCurrentNote();
    createNewNote();
  });

  editor.addEventListener('input', saveCurrentNote);
  searchInput.addEventListener('input', (e) => renderNotesList(e.target.value));

  // 彈出底欄設定
  document.getElementById('format-btn').addEventListener('click', () => openSheet(formatSheet));
  document.getElementById('more-btn').addEventListener('click', () => openSheet(moreSheet));
  document.getElementById('share-btn').addEventListener('click', () => openSheet(shareSheet));
  
  overlay.addEventListener('click', closeAllSheets);
  document.getElementById('close-format').addEventListener('click', closeAllSheets);
  document.getElementById('close-more').addEventListener('click', closeAllSheets);
  document.getElementById('close-share').addEventListener('click', closeAllSheets);

  // 格式按鈕
  document.querySelectorAll('.format-style-btn').forEach(btn => {
    btn.addEventListener('click', () => executeFormat(btn.dataset.command, btn.dataset.value));
  });
  document.querySelectorAll('.format-inline-btn').forEach(btn => {
    btn.addEventListener('click', () => executeFormat(btn.dataset.command));
  });

  // 拍照 / 圖片上傳
  const imgLoader = document.getElementById('image-loader');
  document.getElementById('insert-img-btn').addEventListener('click', () => imgLoader.click());
  imgLoader.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        executeFormat('insertHTML', `<img src="${event.target.result}" alt="image"><br>`);
      };
      reader.readAsDataURL(file);
    }
  });

  // 長圖與導入出
  document.getElementById('export-long-img-btn').addEventListener('click', exportAsLongImage);
  document.getElementById('export-data-btn').addEventListener('click', exportData);
  
  const fileInput = document.getElementById('import-file-input');
  document.getElementById('trigger-import-btn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', importData);
}

init();
