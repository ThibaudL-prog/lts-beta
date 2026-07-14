
(function(){
  const CONFIG_KEY='lts-api-config-v050';
  const DEFAULT={url:'',athleteId:'ath_demo_001',connected:false,lastSync:null,lastMessage:'Non configuré',schemaVersion:null};

  function cfg(){try{return {...DEFAULT,...JSON.parse(localStorage.getItem(CONFIG_KEY)||'{}')}}catch(e){return {...DEFAULT}}}
  function saveCfg(next){localStorage.setItem(CONFIG_KEY,JSON.stringify({...cfg(),...next}));window.dispatchEvent(new Event('lts-api-status'))}
  function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}

  async function request(action,options={}){
    const c=cfg();
    if(!c.url)throw new Error('URL Apps Script manquante');
    const method=options.method||'GET';
    let url=c.url;
    const payload={action,athlete_id:c.athleteId,...(options.payload||{})};
    const fetchOptions={method,headers:{}};
    if(method==='GET'){
      const q=new URLSearchParams(payload);url+=(url.includes('?')?'&':'?')+q.toString()
    }else{
      fetchOptions.headers['Content-Type']='text/plain;charset=utf-8';
      fetchOptions.body=JSON.stringify(payload)
    }
    const response=await fetch(url,fetchOptions);
    const json=await response.json();
    if(!json.ok)throw new Error(json.error||'Erreur API');
    return json
  }

  window.renderApiPanel=function(){
    const c=cfg();
    const cls=c.connected?'ok':(c.url?'error':'');
    const label=c.connected?'Connectée':(c.url?'À vérifier':'Non configurée');
    return `<div class="apiPanel"><div class="sectiontitle"><div><h3>Google Sheets</h3><p class="muted small">Connexion manuelle via Apps Script — v0.5.0</p></div><span class="apiStatus ${cls}">${label}</span></div>
      <div class="apiGrid">
        <div class="field"><label>URL de l’application Web Apps Script</label><input id="apiUrl" value="${escapeHtml(c.url)}" placeholder="https://script.google.com/macros/s/.../exec"></div>
        <div class="field"><label>Athlète</label><input id="apiAthlete" value="${escapeHtml(c.athleteId)}"></div>
      </div>
      <div class="dataTools">
        <button class="btn secondary" onclick="saveApiSettings()">Enregistrer</button>
        <button class="btn ghost" onclick="testSheetsApi()">Tester la connexion</button>
        <button class="btn" onclick="syncSheetsSnapshot()">Charger l’instantané</button>
        <button class="btn ghost" onclick="pushLocalAthleteData()">Envoyer check-ins et mensurations</button>
      </div>
      <p class="muted small" style="margin-bottom:0">${escapeHtml(c.lastMessage)}${c.lastSync?' · '+new Date(c.lastSync).toLocaleString('fr-FR'):''}</p>
    </div>`
  };

  window.saveApiSettings=function(){
    saveCfg({url:document.getElementById('apiUrl')?.value.trim()||'',athleteId:document.getElementById('apiAthlete')?.value.trim()||'ath_demo_001',connected:false,lastMessage:'Configuration enregistrée'});
    if(typeof toast==='function')toast('Configuration API enregistrée')
  };

  window.testSheetsApi=async function(){
    saveApiSettings();saveCfg({lastMessage:'Test en cours…'});
    try{
      const r=await request('health');
      saveCfg({connected:true,lastSync:new Date().toISOString(),schemaVersion:r.schema_version,lastMessage:`API disponible · schéma ${r.schema_version}`});
      if(typeof toast==='function')toast('Connexion Google Sheets validée')
    }catch(e){
      saveCfg({connected:false,lastMessage:e.message});
      if(typeof toast==='function')toast('Connexion impossible')
    }
  };

  function mapSnapshotToLocal(snapshot){
    if(!snapshot)return;
    state.remoteSnapshot=snapshot;
    state.apiSync=state.apiSync||{};
    state.apiSync.lastPulledAt=new Date().toISOString();
    // v0.5.0 keeps the local planning UI stable. Remote data is preserved
    // in remoteSnapshot and progressively mapped in later lots.
    if(snapshot.athlete){
      state.athlete={...state.athlete,name:snapshot.athlete.display_name||state.athlete.name,weight:snapshot.athlete.body_weight_kg||state.athlete.weight}
    }
    if(typeof logAudit==='function')logAudit('SYNC_PULL','API',snapshot.athlete?.athlete_id||cfg().athleteId,'Instantané Google Sheets chargé');
    save()
  }

  window.syncSheetsSnapshot=async function(){
    saveApiSettings();saveCfg({lastMessage:'Chargement de l’instantané…'});
    try{
      const r=await request('snapshot');
      mapSnapshotToLocal(r.snapshot);
      saveCfg({connected:true,lastSync:new Date().toISOString(),lastMessage:`Instantané chargé · ${r.counts?.weeks||0} semaine(s), ${r.counts?.sessions||0} séance(s)`});
      render();if(typeof toast==='function')toast('Instantané Google Sheets chargé')
    }catch(e){
      saveCfg({connected:false,lastMessage:e.message});
      if(typeof toast==='function')toast('Synchronisation impossible')
    }
  };

  window.pushLocalAthleteData=async function(){
    saveApiSettings();saveCfg({lastMessage:'Envoi des données Athlète…'});
    try{
      const checkins=(state.records?.checkins||[]).map(r=>({...r,athlete_id:cfg().athleteId}));
      const measurements=(state.records?.measurements||[]).flatMap(r=>{
        const mapping={weight:'weight_kg',waist:'waist_cm',chest:'chest_cm',hips:'hips_cm',armRelaxed:'arm_relaxed_cm',armContracted:'arm_contract_cm',thigh:'thigh_cm',calf:'calf_cm'};
        return Object.entries(mapping).filter(([k])=>r[k]!==null&&r[k]!==undefined&&r[k]!=='').map(([k,type])=>({
          body_measurement_id:`bm-${r.date?.slice(0,10)}-${type}`,athlete_id:cfg().athleteId,measured_at:r.date,measurement_type:type,body_side:'none',value:r[k],unit:type==='weight_kg'?'kg':'cm',protocol_code:'PWA',source_type:'athlete',data_quality:'measured',notes:r.source||''
        }))
      });
      for(const record of checkins)await request('checkins.upsert',{method:'POST',payload:{record}});
      if(measurements.length)await request('measurements.append',{method:'POST',payload:{records:measurements}});
      if(typeof logAudit==='function')logAudit('SYNC_PUSH','API',cfg().athleteId,`${checkins.length} check-ins · ${measurements.length} mesures`);
      save();saveCfg({connected:true,lastSync:new Date().toISOString(),lastMessage:`Envoi terminé · ${checkins.length} check-ins · ${measurements.length} mesures`});
      if(typeof toast==='function')toast('Données Athlète envoyées')
    }catch(e){
      saveCfg({connected:false,lastMessage:e.message});
      if(typeof toast==='function')toast('Envoi impossible')
    }
  };
  function currentApiConfig(){return cfg()}

  function isoNow(){return new Date().toISOString()}
  function num(v){const n=Number(v);return Number.isFinite(n)?n:null}
  function executionId(sessionId){return `exec-${sessionId}`}
  function syncLabel(status){
    return {local:'Local',pending:'Envoi…',synced:'Synchronisée',error:'Erreur sync'}[status]||'Local'
  }

  window.executionSyncBadge=function(p){
    if(!p||!p.execution)return '';
    const s=p.execution.sync?.status||'local';
    const title=p.execution.sync?.message||syncLabel(s);
    return `<span class="syncBadge ${s}" title="${escapeHtml(title)}">${syncLabel(s)}</span>`
  };

  function refreshExecutionViews(){
    try{
      if(typeof save==='function')save();
      if(typeof renderAthleteWeek==='function'&&state.role!=='coach')renderAthleteWeek();
      else if(typeof renderDashboard==='function'&&state.role==='coach')renderDashboard();
    }catch(error){console.error('Actualisation sync',error)}
  }

  function buildExecutionRecord(session,week){
    const e=session.execution||{};
    const completedAt=e.completedAt||isoNow();
    return {
      session_execution_id:executionId(session.sessionId),
      athlete_id:cfg().athleteId,
      planned_session_id:session.sessionId,
      started_at:e.startedAt||completedAt,
      ended_at:completedAt,
      status:e.completed?'completed':'in_progress',
      rpe_session:num(e.rpe),
      enjoyment:num(e.enjoyment),
      pain_during:num(e.pain),
      completion_pct:e.completed?100:Math.round(((e.sets||[]).filter(x=>x.completed).length/Math.max(1,(e.sets||[]).length))*100),
      deviation_summary:'',
      athlete_comment:e.note||'',
      coach_comment:'',
      data_quality:'athlete_entered',
      duration_minutes:num(e.duration)||num(session.duration),
      session_load_au:(num(e.duration)||num(session.duration))&&num(e.rpe)?(num(e.duration)||num(session.duration))*num(e.rpe):null
    }
  }

  function buildSetRows(session){
    const e=session.execution||{}, bodyweight=num(state.athlete?.weight)||null;
    if(e.type==='SETS'){
      return (e.sets||[]).map((x,i)=>({
        set_result_id:`set-${session.sessionId}-${i+1}`,
        session_execution_id:executionId(session.sessionId),
        exercise_prescription_id:`presc-${session.sessionId}-${i+1}`,
        exercise_catalog_id:session.templateId||'',
        set_no:i+1,
        side:'both',
        reps_completed:num(x.reps),
        duration_s:(session.structuredSets?.[i]?.work&&String(session.structuredSets[i].work).indexOf('/')<0)?num(x.reps):null,
        load_added_kg:num(x.load),
        bodyweight_kg_context:bodyweight,
        rpe:null,
        rir:num(x.rir),
        valid:!!x.completed,
        notes:x.completed?'':'Série non validée',
        supported_load_kg:num(x.load),
        volume_load_kg:num(x.load)&&num(x.reps)?num(x.load)*num(x.reps):null
      }))
    }
    if(e.type==='EXERCISES'){
      const rows=[];
      (e.exercises||[]).forEach((x,i)=>{
        const sets=Math.max(1,num(x.sets)||1);
        for(let n=1;n<=sets;n++)rows.push({
          set_result_id:`set-${session.sessionId}-${i+1}-${n}`,
          session_execution_id:executionId(session.sessionId),
          exercise_prescription_id:`presc-${session.sessionId}-${i+1}`,
          exercise_catalog_id:session.exercises?.[i]?.name||session.templateId||'',
          set_no:n,
          side:'both',
          reps_completed:num(x.reps),
          duration_s:num(x.hold),
          bodyweight_kg_context:bodyweight,
          rpe:num(x.quality),
          valid:true,
          notes:''
        })
      });
      return rows
    }
    return []
  }

  function buildRunningRecord(session){
    const e=session.execution||{};
    if(e.type!=='RUN')return null;
    return {
      running_result_id:`run-${session.sessionId}`,
      session_execution_id:executionId(session.sessionId),
      distance_m:num(e.distance)?num(e.distance)*1000:null,
      time_seconds:num(e.duration)?num(e.duration)*60:null,
      pace_seconds_per_km:num(e.paceMinutes)?num(e.paceMinutes)*60:null,
      speed_kmh:num(e.speed),
      average_hr_bpm:num(e.hr),
      protocol_code:session.templateId||'PWA',
      valid:true,
      notes:e.note||''
    }
  }

  function normalizeFontGrade(value){
    const allowed=['5a','5a+','5b','5b+','5c','5c+','6a','6a+','6b','6b+','6c','6c+','7a','7a+','7b','7b+','7c','7c+','8a','8a+','8b','8b+','8c'];
    const raw=String(value||'').trim().toLowerCase().replace(/\s+/g,'');
    if(allowed.includes(raw))return raw;

    // A range such as 5C-6A is stored using its upper bound.
    const parts=raw.split(/[-–—]/).filter(Boolean);
    for(let i=parts.length-1;i>=0;i--){
      if(allowed.includes(parts[i]))return parts[i]
    }

    const matches=raw.match(/[5-8][abc]\+?/g)||[];
    for(let i=matches.length-1;i>=0;i--){
      if(allowed.includes(matches[i]))return matches[i]
    }
    return ''
  }

  function buildClimbingRows(session){
    const e=session.execution||{};
    if(e.type!=='CLIMBING')return [];
    const angleMatch=String(session.climbing?.angle||'').match(/[\d.]+/);
    return (e.problems||[]).map((p,i)=>({
      climbing_attempt_id:`climb-${session.sessionId}-${i+1}`,
      session_execution_id:executionId(session.sessionId),
      problem_external_id:p.name||`bloc-${i+1}`,
      problem_name:p.name||`Bloc ${i+1}`,
      grading_system:'FONT',
      grade_code:normalizeFontGrade(p.grade),
      wall_angle_deg:angleMatch?Number(angleMatch[0]):null,
      attempt_no:p.attempts||1,
      result_status:p.flash?'FLASH':p.success?'AFTER_WORK':'NOT_DONE',
      attempts_to_send:p.success?(p.attempts||1):null,
      perceived_difficulty:num(e.quality),
      notes:p.comment||'',
      validation_status:'athlete_entered'
    }))
  }

  window.syncSessionExecution=async function(sessionId){
    if(typeof findSession!=='function')return;
    const found=findSession(sessionId);
    if(!found||!found.session.execution)return;
    const session=found.session,e=session.execution,c=cfg();

    if(!c.url){
      e.sync={status:'local',message:'Enregistrée localement — API non configurée',updatedAt:isoNow()};
      refreshExecutionViews();
      return
    }

    e.sync={status:'pending',message:'Synchronisation en cours',updatedAt:isoNow()};
    refreshExecutionViews();

    try{
      await request('execution.upsert',{method:'POST',payload:{record:buildExecutionRecord(session,found.week)}});

      const sets=buildSetRows(session);
      if(sets.length||e.type==='SETS'||e.type==='EXERCISES'){
        await request('sets.replace',{method:'POST',payload:{session_execution_id:executionId(sessionId),records:sets}})
      }

      const climbing=buildClimbingRows(session);
      if(climbing.length||e.type==='CLIMBING'){
        await request('climbing.replace',{method:'POST',payload:{session_execution_id:executionId(sessionId),records:climbing}})
      }

      const running=buildRunningRecord(session);
      if(running){
        await request('running.upsert',{method:'POST',payload:{record:running}})
      }

      e.sync={status:'synced',message:'Synchronisée avec Google Sheets',updatedAt:isoNow()};
      if(typeof logAudit==='function')logAudit('SYNC_EXECUTION','SESSION',sessionId,session.title||'');
      saveCfg({connected:true,lastSync:isoNow(),lastMessage:`Séance synchronisée · ${session.title||sessionId}`});
      refreshExecutionViews();
      if(typeof toast==='function')toast('Séance synchronisée')
    }catch(error){
      console.error('Synchronisation séance',error);
      e.sync={status:'error',message:error.message||'Synchronisation impossible',updatedAt:isoNow()};
      saveCfg({connected:false,lastMessage:error.message||'Synchronisation impossible'});
      refreshExecutionViews();
      if(typeof toast==='function')toast('Séance conservée localement · erreur de synchronisation')
    }
  };

  window.retrySessionSync=function(sessionId){return window.syncSessionExecution(sessionId)}

})();
