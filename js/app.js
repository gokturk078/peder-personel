import { fetchWorkbook, parseInventoryData, parseProcessData } from './dataLoader.js';
import { calculateMetrics, performQualityChecks, augmentData } from './transforms.js';
import { renderKPIs, renderTable, renderPagination, renderQualityChecks } from './ui/components.js';
import { initCharts, renderCategoryChart, renderRepsamChart, renderStatusChart } from './ui/charts.js';
import { formatDate, debounce, exportToCSV } from './utils.js';
import { clearOverrides } from './storage.js';
import { openDrawer } from './ui/drawer.js';
import { showToast } from './ui/toast.js';

// State
const state = {
    // Raw Base Data
    baseInventory: [],
    baseProcess: [],

    // Merged Active Data
    inventory: [],
    process: [],

    metrics: {},
    qualityNotes: [],
    lastUpdated: null,

    // Filters
    filters: {
        invPage: 1,
        invSearch: '',
        invCat: '',
        invTag: '',
        procSearch: '',
        procStatus: '',
        procRef: '',
        procLate: false,
    }
};

// UI Refs
const els = {
    mainInterface: document.getElementById('main-interface'),
    loading: document.getElementById('loading'),
    loadingText: document.getElementById('loading-text'),
    dataSourceInfo: document.getElementById('data-source-info'),
    tabs: document.querySelectorAll('.sub-nav li'),
    contents: document.querySelectorAll('.tab-content')
};

// Init
document.addEventListener('DOMContentLoaded', () => {
    initCharts();
    setupEventListeners();
    loadData();
});

async function loadData() {
    showLoading(true, 'Veriler Sunucudan Çekiliyor...');
    state.qualityNotes = [];

    try {
        // Parallel Fetch
        const [invWb, procWb] = await Promise.all([
            fetchWorkbook('./data/inventory.xlsx'),
            fetchWorkbook('./data/process.xlsx')
        ]);

        // Parse
        const invResult = parseInventoryData(invWb);
        const procResult = parseProcessData(procWb);

        state.baseInventory = invResult.data;
        state.baseProcess = procResult.data;
        state.qualityNotes = [...invResult.qualityNotes, ...procResult.qualityNotes];
        state.lastUpdated = new Date();

        applyData(); // Merge and update UI

        showToast('Veriler başarıyla yüklendi', 'success');
        updateHeaderInfo();

    } catch (err) {
        console.error(err);
        showErrorState(err.message);
    } finally {
        showLoading(false);
    }
}

function applyData() {
    // Merge overrides
    const { inventory, process } = augmentData(state.baseInventory, state.baseProcess);
    state.inventory = inventory;
    state.process = process;

    // Check if main interface is visible, if not show it (first load)
    els.mainInterface.classList.remove('hidden');

    updateApp();
}

function updateApp() {
    // Metrics
    state.metrics = calculateMetrics(state.inventory, state.process);

    // Badges
    document.getElementById('count-inventory').textContent = state.inventory.length;
    document.getElementById('count-process').textContent = state.process.length;

    // Charts & KPIs if visible
    renderKPIs(document.getElementById('dashboard-kpis'), state.metrics);
    // Charts need re-render logic if tab active, simply calling them is safe usually as they check ctx
    renderCategoryChart(state.metrics.categoryCounts);
    renderRepsamChart(state.metrics.repsamRoles);
    renderStatusChart(state.metrics.processStatusBreakdown);

    populateFilters();
    refreshTables();

    // Quality
    const checks = performQualityChecks(state.inventory, state.process);
    renderQualityChecks(document.getElementById('quality-list'), [...state.qualityNotes, ...checks]);
}

function refreshTables() {
    renderInventoryTable();
    renderProcessTable();
}

// Filter Logic
function getFilteredInventory() {
    return state.inventory.filter(row => {
        const matchSearch = row.full_name.toLowerCase().includes(state.filters.invSearch);
        const matchCat = !state.filters.invCat || row.category === state.filters.invCat;
        const matchTag = !state.filters.invTag || row.tag === state.filters.invTag;
        return matchSearch && matchCat && matchTag;
    });
}

function renderInventoryTable() {
    const data = getFilteredInventory();

    // Columns
    const cols = [
        { key: (r, i, abs) => abs, header: '#' },
        { key: 'full_name', header: 'Ad Soyad' },
        { key: 'category', header: 'Kategori', render: (val) => `<span class="tag-badge icon">${val}</span>` },
        { key: 'tag', header: 'Etiket / Rol' }
    ];

    // Pass click handler for drawer
    const totalPages = renderTable(
        'table-inventory',
        data,
        cols,
        state.filters.invPage,
        50,
        (row) => openDrawer('inventory', row, () => applyData())
    );

    renderPagination('pagination-inventory', totalPages, state.filters.invPage, (p) => {
        state.filters.invPage = p;
        renderInventoryTable();
    });
}

function getFilteredProcess() {
    return state.process.filter(row => {
        const matchSearch = row.full_name.toLowerCase().includes(state.filters.procSearch) ||
            (row.s_nu && row.s_nu.toString().includes(state.filters.procSearch));
        const matchStatus = !state.filters.procStatus || row.status === state.filters.procStatus;
        const matchRef = !state.filters.procRef || row.reference === state.filters.procRef;
        let matchLate = true;
        if (state.filters.procLate) matchLate = row._dateStatus === 'late';
        return matchSearch && matchStatus && matchRef && matchLate;
    });
}

