/**
 * Storage Module
 * Handles persistence of user overrides to localStorage.
 * 
 * Override Structure:
 * key: "PORTAL_OVERRIDES_V1"
 * value: {
 *   "inventory": { [uniqueId]: { ...fields } },
 *   "process": { [uniqueId]: { ...fields } }
 * }
 */

const STORAGE_KEY = 'PORTAL_OVERRIDES_V1';

export function getOverrides() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : { inventory: {}, process: {} };
    } catch (e) {
        console.error("Storage load error", e);
        return { inventory: {}, process: {} };
    }
}

export function saveOverride(type, id, data) {
    const current = getOverrides();
    if (!current[type]) current[type] = {};

    // Merge with existing override if present
    current[type][id] = { ...(current[type][id] || {}), ...data };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    return current;
}

export function clearOverrides() {
    localStorage.removeItem(STORAGE_KEY);
}

export function generateInventoryId(row) {
    // Unique composite key for inventory: Name + Category
    // Normalize to handle potential minor differences
    return `${row.full_name}_${row.category}`.replace(/\s+/g, '_').toUpperCase();
}

export function generateProcessId(row) {
    // Unique composite key for process: S.No + Name (or AppNo if S.No unstable)
    // S.NU is usually stable.
    const key = row.s_nu || row.app_no || row.full_name;
    return `${key}_PROCESS`.replace(/\s+/g, '_').toUpperCase();
}

/**
 * Merges base data with overrides logic
 */
export function mergeWithOverrides(baseData, type) {
    const overrides = getOverrides()[type] || {};

    return baseData.map(row => {
        const id = type === 'inventory' ? generateInventoryId(row) : generateProcessId(row);
        const override = overrides[id];

        if (override) {
            // Merge row with override
            // Also add a flag that it's modified
            return { ...row, ...override, _isModified: true, _id: id };
        }
        return { ...row, _id: id };
    });
}
