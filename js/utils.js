/**
 * Utility functions
 */

// Format Excel date serial or string to DD.MM.YYYY
export function formatDate(val) {
    if (!val) return "";
    
    let date;
    // Excel serial date (e.g. 45000)
    if (typeof val === 'number') {
        date = new Date(Math.round((val - 25569) * 86400 * 1000));
    } else if (val instanceof Date) {
        date = val;
    } else {
        // Try parsing string
        date = new Date(val);
    }

    if (isNaN(date.getTime())) return val; // Return original if not valid date

    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}.${m}.${y}`;
}

export function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

export function exportToCSV(data, filename) {
    if (!data || !data.length) return;
    
    // Auto-detect headers from first object
    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(","),
        ...data.map(row => headers.map(fieldName => {
            let val = row[fieldName] || "";
            // Escape quotes
            if (typeof val === 'string' && (val.includes(",") || val.includes('"'))) {
                val = `"${val.replace(/"/g, '""')}"`;
            }
            return val;
        }).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
