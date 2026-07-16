
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
    return renderGlobalSyncCenter()
  };

  function globalSyncState(){
    const c=cfg();
    const queue=loadQueue();
    const conflicts=loadConflicts().filter(x=>x.status==='open');
    if(!c.url)return {status:'unconfigured',label:'Non configurée',message:'Renseigne l’URL Apps Script.'};
    if(!navigator.onLine)return {status:'offline',label:'Hors ligne',message:`${queue.length} élément(s) seront envoyés au retour du réseau.`};
    if(conflicts.length)return {status:'conflict',label:'Conflit',message:`${conflicts.length} conflit(s) à résoudre.`};
    if(queue.length)return {status:'pending',label:'En attente',message:`${queue.length} élément(s) restent à synchroniser.`};
    if(c.connected)return {status:'synced',label:'À jour',message:c.lastMessage||'Google Sheets est à jour.'};
    return {status:'pending',label:'À vérifier',message:c.lastMessage||'Teste la connexion.'}
  }

  window.renderGlobalSyncCenter=function(){
    const c=cfg();
    const s=globalSyncState();
    const queue=loadQueue();
    const conflicts=loadConflicts().filter(x=>x.status==='open');
    const localWeeks=(state.weeks||[]).filter(w=>w.status==='PUBLISHED'&&w.planSync?.status!=='synced').length;
    const unsyncedExecutions=(state.weeks||[]).flatMap(w=>w.sessions||[]).filter(p=>p.execution&&p.execution.sync?.status!=='synced').length;

    return `<div class="syncCenter">
      <div class="syncCenterHeader">
        <div>
          <h3 style="margin:0">Synchronisation Google Sheets</h3>
          <p class="muted small" style="margin:4px 0 0">${escapeHtml(s.message)}</p>
        </div>
        <span class="syncGlobalStatus ${s.status}"><span class="syncDot"></span>${s.label}</span>
      </div>

      <div class="syncStats">
        <div class="syncStat"><span class="muted small">En attente</span><b>${queue.length}</b></div>
        <div class="syncStat"><span class="muted small">Conflits</span><b>${conflicts.length}</b></div>
        <div class="syncStat"><span class="muted small">Non synchronisés</span><b>${localWeeks+unsyncedExecutions}</b></div>
      </div>

      <div class="syncActions">
        <button class="btn" onclick="synchronizeEverything()">Synchroniser maintenant</button>
        <button class="btn secondary" onclick="toggleSyncSettings()">Réglages</button>
        ${conflicts.length?`<button class="btn ghost" onclick="toggleConflictDetails()">Voir les conflits</button>`:''}
      </div>

      <div id="syncSettings" style="display:${c.url?'none':'block'};margin-top:12px">
        <div class="apiGrid">
          <div class="field"><label>URL Apps Script</label><input id="apiUrl" value="${escapeHtml(c.url)}" placeholder="https://script.google.com/macros/s/.../exec"></div>
          <div class="field"><label>Athlète</label><input id="apiAthlete" value="${escapeHtml(c.athleteId)}"></div>
        </div>
        <div class="dataTools">
          <button class="btn secondary" onclick="saveApiSettings()">Enregistrer</button>
          <button class="btn ghost" onclick="testSheetsApi()">Tester la connexion</button>
        </div>
      </div>

      <div id="syncDetails" style="margin-top:12px">
        ${renderSyncQueuePanel()}
        <div id="conflictDetails" style="display:${conflicts.length?'block':'none'}">${renderConflictPanel()}</div>
      </div>

      <div class="syncLast">Dernière synchronisation : ${c.lastSync?new Date(c.lastSync).toLocaleString('fr-FR'):'jamais'}</div>
    </div>`
  };

  window.toggleSyncSettings=function(){
    const el=document.getElementById('syncSettings');
    if(el)el.style.display=el.style.display==='none'?'block':'none'
  };

  window.toggleConflictDetails=function(){
    const el=document.getElementById('conflictDetails');
    if(el)el.style.display=el.style.display==='none'?'block':'none'
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
    const rebuiltRemoteWeeks=rebuildRemoteWeeks(snapshot);
    state.remoteWeeks=rebuiltRemoteWeeks;

    // Reconcile Coach-side publication badges with the source of truth.
    (state.weeks||[]).forEach(localWeek=>{
      const candidates=rebuiltRemoteWeeks.filter(remoteWeek=>Number(remoteWeek.number)===Number(localWeek.number));
      if(!candidates.length)return;
      const latest=candidates.sort((a,b)=>Number(b.publicationVersion||0)-Number(a.publicationVersion||0))[0];
      const sameOrNewer=Number(latest.publicationVersion||0)>=Number(localWeek.publicationVersion||0);
      if(localWeek.status==='PUBLISHED'&&sameOrNewer){
        localWeek.publicationVersion=Number(latest.publicationVersion)||localWeek.publicationVersion||1;
        localWeek.planSync={
          status:'synced',
          message:`Google Sheets v${latest.publicationVersion||1}`,
          updatedAt:new Date().toISOString(),
          remoteWeekId:latest.remoteTrainingWeekId
        };
      }
    });

    state.apiSync=state.apiSync||{};
    state.apiSync.lastPulledAt=new Date().toISOString();
    if(snapshot.athlete){
      state.athlete={...state.athlete,name:snapshot.athlete.display_name||state.athlete.name,weight:snapshot.athlete.body_weight_kg||state.athlete.weight}
    }
    if(typeof logAudit==='function')logAudit('SYNC_PULL','API',snapshot.athlete?.athlete_id||cfg().athleteId,'Instantané Google Sheets chargé');
    save()
  }

  function clearObsoleteBaselineConflict(week){
    const rows=loadConflicts();
    const filtered=rows.filter(row=>{
      const samePlan=row.entityType==='plan'&&Number(row.weekNo)===Number(week.number);
      const obsolete=samePlan&&String(row.message||'').includes('Référence distante absente');
      return !obsolete
    });
    if(filtered.length!==rows.length)saveConflicts(filtered)
  }

  function replaceCoachPublishedWeeksFromRemote(){
    const remoteWeeks=state.remoteWeeks||[];
    if(!remoteWeeks.length)return;

    remoteWeeks.forEach(remoteWeek=>{
      const localIndex=(state.weeks||[]).findIndex(w=>Number(w.number)===Number(remoteWeek.number));
      const localWeek=localIndex>=0?state.weeks[localIndex]:null;

      const executionBySessionId=new Map();
      (localWeek?.sessions||[]).forEach(p=>{
        if(p.sessionId&&p.execution)executionBySessionId.set(String(p.sessionId),p.execution)
      });

      const replacement={
        ...remoteWeek,
        remoteOrigin:false,
        importedFromGoogleSheets:true,
        status:'PUBLISHED',
        planSync:{
          status:'synced',
          message:`Google Sheets v${remoteWeek.publicationVersion||1}`,
          updatedAt:new Date().toISOString(),
          remoteWeekId:remoteWeek.remoteTrainingWeekId,
          remoteFingerprint:remoteWeek.remoteFingerprint||null,
          remoteUpdatedAt:remoteWeek.remoteUpdatedAt||remoteWeek.publishedAt||null
        },
        sessions:(remoteWeek.sessions||[]).map(p=>({
          ...p,
          execution:executionBySessionId.get(String(p.sessionId))||p.execution||null
        }))
      };

      if(localIndex>=0)state.weeks[localIndex]=replacement;
      else state.weeks.push(replacement);
    });

    state.weeks.sort((a,b)=>Number(a.number)-Number(b.number))
  }

  async function hydratePlanConflictBaselines(){
    const remoteWeeks=state.remoteWeeks||[];
    for(const remoteWeek of remoteWeeks){
      try{
        const meta=await fetchSyncMeta('plan',{athlete_id:cfg().athleteId,week_no:remoteWeek.number});
        if(!meta.found)continue;
        remoteWeek.remoteFingerprint=meta.fingerprint||null;
        remoteWeek.remoteUpdatedAt=meta.updated_at||null;
        clearObsoleteBaselineConflict(remoteWeek);
        const localWeek=(state.weeks||[]).find(w=>Number(w.number)===Number(remoteWeek.number));
        if(localWeek&&localWeek.status==='PUBLISHED'){
          localWeek.planSync={...(localWeek.planSync||{}),status:'synced',message:`Google Sheets v${meta.version_no||remoteWeek.publicationVersion||1}`,updatedAt:new Date().toISOString(),remoteWeekId:meta.training_week_id||remoteWeek.remoteTrainingWeekId,remoteFingerprint:meta.fingerprint||null,remoteUpdatedAt:meta.updated_at||null};
          localWeek.publicationVersion=Math.max(Number(localWeek.publicationVersion||0),Number(meta.version_no||0))||1;
        }
      }catch(error){console.warn('Baseline semaine indisponible',remoteWeek.number,error)}
    }
    if(typeof save==='function')save()
  }

  window.syncSheetsSnapshot=async function(options={}){
    saveApiSettings();saveCfg({lastMessage:'Chargement de l’instantané…'});
    try{
      const r=await request('snapshot');
      mapSnapshotToLocal(r.snapshot);
      await hydratePlanConflictBaselines();
      replaceCoachPublishedWeeksFromRemote();
      if(typeof save==='function')save();
      const loaded=(state.remoteWeeks||[]).map(w=>`S${w.number} v${w.publicationVersion||1}`).join(', ');
      saveCfg({connected:true,lastSync:new Date().toISOString(),lastMessage:`Instantané chargé · ${r.counts?.weeks||0} semaine(s), ${r.counts?.sessions||0} séance(s)${loaded?' · '+loaded:''}`});
      render();if(!options.silent&&typeof toast==='function')toast('Instantané Google Sheets chargé')
    }catch(e){
      saveCfg({connected:false,lastMessage:e.message});
      if(!options.silent&&typeof toast==='function')toast('Synchronisation impossible')
    }
  };

  window.pushLocalAthleteData=async function(options={}){
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
      if(!options.silent&&typeof toast==='function')toast('Données Athlète envoyées')
    }catch(e){
      if(checkins.length)upsertQueueItem({
        queueId:queueId('checkins',cfg().athleteId),
        type:'checkins',
        entityId:cfg().athleteId,
        label:'Check-ins Athlète',
        records:checkins
      });
      if(measurements.length)upsertQueueItem({
        queueId:queueId('measurements',cfg().athleteId),
        type:'measurements',
        entityId:cfg().athleteId,
        label:'Mensurations Athlète',
        records:measurements
      });
      saveCfg({connected:false,lastMessage:`Données mises en attente · ${e.message}`});
      if(!options.silent&&typeof toast==='function')toast('Données conservées localement et mises en attente')
    }
  };


  const CONFLICT_KEY='lts-sync-conflicts-v054';
  const FORCE_KEY='lts-sync-force-v054';

  function loadConflicts(){try{const v=JSON.parse(localStorage.getItem(CONFLICT_KEY)||'[]');return Array.isArray(v)?v:[]}catch(e){return []}}
  function saveConflicts(v){localStorage.setItem(CONFLICT_KEY,JSON.stringify(v));window.dispatchEvent(new Event('lts-api-status'))}
  function addConflict(c){const rows=loadConflicts();const i=rows.findIndex(x=>x.conflictId===c.conflictId);const n={createdAt:new Date().toISOString(),status:'open',...c};if(i>=0)rows[i]={...rows[i],...n};else rows.unshift(n);saveConflicts(rows.slice(0,100));return n}
  function removeConflict(id){saveConflicts(loadConflicts().filter(x=>x.conflictId!==id))}
  function conflictId(type,id){return `conflict:${type}:${id}`}

  function setForceOnce(key){let d={};try{d=JSON.parse(localStorage.getItem(FORCE_KEY)||'{}')}catch(e){}d[key]=true;localStorage.setItem(FORCE_KEY,JSON.stringify(d))}
  function consumeForceOnce(key){let d={};try{d=JSON.parse(localStorage.getItem(FORCE_KEY)||'{}')}catch(e){}const ok=!!d[key];if(ok){delete d[key];localStorage.setItem(FORCE_KEY,JSON.stringify(d))}return ok}

  window.renderConflictPanel=function(){
    const rows=loadConflicts().filter(x=>x.status==='open');
    if(!rows.length)return `<div class="conflictPanel" style="border-color:#d9e3f3;background:#f8fbff"><div class="row"><div><b>Conflits multi-appareils</b><div class="muted small">Aucun conflit détecté.</div></div><span class="queueCount">0</span></div></div>`;
    return `<div class="conflictPanel"><div class="sectiontitle"><div><h3 style="margin:0">Conflits multi-appareils</h3><p class="muted small">Une version distante a changé.</p></div><span class="conflictCount">${rows.length}</span></div>${rows.map(r=>`<div class="conflictItem"><b>${escapeHtml(r.label||r.entityId)}</b><div class="muted small">${escapeHtml(r.message||'Conflit détecté')}</div><div class="conflictActions"><button class="btn secondary" onclick="resolveConflictKeepLocal('${escapeHtml(r.conflictId)}')">Conserver local</button><button class="btn ghost" onclick="resolveConflictUseRemote('${escapeHtml(r.conflictId)}')">Utiliser distant</button></div></div>`).join('')}</div>`
  };

  async function fetchSyncMeta(entityType,params){return request('sync.meta',{payload:{entity_type:entityType,...params}})}

  window.resolveConflictKeepLocal=async function(id){
    const r=loadConflicts().find(x=>x.conflictId===id);if(!r)return;
    setForceOnce(`${r.entityType}:${r.entityId}`);removeConflict(id);
    if(typeof logAudit==='function')logAudit('CONFLICT_KEEP_LOCAL',r.entityType,r.entityId,r.message||'');
    if(r.entityType==='execution')await syncSessionExecution(r.entityId);else await syncWeekPlan(r.weekNo)
  };

  window.resolveConflictUseRemote=async function(id){
    const r=loadConflicts().find(x=>x.conflictId===id);if(!r)return;
    try{
      const response=await request('snapshot');
      mapSnapshotToLocal(response.snapshot);
      await hydratePlanConflictBaselines();
      replaceCoachPublishedWeeksFromRemote();
      removeQueueItem(queueId(r.entityType==='execution'?'execution':'plan',r.entityId));
      removeConflict(id);
      if(r.entityType==='plan'){
        clearObsoleteBaselineConflict({number:r.weekNo})
      }
      if(typeof logAudit==='function')logAudit('CONFLICT_USE_REMOTE',r.entityType,r.entityId,r.message||'');
      save();render();if(typeof toast==='function')toast('Version distante conservée')
    }catch(e){if(typeof toast==='function')toast('Impossible de charger la version distante')}
  };

  const QUEUE_KEY='lts-sync-queue-v054';
  let queueProcessing=false;

  function loadQueue(){
    try{
      const q=JSON.parse(localStorage.getItem(QUEUE_KEY)||'[]');
      return Array.isArray(q)?q:[]
    }catch(error){return []}
  }

  function saveQueue(queue){
    localStorage.setItem(QUEUE_KEY,JSON.stringify(queue));
    window.dispatchEvent(new Event('lts-api-status'))
  }

  function queueId(type,entityId){
    return `${type}:${entityId}`
  }

  function upsertQueueItem(item){
    const queue=loadQueue();
    const index=queue.findIndex(q=>q.queueId===item.queueId);
    const normalized={
      attempts:0,
      createdAt:new Date().toISOString(),
      updatedAt:new Date().toISOString(),
      lastError:'',
      ...item
    };
    if(index>=0){
      normalized.createdAt=queue[index].createdAt||normalized.createdAt;
      normalized.attempts=queue[index].attempts||0;
      queue[index]={...queue[index],...normalized,updatedAt:new Date().toISOString()}
    }else{
      queue.push(normalized)
    }
    saveQueue(queue);
    return normalized
  }

  function removeQueueItem(id){
    saveQueue(loadQueue().filter(item=>item.queueId!==id))
  }

  function markQueueFailure(id,error){
    const queue=loadQueue();
    const item=queue.find(q=>q.queueId===id);
    if(item){
      item.attempts=(item.attempts||0)+1;
      item.lastError=error?.message||String(error||'Erreur inconnue');
      item.updatedAt=new Date().toISOString();
      saveQueue(queue)
    }
  }

  function queueSummary(){
    const queue=loadQueue();
    return {
      total:queue.length,
      executions:queue.filter(q=>q.type==='execution').length,
      plans:queue.filter(q=>q.type==='plan').length,
      checkins:queue.filter(q=>q.type==='checkins').length,
      measurements:queue.filter(q=>q.type==='measurements').length
    }
  }

  window.renderSyncQueuePanel=function(){
    const queue=loadQueue();
    const summary=queueSummary();
    if(!queue.length){
      return `<div class="queuePanel"><div class="row"><div><b>File de synchronisation</b><div class="muted small">Aucun élément en attente.</div></div><span class="queueCount">0</span></div></div>`
    }
    return `<div class="queuePanel">
      <div class="sectiontitle"><div><h3 style="margin:0">File de synchronisation</h3><p class="muted small">${summary.total} élément(s) en attente</p></div><span class="queueCount">${summary.total}</span></div>
      <div class="dataTools">
        <button class="btn secondary" onclick="retrySyncQueue()">Relancer maintenant</button>
        <button class="btn ghost" onclick="toggleSyncQueueDetails()">Détails</button>
      </div>
      <div id="syncQueueDetails" style="display:none;margin-top:8px">
        ${queue.slice(0,20).map(item=>`<div class="queueItem">
          <div class="queueMeta"><b>${escapeHtml(item.label||item.type)}</b><span class="muted small">${escapeHtml(item.type)}</span><span class="muted small">tentatives ${item.attempts||0}</span></div>
          ${item.lastError?`<div class="muted small">${escapeHtml(item.lastError)}</div>`:''}
        </div>`).join('')}
      </div>
    </div>`
  };

  window.toggleSyncQueueDetails=function(){
    const el=document.getElementById('syncQueueDetails');
    if(el)el.style.display=el.style.display==='none'?'block':'none'
  };

  function queueExecutionPayload(session,found){
    const e=session.execution||{};
    const payloads=[
      {action:'execution.upsert',payload:{record:buildExecutionRecord(session,found.week)}}
    ];
    const sets=buildSetRows(session);
    if(sets.length||e.type==='SETS'||e.type==='EXERCISES'){
      payloads.push({action:'sets.replace',payload:{session_execution_id:executionId(session.sessionId),records:sets}})
    }
    const climbing=buildClimbingRows(session);
    if(climbing.length||e.type==='CLIMBING'){
      payloads.push({action:'climbing.replace',payload:{session_execution_id:executionId(session.sessionId),records:climbing}})
    }
    const running=buildRunningRecord(session);
    if(running){
      payloads.push({action:'running.upsert',payload:{record:running}})
    }
    return payloads
  }

  async function executeQueueItem(item){
    if(item.type==='execution'){
      for(const step of item.payloads){
        await request(step.action,{method:'POST',payload:step.payload})
      }
      const found=findSession(item.entityId);
      if(found?.session?.execution){
        found.session.execution.sync={status:'synced',message:'Synchronisée avec Google Sheets',updatedAt:isoNow()}
      }
    }else if(item.type==='plan'){
      const week=(state.weeks||[]).find(w=>String(w.weekId||w.number)===String(item.entityId));
      if(!week)throw new Error('Semaine locale introuvable');

      const force=consumeForceOnce(`plan:${week.weekId||week.number}`);
      if(!force){
        const meta=await fetchSyncMeta('plan',{athlete_id:cfg().athleteId,week_no:week.number});
        const known=week.planSync?.remoteFingerprint||null;
        const newer=meta.found&&Number(meta.version_no||0)>Number(week.publicationVersion||0);
        const sameVersion=meta.found&&Number(meta.version_no||0)===Number(week.publicationVersion||0);
        const changed=sameVersion&&known&&meta.fingerprint!==known;
        const baselineMissing=sameVersion&&!known;

        if(newer||changed||baselineMissing){
          const c=addConflict({
            conflictId:conflictId('plan',week.weekId||week.number),
            entityType:'plan',
            entityId:week.weekId||String(week.number),
            weekNo:week.number,
            label:`Semaine ${week.number}`,
            message:newer?'Une version distante plus récente existe.':baselineMissing?'Référence distante absente : recharge l’instantané.':'La même version a été modifiée ailleurs.'
          });
          week.planSync={...previousPlanSync,status:'error',message:'Conflit multi-appareils',updatedAt:isoNow(),conflictId:c.conflictId,remoteFingerprint:knownRemoteFingerprint};
          save();
          throw new Error('CONFLICT_BLOCKED');
        }
      }

      const result=await request('plan.publish',{method:'POST',payload:item.payload});
      if(week){
        const freshMeta=await fetchSyncMeta('plan',{athlete_id:cfg().athleteId,week_no:week.number});
        week.planSync={
          status:'synced',
          message:`Version ${week.publicationVersion} publiée`,
          updatedAt:isoNow(),
          remoteWeekId:result.training_week_id,
          remoteFingerprint:freshMeta.fingerprint||null
        }
      }
    }else if(item.type==='checkins'){
      for(const record of item.records||[])await request('checkins.upsert',{method:'POST',payload:{record}})
    }else if(item.type==='measurements'){
      if((item.records||[]).length)await request('measurements.append',{method:'POST',payload:{records:item.records}})
    }else{
      throw new Error('Type de file inconnu : '+item.type)
    }
  }

  window.retrySyncQueue=async function(options={}){
    if(queueProcessing)return;
    if(!navigator.onLine){
      if(!options.silent&&typeof toast==='function')toast('Toujours hors ligne');
      return
    }
    queueProcessing=true;
    try{
      const queue=[...loadQueue()];
      if(!queue.length){
        if(!options.silent&&typeof toast==='function')toast('Aucun élément en attente');
        return
      }
      for(const item of queue){
        try{
          await executeQueueItem(item);
          removeQueueItem(item.queueId)
        }catch(error){
          if(String(error?.message||error)==='CONFLICT_BLOCKED'){
            removeQueueItem(item.queueId)
          }else{
            markQueueFailure(item.queueId,error)
          }
        }
      }
      if(typeof save==='function')save();
      saveCfg({lastSync:isoNow(),lastMessage:`File traitée · ${loadQueue().length} restant(s)`});
      if(typeof render==='function')render();
      if(!options.silent&&typeof toast==='function')toast(loadQueue().length?'Certaines synchronisations restent en attente':'Toutes les synchronisations sont à jour')
    }finally{
      queueProcessing=false
    }
  };

  window.addEventListener('online',()=>{
    saveCfg({lastMessage:'Connexion rétablie · reprise de la synchronisation'});
    setTimeout(()=>retrySyncQueue(),800)
  });
  window.addEventListener('offline',()=>{
    saveCfg({connected:false,lastMessage:'Hors ligne · les données seront mises en attente'})
  });


  function weekHasRealLocalChanges(week){
    if(!week||week.status!=='PUBLISHED')return false;
    if(week.planSync?.status==='pending')return true;
    if(week.planSync?.status==='error'&&week.planSync?.message!=='Conflit multi-appareils')return true;
    if(week.lastPublishedFingerprint&&typeof weekPlanningFingerprint==='function'){
      try{return weekPlanningFingerprint(week)!==week.lastPublishedFingerprint}catch(error){}
    }
    return false
  }

  function clearResolvedOrStaleConflicts(){
    const rows=loadConflicts();
    const filtered=rows.filter(row=>{
      if(row.entityType!=='plan')return true;
      const week=(state.weeks||[]).find(w=>Number(w.number)===Number(row.weekNo));
      if(!week)return false;
      return weekHasRealLocalChanges(week)
    });
    if(filtered.length!==rows.length)saveConflicts(filtered)
  }

  async function syncPublishedPlans(){
    const weeks=(state.weeks||[]).filter(w=>w.status==='PUBLISHED');
    for(const week of weeks){
      if(!weekHasRealLocalChanges(week))continue;
      await syncWeekPlan(week.number)
    }
  }

  async function syncUnsyncedExecutions(){
    const sessions=(state.weeks||[]).flatMap(w=>w.sessions||[]);
    for(const session of sessions){
      if(!session.execution)continue;
      if(session.execution.sync?.status==='synced')continue;
      await syncSessionExecution(session.sessionId)
    }
  }

  window.synchronizeEverything=async function(){
    const c=cfg();
    if(!c.url){
      toggleSyncSettings();
      if(typeof toast==='function')toast('Configure d’abord Google Sheets');
      return
    }
    if(!navigator.onLine){
      if(typeof toast==='function')toast('Hors ligne · les données restent en attente');
      return
    }
    saveCfg({lastMessage:'Synchronisation globale en cours…'});

    try{
      // 1. Pull remote source of truth first.
      await syncSheetsSnapshot({silent:true});

      // 2. Remove stale conflicts that no longer correspond to a local change.
      clearResolvedOrStaleConflicts();

      // 3. Retry explicit queued operations.
      await retrySyncQueue({silent:true});

      // 4. Push only genuine local changes.
      await syncPublishedPlans();
      await syncUnsyncedExecutions();
      await pushLocalAthleteData({silent:true});

      // 5. Final pull so both devices end on the same state.
      await syncSheetsSnapshot({silent:true});

      saveCfg({connected:true,lastSync:new Date().toISOString(),lastMessage:'Toutes les données sont à jour'});
      if(typeof render==='function')render();
      if(typeof toast==='function')toast('Synchronisation terminée')
    }catch(error){
      console.error('Synchronisation globale',error);
      saveCfg({connected:false,lastMessage:error.message||'Synchronisation incomplète'});
      if(typeof render==='function')render();
      if(typeof toast==='function')toast('Synchronisation incomplète')
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

    const payloads=queueExecutionPayload(session,found);
    try{
      const force=consumeForceOnce(`execution:${sessionId}`);
      if(!force){
        const meta=await fetchSyncMeta('execution',{entity_id:executionId(sessionId)});
        const known=e.sync?.remoteFingerprint||null;
        if(meta.found&&known&&meta.fingerprint!==known){
          const c=addConflict({conflictId:conflictId('execution',sessionId),entityType:'execution',entityId:sessionId,label:session.title||sessionId,message:'Cette séance a été modifiée sur un autre appareil.'});
          e.sync={status:'error',message:'Conflit multi-appareils',updatedAt:isoNow(),conflictId:c.conflictId};refreshExecutionViews();if(typeof toast==='function')toast('Conflit détecté');return
        }
      }
      for(const step of payloads){
        await request(step.action,{method:'POST',payload:step.payload})
      }
      removeQueueItem(queueId('execution',sessionId));
      const freshMeta=await fetchSyncMeta('execution',{entity_id:executionId(sessionId)});
      e.sync={status:'synced',message:'Synchronisée avec Google Sheets',updatedAt:isoNow(),remoteFingerprint:freshMeta.fingerprint||null};
      if(typeof logAudit==='function')logAudit('SYNC_EXECUTION','SESSION',sessionId,session.title||'');
      saveCfg({connected:true,lastSync:isoNow(),lastMessage:`Séance synchronisée · ${session.title||sessionId}`});
      refreshExecutionViews();
      if(typeof toast==='function')toast('Séance synchronisée')
    }catch(error){
      console.error('Synchronisation séance',error);
      const queued=upsertQueueItem({
        queueId:queueId('execution',sessionId),
        type:'execution',
        entityId:sessionId,
        label:session.title||sessionId,
        payloads
      });
      e.sync={status:'error',message:`En attente de synchronisation · ${error.message||'Erreur réseau'}`,updatedAt:isoNow(),queueId:queued.queueId};
      saveCfg({connected:false,lastMessage:`Séance mise en attente · ${error.message||'Erreur réseau'}`});
      refreshExecutionViews();
      if(typeof toast==='function')toast('Séance conservée localement et mise en attente')
    }
  };

  window.retrySessionSync=function(sessionId){return window.syncSessionExecution(sessionId)}

  function planIsoDate(date){
    if(!date)return null;
    const d=new Date(date);
    return Number.isNaN(d.getTime())?null:d.toISOString().slice(0,10)
  }
  function addDaysIso(date,days){
    const d=new Date(date||new Date());
    d.setDate(d.getDate()+days);
    return d.toISOString().slice(0,10)
  }
  function slotTime(slot){
    return {matin:'07:00',midi:'13:00',soir:'19:30'}[slot]||'13:00'
  }
  function planVersionId(base,version){return `${base}-v${version}`}
  function safeJson(value){try{return JSON.stringify(value)}catch(error){return '{}'}}
  function parseJson(value,fallback=null){
    if(!value)return fallback;
    try{return typeof value==='string'?JSON.parse(value):value}catch(error){return fallback}
  }
  function planSyncText(status){
    return {local:'Local',pending:'Publication…',synced:'Google Sheets',error:'Erreur sync'}[status]||'Local'
  }
  window.weekPlanSyncBadge=function(w){
    if(!w||w.status!=='PUBLISHED')return '';
    const s=w.planSync?.status||'local';
    return `<span class="planSyncBadge ${s}" title="${escapeHtml(w.planSync?.message||planSyncText(s))}">${planSyncText(s)}</span>`
  };

  function buildPlanPayload(week){
    const c=state.cycle||{};
    const version=week.publicationVersion||1;
    const baseWeekId=week.weekId||`week-${week.number}`;
    const remoteWeekId=planVersionId(baseWeekId,version);
    const cycleId=c.cycleId||'cycle-local';
    const cycleStart=planIsoDate(c.start)||new Date().toISOString().slice(0,10);
    const weekStart=addDaysIso(cycleStart,(Number(week.number||1)-1)*7);
    const weekEnd=addDaysIso(weekStart,6);

    const cycle={
      cycle_id:cycleId,
      athlete_id:cfg().athleteId,
      name:c.name||'Cycle LTS',
      start_date:cycleStart,
      end_date:addDaysIso(cycleStart,55),
      cycle_type:'8_week',
      objective_summary:[c.primary,c.secondary].filter(Boolean).join(' + '),
      structure_code:'3+1+3+1',
      status:c.status==='VALIDATED'?'active':'draft',
      version_no:Number(c.version||1),
      validated_at:c.validatedAt||'',
      validated_by:'coach',
      supersedes_cycle_id:''
    };

    const remoteWeek={
      training_week_id:remoteWeekId,
      cycle_id:cycleId,
      athlete_id:cfg().athleteId,
      week_no:Number(week.number),
      start_date:weekStart,
      end_date:weekEnd,
      week_type:week.type==='DELOAD'?'deload':week.type==='TESTS'?'tests':'build',
      load_target:week.type==='DELOAD'?50:100,
      focus_summary:week.comment||c.primary||'',
      status:'published',
      version_no:version,
      generated_from_diagnostic_id:'',
      local_week_id:baseWeekId,
      published_at:week.publishedAt||new Date().toISOString(),
      g21_status:week.g21Status||'',
      adaptation_reason:week.adaptationReason||''
    };

    const sessions=[];
    const blocks=[];
    const prescriptions=[];

    (week.containers||[]).forEach((container,containerIndex)=>{
      const remoteSessionId=planVersionId(container.containerId,version);
      const sessionDate=addDaysIso(weekStart,({Lun:0,Mar:1,Mer:2,Jeu:3,Ven:4,Sam:5,Dim:6}[container.day]??0));
      const containerPrescs=(week.sessions||[]).filter(p=>p.containerId===container.containerId);
      sessions.push({
        planned_session_id:remoteSessionId,
        training_week_id:remoteWeekId,
        athlete_id:cfg().athleteId,
        session_template_id:'MULTI_PRESCRIPTION',
        session_date:sessionDate,
        planned_start_time:slotTime(container.slot),
        planned_duration_min:containerPrescs.reduce((sum,p)=>sum+(Number(p.duration)||0),0),
        location_id:'',
        primary_quality_id:containerPrescs[0]?.domain||'',
        secondary_quality_id:containerPrescs[1]?.domain||'',
        session_type:'SESSION_CONTAINER',
        priority_order:containerIndex+1,
        status:'published',
        version_no:version,
        coach_instructions:safeJson({
          localContainerId:container.containerId,
          day:container.day,
          slot:container.slot,
          title:container.title,
          comment:container.comment||''
        }),
        cancel_reason:''
      });

      containerPrescs.forEach((p,pIndex)=>{
        const blockId=planVersionId(p.sessionId,version);
        blocks.push({
          session_block_id:blockId,
          planned_session_id:remoteSessionId,
          session_template_id:p.templateId||'',
          block_order:pIndex+1,
          block_type:'prescription',
          name:p.title||'Prescription',
          duration_target_min:Number(p.duration)||0,
          objective_text:[p.guide,p.domain].filter(Boolean).join(' · '),
          completion_rule:'Athlète valide la prescription',
          notes:safeJson({...p,execution:null,remoteVersion:version,remoteWeekId})
        });

        const structured=Array.isArray(p.structuredSets)?p.structuredSets:[];
        const first=structured[0]||{};
        prescriptions.push({
          exercise_prescription_id:blockId,
          session_block_id:blockId,
          exercise_catalog_id:p.templateId||p.title||'',
          exercise_order:1,
          sets_target:structured.length||Number(p.sets)||Number(p.exercises?.[0]?.sets)||1,
          reps_target_min:Number(first.reps)||Number(p.reps)||Number(p.exercises?.[0]?.reps)||'',
          reps_target_max:Number(first.reps)||Number(p.reps)||Number(p.exercises?.[0]?.reps)||'',
          duration_target_s:Number(first.work)||Number(p.workSeconds)||Number(p.exercises?.[0]?.hold)||'',
          distance_target_m:'',
          load_target_value:Number(first.load)||Number(p.load)||'',
          load_target_unit:first.loadMode||'',
          rir_target:first.rir!==''&&first.rir!==undefined?Number(first.rir):(p.rir??''),
          rpe_target:p.rpe??'',
          rest_seconds:Number(first.rest)||Number(p.restSeconds)||'',
          tempo_code:'',
          progression_rule_text:'',
          optional:false,
          coach_notes:safeJson({notes:p.notes||'',structuredSets:p.structuredSets||[],exercises:p.exercises||[],climbing:p.climbing||null})
        });
      });
    });

    return {cycle,week:remoteWeek,sessions,blocks,prescriptions};
  }

  window.syncWeekPlan=async function(weekNo){
    const week=(state.weeks||[]).find(w=>Number(w.number)===Number(weekNo));
    if(!week||week.status!=='PUBLISHED')return;
    const c=cfg();
    if(!c.url){
      week.planSync={status:'local',message:'Publication locale — API non configurée',updatedAt:isoNow()};
      save();renderWeeks();return
    }

    const previousPlanSync={...(week.planSync||{})};
    const knownRemoteFingerprint=previousPlanSync.remoteFingerprint||null;
    week.planSync={
      ...previousPlanSync,
      status:'pending',
      message:'Publication vers Google Sheets',
      updatedAt:isoNow()
    };
    save();renderWeeks();

    try{
      const payload=buildPlanPayload(week);
      const force=consumeForceOnce(`plan:${week.weekId||week.number}`);
      if(!force){
        const meta=await fetchSyncMeta('plan',{athlete_id:cfg().athleteId,week_no:week.number});
        const known=knownRemoteFingerprint;
        const newer=meta.found&&Number(meta.version_no||0)>Number(week.publicationVersion||0);
        const sameVersion=meta.found&&Number(meta.version_no||0)===Number(week.publicationVersion||0);
        const changed=sameVersion&&known&&meta.fingerprint!==known;
        const baselineMissing=sameVersion&&!known;
        if(newer||changed||baselineMissing){
          const c=addConflict({conflictId:conflictId('plan',week.weekId||week.number),entityType:'plan',entityId:week.weekId||String(week.number),weekNo:week.number,label:`Semaine ${week.number}`,message:newer?'Une version distante plus récente existe.':baselineMissing?'Référence distante absente : recharge l’instantané avant de publier.':'La même version a été modifiée ailleurs.'});
          removeQueueItem(queueId('plan',week.weekId||week.number));
          week.planSync={status:'error',message:'Conflit multi-appareils',updatedAt:isoNow(),conflictId:c.conflictId};
          save();renderWeeks();
          if(typeof toast==='function')toast('Conflit détecté · publication bloquée');
          return
        }
      }
      if(!payload.cycle?.cycle_id)throw new Error('Identifiant du cycle manquant');
      if(!payload.week?.training_week_id)throw new Error('Identifiant de semaine manquant');
      if(!payload.sessions?.length)throw new Error('Aucun conteneur de séance à publier');
      if(!payload.blocks?.length)throw new Error('Aucune prescription à publier');
      const result=await request('plan.publish',{method:'POST',payload});
      removeQueueItem(queueId('plan',week.weekId||week.number));
      const freshMeta=await fetchSyncMeta('plan',{athlete_id:cfg().athleteId,week_no:week.number});
      week.planSync={
        status:'synced',
        message:`Version ${week.publicationVersion} publiée · ${result.counts?.sessions||0} séance(s)`,
        updatedAt:isoNow(),
        remoteWeekId:result.training_week_id,
        remoteFingerprint:freshMeta.fingerprint||null
      };
      if(typeof logAudit==='function')logAudit('SYNC_PLAN','WEEK',week.weekId||String(week.number),`Version ${week.publicationVersion}`);
      saveCfg({connected:true,lastSync:isoNow(),lastMessage:`Semaine ${week.number} publiée vers Google Sheets`});
      save();renderWeeks();
      if(typeof toast==='function')toast('Semaine synchronisée avec Google Sheets')
    }catch(error){
      console.error('Publication semaine',error);
      const payload=buildPlanPayload(week);
      const queued=upsertQueueItem({
        queueId:queueId('plan',week.weekId||week.number),
        type:'plan',
        entityId:week.weekId||String(week.number),
        label:`Semaine ${week.number} v${week.publicationVersion||1}`,
        payload
      });
      week.planSync={...previousPlanSync,status:'error',message:`En attente · ${error.message||'Erreur réseau'}`,updatedAt:isoNow(),queueId:queued.queueId,remoteFingerprint:knownRemoteFingerprint};
      saveCfg({connected:false,lastMessage:`Publication mise en attente · ${error.message||'Erreur réseau'}`});
      save();renderWeeks();
      if(typeof toast==='function')toast('Publication conservée localement et mise en attente')
    }
  };

  function rebuildRemoteWeeks(snapshot){
    const remoteWeeks=snapshot?.weeks||[];
    const remoteSessions=snapshot?.sessions||[];
    const remoteBlocks=snapshot?.blocks||[];
    if(!remoteWeeks.length)return [];

    const latestByNo=new Map();
    remoteWeeks.filter(w=>String(w.status).toLowerCase()==='published').forEach(w=>{
      const no=Number(w.week_no);
      const current=latestByNo.get(no);
      if(!current||Number(w.version_no||0)>Number(current.version_no||0))latestByNo.set(no,w)
    });

    return [...latestByNo.values()].sort((a,b)=>Number(a.week_no)-Number(b.week_no)).map(w=>{
      const sessionRows=remoteSessions.filter(s=>String(s.training_week_id)===String(w.training_week_id));
      const containers=[];
      const prescriptions=[];
      sessionRows.forEach((s,sessionIndex)=>{
        const meta=parseJson(s.coach_instructions,{})||{};
        const containerId=meta.localContainerId||String(s.planned_session_id);
        containers.push({
          containerId,
          day:meta.day||['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'][new Date(s.session_date).getDay()===0?6:new Date(s.session_date).getDay()-1]||'Lun',
          slot:meta.slot||'midi',
          title:meta.title||`Séance ${sessionIndex+1}`,
          comment:meta.comment||'',
          status:'PLANNED',
          remotePlannedSessionId:s.planned_session_id
        });
        remoteBlocks
          .filter(b=>String(b.planned_session_id)===String(s.planned_session_id))
          .sort((a,b)=>Number(a.block_order)-Number(b.block_order))
          .forEach(b=>{
            const p=parseJson(b.notes,{})||{};
            const sessionId=p.sessionId||String(b.session_block_id).replace(/-v\d+$/,'');
            prescriptions.push({
              ...p,
              sessionId,
              containerId,
              day:meta.day||p.day||'Lun',
              slot:meta.slot||p.slot||'midi',
              title:p.title||b.name||'Prescription',
              duration:Number(p.duration||b.duration_target_min)||0,
              execution:null,
              remoteBlockId:b.session_block_id,
              remoteWeekId:w.training_week_id
            })
          })
      });
      return {
        weekId:w.local_week_id||String(w.training_week_id).replace(/-v\d+$/,''),
        remoteTrainingWeekId:w.training_week_id,
        number:Number(w.week_no),
        type:String(w.week_type).toLowerCase()==='deload'?'DELOAD':String(w.week_type).toLowerCase()==='tests'?'TESTS':'WORK',
        status:'PUBLISHED',
        publicationVersion:Number(w.version_no)||1,
        comment:w.focus_summary||'',
        containers,
        sessions:prescriptions,
        remoteOrigin:true,
        isDemo:false
      }
    })
  }

})();
