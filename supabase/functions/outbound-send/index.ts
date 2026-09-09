const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-moneyback-admin-token, x-moneyback-worker-secret','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,'Content-Type':'application/json'}});
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
Deno.serve(async req=>{
 if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
 if(req.method!=='POST') return json({error:'Method not allowed'},405);
 const admin=Deno.env.get('MONEYBACK_ADMIN_TOKEN'), worker=Deno.env.get('MONEYBACK_WORKER_SECRET');
 const supplied=req.headers.get('x-moneyback-admin-token')||req.headers.get('x-moneyback-worker-secret');
 if((!admin||supplied!==admin)&&(!worker||supplied!==worker)) return json({error:'Unauthorized'},401);
 try{
  const resend=Deno.env.get('RESEND_API_KEY'), from=Deno.env.get('MONEYBACK_FROM_EMAIL');
  const url=Deno.env.get('SUPABASE_URL')!, key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||Deno.env.get('SUPABASE_SECRET_KEY');
  if(!resend||!from||!key) throw Error('Configuration email incomplète');
  const h={apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
  const now=new Date().toISOString();
  const r=await fetch(`${url}/rest/v1/outbound_prospects?status=in.(queued,contacted)&opted_out=eq.false&next_followup_at=lte.${encodeURIComponent(now)}&order=next_followup_at.asc&limit=10`,{headers:h});
  if(!r.ok) throw Error('Lecture prospects impossible');
  const prospects=await r.json(); let sent=0, failed=0, skipped=0;
  for(const p of prospects){
   const followup=p.status==='contacted'; const count=Number(p.followup_count||0);
   if(followup && count>=3){
    await fetch(`${url}/rest/v1/outbound_prospects?id=eq.${p.id}`,{method:'PATCH',headers:{...h,Prefer:'return=minimal'},body:JSON.stringify({next_followup_at:null})}); skipped++; continue;
   }
   const first=(p.contact_name||'').split(/\s+/)[0], company=p.company_name;
   const subject=followup?`Re: vérification de vos factures fournisseurs — ${company}`:`Une vérification rapide de vos factures fournisseurs — ${company}`;
   const text=followup?`Bonjour${first?' '+first:''},\n\nJe me permets une courte relance concernant MONEYBACK et l’identification d’éventuels écarts de facturation fournisseurs.\n\nSi vous souhaitez, je peux vous indiquer en quelques lignes comment fonctionne le screening initial.\n\nSi vous préférez ne plus recevoir de message de ma part, répondez simplement « STOP ».\n\nBien cordialement,\nMONEYBACK`:`Bonjour${first?' '+first:''},\n\nJe travaille sur MONEYBACK, un service qui recherche les erreurs et écarts de facturation fournisseurs : doublons, prix contractuels non respectés, remises manquantes, indexations anormales, etc.\n\nL’idée est simple : identifier des montants potentiellement récupérables sans changer vos fournisseurs.\n\nSi le sujet vous intéresse, je peux vous proposer un premier screening de vos dépenses fournisseurs.\n\nSi vous préférez ne plus recevoir de message de ma part, répondez simplement « STOP ».\n\nBien cordialement,\nMONEYBACK`;
   const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#111827"><p>Bonjour${first?' '+esc(first):''},</p><p>${followup?'Je me permets une courte relance concernant MONEYBACK et l’identification d’éventuels écarts de facturation fournisseurs.':'Je travaille sur <strong>MONEYBACK</strong>, un service qui recherche les erreurs et écarts de facturation fournisseurs : doublons, prix contractuels non respectés, remises manquantes, indexations anormales, etc.'}</p><p>${followup?'Si vous souhaitez, je peux vous indiquer en quelques lignes comment fonctionne le screening initial.':'L’idée est simple : identifier des montants potentiellement récupérables sans changer vos fournisseurs.'}</p><p>Si vous préférez ne plus recevoir de message de ma part, répondez simplement « STOP ».</p><p>Bien cordialement,<br><strong>MONEYBACK</strong></p></body></html>`;
   const idem=`moneyback-${p.id}-${followup?'followup'+(count+1):'initial'}`;
   const sr=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resend}`,'Content-Type':'application/json','Idempotency-Key':idem},body:JSON.stringify({from,to:[p.email],subject,text,html,tags:[{name:'campaign',value:String(p.campaign_id)},{name:'prospect',value:String(p.id)}]})});
   if(sr.ok){const data=await sr.json();sent++;const next=followup?new Date(Date.now()+5*86400000):new Date(Date.now()+2*86400000);await fetch(`${url}/rest/v1/outbound_prospects?id=eq.${p.id}`,{method:'PATCH',headers:{...h,Prefer:'return=minimal'},body:JSON.stringify({status:'contacted',contacted_at:p.contacted_at||new Date().toISOString(),next_followup_at:next.toISOString(),last_email_id:data?.id||null,followup_count:followup?count+1:count,last_contact_type:followup?'followup':'initial'})});}
   else {failed++;await fetch(`${url}/rest/v1/outbound_prospects?id=eq.${p.id}`,{method:'PATCH',headers:{...h,Prefer:'return=minimal'},body:JSON.stringify({next_followup_at:new Date(Date.now()+15*60000).toISOString()})});}
  }
  return json({ok:true,found:prospects.length,sent,failed,skipped});
 }catch(e){return json({error:e instanceof Error?e.message:'Erreur'},400)}
});
