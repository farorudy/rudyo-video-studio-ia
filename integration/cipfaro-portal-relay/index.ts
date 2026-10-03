export async function handle(req, send = fetch) {
 const allowed = ['https://cipfaro-portail.vercel.app','https://cipfaro-formation.org','https://www.cipfaro-formation.org'];
 const origin = req.headers.get('origin') || '';
 const headers = {'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':allowed.includes(origin)?origin:allowed[0],'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};
 const reply = (status,message) => new Response(JSON.stringify({message}),{status,headers});
 if(origin && !allowed.includes(origin)) return reply(403,'Origine refusée.');
 if(req.method==='OPTIONS') return new Response(null,{status:204,headers});
 if(req.method!=='POST') return reply(405,'Méthode refusée.');
 const auth=req.headers.get('authorization')||'';
 if(!auth.startsWith('Bearer ')) return reply(401,'Connectez-vous.');
 try {
  const raw=await req.text();
  if(raw.length>18000) return reply(400,'Conversation trop longue.');
  // RudyoAI validates the learner session, lesson access and quota. Do not reserve again here.
  const result=await send('https://rudyoai.com/api/tutor',{method:'POST',headers:{Authorization:auth,'Content-Type':'application/json'},body:raw,redirect:'error',signal:AbortSignal.timeout(75000)});
  const data=await result.json();
  if(result.ok && typeof data.answer==='string' && data.answer.trim()) return new Response(JSON.stringify({answer:data.answer}),{status:200,headers});
  if([400,401,403,429,503].includes(result.status) && typeof data.message==='string') return reply(result.status,data.message);
  return reply(503,'Assistant RudyoAI indisponible.');
 } catch { return reply(503,'Connexion à RudyoAI interrompue. Réessayez.'); }
}
if(import.meta.main) Deno.serve((req)=>handle(req));
