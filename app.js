// ============================================================
//  数据层
// ============================================================
const DB_KEY = 'memo_notes';

function loadNotes() {
    try {
        const raw = localStorage.getItem(DB_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

function saveNotes(notes) {
    localStorage.setItem(DB_KEY, JSON.stringify(notes));
}

function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function createNote(title = '', sub = '', body = '') {
    return {
        id: genId(),
        title: title || '',
        sub: sub || '',
        body: body || '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
}

// ============================================================
//  状态
// ============================================================
let notes = loadNotes();
let currentId = null;
let searchQuery = '';
let isEditing = false;

// ============================================================
//  DOM 引用
// ============================================================
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const listView = $('#listView');
const editorView = $('#editorView');
const noteList = $('#noteList');
const searchInput = $('#searchInput');
const btnNewNote = $('#btnNewNote');
const btnBack = $('#btnBack');
const btnDeleteNote = $('#btnDeleteNote');
const btnInsertImage = $('#btnInsertImage');
const btnExportImage = $('#btnExportImage');
const editorTitle = $('#editorTitle');
const editorSub = $('#editorSub');
const editorBody = $('#editorBody');
const imageInput = $('#imageInput');
const modalOverlay = $('#modalOverlay');
const modalTitle = $('#modalTitle');
const modalDesc = $('#modalDesc');
const modalConfirm = $('#modalConfirm');
const modalCancel = $('#modalCancel');
const toast = $('#toast');
const exportContainer = $('#exportContainer');
const textColorPicker = $('#textColorPicker');

let toastTimer = null;

// ============================================================
//  Toast
// ============================================================
function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
}

// ============================================================
//  工具函数
// ============================================================
function safeStr(val) {
    return val || '';
}

function escapeHtml(str) {
    if (!str && str !== 0) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function extractFirstImg(html) {
    if (!html) return null;
    const m = html.match(/<img[^>]+src="([^">]+)"/);
    return m ? m[1] : null;
}

function formatDate(ts) {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '--';
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
        return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    const isYesterday = new Date(now - 86400000).toDateString() === d.toDateString();
    if (isYesterday) return '昨天';
    if (now.getFullYear() === d.getFullYear()) {
        return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    }
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getPreview(n) {
    const body = safeStr(n.body);
    let text = body.replace(/<[^>]+>/g, ' ').trim();
    if (!text && n.sub) text = safeStr(n.sub);
    if (!text && n.title) text = safeStr(n.title);
    if (!text) return '沒有內容';
    return text.slice(0, 60) + (text.length > 60 ? '…' : '');
}

// ============================================================
//  渲染列表
// ============================================================
function renderList() {
    try {
        const q = searchQuery.trim().toLowerCase();
        let filtered = notes;
        if (q) {
            filtered = notes.filter(n =>
                safeStr(n.title).toLowerCase().includes(q) ||
                safeStr(n.sub).toLowerCase().includes(q) ||
                safeStr(n.body).toLowerCase().includes(q)
            );
        }
        filtered = [...filtered].sort((a, b) => b.updatedAt - a.updatedAt);

        if (filtered.length === 0) {
            noteList.innerHTML = `
                <div class="empty">
                    <div class="icon">📝</div>
                    ${q ? '沒有符合的備忘錄' : '還沒有備忘錄，點擊 + 新增'}
                </div>
            `;
            return;
        }

        let html = '';
        for (const n of filtered) {
            const preview = getPreview(n);
            const dateStr = formatDate(n.updatedAt);
            const hasImg = /<img[^>]+>/.test(safeStr(n.body));
            const firstImg = hasImg ? extractFirstImg(n.body) : null;
            const titleText = escapeHtml(safeStr(n.title)) || '無標題';

            html += `
                <div class="note-item" data-id="${n.id}">
                    <div class="color-dot"></div>
                    <div class="info">
                        <div class="title">${titleText}</div>
                        <div class="preview">${escapeHtml(preview)}</div>
                        <div class="meta">
                            <span class="date">${dateStr}</span>
                            ${hasImg ? '<span>🖼️</span>' : ''}
                        </div>
                    </div>
                    ${firstImg ? `<div class="thumb"><img src="${firstImg}" alt="thumbnail" loading="lazy" /></div>` : ''}
                </div>
            `;
        }
        noteList.innerHTML = html;

        noteList.querySelectorAll('.note-item').forEach(el => {
            el.addEventListener('click', () => {
                const id = el.dataset.id;
                if (id) openNote(id);
            });
        });
    } catch (e) {
        console.error('渲染列表失败:', e);
        noteList.innerHTML = `<div class="empty"><div class="icon">⚠️</div>渲染出错，请刷新页面</div>`;
    }
}

// ============================================================
//  编辑器操作
// ============================================================
function openNote(id) {
    try {
        const note = notes.find(n => n.id === id);
        if (!note) return;
        currentId = id;
        editorTitle.value = safeStr(note.title);
        editorSub.value = safeStr(note.sub);
        editorBody.innerHTML = safeStr(note.body);
        isEditing = true;
        switchView('editor');
        updateToolbarState();
        setTimeout(() => editorBody.focus(), 100);
    } catch (e) {
        console.error('打开笔记失败:', e);
        showToast('打开失败，请重试');
    }
}

function saveCurrentNote() {
    if (!currentId) return;
    try {
        const note = notes.find(n => n.id === currentId);
        if (!note) return;
        note.title = editorTitle.value.trim();
        note.sub = editorSub.value.trim();
        note.body = editorBody.innerHTML.trim() || '';
        note.updatedAt = Date.now();
        saveNotes(notes);
        renderList();
    } catch (e) {
        console.warn('自动保存失败:', e);
    }
}

function autoSave() {
    if (isEditing && currentId) {
        saveCurrentNote();
    }
}

// 输入自动保存
editorTitle.addEventListener('input', autoSave);
editorSub.addEventListener('input', autoSave);
editorBody.addEventListener('input', autoSave);

// ============================================================
//  视图切换（带滑动动画）
// ============================================================
function switchView(view) {
    try {
        if (view === 'list') {
            listView.classList.add('active');
            editorView.classList.remove('active');
            editorView.classList.remove('slide-in');
            void editorView.offsetWidth;
            editorView.classList.add('slide-in');
            if (isEditing) {
                autoSave();
                isEditing = false;
                currentId = null;
            }
            renderList();
        } else {
            listView.classList.remove('active');
            editorView.classList.add('active');
            editorView.classList.remove('slide-in');
            void editorView.offsetWidth;
            editorView.classList.add('slide-in');
        }
    } catch (e) {
        console.error('视图切换失败:', e);
    }
}

// ============================================================
//  导航事件
// ============================================================
btnBack.addEventListener('click', () => switchView('list'));

btnNewNote.addEventListener('click', () => {
    try {
        const note = createNote('', '', '');
        notes.push(note);
        saveNotes(notes);
        renderList();
        openNote(note.id);
    } catch (e) {
        console.error('新增失败:', e);
        showToast('新增失敗，請查看控制台');
    }
});

btnDeleteNote.addEventListener('click', () => {
    if (!currentId) return;
    if (confirm('確定要刪除這篇備忘錄嗎？')) {
        notes = notes.filter(n => n.id !== currentId);
        saveNotes(notes);
        renderList();
        switchView('list');
        showToast('已刪除');
    }
});

// ============================================================
//  搜索
// ============================================================
searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderList();
});

// ============================================================
//  插入图片
// ============================================================
btnInsertImage.addEventListener('click', () => imageInput.click());

imageInput.addEventListener('change', (e) => {
    const files = e.target.files;
    if (!files.length) return;
    for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        const reader = new FileReader();
        reader.onload = (ev) => {
            insertImageAtCursor(ev.target.result);
            autoSave();
        };
        reader.readAsDataURL(file);
    }
    imageInput.value = '';
});

function insertImageAtCursor(dataUrl) {
    const sel = window.getSelection();
    let range;
    if (sel.rangeCount > 0) {
        range = sel.getRangeAt(0);
    } else {
        range = document.createRange();
        range.setStart(editorBody, 0);
        range.collapse(true);
    }
    const img = document.createElement('img');
    img.src = dataUrl;
    img.alt = '圖片';
    img.style.maxWidth = '100%';
    img.style.borderRadius = '10px';
    img.style.margin = '8px 0';
    range.insertNode(img);
    range.setStartAfter(img);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    editorBody.dispatchEvent(new Event('input'));
}

// ============================================================
//  格式工具栏
// ============================================================
function updateToolbarState() {
    try {
        document.querySelectorAll('[data-cmd]').forEach(btn => {
            const cmd = btn.dataset.cmd;
            let active = false;
            if (cmd === 'bold') active = document.queryCommandState('bold');
            else if (cmd === 'italic') active = document.queryCommandState('italic');
            else if (cmd === 'underline') active = document.queryCommandState('underline');
            else if (cmd === 'strikeThrough') active = document.queryCommandState('strikeThrough');
            else if (cmd === 'insertUnorderedList') active = document.queryCommandState('insertUnorderedList');
            else if (cmd === 'insertOrderedList') active = document.queryCommandState('insertOrderedList');
            else if (cmd === 'formatBlock') {
                const val = btn.dataset.value;
                const block = document.queryCommandValue('formatBlock') || '';
                active = block.toLowerCase() === val.toLowerCase();
            }
            btn.classList.toggle('active', !!active);
        });
    } catch (e) { /* ignore */ }
}

document.querySelectorAll('[data-cmd]').forEach(btn => {
    btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const cmd = btn.dataset.cmd;
        const val = btn.dataset.value || null;
        try {
            if (cmd === 'formatBlock') {
                document.execCommand('formatBlock', false, val);
            } else if (cmd === 'removeFormat') {
                document.execCommand('removeFormat', false, null);
            } else {
                document.execCommand(cmd, false, val);
            }
        } catch (ex) { /* ignore */ }
        editorBody.focus();
        updateToolbarState();
        autoSave();
    });
});

