import { saveOverride } from '../storage.js';
import { showToast } from './toast.js';

export function openDrawer(type, row, onSave) {
    let drawerOverlay = document.getElementById('drawer-overlay');

    // Create drawer if not exists
    if (!drawerOverlay) {
        drawerOverlay = document.createElement('div');
        drawerOverlay.id = 'drawer-overlay';
        drawerOverlay.className = 'drawer-overlay';
        drawerOverlay.innerHTML = `
            <div class="drawer">
                <div class="drawer-header">
                    <h2 id="drawer-title">Detay</h2>
                    <button class="btn-icon" id="drawer-close">✕</button>
                </div>
                <div class="drawer-body" id="drawer-content"></div>
                <div class="drawer-footer">
                    <button class="btn btn-outline" id="drawer-cancel">İptal</button>
                    <button class="btn btn-primary" id="drawer-save">Kaydet</button>
                </div>
            </div>
        `;
        document.body.appendChild(drawerOverlay);

        // Bind global events
        document.getElementById('drawer-close').onclick = closeDrawer;
        document.getElementById('drawer-cancel').onclick = closeDrawer;

        // Close on click outside
        drawerOverlay.addEventListener('click', (e) => {
            if (e.target === drawerOverlay) closeDrawer();
        });
    }

    const content = document.getElementById('drawer-content');
    const saveBtn = document.getElementById('drawer-save');
    const title = document.getElementById('drawer-title');

    // Populate Content
    title.textContent = row.full_name || 'Personel Detayı';

    if (type === 'inventory') {
        content.innerHTML = renderInventoryForm(row);
    } else {
        content.innerHTML = renderProcessForm(row);
    }

    // Show
    drawerOverlay.classList.add('open');

    // Save Handler uses closure to capture current row/type
    saveBtn.onclick = () => {
        const formData = getFormData(type);
        // Optimistic Save
        saveOverride(type, row._id, formData);
        showToast('Değişiklikler kaydedildi', 'success');
        if (onSave) onSave(); // Callback to refresh app
        closeDrawer();
    };
}

export function closeDrawer() {
    const el = document.getElementById('drawer-overlay');
    if (el) el.classList.remove('open');
}

function renderInventoryForm(row) {
    // Inventory usually read-only except maybe custom tags
    // But user asked for editable fields logic similar to process
    return `
        <div class="form-group">
            <label>Ad Soyad</label>
            <input type="text" class="form-input" disabled value="${row.full_name || ''}">
        </div>
        <div class="form-group">
            <label>Kategori</label>
            <input type="text" class="form-input" disabled value="${row.category || ''}">
        </div>
        <div class="form-group">
            <label>Etiket / Rol</label>
            <select id="edit-tag" class="form-input">
                <option value="${row.tag || ''}">${row.tag || 'Seçiniz'}</option>
                <option value="USTA">USTA</option>
                <option value="KALFA">KALFA</option>
                <option value="DÜZ İŞÇİ">DÜZ İŞÇİ</option>
                <option value="OPERATÖR">OPERATÖR</option>
                <option value="ŞOFÖR">ŞOFÖR</option>
                <option value="AŞÇI">AŞÇI</option>
                <option value="REPSAM">REPSAM</option>
            </select>
            <small class="hint">Mevcut: ${row.tag}</small>
        </div>
        <div class="form-group">
            <label>Notlar</label>
            <textarea id="edit-notes" class="form-input" rows="3">${row.notes || ''}</textarea>
        </div>
    `;
}

function renderProcessForm(row) {
    const statuses = [
        "ÖN İZİN ONAYLANDI",
        "SAĞLIĞA SEVK",
        "BANKA İŞLEMİ",
        "VİZE BEKLİYOR",
        "RET",
        "TAMAMLANDI"
    ];

    const currentStatus = (row.status || '').toUpperCase().trim();

    return `
         <div class="form-group">
            <label>Başvuru No</label>
            <input type="text" class="form-input" disabled value="${row.s_nu || row.app_no || ''}">
        </div>
        <div class="form-group">
            <label>Ad Soyad</label>
            <input type="text" class="form-input" disabled value="${row.full_name || ''}">
        </div>
        
        <div class="form-group">
            <label>Durum</label>
            <select id="edit-status" class="form-input">
                <option value="">Seçiniz</option>
                ${statuses.map(s => `<option value="${s}" ${s === currentStatus ? 'selected' : ''}>${s}</option>`).join('')}
                 <option value="${row.status}" ${!statuses.includes(currentStatus) ? 'selected' : ''}>${row.status} (Orijinal)</option>
            </select>
        </div>

        <div class="form-group">
            <label>Sorumlu / Referans</label>
             <input type="text" id="edit-ref" class="form-input" value="${row.reference || ''}" list="ref-list">
             <datalist id="ref-list">
                <option value="İBRAHİM BEY">
                <option value="REPSAM">
                <option value="İK">
             </datalist>
        </div>

        <div class="form-group">
            <label>Açıklama / Tarih</label>
            <textarea id="edit-desc" class="form-input" rows="2">${row.description || ''}</textarea>
        </div>
    `;
}

function getFormData(type) {
    if (type === 'inventory') {
        return {
            tag: document.getElementById('edit-tag').value,
            notes: document.getElementById('edit-notes').value
        };
    } else {
        return {
            status: document.getElementById('edit-status').value,
            reference: document.getElementById('edit-ref').value,
            description: document.getElementById('edit-desc').value
        };
    }
}
