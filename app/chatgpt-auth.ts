import {headers} from "next/headers";
export type ChatGPTUser={userId:string;displayName:string;email:string;fullName:string|null};
export async function getChatGPTUser():Promise<ChatGPTUser|null>{
 const email=process.env.ADMIN_EMAIL;const password=process.env.ADMIN_PASSWORD;
 if(!email||!password)return null;
 const h=await headers();const authorization=h.get('authorization');
 if(!authorization?.startsWith('Basic '))return null;
 let decoded='';try{decoded=Buffer.from(authorization.slice(6),'base64').toString('utf8')}catch{return null}
 const sep=decoded.indexOf(':');if(sep<0)return null;
 const username=decoded.slice(0,sep);const supplied=decoded.slice(sep+1);
 const {timingSafeEqual}=await import('node:crypto');
 const a=Buffer.from(supplied);const b=Buffer.from(password);
 if(username!==email||a.length!==b.length||!timingSafeEqual(a,b))return null;
 return {userId:email,displayName:email,email,fullName:null};
}
