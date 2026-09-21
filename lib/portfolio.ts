import type {Scheme} from './domain';
export type Holding={id:string;name:string;schemeId:string;amc:string;folio:string;units:number;invested:number;value:number;nav:number};
export type Portfolio={id:string;clientId:string;clientName:string;source:string;asOf:string;holdings:Holding[];originalHoldings:Holding[];importedAt:string;updatedAt:string;reportedValue?:number};
export type PdfItem={text:string;x:number;y:number;width:number};
export type PdfPage={width:number;height:number;items:PdfItem[]};
export const amcKey=(s:string)=>s.toLowerCase().replace(/\bpru\b/g,'prudential').replace(/franklin (india|templeton)/g,'franklin').replace(/\b(mutual|fund|asset|management|company|limited|ltd)\b/g,'').replace(/[^a-z0-9]/g,'');
const nameKey=(s:string)=>s.toLowerCase().replace(/\bpru\b/g,'prudential').replace(/\b(reg(ular)?|plan|fund|growth|gr|std|standard)\b/g,'').replace(/\(g\)/g,'').replace(/&/g,'and').replace(/[^a-z0-9]/g,'');
export function matchScheme(name:string,schemes:Scheme[]){const key=nameKey(name);const found=schemes.filter(s=>nameKey(s.name)===key||nameKey(s.official)===key);return found.length===1?found[0]:undefined}
export function inferAMC(name:string,schemes:Scheme[]){const n=name.toLowerCase().replace(/\bpru\b/g,'prudential');const amcs=[...new Set(schemes.map(s=>s.amc))].sort((a,b)=>b.length-a.length);return amcs.find(a=>n.startsWith(a.toLowerCase().replace(/ mutual fund$/,'')))||(n.startsWith('franklin')?amcs.find(a=>a.toLowerCase().startsWith('franklin')):'')||''}
const num=(s:string)=>Number(s.replace(/,/g,''));
export function parsePortfolioPages(pages:PdfPage[],schemes:Scheme[]){
 const full=pages.flatMap(p=>p.items.map(i=>i.text)).join('\n');
 const wealth=/Mutual Fund Summary Report/.test(full)&&/Inv\. Cost/.test(full);
 const invest=/Portfolio Valuation Summary/.test(full)&&/Balance Units/.test(full);
 if(!wealth&&!invest)throw Error('Unsupported report layout. Use a text-based Wealth Elite valuation report or Investwell Portfolio Valuation Summary. Scanned PDFs need a text-based export.');
 const source=wealth?'Wealth Elite':'Investwell',holdings:Holding[]=[];let reportedValue:number|undefined;
 const pan=full.match(/\b[A-Z]{5}\d{4}[A-Z]\b/)?.[0]||'';
 const first=pages[0].items;const panItem=first.find(i=>i.text.includes(pan)&&pan);const clientName=panItem?first.filter(i=>i.x<pages[0].width*.4&&i.y<panItem.y&&i.y>panItem.y-25).sort((a,b)=>b.y-a.y)[0]?.text||'':'';
 const asOf=wealth?full.match(/as on Date\s*-\s*([^\n]+)/i)?.[1]?.replace(/Current Sensex.*$/,'').trim():full.match(/As on\s+([\d-]+)/i)?.[1];
 for(const page of pages){
  const its=[...page.items].sort((a,b)=>a.y-b.y||a.x-b.x);
  const header=its.find(i=>i.text===(wealth?'Scheme Name':'Scheme'));if(!header)continue;
  const heads=its.filter(i=>Math.abs(i.y-header.y)<12);
  const right=(label:string)=>{const h=heads.find(i=>i.text===label);if(!h)throw Error('Report column not recognised: '+label);return h.x+h.width};
  const columns={units:right(wealth?'Units':'Balance Units'),invested:right(wealth?'Inv. Cost':'Purchase Value'),value:right(wealth?'Cur. Value':'Current Value'),nav:right(wealth?'Cur. Nav':'Current NAV')};
  const read=(field:keyof typeof columns,lo:number,hi:number)=>{const found=its.filter(i=>i.y>=lo&&i.y<=hi&&Math.abs(i.x+i.width-columns[field])<3&&/^-?[\d,]+(?:\.\d+)?$/.test(i.text.trim()));if(found.length!==1)throw Error('Could not safely read '+field+' near a holding. Please use the original report export.');return num(found[0].text)};
  const total=its.find(i=>/^Grand Total\s*:?$/.test(i.text));if(total){try{reportedValue=Math.round(read('value',total.y-2,total.y+2)*100)}catch{}}
  const leftEdge=wealth?header.x+header.width+3:page.width*.264;
  const names=its.filter(i=>i.x<leftEdge&&i.y>header.y+12&&i.y<page.height-24);
  let buffer:PdfItem[]=[];
  for(const item of names){
   const label=item.text.trim();
   const section=/^(Equity|Hybrid|Debt|Other|Liquid and Ultra Short|Arbitrage|International|Gold|Commodity|Fixed Income|Tax Saving|ELSS|Solution Oriented|Index(?: Funds?)?|Fund of Funds|FoF)$/i.test(label);
   if(section||/^(Grand Total|.* Total\s*:|.*PAN\s*:|Disclaimer)/i.test(label)){buffer=[];continue}
   buffer.push(item);
   const end=wealth?/^ARN-/.test(item.text):item.text.trim().endsWith(']');if(!end)continue;
   const text=buffer.map(i=>i.text).join(' ');const m=wealth?text.match(/^(.*?)\s+(\d[\d/\s-]{3,})\s+ARN-/):text.match(/^(.*?)\s*\[([^\]]+)\]$/);
   if(!m)throw Error('Could not read a scheme name and folio. Please review the report format.');
   const name=m[1].trim(),folio=m[2].replace(/\s/g,'');const lo=buffer[0].y-2,hi=item.y+2;
   const matched=matchScheme(name,schemes);
   const h:Holding={id:crypto.randomUUID(),name,folio,schemeId:matched?.id||'',amc:matched?.amc||inferAMC(name,schemes),units:read('units',lo,hi),invested:Math.round(read('invested',lo,hi)*100),value:Math.round(read('value',lo,hi)*100),nav:read('nav',lo,hi)};
   if(h.units<0||h.invested<0||h.value<0)throw Error('Negative holding values require manual review.');holdings.push(h);buffer=[];
  }
 }
 if(!holdings.length)throw Error('No holdings were found. Use a text-based report export.');
 if(new Set(holdings.map(h=>nameKey(h.name)+'|'+h.folio)).size!==holdings.length)throw Error('Duplicate holdings detected. Please use a single-client report.');
 const sum=holdings.reduce((n,h)=>n+h.value,0);
 if(reportedValue===undefined)throw Error('Grand total could not be verified. Import a complete report including the last page.');
 if(Math.abs(sum-reportedValue)>holdings.length)throw Error('Extracted holdings do not match the report total. No data has been saved.');
 return {source,clientName,pan,asOf:asOf||'',holdings,reportedValue};
}
export function foliosFor(amc:string,holdings:Holding[]){return [...new Set(holdings.filter(h=>amcKey(h.amc)===amcKey(amc)&&h.folio).map(h=>h.folio))]}
export function validateHoldings(rows:Holding[]){if(rows.length>5000)throw Error('Too many holdings.');const seen=new Set<string>();for(const [index,h] of rows.entries()){const row='Holding '+(index+1)+(h.name.trim()?' ('+h.name.trim()+')':'');if(!h.id||!h.name.trim()||!h.folio.trim())throw Error(row+' needs a scheme name and folio number.');if(!Number.isFinite(h.units)||h.units<0||!Number.isFinite(h.nav)||h.nav<0||![h.invested,h.value].every(n=>Number.isSafeInteger(n)&&n>=0))throw Error(row+' has invalid or negative values.');const key=(h.schemeId||nameKey(h.name))+'|'+h.folio.trim().toLowerCase();if(seen.has(key))throw Error(row+' duplicates the same scheme and folio.');seen.add(key)}}
