import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,x-client-info,apikey,content-type","Content-Type":"application/json"}
serve(async req=>{
 if(req.method==='OPTIONS') return new Response('ok',{headers:cors})
 try{
  const body=await req.json().catch(()=>({})); const id=String(body.auditJobId||''); const token=String(body.accessToken||'')
  if(!id||!token) throw Error('auditJobId et accessToken requis')
  const key=Deno.env.get('SUPABASE_SECRET_KEY')||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'); if(!key) throw Error('Supabase serveur non configuré')
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,key)
  const {data:job,error}=await admin.from('audit_jobs').select('id,company_name,status,created_at,completed_at,error_message').eq('id',id).eq('access_token',token).single()
  if(error||!job) throw Error('Dossier introuvable')
  let report=null
  if(job.status==='completed') { const r=await admin.from('audit_reports').select('rows_analyzed,potential_savings_eur,indicative_success_fee_eur,report_json,report_html,created_at').eq('audit_job_id',id).order('created_at',{ascending:false}).limit(1).maybeSingle(); report=r.data||null }
  return new Response(JSON.stringify({ok:true,job,report}),{headers:cors})
 }catch(e){return new Response(JSON.stringify({error:e instanceof Error?e.message:'Erreur'}),{status:400,headers:cors})}
})
