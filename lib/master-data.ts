export function updateMaster(d:any,p:any){
  if(!['clients','schemes'].includes(p.kind))throw Error('Invalid master list.');
  const rows=d[p.kind];
  if(p.action==='editMaster'){
    const old=rows.find((x:any)=>x.id===p.id);if(!old)throw Error('This record no longer exists.');
    const fields=p.kind==='clients'?['id','name']:['id','name','official','amc','category','plan','option'];
    const next={...old};for(const key of fields){if(typeof p.record?.[key]!=='string'||!p.record[key].trim())throw Error('Please complete all fields.');next[key]=p.record[key].trim();}
    if(rows.some((x:any)=>x.id===next.id&&x.id!==p.id))throw Error('This ID already exists.');
    if(p.kind==='schemes'){if(typeof p.record.active!=='boolean')throw Error('Choose a scheme status.');next.active=p.record.active;}
    d[p.kind]=rows.map((x:any)=>x.id===p.id?next:x);
    if(p.kind==='schemes'){
      for(const key of ['favourites','recent'])d[key]=d[key].map((id:string)=>id===p.id?next.id:id);
      d.baskets=d.baskets.map((b:any)=>({...b,items:b.items.map((i:any)=>i.id===p.id?{...i,id:next.id}:i)}));
    }
  }else if(p.action==='deleteMaster'){
    if(!Array.isArray(p.ids)||!p.ids.length||p.ids.some((id:any)=>typeof id!=='string'))throw Error('Select records to delete.');
    const ids=new Set(p.ids);d[p.kind]=rows.filter((x:any)=>!ids.has(x.id));
    if(p.kind==='schemes')for(const key of ['favourites','recent'])d[key]=d[key].filter((id:string)=>!ids.has(id));
  }else throw Error('Invalid master action.');
}
