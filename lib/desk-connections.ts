import type { Plan } from './workspace';
import { plansWorkbook } from './desk-export';
export const DRIVE_ACCOUNT='support@purohitassociates.org';
export const DEFAULT_BACKEND='https://purohit-datasheets.pages.dev/.netlify/functions/portfolio';
let officeCode='',activeUntil=0,connected=false;
export const driveConnected=()=>Boolean(connected&&officeCode&&Date.now()<activeUntil);
export function settings(){try{return {aiUrl:DEFAULT_BACKEND,...JSON.parse(localStorage.getItem('purohit-connections')||'{}')}}catch{return {aiUrl:DEFAULT_BACKEND}}}
export function loadGoogle(){return Promise.resolve()}
export function setOfficeCode(code:string){officeCode=code.trim();activeUntil=Date.now()+15*60*1000;connected=false}
async function request(action:string,input:Record<string,unknown>={}){
 if(!officeCode||Date.now()>=activeUntil){officeCode='';connected=false;throw Error('Enter the office access code in Data → Connections. Your local work is safe.')}
 const url=settings().aiUrl;if(!/^https:\/\//.test(url))throw Error('Configure the secure office backend URL.');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),65000);
 try{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','x-staff-code':officeCode},body:JSON.stringify({action,...input}),signal:controller.signal});
 if(r.status===401){officeCode='';connected=false;throw Error('Office session expired or code incorrect. Reconnect in Data → Connections.')}
 if(!r.headers.get('content-type')?.includes('application/json'))throw Error('The portfolio backend is not deployed yet. Your local work remains available.');
 const data:any=await r.json();if(!r.ok)throw Error(data.error||'The office service is unavailable.');activeUntil=Date.now()+15*60*1000;return data;
 }catch(e){if(e instanceof TypeError)throw Error('Cannot reach the portfolio backend. Check its deployment and your connection.');throw e}finally{clearTimeout(timer)}
}
export async function connectDrive(){const status=await request('status');if(status.owner?.toLowerCase()!==DRIVE_ACCOUNT)throw Error('The office Drive must belong to '+DRIVE_ACCOUNT+'.');connected=true}
export async function saveDrivePlan(plan:Plan){const bytes=plansWorkbook([plan]);let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));const result=await request('save',{plan,excel:btoa(binary)});return result.url as string}
export async function loadDrivePlans():Promise<Plan[]>{const result=await request('list');return result.plans}
export async function askAI(question:string,context:unknown){return request('ask',{question,context}) as Promise<{answer:string;provider:string}>}
