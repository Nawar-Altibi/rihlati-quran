export const STORAGE_VERSION = 2;

const arrays = ['units','revisions','attempts','sessions','tasks','activities'];

/** Upgrade saved v1 data without replacing its records, identifiers, or seed history. */
export function migrateData(saved, defaults) {
  if (!saved || typeof saved !== 'object' || ![1, STORAGE_VERSION].includes(saved.version)) {
    throw new Error('نسخة البيانات غير مدعومة');
  }
  const migrated = structuredClone(saved);
  for (const key of arrays) {
    if (migrated[key] != null && !Array.isArray(migrated[key])) throw new Error(`بيانات ${key} غير صالحة`);
    migrated[key] ??= [];
  }
  migrated.settings = { ...structuredClone(defaults), ...(migrated.settings || {}) };
  migrated.scheduledSessions ??= [];
  migrated.weeklyGoals ??= [];
  migrated.version = STORAGE_VERSION;
  return migrated;
}

export function loadData(storage, key, createInitial, defaults) {
  const raw = storage.getItem(key);
  if (raw == null) return { data: createInitial(), migrated: false, error: null };
  try {
    const parsed = JSON.parse(raw);
    const data = migrateData(parsed, defaults);
    const migrated = parsed.version !== STORAGE_VERSION;
    if (migrated) storage.setItem(key, JSON.stringify(data));
    return { data, migrated, error: null };
  } catch (error) {
    return { data: null, migrated: false, error };
  }
}
