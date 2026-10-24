// IndexedDB：kv（設定、進度、練習日）、cards（卡片）、log（複習紀錄）。
const NAME = 'shadowing';
const VERSION = 1;
let dbp;

function open() {
  dbp ||= new Promise((resolve, reject) => {
    const req = indexedDB.open(NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('kv');
      db.createObjectStore('cards', { keyPath: 'id' });
      db.createObjectStore('log', { autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    Promise.resolve(fn(s)).then(r => { result = r; });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

const req2p = req => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

export const kvGet = key => tx('kv', 'readonly', s => req2p(s.get(key)));
export const kvSet = (key, value) => tx('kv', 'readwrite', s => { s.put(value, key); });
export const allCards = () => tx('cards', 'readonly', s => req2p(s.getAll()));
export const putCards = cards => tx('cards', 'readwrite', s => { for (const c of cards) s.put(c); });
export const addLog = entry => tx('log', 'readwrite', s => { s.add(entry); });
export const allLogs = () => tx('log', 'readonly', s => req2p(s.getAll()));

export async function exportAll() {
  const kv = await tx('kv', 'readonly', async s => {
    const keys = await req2p(s.getAllKeys());
    const vals = await req2p(s.getAll());
    return Object.fromEntries(keys.map((k, i) => [k, vals[i]]));
  });
  return { app: 'shadowing', version: VERSION, exported: new Date().toISOString(), kv, cards: await allCards(), log: await allLogs() };
}

export async function importAll(data) {
  if (data?.app !== 'shadowing') throw new Error('這不是本 App 的備份檔');
  await tx('kv', 'readwrite', s => { s.clear(); for (const [k, v] of Object.entries(data.kv || {})) s.put(v, k); });
  await tx('cards', 'readwrite', s => { s.clear(); for (const c of data.cards || []) s.put(c); });
  await tx('log', 'readwrite', s => { s.clear(); for (const l of data.log || []) s.add(l); });
}

export async function wipe() {
  for (const store of ['kv', 'cards', 'log']) await tx(store, 'readwrite', s => { s.clear(); });
}
