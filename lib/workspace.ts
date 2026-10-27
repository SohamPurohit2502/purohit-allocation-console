import type { Client, Scheme } from './domain';
import { amcKey, inferAMC, nameKey, type Holding, type Portfolio } from './portfolio';

export type DeskHolding = Holding & { category?: string; days?: number; absolute?: number; cagr?: number; duplicateSourceRow?: boolean };
export type Action = 'none' | 'buy' | 'redemption' | 'switch' | 'sip-start' | 'sip-stop';
export type DeskRow = { id: string; holding?: DeskHolding; scheme?: Scheme; folio: string; action: Action; amount: string; target?: Scheme; date?: string; frequency?: string };
export type Plan = { id: string; client: Client; rows: DeskRow[]; status: 'draft' | 'final'; date: string; drive?: string; driveError?: string };
export type SectorWeight = { schemeId: string; sector: string; weight: number; asOf: string };
export const money = (paise: number) => (paise / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });
export const amount = (s: string) => Math.round(Number(s.replace(/[₹,\s]/g, '')) * 100);
export const holdingPeriod = (days?: number) => days === undefined ? '—' : `${Math.floor(days / 365)} yrs, ${Math.floor((days % 365) / 30)} mo, ${Math.floor(days % 365 % 30)} days`;

// Quoted CSV fields, escaped quotes, BOMs, CRLFs and embedded newlines are preserved.
export function csvRows(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && (c === ',' || c === '\n')) { row.push(cell.trim()); cell = ''; if (c === '\n') { if (row.some(Boolean)) rows.push(row); row = []; } }
    else if (c !== '\r' || quoted) cell += c;
  }
  if (quoted) throw Error('A CSV quoted field is incomplete. Export the file again.');
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
  return rows;
}
export function parseFolioMaster(text: string, schemes: Scheme[]) {
  const [headers, ...sourceRows] = csvRows(text);
  const required = ['CLIENT NAME','IWELL CODE','FOLIO NO','SCHEME NAME','PURCHASE VALUE','CURRENT VALUE'];
  if (!headers || required.some(h => !headers.includes(h))) throw Error('Expected the Investwell folio master columns: ' + required.join(', '));
  const index = new Map(headers.map((h,i) => [h,i]));
  const totals=sourceRows.filter(row=>/^(grand )?total$/i.test(row[index.get('CLIENT NAME')!]||'')&&!row[index.get('IWELL CODE')!]&&!row[index.get('FOLIO NO')!]&&!row[index.get('SCHEME NAME')!]);
  const rows=sourceRows.filter(row=>!totals.includes(row));
  if (!rows.length || rows.length > 200000) throw Error('Upload between 1 and 200,000 holdings.');
  const identity = new Map<string,Set<string>>();
  for (const row of rows) { const id=row[index.get('IWELL CODE')!]; const name=row[index.get('CLIENT NAME')!]; if(!identity.has(id))identity.set(id,new Set());identity.get(id)!.add(name); }
  const conflicts = new Set([...identity].filter(([,names])=>names.size>1).map(([id])=>id));
  const schemeIndex = new Map<string,Scheme[]>();
  for(const s of schemes)for(const key of new Set([nameKey(s.name),nameKey(s.official)])){const list=schemeIndex.get(key)||[];list.push(s);schemeIndex.set(key,list)}
  const amcCache=new Map<string,string>();
  const clients = new Map<string, Client>(), groups = new Map<string, DeskHolding[]>(), seen = new Set<string>();
  const lotKeys=new Set<string>();let separateLots=0,duplicateRows=0;
  rows.forEach((cells, i) => {
    const get = (key: string) => cells[index.get(key) ?? -1] || '';
    const n = (key: string, optional = false) => { const raw = get(key).replace(/[,%₹\s]/g, ''); if (optional && (!raw || raw === '-')) return undefined; const value = Number(raw); if (!raw || !Number.isFinite(value)) throw Error(`Row ${i+2}: invalid ${key}.`); return value; };
    const sourceId = get('IWELL CODE'), name = get('CLIENT NAME'), folio = get('FOLIO NO'), schemeName = get('SCHEME NAME');
    if(conflicts.has(sourceId)&&!get('IWELL CODE2'))throw Error(`Row ${i+2}: conflicting Iwell ID requires IWELL CODE2 to separate investors.`);
    const id=conflicts.has(sourceId)?sourceId+'~'+get('IWELL CODE2'):sourceId;
    if (!id || !name || !folio || !schemeName) throw Error(`Row ${i+2}: client ID, client, folio and scheme are required.`);
    if (clients.has(id) && clients.get(id)!.name !== name) throw Error(`Row ${i+2}: client ID ${id} has conflicting names.`);
    const matches=schemeIndex.get(nameKey(schemeName))||[];
    const scheme = matches.length===1?matches[0]:undefined, key = `${id}|${scheme?.id || schemeName.toLowerCase()}|${folio}`;
    const signature=JSON.stringify(cells);
    const duplicateSourceRow=seen.has(signature);if(duplicateSourceRow)duplicateRows++;
    if(lotKeys.has(key))separateLots++;lotKeys.add(key);
    seen.add(signature); clients.set(id,{id,name});
    const invested = Math.round(n('PURCHASE VALUE')! * 100), value = Math.round(n('CURRENT VALUE')! * 100);
    if (![invested,value].every(x => Number.isSafeInteger(x) && x >= 0)) throw Error(`Row ${i+2}: invalid holding values.`);
    const days = n('AVG HOLDING DAYS',true);
    if(!scheme&&!amcCache.has(schemeName))amcCache.set(schemeName,inferAMC(schemeName,schemes));
    const holding: DeskHolding = { id: crypto.randomUUID(), name: schemeName, schemeId: scheme?.id || '', amc: scheme?.amc || amcCache.get(schemeName) || '', folio, units:n('BALANCE UNITS',true) ?? 0, nav:n('CURRENT NAV',true) ?? 0, invested,value,category:get('CATEGORY'),days,absolute:n('ABSOLUTE RETURN',true),cagr:n('CAGR',true) };
    if(duplicateSourceRow)holding.duplicateSourceRow=true;
    if (holding.units < 0 || holding.nav < 0 || (days !== undefined && days < 0)) throw Error(`Row ${i+2}: negative units, NAV or holding days.`);
    groups.set(id,[...(groups.get(id)||[]),holding]);
  });
  const date = new Date().toISOString();
  const portfolios: Portfolio[] = [...groups].map(([clientId,holdings]) => ({ id:'master-'+clientId, clientId, clientName:clients.get(clientId)!.name, source:'Folio master', asOf:date.slice(0,10), holdings, originalHoldings:structuredClone(holdings), importedAt:date,updatedAt:date }));
  if(totals.length>1)throw Error('Multiple grand total rows found. Upload one complete folio master.');
  if(totals.length){const reported=Number(totals[0][index.get('CURRENT VALUE')!].replace(/,/g,''));const extracted=portfolios.reduce((sum,p)=>sum+p.holdings.reduce((s,h)=>s+h.value,0),0)/100;if(!Number.isFinite(reported)||Math.abs(reported-extracted)>1)throw Error('Holdings do not reconcile with the file’s current-value total. No data was replaced.');}
  return {clients:[...clients.values()],portfolios,count:rows.length,disambiguatedIds:conflicts.size,separateLots,duplicateRows};
}
export function validatePlan(plan: Plan) {
  if (!plan.id || !plan.client?.id || !Array.isArray(plan.rows)) throw Error('Invalid portfolio plan.');
  const changed = plan.rows.filter(r => r.action !== 'none');
  if (!changed.length) throw Error('Add at least one investment or portfolio action.');
  for (const r of changed) {
    const name = r.scheme?.name || r.holding?.name || 'Scheme';
    if (!r.scheme) throw Error(`Match ${name} to a master scheme first.`);
    if (!['buy','redemption','switch','sip-start','sip-stop'].includes(r.action)) throw Error('Unsupported action.');
    if (r.action !== 'sip-stop' && (!Number.isSafeInteger(amount(r.amount)) || amount(r.amount) <= 0)) throw Error(`Enter a positive amount for ${name}.`);
    if (['redemption','switch','sip-stop'].includes(r.action) && !r.holding) throw Error(`${name}: this action needs an existing holding.`);
    if (['redemption','switch'].includes(r.action) && amount(r.amount) > r.holding!.value) throw Error(`${name}: the amount exceeds the current holding.`);
    if (r.action === 'switch' && (!r.target || !r.target.active || amcKey(r.target.amc) !== amcKey(r.scheme.amc) || r.target.id === r.scheme.id)) throw Error(`${name}: choose a different active scheme in the same AMC.`);
    if (r.action === 'sip-start' && (!r.date || !r.frequency)) throw Error(`${name}: choose the SIP start date and frequency.`);
  }
}
export function rowValues(rows: DeskRow[], proposed: boolean) {
  const values: {scheme?: Scheme; holding?: DeskHolding; value: number}[] = [];
  for (const r of rows) {
    let value = r.holding?.value || 0;
    const a = Number.isFinite(amount(r.amount)) ? Math.max(0,amount(r.amount)) : 0;
    if (proposed) {
      if (r.action === 'buy') value += a;
      if (r.action === 'redemption') value -= Math.min(a,value);
      if (r.action === 'switch' && r.target && r.scheme && amcKey(r.target.amc) === amcKey(r.scheme.amc) && r.target.id !== r.scheme.id) { const move = Math.min(a,value); value -= move; values.push({scheme:r.target,value:move}); }
    }
    values.push({scheme:r.scheme,holding:r.holding,value});
  }
  return values;
}
export function allocation(rows: DeskRow[], proposed: boolean, mode: 'Category'|'AMC'|'Sector', weights: SectorWeight[]) {
  const result: Record<string,number> = {};
  const add = (key: string, value: number) => { result[key] = (result[key] || 0) + value; };
  for (const r of rowValues(rows,proposed)) {
    if (!r.value) continue;
    if (mode === 'Sector') { const w = weights.filter(x=>x.schemeId === (r.scheme?.id || r.holding?.schemeId)); if (!w.length) add('Unmapped',r.value); else { let covered=0; for (const x of w) { add(x.sector,r.value*x.weight/100); covered+=x.weight; } if (covered<100) add('Unmapped',r.value*(100-covered)/100); } }
    else add(mode === 'AMC' ? r.scheme?.amc || r.holding?.amc || 'Unmapped' : r.scheme?.category || r.holding?.category?.split(':').pop()?.trim() || 'Unmapped', r.value);
  }
  return Object.entries(result).sort((a,b)=>b[1]-a[1]);
}
export function parseSectors(text: string, schemes: Scheme[]): SectorWeight[] {
  const [headers,...rows] = csvRows(text); const expected=['Scheme ID','Sector','Weight','As of'];
  if (!headers || expected.some(x=>!headers.includes(x)) || !rows.length) throw Error('Use columns: Scheme ID, Sector, Weight, As of. Weight is a percentage.');
  const seen=new Set<string>(), totals=new Map<string,number>(), dates=new Map<string,string>();
  return rows.map((row,i)=> { const get=(key:string)=>row[headers.indexOf(key)]||''; const schemeId=get('Scheme ID'),sector=get('Sector'),weight=Number(get('Weight')),asOf=get('As of');
    if(!schemes.some(s=>s.id===schemeId)||!sector||!Number.isFinite(weight)||weight<=0||weight>100||!/^\d{4}-\d{2}-\d{2}$/.test(asOf)||isNaN(Date.parse(asOf))) throw Error(`Sector row ${i+2} is invalid.`);
    if(seen.has(schemeId+'|'+sector)||dates.has(schemeId)&&dates.get(schemeId)!==asOf) throw Error('Duplicate sector or mixed dates for one scheme.');
    seen.add(schemeId+'|'+sector); dates.set(schemeId,asOf); const total=(totals.get(schemeId)||0)+weight; if(total>100.001) throw Error('Sector weights exceed 100%.'); totals.set(schemeId,total); return {schemeId,sector,weight,asOf};
  });
}
