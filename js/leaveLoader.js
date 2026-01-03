/**
 * Leave (İzin) Data Loader
 * Parses monthly leave records from Excel
 */

import { fetchWorkbook } from './dataLoader.js';

export async function loadLeaveData() {
    try {
        const wb = await fetchWorkbook('./data/leaves_2025_12.xlsx');
        return parseLeaveData(wb);
    } catch (err) {
        console.error('İzin verisi yüklenemedi:', err);
        return { data: [], qualityNotes: [{ status: 'fail', label: 'İzin Dosyası', message: err.message }] };
    }
}

function parseLeaveData(workbook) {
    const data = [];
    const qualityNotes = [];

    // Try to find the main sheet - usually first sheet or one containing data
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
        qualityNotes.push({ status: 'fail', label: 'İzin Sayfası', message: 'Excel\'de sayfa bulunamadı.' });
        return { data, qualityNotes };
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Find header row - look for common headers
    let headerRowIndex = -1;
    let colMap = {};

    for (let i = 0; i < Math.min(10, rows.length); i++) {
        const row = rows[i];
        if (!row) continue;

        const rowStr = row.join(' ').toUpperCase();
        // Look for name column
        if (rowStr.includes('ADI') || rowStr.includes('SOYADI') || rowStr.includes('PERSONEL')) {
            headerRowIndex = i;
            // Map columns
            row.forEach((cell, idx) => {
                const cellStr = (cell || '').toString().toUpperCase();
                if (cellStr.includes('ADI') || cellStr.includes('PERSONEL')) colMap.name = idx;
                if (cellStr.includes('İZİN') && cellStr.includes('TÜR')) colMap.type = idx;
                if (cellStr.includes('BAŞLANGIÇ') || cellStr.includes('TARİH')) colMap.startDate = idx;
                if (cellStr.includes('BİTİŞ')) colMap.endDate = idx;
                if (cellStr.includes('GÜN') || cellStr.includes('SÜRE')) colMap.days = idx;
                if (cellStr.includes('AÇIKLAMA') || cellStr.includes('NOT')) colMap.notes = idx;
            });
            break;
        }
    }

    // If no header found, try first row as header
    if (headerRowIndex === -1 && rows.length > 0) {
        headerRowIndex = 0;
        colMap = { name: 0, type: 1, startDate: 2, endDate: 3, days: 4, notes: 5 };
    }

    // Parse data rows
    for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const name = row[colMap.name];
        if (!name || typeof name !== 'string' || name.trim().length < 2) continue;

        // Skip header-like rows
        if (name.toUpperCase().includes('ADI') || name.toUpperCase().includes('PERSONEL')) continue;

        data.push({
            full_name: name.toString().trim().toUpperCase(),
            leave_type: row[colMap.type] || 'BELİRTİLMEMİŞ',
            start_date: row[colMap.startDate] || '',
            end_date: row[colMap.endDate] || '',
            days: row[colMap.days] || '',
            notes: row[colMap.notes] || '',
            period: 'ARALIK 2025'
        });
    }

    if (data.length === 0) {
        qualityNotes.push({ status: 'warn', label: 'İzin Verisi', message: 'İzin kaydı bulunamadı veya tablo yapısı farklı.' });
    } else {
        qualityNotes.push({ status: 'ok', label: 'İzin Verisi', message: `${data.length} izin kaydı yüklendi.` });
    }

    return { data, qualityNotes };
}
