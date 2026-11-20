import {NextRequest,NextResponse} from 'next/server';
export function proxy(req:NextRequest){
 const email=process.env.ADMIN_EMAIL;const password=process.env.ADMIN_PASSWORD;
 if(!email||!password)return new NextResponse('Configuration ADMIN_EMAIL / ADMIN_PASSWORD manquante',{status:503});
 const auth=req.headers.get('authorization');
 let username='',supplied='';
 if(auth?.startsWith('Basic '))try{const decoded=atob(auth.slice(6));const pos=decoded.indexOf(':');username=decoded.slice(0,pos);supplied=decoded.slice(pos+1)}catch{}
 if(username!==email||supplied!==password)return new NextResponse('Connexion requise',{status:401,headers:{'WWW-Authenticate':'Basic realm="Pilotage Achats", charset="UTF-8"','Cache-Control':'no-store'}});
 return NextResponse.next();
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico).*)']};
