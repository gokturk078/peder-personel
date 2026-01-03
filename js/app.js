import { fetchWorkbook, parseInventoryData, parseProcessData } from './dataLoader.js';
import { calculateMetrics, performQualityChecks, augmentData } from './transforms.js';
import { renderKPIs, renderTable, renderPagination, renderQualityChecks } from './ui/components.js';
import { initCharts, renderCategoryChart, renderRepsamChart, renderStatusChart, renderDeparturesChart } from './ui/charts.js';
import { formatDate, debounce, exportToCSV } from './utils.js';
import { clearOverrides } from './storage.js';
import { openDrawer } from './ui/drawer.js';
import { showToast } from './ui/toast.js';
import { loadLeaveData } from './leaveLoader.js';
import { loadDeparturesData, calculateDepartureStats } from './departuresLoader.js';

// State
const state = {
    // Raw Base Data
    baseInventory: [],
    baseProcess: [],

    // New Modules
    leaves: [],
    departures: [],
    departureStats: null,

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
        // New filters
        leavesSearch: '',
        leavesType: '',
        leavesPeriod: 'ARALIK 2025',
        depSearch: '',
        depMonth: '',
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
        // Parallel Fetch - all 4 data sources
        const [invWb, procWb, leavesResult, departuresResult] = await Promise.all([
            fetchWorkbook('./data/inventory.xlsx'),
            fetchWorkbook('./data/process.xlsx'),
            loadLeaveData(),
            loadDeparturesData()
        ]);

        // Parse inventory & process
        const invResult = parseInventoryData(invWb);
        const procResult = parseProcessData(procWb);

        state.baseInventory = invResult.data;
        state.baseProcess = procResult.data;

        // New modules
        state.leaves = leavesResult.data;
        state.departures = departuresResult.data;
        state.departureStats = calculateDepartureStats(state.departures);

        // Collect quality notes
        state.qualityNotes = [
            ...invResult.qualityNotes,
            ...procResult.qualityNotes,
            ...leavesResult.qualityNotes,
            ...departuresResult.qualityNotes
        ];

        state.lastUpdated = new Date();

        applyData();

        showToast('Tüm veriler başarıyla yüklendi', 'success');
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
    document.getElementById('count-leaves').textContent = state.leaves.length;
    document.getElementById('count-departures').textContent = state.departures.length;

    // Charts & KPIs
    renderKPIs(document.getElementById('dashboard-kpis'), state.metrics, state.leaves, state.departureStats);
    renderCategoryChart(state.metrics.categoryCounts);
    renderRepsamChart(state.metrics.repsamRoles);
    renderStatusChart(state.metrics.processStatusBreakdown);

    // New chart
    if (state.departureStats) {
        renderDeparturesChart(state.departureStats.byMonth);
    }

    populateFilters();
    refreshTables();

    // Quality
    const checks = performQualityChecks(state.inventory, state.process);
    renderQualityChecks(document.getElementById('quality-list'), [...state.qualityNotes, ...checks]);
}

function refreshTables() {
    renderInventoryTable();
    renderProcessTable();
    renderLeavesTable();
    renderDeparturesTable();
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

    const cols = [
        { key: (r, i, abs) => abs, header: '#' },
        { key: 'full_name', header: 'Ad Soyad' },
        { key: 'category', header: 'Kategori', render: (val) => `<span class="tag-badge icon">${val}</span>` },
        { key: 'tag', header: 'Etiket / Rol' }
    ];

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

// === NEW: Leaves Tab ===
function getFilteredLeaves() {
    return state.leaves.filter(row => {
        const matchSearch = row.full_name.toLowerCase().includes(state.filters.leavesSearch);
        const matchType = !state.filters.leavesType || row.leave_type === state.filters.leavesType;
        const matchPeriod = !state.filters.leavesPeriod || row.period === state.filters.leavesPeriod;
        return matchSearch && matchType && matchPeriod;
    });
}

function renderLeavesTable() {
    const data = getFilteredLeaves();

    renderTable('table-leaves', data, [
        { key: (r, i, abs) => abs, header: '#' },
        { key: 'full_name', header: 'Ad Soyad' },
        { key: 'leave_type', header: 'İzin Türü' },
        { key: 'start_date', header: 'Başlangıç', render: (val) => formatDate(val) || val },
        { key: 'end_date', header: 'Bitiş', render: (val) => formatDate(val) || val },
        { key: 'days', header: 'Gün' },
        { key: 'notes', header: 'Not' }
    ], 1, 1000, null);
}

// === NEW: Departures Tab ===
function getFilteredDepartures() {
    return state.departures.filter(row => {
        const matchSearch = row.full_name.toLowerCase().includes(state.filters.depSearch);
        const matchMonth = !state.filters.depMonth || row.exit_month === state.filters.depMonth;
        return matchSearch && matchMonth;
    });
}

function renderDeparturesTable() {
    const data = getFilteredDepartures();

    renderTable('table-departures', data, [
        { key: (r, i, abs) => abs, header: '#' },
        { key: 'full_name', header: 'Ad Soyad' },
        { key: 'entry_date', header: 'İşe Giriş', render: (val) => formatDate(val) || val },
        { key: 'exit_date', header: 'Çıkış Tarihi', render: (val) => formatDate(val) || val },
        { key: 'exit_month', header: 'Çıkış Ayı', render: (val) => `<span class="tag-badge">${val}</span>` },
        { key: 'reason', header: 'Sebep' }
    ], 1, 1000, null);
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
            applyData();
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

    // === NEW: Leaves Listeners ===
    document.getElementById('leaves-search').addEventListener('input', debounce((e) => { state.filters.leavesSearch = e.target.value.toLowerCase(); renderLeavesTable(); }, 300));
    document.getElementById('leaves-filter-type').addEventListener('change', (e) => { state.filters.leavesType = e.target.value; renderLeavesTable(); });
    document.getElementById('leaves-filter-period').addEventListener('change', (e) => { state.filters.leavesPeriod = e.target.value; renderLeavesTable(); });

    // === NEW: Departures Listeners ===
    document.getElementById('dep-search').addEventListener('input', debounce((e) => { state.filters.depSearch = e.target.value.toLowerCase(); renderDeparturesTable(); }, 300));
    document.getElementById('dep-filter-month').addEventListener('change', (e) => { state.filters.depMonth = e.target.value; renderDeparturesTable(); });

    // Exports
    document.getElementById('btn-export-inventory').addEventListener('click', () => exportToCSV(getFilteredInventory(), 'Personel_Envanteri.csv'));
    document.getElementById('btn-export-process').addEventListener('click', () => exportToCSV(getFilteredProcess(), 'Izin_Sureci.csv'));
    document.getElementById('btn-export-leaves').addEventListener('click', () => exportToCSV(getFilteredLeaves(), 'Aylik_Izin.csv'));
    document.getElementById('btn-export-departures').addEventListener('click', () => exportToCSV(getFilteredDepartures(), 'Isten_Ayrilanlar.csv'));
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

    // New: Leaves type filter
    const leaveTypes = [...new Set(state.leaves.map(l => l.leave_type).filter(Boolean))].sort();
    updateSelect('leaves-filter-type', leaveTypes, state.filters.leavesType);
}

function updateSelect(id, options, currentVal) {
    const sel = document.getElementById(id);
    if (!sel) return;
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
            <p>Lütfen 'data' klasöründe tüm Excel dosyalarının olduğundan emin olun.</p>
            <button class="btn btn-outline" onclick="location.reload()">Sayfayı Yenile</button>
        </div>
    `;
    els.mainInterface.classList.remove('hidden');
}
