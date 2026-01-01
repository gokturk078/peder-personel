/**
 * Chart.js Wrappers
 */

let charts = {};

export function initCharts() {
    // Setup default options if needed
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = '#64748b';
}

function destroyChart(id) {
    if (charts[id]) {
        charts[id].destroy();
        delete charts[id];
    }
}

export function renderCategoryChart(data) {
    // data: { "REPSAM": 60, "KALMES": 50 ... }
    const ctx = document.getElementById('chart-categories');
    if (!ctx) return;

    destroyChart('chart-categories');

    const labels = Object.keys(data);
    const values = Object.values(data);

    charts['chart-categories'] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: [
                    '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
                    '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right' }
            }
        }
    });
}

export function renderRepsamChart(data) {
    // data: { "ROLLER": count ... }
    const ctx = document.getElementById('chart-repsam');
    if (!ctx) return;

    destroyChart('chart-repsam');

    const labels = Object.keys(data);
    const values = Object.values(data);

    charts['chart-repsam'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Kişi Sayısı',
                data: values,
                backgroundColor: '#3b82f6',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y', // Horizontal bar
            scales: {
                x: { beginAtZero: true }
            }
        }
    });
}

export function renderStatusChart(data) {
    // data: { "ONAY": 5, "BEKLEYEN": 2 ... }
    const ctx = document.getElementById('chart-status');
    if (!ctx) return;

    destroyChart('chart-status');

    charts['chart-status'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(data),
            datasets: [{
                label: 'Kişi Sayısı',
                data: Object.values(data),
                backgroundColor: '#8b5cf6',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}
