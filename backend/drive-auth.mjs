const OWNER='support@purohitassociates.org';
const BASE='https://purohit-portfolio-api.pages.dev';
const CALLBACK=BASE+'/oauth/callback';
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const random=()=>b64(crypto.getRandomValues(new Uint8Array(32)));
const fail=(message,status=400)=>Object.assign(Error(message),{status});
async function key(env){return crypto.subtle.importKey('raw',Uint8Array.from(atob(env.DRIVE_TOKEN_KEY),c=>c.charCodeAt(0)),'AES-GCM',false,['encrypt','decrypt'])}
export async function storedRefreshToken(env){
 if(!env.PORTFOLIO_STORE||!env.DRIVE_TOKEN_KEY)return '';
 const record=await env.PORTFOLIO_STORE.get('drive-token','json');if(!record)return '';
 const decode=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
 return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(record.iv)},await key(env),decode(record.value)));
}
export async function beginDriveAuth(env){
 if(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET||!env.PORTFOLIO_STORE||!env.DRIVE_TOKEN_KEY)throw fail('The dedicated Google connection is not configured yet. Your local work is safe.',503);
 const ticket=random();await env.PORTFOLIO_STORE.put('start:'+ticket,'1',{expirationTtl:300});
 return {url:BASE+'/oauth/start?ticket='+ticket};
}
export async function driveAuth(request,env,fetcher=fetch){
 const url=new URL(request.url);
 const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",'Content-Type':'text/html; charset=utf-8'};
 const page=(text,status=200)=>new Response('<!doctype html><title>Allocation Console · Drive</title><main style="font:18px system-ui;max-width:600px;margin:10vh auto;padding:24px"><h1>Allocation Console</h1><p>'+text+'</p><p>You can close this tab and return to the console.</p></main>',{status,headers:{...headers,'Set-Cookie':'portfolio_oauth=; Max-Age=0; Path=/oauth; Secure; HttpOnly; SameSite=Lax'}});
 try{
  if(request.method!=='GET')return page('Method not allowed.',405);
  if(!env.PORTFOLIO_STORE||!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET||!env.DRIVE_TOKEN_KEY)return page('The dedicated Google connection is not configured yet.',503);
  if(url.pathname==='/oauth/start'){
   const ticket=url.searchParams.get('ticket');if(!ticket||!await env.PORTFOLIO_STORE.get('start:'+ticket))return page('This connection link has expired. Start again from the console.',400);
   await env.PORTFOLIO_STORE.delete('start:'+ticket);
   const state=random(),verifier=random();
   await env.PORTFOLIO_STORE.put('oauth:'+state,JSON.stringify({verifier,expires:Date.now()+600000}),{expirationTtl:600});
   const challenge=b64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
   const params=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:CALLBACK,response_type:'code',scope:'https://www.googleapis.com/auth/drive.file',access_type:'offline',prompt:'consent',login_hint:OWNER,state,code_challenge:challenge,code_challenge_method:'S256'});
   return new Response(null,{status:302,headers:{...headers,Location:'https://accounts.google.com/o/oauth2/v2/auth?'+params,'Set-Cookie':'portfolio_oauth='+state+'; Max-Age=600; Path=/oauth; Secure; HttpOnly; SameSite=Lax'}});
  }
  const state=url.searchParams.get('state'),cookie=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('portfolio_oauth='))?.slice(16);
  if(!state||state!==cookie)return page('Connection verification failed. Start again from the console.',400);
  const pending=await env.PORTFOLIO_STORE.get('oauth:'+state,'json');
  if(!pending||pending.expires<Date.now())return page('This connection request expired. Start again.',400);
  await env.PORTFOLIO_STORE.delete('oauth:'+state);
  if(url.searchParams.has('error'))return page('Google permission was not granted. No connection was changed.',400);
  const code=url.searchParams.get('code');if(!code)return page('Google did not return a connection code.',400);
  const response=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:CALLBACK,grant_type:'authorization_code',code,code_verifier:pending.verifier}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)return page('Google could not complete the connection. Start again.',502);
  const token=await response.json();
  const identity=await fetcher('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)',{headers:{Authorization:'Bearer '+token.access_token},signal:AbortSignal.timeout(15000)});
  if(!identity.ok||(await identity.json()).user?.emailAddress?.toLowerCase()!==OWNER)return page('Please connect support@purohitassociates.org. No connection was changed.',403);
  if(!token.refresh_token)return page('Google did not grant ongoing access. Please reconnect and approve access.',400);
  const iv=crypto.getRandomValues(new Uint8Array(12)),encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(env),new TextEncoder().encode(token.refresh_token)));
  await env.PORTFOLIO_STORE.put('drive-token',JSON.stringify({iv:btoa(String.fromCharCode(...iv)),value:btoa(String.fromCharCode(...encrypted))}));
  return page('Google Drive is connected to support@purohitassociates.org. Allocation Console files will use its dedicated folder. Return to the console and select Check connection.');
 }catch{return page('The connection could not finish. Your local work and existing connection are unchanged.',502)}
}
