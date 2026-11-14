import type { Plan } from './workspace';
import { plansWorkbook } from './desk-export';
export const DRIVE_ACCOUNT='support@purohitassociates.org';
export const DEFAULT_BACKEND='https://purohit-portfolio-api.pages.dev/api/portfolio';
let officeCode='',activeUntil=0,connected=false;
export const driveConnected=()=>Boolean(connected&&officeCode&&Date.now()<activeUntil);
export function settings(){return {aiUrl:DEFAULT_BACKEND}}
export function loadGoogle(){return Promise.resolve()}
export function setOfficeCode(code:string){officeCode=code.trim();activeUntil=Date.now()+15*60*1000;connected=false}
async function request(action:string,input:Record<string,unknown>={}){
 if(!officeCode||Date.now()>=activeUntil){officeCode='';connected=false;throw Error('Enter the office access code in Data → Connections. Your local work is safe.')}
 const url=settings().aiUrl;if(!/^https:\/\//.test(url))throw Error('Configure the secure office backend URL.');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),125000);
 try{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','x-staff-code':officeCode},body:JSON.stringify({action,...input}),signal:controller.signal});
 if(r.status===401){officeCode='';connected=false;throw Error('Office session expired or code incorrect. Reconnect in Data → Connections.')}
 if(!r.headers.get('content-type')?.includes('application/json'))throw Error('The portfolio backend is not deployed yet. Your local work remains available.');
 const data:any=await r.json();if(!r.ok)throw Error(data.error||'The office service is unavailable.');activeUntil=Date.now()+15*60*1000;return data;
 }catch(e){if(controller.signal.aborted)throw Error('The upload timed out. Your local data is safe; try Save all data again.');if(e instanceof TypeError)throw Error('Cannot reach the portfolio backend. Check its deployment and your connection.');throw e}finally{clearTimeout(timer)}
}
export async function connectDrive(){const status=await request('status');if(status.owner?.toLowerCase()!==DRIVE_ACCOUNT)throw Error('The office Drive must belong to '+DRIVE_ACCOUNT+'.');connected=true}
export async function saveDrivePlan(plan:Plan){const bytes=plansWorkbook([plan]);let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));const result=await request('save',{plan,excel:btoa(binary)});return result.url as string}
export async function loadDrivePlans():Promise<Plan[]>{const result=await request('list');return result.plans}
export type AIReply={answer:string;provider:string;sources?:{title:string;url:string}[];searched?:boolean;searchSuggestions?:string;searchError?:string};
export async function askAI(question:string,context:unknown,history:{role:string;content:string}[]=[]){return request('ask',{question,context,history}) as Promise<AIReply>}

export async function authorizeDrive(){const result=await request('connect');return result.url as string}

export async function backupWorkspace(data:any){
 const content=JSON.stringify({version:1,data});if(content.length>100000000)throw Error('Workspace exceeds the 100 MB backup limit.');
 const compressed=new Uint8Array(await new Response(new Blob([content]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());let binary='';for(let i=0;i<compressed.length;i+=8192)binary+=String.fromCharCode(...compressed.subarray(i,i+8192));
 return request('backup',{archive:{version:1,encoding:'gzip',content:btoa(binary),clients:data.clients.length,holdings:(data.portfolios||[]).reduce((n:number,p:any)=>n+(p.holdings?.length||0),0)}});
}
export async function listWorkspaceBackups(){return (await request('backups')).backups as {id:string;name:string;date:string;clients:number;holdings:number}[]}
export async function restoreWorkspaceBackup(id:string){const w=(await request('restore',{id})).workspace;if(w.encoding!=='gzip')return w;const bytes=Uint8Array.from(atob(w.content),c=>c.charCodeAt(0));const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();const chunks:Uint8Array[]=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>100000000)throw Error('Backup exceeds the 100 MB restore limit.');chunks.push(value)}}finally{await reader.cancel()}return JSON.parse(await new Blob(chunks as BlobPart[]).text())}