textColorPicker.addEventListener('input', (e) => {
    document.execCommand('foreColor', false, e.target.value);
    editorBody.focus();
    autoSave();
});

document.addEventListener('selectionchange', () => {
    if (isEditing) updateToolbarState();
});

editorBody.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        let cmd = null;
        if (e.key === 'b') cmd = 'bold';
        else if (e.key === 'i') cmd = 'italic';
        else if (e.key === 'u') cmd = 'underline';
        if (cmd) {
            e.preventDefault();
            document.execCommand(cmd, false, null);
            updateToolbarState();
            autoSave();
        }
    }
});

// ============================================================
//  导出长图
// ============================================================
btnExportImage.addEventListener('click', () => {
    if (!currentId) return;
    const note = notes.find(n => n.id === currentId);
    if (!note) return;
    if (!note.title && !note.sub && !note.body) {
        showToast('備忘錄是空的，無法匯出');
        return;
    }
    modalTitle.textContent = '匯出長圖';
    modalDesc.textContent = '將這篇備忘錄匯出為一張長圖，分享或儲存。';
    modalConfirm.textContent = '匯出';
    modalConfirm.disabled = false;
    modalOverlay.classList.add('active');
    modalConfirm._note = note;
});

modalCancel.addEventListener('click', () => modalOverlay.classList.remove('active'));
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) modalOverlay.classList.remove('active');
});

