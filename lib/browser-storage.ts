import { savePortfolio } from './portfolio-store';
import { updateMaster } from './master-data';
import uploaded from './uploaded-schemes.json';
import {
  sampleClients,
  sampleBaskets,
  sampleSchemes,
  validateAllocation,
} from './domain';
export const browserEdition = () =>
  typeof document !== 'undefined' &&
  document.documentElement.dataset.storage === 'browser';
const canonical = (s: string) =>
  s
    .toLowerCase()
    .replace(/\bpru\b/g, 'prudential')
    .replace(/\b(reg(ular)?|plan|growth|allocation)\b/g, '')
    .replace(/\(g\)/g, '')
    .replace(/[^a-z0-9]/g, '');
function seed() {
  return {
    clients: sampleClients,
    schemes: uploaded,
    records: [],
    favourites: [],
    recent: [],
    baskets: sampleBaskets.map((b) => ({
      ...b,
      items: b.items.map((i) => ({
        ...i,
        id:
          uploaded.find(
            (s) =>
              canonical(s.name) ===
              canonical(sampleSchemes.find((x) => x.id === i.id)!.name),
          )?.id || i.id,
      })),
    })),
  };
}
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('purohit-allocation-console', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('workspace');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () =>
      reject(
        Error(
          'Browser storage is unavailable. Enable storage for this website.',
        ),
      );
  });
}
export async function localData(payload?: any): Promise<any> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('workspace', 'readwrite'),
      store = tx.objectStore('workspace');
    let output: any, problem: Error;
    const r = store.get('data');
    r.onsuccess = () => {
      try {
        const d: any = r.result || seed();
        d.portfolios ??= [];
        d.portfolioActions ??= [];
        if (payload) {
          const p = payload;
          switch (p.action) {
            case 'portfolio':
              output = savePortfolio(d, p.portfolio);
              break;
            case 'portfolioActionBatch':
              if (!p.batch?.id || !p.batch?.client?.id || !Array.isArray(p.batch.instructions) || !p.batch.instructions.length)
                throw Error('Add at least one valid portfolio instruction.');
              if (!d.clients.some((x: any) => x.id === p.batch.client.id))
                throw Error('Client no longer exists.');
              d.portfolioActions = [p.batch, ...d.portfolioActions.filter((x: any) => x.id !== p.batch.id)];
              output = p.batch;
              break;
            case 'editMaster':
            case 'deleteMaster':
              updateMaster(d, p);
              break;
            case 'save': {
              const a = structuredClone(p.record);
              validateAllocation(a, a.status === 'final');
              if (!['draft', 'final'].includes(a.status))
                throw Error('Invalid allocation status');
              if (
                d.records.some(
                  (x: any) => x.id === a.id && x.status === 'final',
                )
              )
                throw Error('Finalised allocations cannot be changed.');
              a.client = d.clients.find((x: any) => x.id === a.client.id);
              if (!a.client) throw Error('Client not found');
              a.lines = a.lines.map((l: any) => {
                const scheme = d.schemes.find(
                  (s: any) => s.id === l.scheme.id && s.active,
                );
                if (!scheme)
                  throw Error('A selected scheme is inactive or missing.');
                return {
                  scheme,
                  amount: l.amount,
                  folio: (l.folio || '').trim(),
                };
              });
              a.date = new Date().toISOString();
              a.queued = false;
              d.records = [a, ...d.records.filter((x: any) => x.id !== a.id)];
              output = a;
              break;
            }
            case 'deleteDraft':
              d.records = d.records.filter(
                (x: any) => x.id !== p.id || x.status !== 'draft',
              );
              break;
            case 'preference':
              if (
                !['favourites', 'recent'].includes(p.key) ||
                !Array.isArray(p.value)
              )
                throw Error('Invalid preference');
              d[p.key] = p.value;
              break;
            case 'basket':
              if (
                !p.basket.name.trim() ||
                !p.basket.items.length ||
                Math.abs(
                  p.basket.items.reduce((n: number, x: any) => n + x.pct, 0) -
                    100,
                ) > 0.001
              )
                throw Error('Basket percentages must total 100%.');
              d.baskets = [
                ...d.baskets.filter((x: any) => x.id !== p.basket.id),
                p.basket,
              ];
              break;
            case 'queue': {
              const a = d.records.find(
                (x: any) => x.id === p.id && x.status === 'final',
              );
              if (!a) throw Error('Finalised record not found');
              a.queued = true;
              output = a;
              break;
            }
            case 'import': {
              if (
                !['clients', 'schemes'].includes(p.kind) ||
                !p.rows?.length ||
                p.rows.length > 20000
              )
                throw Error('Invalid import');
              const ids = new Set<string>();
              for (const x of p.rows) {
                if (!x.id || !x.name || ids.has(x.id))
                  throw Error('Missing or duplicate ID: ' + x.id);
                if (
                  p.kind === 'schemes' &&
                  (!x.official || !x.amc || !x.category)
                )
                  throw Error('Missing scheme fields');
                ids.add(x.id);
              }
              if (p.replace) {
                d[p.kind] = structuredClone(p.rows);
                if (p.kind === 'clients') {
                  for (const list of ['portfolios', 'portfolioHistory'])
                    d[list] = (d[list] || []).filter((x: any) =>
                      ids.has(x.clientId),
                    );
                } else {
                  const schemes = new Map(
                    p.rows.map((x: any) => [x.id, x] as const),
                  );
                  d.portfolios = (d.portfolios || []).map((portfolio: any) => ({
                    ...portfolio,
                    holdings: portfolio.holdings.map((holding: any) => {
                      const scheme: any = schemes.get(holding.schemeId);
                      return scheme
                        ? { ...holding, amc: scheme.amc }
                        : { ...holding, schemeId: '' };
                    }),
                  }));
                  for (const key of ['favourites', 'recent'])
                    d[key] = d[key].filter((id: string) => ids.has(id));
                  d.baskets = d.baskets
                    .map((basket: any) => ({
                      ...basket,
                      items: basket.items.filter((item: any) => ids.has(item.id)),
                    }))
                    .filter((basket: any) => basket.items.length);
                }
              } else {
                const existing = new Set(d[p.kind].map((x: any) => x.id));
                if (p.rows.some((x: any) => existing.has(x.id)))
                  throw Error('An imported ID already exists.');
                d[p.kind].push(...p.rows);
              }
              output = { count: p.rows.length };
              break;
            }
            default:
              throw Error('Unknown action');
          }
        }
        store.put(d, 'data');
        output = output || (payload ? { ok: true } : d);
      } catch (e) {
        problem = e as Error;
        tx.abort();
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve(output);
    };
    tx.onabort = () => {
      db.close();
      reject(problem || Error('Unable to save. Browser storage may be full.'));
    };
    tx.onerror = () => {
      db.close();
      reject(Error('Unable to save in browser storage.'));
    };
  });
}
