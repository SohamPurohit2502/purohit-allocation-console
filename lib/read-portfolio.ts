import {GlobalWorkerOptions,getDocument} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {parsePortfolioPages,type PdfPage} from './portfolio';
import type {Scheme} from './domain';
GlobalWorkerOptions.workerSrc=workerUrl;
export async function readPortfolio(file:File,schemes:Scheme[]){
 if(file.size>25e6)throw Error('Choose a PDF smaller than 25 MB.');
 const task=getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false});
 try{const doc=await task.promise;if(doc.numPages>100)throw Error('Use a report of at most 100 pages.');const pages:PdfPage[]=[];for(let n=1;n<=doc.numPages;n++){const page=await doc.getPage(n),v=page.getViewport({scale:1}),t=await page.getTextContent();pages.push({width:v.width,height:v.height,items:t.items.filter((i:any)=>i.str?.trim()).map((i:any)=>({text:i.str,x:i.transform[4],y:v.height-i.transform[5],width:i.width}))})}return parsePortfolioPages(pages,schemes)}finally{await task.destroy()}
}
