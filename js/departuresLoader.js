/**
 * Departures (İşten Ayrılanlar) Data Loader
 * Parses yearly departure records and categorizes by month
 */

import { fetchWorkbook } from './dataLoader.js';

export async function loadDeparturesData() {
    try {
        const wb = await fetchWorkbook('./data/departures_2025.xlsx');
        return parseDeparturesData(wb);
    } catch (err) {
        console.error('Ayrılan personel verisi yüklenemedi:', err);
        return { data: [], qualityNotes: [{ status: 'fail', label: 'Ayrılanlar Dosyası', message: err.message }] };
    }
}

const MONTHS_TR = ['OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN',
    'TEMMUZ', 'AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK'];

function parseDeparturesData(workbook) {
    const data = [];
    const qualityNotes = [];

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
        qualityNotes.push({ status: 'fail', label: 'Ayrılanlar Sayfası', message: 'Excel\'de sayfa bulunamadı.' });
        return { data, qualityNotes };
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Find header row
    let headerRowIndex = -1;
    let colMap = {};

    for (let i = 0; i < Math.min(10, rows.length); i++) {
        const row = rows[i];
        if (!row) continue;

        const rowStr = row.join(' ').toUpperCase();
        if (rowStr.includes('ADI') || rowStr.includes('SOYADI') || rowStr.includes('PERSONEL')) {
            headerRowIndex = i;
            row.forEach((cell, idx) => {
                const cellStr = (cell || '').toString().toUpperCase();
                if (cellStr.includes('ADI') || cellStr.includes('PERSONEL')) colMap.name = idx;
                if (cellStr.includes('GİRİŞ') && cellStr.includes('TARİH')) colMap.entryDate = idx;
                if (cellStr.includes('ÇIKIŞ') && cellStr.includes('TARİH')) colMap.exitDate = idx;
                if (cellStr.includes('NEDEN') || cellStr.includes('SEBEP')) colMap.reason = idx;
                if (cellStr.includes('KATEGORİ') || cellStr.includes('GRUP')) colMap.category = idx;
            });
            break;
        }
    }

    if (headerRowIndex === -1 && rows.length > 0) {
        headerRowIndex = 0;
        colMap = { name: 0, entryDate: 1, exitDate: 2, reason: 3 };
    }

    // Parse data rows
    for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const name = row[colMap.name];
        if (!name || typeof name !== 'string' || name.trim().length < 2) continue;
        if (name.toUpperCase().includes('ADI') || name.toUpperCase().includes('PERSONEL')) continue;

        const exitDateRaw = row[colMap.exitDate];
        const parsedExit = parseExcelDate(exitDateRaw);
        const exitMonth = parsedExit ? MONTHS_TR[parsedExit.getMonth()] : 'BELİRSİZ';

        data.push({
            full_name: name.toString().trim().toUpperCase(),
            entry_date: row[colMap.entryDate] || '',
            exit_date: exitDateRaw || '',
            exit_date_parsed: parsedExit,
            exit_month: exitMonth,
            reason: row[colMap.reason] || '',
            category: row[colMap.category] || ''
        });
    }

    if (data.length === 0) {
        qualityNotes.push({ status: 'warn', label: 'Ayrılanlar', message: 'Kayıt bulunamadı.' });
    } else {
        qualityNotes.push({ status: 'ok', label: 'Ayrılanlar', message: `${data.length} ayrılan personel kaydı yüklendi.` });
    }

    return { data, qualityNotes };
}

function parseExcelDate(val) {
    if (!val) return null;

    // Excel serial date
    if (typeof val === 'number') {
        return new Date(Math.round((val - 25569) * 86400 * 1000));
    }

    // String date DD.MM.YYYY
    if (typeof val === 'string') {
        const parts = val.match(/(\d{1,2})[\.\/](\d{1,2})[\.\/](\d{4})/);
        if (parts) {
            return new Date(`${parts[3]}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}`);
        }
    }

    return null;
}

export function calculateDepartureStats(data) {
    const byMonth = {};
    MONTHS_TR.forEach(m => byMonth[m] = 0);

    data.forEach(p => {
        if (byMonth[p.exit_month] !== undefined) {
            byMonth[p.exit_month]++;
        }
    });

    // Find peak month
    let peakMonth = 'BELİRSİZ';
    let peakCount = 0;
    Object.entries(byMonth).forEach(([month, count]) => {
        if (count > peakCount) {
            peakCount = count;
            peakMonth = month;
        }
    });

    return { byMonth, peakMonth, peakCount, total: data.length };
}
