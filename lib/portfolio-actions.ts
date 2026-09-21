import type {Client,Scheme} from './domain';

export type PortfolioActionKind='redemption'|'switch'|'sip-start'|'sip-stop';
export type PortfolioInstruction={
 id:string;kind:PortfolioActionKind;sourceScheme?:Scheme;targetScheme?:Scheme;folio:string;
 basis?:'amount'|'units'|'all';amount?:number;units?:number;sipAmount?:number;
 frequency?:string;startDate?:string;stopDate?:string;installmentDay?:number;
 installments?:number;mandate?:string;sipReference?:string;
};
export type PortfolioActionBatch={id:string;client:Client;instructions:PortfolioInstruction[];status:'draft'|'ready'|'submitted'|'executed'|'rejected';createdAt:string;updatedAt:string};