function renderProcessTable() {
    const data = getFilteredProcess();

    renderTable('table-process', data, [
        { key: 's_nu', header: 'S.NU' },
        { key: 'full_name', header: 'Ad Soyad', render: (val, r) => `${val} ${r._isModified ? '<span class="status-badge" style="font-size:0.6rem">DÜZENLENDİ</span>' : ''}` },
        { key: 'job', header: 'Meslek' },
        { key: 'app_no', header: 'Başvuru No' },
        { key: 'status', header: 'Durum' },
        {
            key: 'description', header: 'Açıklama', render: (val, row) => {
                const displayDate = formatDate(val) || val;
                let badge = '';
                if (row._dateStatus === 'late') badge = '<span class="tag-badge danger">Gecikmiş</span>';
                if (row._dateStatus === 'closing') badge = '<span class="tag-badge warn">Yaklaşıyor</span>';
                return `<div>${displayDate} <br/>${badge}</div>`;
            }
        },
        { key: 'reference', header: 'Sorumlu' }
    ], 1, 1000,
        (row) => openDrawer('process', row, () => applyData()));
}


function setupEventListeners() {
    // Tabs
    els.tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // UI Toggle
            els.tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            els.contents.forEach(c => c.classList.remove('active'));
            document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');

            // Reflow Charts
            if (tab.dataset.tab === 'dashboard') updateApp();
        });
    });

    // Data Ops
    document.getElementById('btn-refresh-data').addEventListener('click', loadData);
    document.getElementById('btn-reset-changes').addEventListener('click', () => {
        if (confirm('Tüm manuel değişiklikler silinecek. Emin misiniz?')) {
            clearOverrides();
            applyData(); // Re-merge (now with empty overrides)
            showToast('Tüm değişiklikler sıfırlandı.', 'info');
        }
    });

    // Input Listeners Inventory
    document.getElementById('inv-search').addEventListener('input', debounce((e) => { state.filters.invSearch = e.target.value.toLowerCase(); state.filters.invPage = 1; renderInventoryTable(); }, 300));
    document.getElementById('inv-filter-category').addEventListener('change', (e) => { state.filters.invCat = e.target.value; state.filters.invPage = 1; renderInventoryTable(); });
    document.getElementById('inv-filter-tag').addEventListener('change', (e) => { state.filters.invTag = e.target.value; state.filters.invPage = 1; renderInventoryTable(); });

    // Input Listeners Process
    document.getElementById('proc-search').addEventListener('input', debounce((e) => { state.filters.procSearch = e.target.value.toLowerCase(); renderProcessTable(); }, 300));
    document.getElementById('proc-filter-status').addEventListener('change', (e) => { state.filters.procStatus = e.target.value; renderProcessTable(); });
    document.getElementById('proc-filter-ref').addEventListener('change', (e) => { state.filters.procRef = e.target.value; renderProcessTable(); });
    document.getElementById('proc-filter-late').addEventListener('change', (e) => { state.filters.procLate = e.target.checked; renderProcessTable(); });

    // Exports
    document.getElementById('btn-export-inventory').addEventListener('click', () => exportToCSV(getFilteredInventory(), 'Personel_Envanteri.csv'));
    document.getElementById('btn-export-process').addEventListener('click', () => exportToCSV(getFilteredProcess(), 'Izin_Sureci.csv'));
}

function populateFilters() {
    const cats = [...new Set(state.inventory.map(i => i.category))].sort();
    const tags = [...new Set(state.inventory.map(i => i.tag).filter(Boolean))].sort();
    updateSelect('inv-filter-category', cats, state.filters.invCat);
    updateSelect('inv-filter-tag', tags, state.filters.invTag);

    const statuses = [...new Set(state.process.map(p => p.status).filter(Boolean))].sort();
    const refs = [...new Set(state.process.map(p => p.reference).filter(Boolean))].sort();
    updateSelect('proc-filter-status', statuses, state.filters.procStatus);
    updateSelect('proc-filter-ref', refs, state.filters.procRef);
}

function updateSelect(id, options, currentVal) {
    const sel = document.getElementById(id);
    const first = sel.options[0];
    sel.innerHTML = '';
    sel.appendChild(first);
    options.forEach(opt => {
        const el = document.createElement('option');
        el.value = opt;
        el.textContent = opt;
        sel.appendChild(el);
    });
    sel.value = currentVal;
}

function updateHeaderInfo() {
    const time = state.lastUpdated ? state.lastUpdated.toLocaleTimeString() : '-';
    els.dataSourceInfo.textContent = `Veri Kaynağı: Yerel Excel | Son Güncelleme: ${time}`;
}

function showLoading(show, text) {
    if (show) {
        els.loading.classList.remove('hidden');
        if (text) els.loadingText.textContent = text;
    } else {
        els.loading.classList.add('hidden');
    }
}

function showErrorState(msg) {
    els.mainInterface.innerHTML = `
        <div style="text-align:center; padding:50px; color:var(--danger)">
            <h2>⚠️ Bir Sorun Oluştu</h2>
            <p>${msg}</p>
            <p>Lütfen 'data' klasöründe 'inventory.xlsx' ve 'process.xlsx' dosyalarının olduğundan emin olun.</p>
            <button class="btn btn-outline" onclick="location.reload()">Sayfayı Yenile</button>
        </div>
    `;
    els.mainInterface.classList.remove('hidden');
}
