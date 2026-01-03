/**
 * UI Renderers
 */
import { formatDate } from '../utils.js';

export function renderKPIs(container, metrics, leaves = [], departureStats = null) {
    if (!container) return;

    // Build cards array
    const cards = [
        { title: "Toplam Personel (İzni Çıkmış)", value: metrics.totalInventory, sub: "Envanter Kayıtlı" },
        { title: "Süreçteki Personel", value: metrics.totalProcess, sub: "Aktif Başvuru/İşlem" },
        { title: "En Büyük Grup", value: metrics.maxCategory?.name || "-", sub: `${metrics.maxCategory?.count || 0} Kişi` },
        { title: "Aylık İzin Kullanımı", value: leaves.length, sub: "Aralık 2025" },
    ];

    // Add departures card if data exists
    if (departureStats) {
        cards.push({
            title: "2025 Toplam Ayrılan",
            value: departureStats.total,
            sub: `En yoğun: ${departureStats.peakMonth} (${departureStats.peakCount})`
        });
    }

    container.innerHTML = cards.map(c => `
        <div class="kpi-card">
            <h4>${c.title}</h4>
            <div class="value">${c.value}</div>
            <div class="sub">${c.sub}</div>
        </div>
    `).join('');
}

export function renderTable(tableId, data, columns, page = 1, rowsPerPage = 50, onRowClick = null) {
    const table = document.getElementById(tableId);
    if (!table) return;

    const tbody = table.querySelector('tbody');
    tbody.innerHTML = '';

    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${columns.length}" style="text-align:center; padding: 20px;">Veri bulunamadı.</td></tr>`;
        return;
    }

    const start = (page - 1) * rowsPerPage;
    const paginatedItems = data.slice(start, start + rowsPerPage);

    paginatedItems.forEach((row, index) => {
        const tr = document.createElement('tr');

        if (onRowClick) {
            tr.style.cursor = 'pointer';
            tr.onclick = (e) => {
                // Prevent trigger if clicking a button inside row
                if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') {
                    onRowClick(row);
                }
            };
        }

        columns.forEach(col => {
            const td = document.createElement('td');
            // Data key can be a simple string or a function accessor
            let val = typeof col.key === 'function' ? col.key(row, index, start + index + 1) : row[col.key];

            // Render logic
            if (col.render) {
                td.innerHTML = col.render(val, row, start + index + 1);
            } else {
                td.textContent = val !== null && val !== undefined ? val : '';
            }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    return Math.ceil(data.length / rowsPerPage);
}

export function renderPagination(containerId, totalPages, currentPage, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    if (totalPages <= 1) return;

    // Simple prev/next for now
    const prev = document.createElement('button');
    prev.textContent = 'Önceki';
    prev.className = 'btn btn-outline';
    prev.disabled = currentPage === 1;
    prev.onclick = () => onPageChange(currentPage - 1);

    const next = document.createElement('button');
    next.textContent = 'Sonraki';
    next.className = 'btn btn-outline';
    next.disabled = currentPage === totalPages;
    next.onclick = () => onPageChange(currentPage + 1);

    const info = document.createElement('span');
    info.style.margin = "0 10px";
    info.textContent = `Sayfa ${currentPage} / ${totalPages}`;

    container.appendChild(prev);
    container.appendChild(info);
    container.appendChild(next);
}

export function renderQualityChecks(container, checks) {
    if (!container) return;
    container.innerHTML = checks.map(c => `
        <div class="check-item ${c.status === 'ok' ? 'pass' : (c.status === 'warn' ? 'warn' : 'fail')}">
            <div class="info">
                <strong>${c.label}</strong>
                <div>${c.message}</div>
            </div>
            <div class="icon">
                ${c.status === 'ok' ? '✅' : (c.status === 'warn' ? '⚠️' : '❌')}
            </div>
        </div>
    `).join('');
}
