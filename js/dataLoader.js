/**
 * Data Parser using SheetJS
 */

/**
 * Data Parser using SheetJS
 */

export async function fetchWorkbook(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Dosya indirilemedi: ${url} (Kod: ${response.status})`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return XLSX.read(arrayBuffer, { type: 'array' });
    } catch (err) {
        throw new Error(`Veri Yükleme Hatası: ${err.message}`);
    }
}

/**
 * Parses the Inventory File (ÖN İZİNLE ADYA GELİP...)
 * Target Sheets: REPSAM, KALMES, BANGLADEŞ, NEŞAT, CAPRA, ÖZBEK, TÜRKMEN, ZİMBAVE
 */
export function parseInventoryData(workbook) {
    const categories = ['REPSAM', 'KALMES', 'BANGLADEŞ', 'NEŞAT', 'CAPRA', 'ÖZBEK', 'TÜRKMEN', 'ZİMBAVE'];
    let allPersonnel = [];
    let qualityNotes = [];

    categories.forEach(cat => {
        // Try to find the sheet case-insensitively or exact match
        const sheetName = workbook.SheetNames.find(s => s.trim().toUpperCase() === cat);

        if (!sheetName) {
            qualityNotes.push({ status: 'warn', label: `Eksik Sayfa: ${cat}`, message: 'Bu kategoriye ait sayfa bulunamadı.' });
            return;
        }

        const sheet = workbook.Sheets[sheetName];
        // Convert to JSON with array of arrays to have control over columns
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        // Assumption from prompt: A=Index, B=Name, C=Tag
        // Usually rows[0] might be header or empty. We scan rows.
        rows.forEach((row, rowIndex) => {
            // Check if Row B (index 1) has a name
            const name = row[1]; // B column
            if (name && typeof name === 'string' && name.trim().length > 2) {
                // Filter out header lines if they exist like "ADI SOYADI"
                if (name.includes('ADI SOYADI') || name.includes('İSİM')) return;

                const tag = row[2] || cat; // C column or fallback to Category name

                allPersonnel.push({
                    category: cat,
                    full_name: name.trim().toUpperCase(),
                    tag: tag ? tag.toString().trim().toUpperCase() : ''
                });
            }
        });
    });

    return { data: allPersonnel, qualityNotes };
}

/**
 * Parses the Process File (PERSONEL TAKİP ÇİZELGESİ...)
 * Target: "GÜNCEL (3)" or find "S.NU"
 */
export function parseProcessData(workbook) {
    let sheetName = workbook.SheetNames.find(s => s.includes('GÜNCEL'));

    // If exact generic match fails, search content of first 3 sheets for "S.NU"
    if (!sheetName) {
        for (let i = 0; i < Math.min(3, workbook.SheetNames.length); i++) {
            const sn = workbook.SheetNames[i];
            const s = workbook.Sheets[sn];
            // Quick check if S.NU exists in the sheet content string dump (basic check)
            // Better: read first 20 rows
            const peek = XLSX.utils.sheet_to_json(s, { header: 1, range: 0 });
            const hasHeader = peek.some(row => row.some(cell => cell && cell.toString().includes('S.NU')));
            if (hasHeader) {
                sheetName = sn;
                break;
            }
        }
    }

    if (!sheetName) {
        throw new Error('Takip çizelgesi sayfası ("GÜNCEL" veya "S.NU" içeren) bulunamadı.');
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Find header row index
    let headerRowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row.some(cell => cell && cell.toString().trim() === 'S.NU')) {
            headerRowIndex = i;
            break;
        }
    }

    if (headerRowIndex === -1) {
        throw new Error('"S.NU" başlık satırı bulunamadı.');
    }

    // Map columns based on relative position to S.NU
    // Expected: 0:S.NU, 1:Ad Soyad, 2:Meslek, 3:Başvuru No, 4:Durum, 5:Açıklama, 6:Sorumlu?
    // Prompt says: S.NU, ADI SOYADI, MESLEĞİ, ÇALIŞMA D.B.N, GÜNCEL DURUMU, AÇIKLAMA.
    // 7th item (index 6, if S.NU is 0) is Referans.

    // Let's find exact indices from the header row just to be safe
    const headerRow = rows[headerRowIndex];
    const idx = {
        snu: headerRow.findIndex(c => c && c.toString().includes('S.NU')),
        name: headerRow.findIndex(c => c && c.toString().includes('SOYADI')), // ADI SOYADI
        job: headerRow.findIndex(c => c && c.toString().includes('MESLEĞİ')),
        appNo: headerRow.findIndex(c => c && c.toString().includes('BAŞVURU')), // ÇALIŞMA...
        status: headerRow.findIndex(c => c && c.toString().includes('DURUMU')), // GÜNCEL DURUMU
        desc: headerRow.findIndex(c => c && c.toString().includes('AÇIKLAMA')),
        ref: 6 // Fallback default as per prompt
    };

    // If we found 'S.NU' at column 0, then we trust the user prompt 0..6
    // But if columns are shifted, dynamic lookup helps. 
    // The prompt explicitly said "Başlıksız 7. sütun... Referans".
    // So if S.NU is index 0 -> Referans is index 6.

    const processData = [];
    const qualityNotes = [];

    // Start reading from header + 1
    for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const snu = row[idx.snu] || row[0]; // Fallback to 0
        const name = row[idx.name > -1 ? idx.name : 1];

        // Skip empty names
        if (!name || name.toString().trim().length < 2) continue;

        processData.push({
            s_nu: snu,
            full_name: name.toString().trim().toUpperCase(),
            job: row[idx.job > -1 ? idx.job : 2],
            app_no: row[idx.appNo > -1 ? idx.appNo : 3],
            status: row[idx.status > -1 ? idx.status : 4],
            description: row[idx.desc > -1 ? idx.desc : 5], // Can be date or text
            reference: row[6] // Prompt specific: 7th column (index 6)
        });
    }

    return { data: processData, qualityNotes };
}
