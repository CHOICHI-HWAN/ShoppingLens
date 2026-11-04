export type Status = 'pending' | 'flagged' | 'verified' | 'rejected';
export type PriceRecord = {
 id:string; productNo:string; name:string; price:number; regularPrice:number|null;
 store:string; createdAt:string; status:Status; source:'demo'|'user';
 imageHash?:string; ocrText?:string; notes?:string; reporter?:string;
};
export const STORES = ['세종점','대전점','양재점','상봉점','광명점','송도점','하남점','일산점','부산점','대구점','기타'];
export const DEMO:PriceRecord[] = [
 {id:'demo1',productNo:'1234567',name:'커클랜드 세탁세제 5.7L',price:24990,regularPrice:32990,store:'세종점',createdAt:'2026-10-15T12:00:00.000Z',status:'verified',source:'demo'},
 {id:'demo2',productNo:'1234567',name:'커클랜드 세탁세제 5.7L',price:28990,regularPrice:32990,store:'대전점',createdAt:'2026-09-21T12:00:00.000Z',status:'verified',source:'demo'},
 {id:'demo3',productNo:'9876543',name:'올리브오일 1L',price:15990,regularPrice:19990,store:'양재점',createdAt:'2026-10-11T12:00:00.000Z',status:'verified',source:'demo'}
];
