/**
 * Data Transformation & Logic
 */
import { mergeWithOverrides } from './storage.js';

export function calculateMetrics(inventory, process) {
    const kpis = {
        totalInventory: inventory.length,
        totalProcess: process.length,
        maxCategory: null,
        categoryCounts: {},
        repsamRoles: {},
        processStatusBreakdown: {}
    };

    // Inventory Metrics
    inventory.forEach(p => {
        // Category Counts
        kpis.categoryCounts[p.category] = (kpis.categoryCounts[p.category] || 0) + 1;

        // Repsam Roles
        if (p.category === 'REPSAM') {
            const role = p.tag || 'BELİRSİZ';
            kpis.repsamRoles[role] = (kpis.repsamRoles[role] || 0) + 1;
        }
    });

    // Max Category
    let maxCount = 0;
    Object.entries(kpis.categoryCounts).forEach(([cat, count]) => {
        if (count > maxCount) {
            maxCount = count;
            kpis.maxCategory = { name: cat, count: count };
        }
    });

    // Process Metrics
    process.forEach(p => {
        const stat = p.status ? p.status.toString().toUpperCase().trim() : 'BELİRSİZ';
        kpis.processStatusBreakdown[stat] = (kpis.processStatusBreakdown[stat] || 0) + 1;
    });

    return kpis;
}

export function performQualityChecks(inventory, process) {
    const checks = [];
    const EXPECTED_TOTAL = 177;

    // 1. Inventory Count
    if (inventory.length === EXPECTED_TOTAL) {
        checks.push({ status: 'ok', label: 'Personel Sayısı', message: `Beklenen sayı (177) doğrulandı.` });
    } else {
        checks.push({ status: 'warn', label: 'Personel Sayısı', message: `Beklenen 177, bulunan ${inventory.length}. Veri eksik veya fazla olabilir.` });
    }

    // 2. Duplicates
    const seenInv = new Set();
    const dupeInv = [];
    inventory.forEach(p => {
        if (seenInv.has(p.full_name)) dupeInv.push(p.full_name);
        seenInv.add(p.full_name);
    });
    if (dupeInv.length) {
        checks.push({ status: 'fail', label: 'Mükerrer (Envanter)', message: `${dupeInv.length} tekrar: ${dupeInv.slice(0, 2).join(', ')}...` });
    }

    // 3. Process Health
    const emptyRefs = process.filter(p => !p.reference).length;
    if (emptyRefs > 0) checks.push({ status: 'warn', label: 'Eksik Sorumlu', message: `${emptyRefs} kayıtta sorumlu yok.` });

    // 4. Missing App No
    const missingAppNo = process.filter(p => !p.app_no && !p.s_nu).length;
    if (missingAppNo > 0) checks.push({ status: 'fail', label: 'Eksik Başvuru No', message: `${missingAppNo} kayıtta takip numarası yok.` });

    return checks;
}

export function augmentData(inventoryRaw, processRaw) {
    // 1. Merge Overrides
    const inventory = mergeWithOverrides(inventoryRaw, 'inventory');
    const process = mergeWithOverrides(processRaw, 'process');

    // 2. Augment Process Dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const augmentedProcess = process.map(p => {
        let dateStatus = 'normal';
        // Logic to parse date from description if possible
        if (typeof p.description === 'number' || (p.description && /\d{2}\.\d{2}\.\d{4}/.test(p.description))) {
            let d = null;
            if (typeof p.description === 'number') {
                d = new Date(Math.round((p.description - 25569) * 86400 * 1000));
            } else {
                // Simple string parse DD.MM.YYYY
                const parts = p.description.match(/(\d{2})\.(\d{2})\.(\d{4})/);
                if (parts) d = new Date(`${parts[3]}-${parts[2]}-${parts[1]}`);
            }

            if (d && !isNaN(d.getTime())) {
                const diffTime = d - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays < 0) dateStatus = 'late';
                else if (diffDays <= 7) dateStatus = 'closing';
            }
        }
        return { ...p, _dateStatus: dateStatus };
    });

    return { inventory, process: augmentedProcess };
}
