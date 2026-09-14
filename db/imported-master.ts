import {env} from 'cloudflare:workers';
import uploadedSchemes from '@/lib/uploaded-schemes.json';
import {sampleSchemes} from '@/lib/domain';
const marker='scheme-master:2026-09-14:top-schemes';
const canonical=(name:string)=>name.toLowerCase().replace(/\bpru\b/g,'prudential').replace(/\bsl\b/g,'sun life').replace(/\b(reg(ular)?|plan|growth|allocation)\b/g,'').replace(/\(g\)/g,'').replace(/[^a-z0-9]/g,'');
export async function syncUploadedMaster(){
 const db=env.DB;
 if(await db.prepare('SELECT id FROM preferences WHERE id=?').bind(marker).first())return;
 for(let start=0;start<uploadedSchemes.length;start+=75){await db.batch(uploadedSchemes.slice(start,start+75).map(s=>db.prepare('INSERT OR IGNORE INTO schemes(id,payload) VALUES(?,?)').bind(s.id,JSON.stringify(s))))}
 const replacements=new Map(sampleSchemes.flatMap(s=>{const matches=uploadedSchemes.filter(u=>canonical(u.name)===canonical(s.name));return matches.length===1?[[s.id,matches[0]] as const]:[]}));
 const statements=sampleSchemes.map(s=>db.prepare('UPDATE schemes SET payload=? WHERE id=?').bind(JSON.stringify({...s,active:false}),s.id));
 const baskets=(await db.prepare('SELECT id,payload FROM baskets').all<{id:string;payload:string}>()).results;
 for(const row of baskets){const b=JSON.parse(row.payload);if(b.items.every((x:any)=>replacements.has(x.id)||!sampleSchemes.some(s=>s.id===x.id))){b.items=b.items.map((x:any)=>({...x,id:replacements.get(x.id)?.id||x.id}));statements.push(db.prepare('UPDATE baskets SET payload=? WHERE id=?').bind(JSON.stringify(b),row.id))}}
 for(const key of ['favourites','recent']){const row=await db.prepare('SELECT payload FROM preferences WHERE id=?').bind(key).first<{payload:string}>();if(row){const ids=JSON.parse(row.payload).map((id:string)=>replacements.get(id)?.id||id);statements.push(db.prepare('UPDATE preferences SET payload=? WHERE id=?').bind(JSON.stringify([...new Set(ids)]),key))}}
 statements.push(db.prepare('INSERT OR IGNORE INTO preferences(id,payload) VALUES(?,?)').bind(marker,JSON.stringify({source:'Top Schemes-14-09-2026-05_38_28.xlsx',count:uploadedSchemes.length})));
 await db.batch(statements);
}
