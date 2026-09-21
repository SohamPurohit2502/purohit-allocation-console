import {validateHoldings,type Portfolio} from './portfolio';
export function savePortfolio(d:any,p:Portfolio){
 if(!d.clients.some((c:any)=>c.id===p.clientId))throw Error('Select a saved client.');
 validateHoldings(p.holdings);
 for(const h of p.holdings){if(h.schemeId&&!d.schemes.some((s:any)=>s.id===h.schemeId&&s.amc===h.amc))throw Error('A linked scheme or AMC has changed. Please match it again.');}
 const old=(d.portfolios||[]).find((x:Portfolio)=>x.clientId===p.clientId);
 const next=structuredClone(p);next.updatedAt=new Date().toISOString();
 if(old?.id===p.id)next.originalHoldings=old.originalHoldings;
 if(old&&old.id!==p.id)d.portfolioHistory=[...(d.portfolioHistory||[]),old];
 d.portfolios=[...(d.portfolios||[]).filter((x:Portfolio)=>x.clientId!==p.clientId),next];
 return next;
}