modalConfirm.addEventListener('click', async () => {
    const note = modalConfirm._note;
    if (!note) return;
    modalConfirm.disabled = true;
    modalConfirm.textContent = '生成中…';

    try {
        const container = exportContainer;
        container.innerHTML = '';

        const titleDiv = document.createElement('div');
        titleDiv.className = 'export-title';
        titleDiv.textContent = safeStr(note.title) || '無標題';
        container.appendChild(titleDiv);

        if (note.sub) {
            const subDiv = document.createElement('div');
            subDiv.className = 'export-sub';
            subDiv.textContent = safeStr(note.sub);
            container.appendChild(subDiv);
        }

        const bodyDiv = document.createElement('div');
        bodyDiv.className = 'export-body';
        bodyDiv.innerHTML = safeStr(note.body) || '<p style="color:#8e8e93;">（沒有內容）</p>';
        container.appendChild(bodyDiv);

        const footer = document.createElement('div');
        footer.className = 'export-footer';
        footer.textContent = `備忘錄 · ${new Date(note.updatedAt).toLocaleString('zh-CN')}`;
        container.appendChild(footer);

        const canvas = await html2canvas(container, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            width: 420,
        });

        const link = document.createElement('a');
        link.download = `備忘錄_${safeStr(note.title) || '無標題'}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        showToast('匯出成功！');
        modalOverlay.classList.remove('active');
    } catch (err) {
        console.error(err);
        showToast('匯出失敗，請重試');
        modalOverlay.classList.remove('active');
    } finally {
        modalConfirm.disabled = false;
        modalConfirm.textContent = '匯出';
    }
});

// ============================================================
//  键盘快捷键
// ============================================================
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (isEditing) {
            autoSave();
            showToast('已儲存');
        }
    }
    if (e.key === 'Escape') {
        if (modalOverlay.classList.contains('active')) {
            modalOverlay.classList.remove('active');
        } else if (isEditing) {
            switchView('list');
        }
    }
});

// ============================================================
//  粘贴图片
// ============================================================
editorBody.addEventListener('paste', (e) => {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (const item of items) {
        if (item.type.startsWith('image/')) {
            e.preventDefault();
            const file = item.getAsFile();
            const reader = new FileReader();
            reader.onload = (ev) => {
                insertImageAtCursor(ev.target.result);
                autoSave();
            };
            reader.readAsDataURL(file);
            break;
        }
    }
});

// ============================================================
//  初始化
// ============================================================
renderList();

if (notes.length === 0) {
    const welcome = createNote(
        '歡迎使用備忘錄',
        '開始記錄你的想法',
        '<p>這是一個功能完整的 PWA 備忘錄。</p><p>✨ 支援 <strong>粗體</strong>、<em>斜體</em>、<u>底線</u></p><p>📷 可插入圖片</p><p>🖼️ 可匯出長圖</p><p style="color:#8e8e93;">試試看吧！</p>'
    );
    notes.push(welcome);
    saveNotes(notes);
    renderList();
}

// 定时自动保存
setInterval(() => {
    if (isEditing) autoSave();
}, 3000);

window.addEventListener('beforeunload', () => {
    if (isEditing) autoSave();
});

console.log('📝 备忘录 PWA (iOS 风格) 已启动');
console.log(`📄 共 ${notes.length} 篇备忘录`);