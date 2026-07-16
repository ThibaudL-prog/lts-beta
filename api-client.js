
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


  let backgroundSyncTimer=null;
  let backgroundSyncRunning=false;
  let backgroundSyncQueued=false;
  let backgroundSyncLastRequestAt=0;
  let backgroundSyncFailureCount=0;
  let backgroundSyncSuspended=false;
  let backgroundSyncLastError='';
  const BACKGROUND_SYNC_DELAY_MS=3500;
  const BACKGROUND_SYNC_MIN_INTERVAL_MS=12000;
  const BACKGROUND_SYNC_MAX_FAILURES=2;
  const BACKGROUND_SYNC_BACKOFF_MS=[15000,45000];

  function setBackgroundSyncBadge(mode,text){
    const badge=document.getElementById('backgroundSyncBadge');
    const label=document.getElementById('backgroundSyncBadgeText');
    if(!badge||!label)return;
    badge.classList.remove('show','done','error');
    if(mode==='hidden')return;
    badge.classList.add('show');
    if(mode==='done')badge.classList.add('done');
    if(mode==='error')badge.classList.add('error');
    label.textContent=text;
  }

  function hideBackgroundSyncBadge(delay=1200){
    setTimeout(()=>setBackgroundSyncBadge('hidden',''),delay)
  }

  function hasOpenEditor(){
    return !!document.querySelector('.sheetwrap, .modal, [data-editing="true"]')
  }

  function hasAnythingToBackgroundSync(){
    if(loadQueue().length)return true;
    if(loadConflicts().some(x=>x.status==='open'))return false;

    const dirtyExecution=(state.weeks||[])
      .flatMap(w=>w.sessions||[])
      .some(p=>p.execution&&p.execution.sync?.status!=='synced');
    if(dirtyExecution)return true;

    const lastSyncTime=cfg().lastSync?new Date(cfg().lastSync).getTime():0;
    const isNewerThanLastSync=r=>{
      const t=new Date(r?.date||0).getTime();
      return Number.isFinite(t)&&t>lastSyncTime
    };
    const dirtyCheckin=(state.records?.checkins||[]).some(isNewerThanLastSync);
    const dirtyMeasurement=(state.records?.measurements||[]).some(isNewerThanLastSync);
    return dirtyCheckin||dirtyMeasurement
  }

  function scheduleBackgroundSync(reason='local-change'){
    if(window.__LTS_SUPPRESS_LOCAL_CHANGE__)return;
    if(backgroundSyncRunning&&reason==='local-change')return;
    if(!cfg().url)return;
    if(!navigator.onLine)return;
    if(loadConflicts().some(x=>x.status==='open'))return;

    // A genuine new local change or a network return re-enables background sync.
    if(reason==='local-change'||reason==='online'||reason==='manual-reset'){
      backgroundSyncSuspended=false;
      backgroundSyncFailureCount=0;
      backgroundSyncLastError='';
    }

    if(backgroundSyncSuspended)return;

    backgroundSyncLastRequestAt=Date.now();
    backgroundSyncQueued=true;

    clearTimeout(backgroundSyncTimer);
    backgroundSyncTimer=setTimeout(()=>{
      runBackgroundSync(reason)
    },BACKGROUND_SYNC_DELAY_MS)
  }

  async function runBackgroundSync(reason='scheduled'){
    if(backgroundSyncRunning||globalSyncRunning)return;
    if(!navigator.onLine||!cfg().url)return;
    if(loadConflicts().some(x=>x.status==='open'))return;

    if(hasOpenEditor()){
      scheduleBackgroundSync('editor-open');
      return
    }

    if(!hasAnythingToBackgroundSync()){
      backgroundSyncQueued=false;
      return
    }

    const sinceLast=Date.now()-(cfg().lastSync?new Date(cfg().lastSync).getTime():0);
    if(sinceLast<BACKGROUND_SYNC_MIN_INTERVAL_MS&&reason!=='online'){
      scheduleBackgroundSync('min-interval');
      return
    }

    backgroundSyncRunning=true;
    backgroundSyncQueued=false;
    setBackgroundSyncBadge('running','Synchronisation en arrière-plan…');

    const previousSuppressState=window.__LTS_SUPPRESS_LOCAL_CHANGE__;
    window.__LTS_SUPPRESS_LOCAL_CHANGE__=true;

    try{
      // Toutes les écritures réalisées ici sont techniques.
      // Elles ne doivent jamais être interprétées comme une nouvelle modification Coach.
      pruneStaleQueueItems();
      await retrySyncQueue({silent:true});
      // Les plans sont volontairement exclus de l’arrière-plan.
      // Ils sont publiés au clic sur Publier ou Synchroniser maintenant.
      await syncUnsyncedExecutions();
      await pushLocalAthleteData({silent:true});
      await syncSheetsSnapshot({silent:true});
      reconcilePublishedWeekSyncStatus();

      pruneStaleQueueItems();
      backgroundSyncFailureCount=0;
      backgroundSyncSuspended=false;
      backgroundSyncLastError='';
      saveCfg({connected:true,lastSync:new Date().toISOString(),lastMessage:'Synchronisation automatique terminée'});
      setBackgroundSyncBadge('done','Synchronisation automatique terminée');
      hideBackgroundSyncBadge(1800);
      if(typeof render==='function')render()
    }catch(error){
      console.error('Synchronisation arrière-plan',error);
      backgroundSyncFailureCount+=1;
      backgroundSyncLastError=error.message||'Erreur';

      if(backgroundSyncFailureCount>=BACKGROUND_SYNC_MAX_FAILURES){
        backgroundSyncSuspended=true;
        backgroundSyncQueued=false;
        clearTimeout(backgroundSyncTimer);
        saveCfg({
          connected:false,
          lastMessage:`Synchronisation en attente · ${backgroundSyncLastError}`
        });
        setBackgroundSyncBadge('error','Synchronisation en attente');
        hideBackgroundSyncBadge(2600)
      }else{
        const delay=BACKGROUND_SYNC_BACKOFF_MS[Math.min(backgroundSyncFailureCount-1,BACKGROUND_SYNC_BACKOFF_MS.length-1)];
        saveCfg({
          connected:false,
          lastMessage:`Nouvelle tentative automatique dans ${Math.round(delay/1000)} s · ${backgroundSyncLastError}`
        });
        setBackgroundSyncBadge('error',`Nouvelle tentative dans ${Math.round(delay/1000)} s`);
        hideBackgroundSyncBadge(2200);
        clearTimeout(backgroundSyncTimer);
        backgroundSyncQueued=true;
        backgroundSyncTimer=setTimeout(()=>runBackgroundSync('retry'),delay)
      }
    }finally{
      window.__LTS_SUPPRESS_LOCAL_CHANGE__=previousSuppressState;
      backgroundSyncRunning=false;

      if(backgroundSyncQueued&&!backgroundSyncSuspended&&backgroundSyncFailureCount===0){
        if(hasAnythingToBackgroundSync())scheduleBackgroundSync('queued');
        else backgroundSyncQueued=false
      }
    }
  }

  window.addEventListener('lts-local-change',()=>{
    try{
      if(window.__LTS_SUPPRESS_LOCAL_CHANGE__)return;
      scheduleBackgroundSync('local-change')
    }catch(error){
      console.error('Planification de la synchronisation automatique',error)
    }
  });

  setTimeout(()=>{
    const removed=discardLegacyPlanQueue();
    if(removed&&typeof render==='function')render()
  },300);

  window.addEventListener('online',()=>{
    setTimeout(()=>runBackgroundSync('online'),1000)
  });

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'&&navigator.onLine&&!backgroundSyncSuspended){
      if(loadQueue().length)scheduleBackgroundSync('queue-added');
      else scheduleBackgroundSync('visible')
    }
  });

  setTimeout(()=>{
    if(navigator.onLine&&loadQueue().length&&!backgroundSyncSuspended){
      scheduleBackgroundSync('queue-added')
    }
  },1200);

  let globalSyncRunning=false;
  let globalSyncProgress={step:0,total:6,label:'Prête',done:false};

  function updateGlobalSyncProgress(step,label,done=false){
    globalSyncProgress={step,total:6,label,done};
    const bar=document.getElementById('globalSyncProgressBar');
    const text=document.getElementById('globalSyncProgressLabel');
    const count=document.getElementById('globalSyncProgressCount');
    const button=document.getElementById('globalSyncButton');
    const doneBox=document.getElementById('globalSyncDone');

    if(bar)bar.style.width=`${Math.min(100,Math.round(step/6*100))}%`;
    if(text)text.textContent=label;
    if(count)count.textContent=`${Math.min(step,6)}/6`;
    if(button){
      button.disabled=globalSyncRunning;
      button.innerHTML=globalSyncRunning?`<span class="syncSpinner"></span>Synchronisation…`:'Synchroniser maintenant'
    }
    if(doneBox){
      doneBox.style.display=done?'block':'none';
      doneBox.textContent=done?'Synchronisation terminée · toutes les données sont à jour':''
    }
  }

  function globalSyncState(){
    const c=cfg();
    const queue=loadQueue();
    const conflicts=loadConflicts().filter(x=>x.status==='open');
    if(!c.url)return {status:'unconfigured',label:'Non configurée',message:'Renseigne l’URL Apps Script.'};
    if(!navigator.onLine)return {status:'offline',label:'Hors ligne',message:`${queue.length} élément(s) seront envoyés au retour du réseau.`};
    if(conflicts.length)return {status:'conflict',label:'Conflit',message:`${conflicts.length} conflit(s) à résoudre.`};
    if(queue.length)return {status:'pending',label:'En attente',message:`${queue.length} élément(s) restent à synchroniser.`};

    const unsyncedPlans=(state.weeks||[]).filter(w=>w.status==='PUBLISHED'&&w.planSync?.status!=='synced').length;
    const unsyncedExecutions=(state.weeks||[]).flatMap(w=>w.sessions||[]).filter(p=>p.execution&&p.execution.sync?.status!=='synced').length;

    if(unsyncedPlans+unsyncedExecutions){
      return {
        status:'pending',
        label:'En attente',
        message:`${unsyncedPlans+unsyncedExecutions} élément(s) restent à synchroniser.`
      }
    }

    if(c.connected)return {status:'synced',label:'À jour',message:c.lastMessage||'Google Sheets est à jour.'};
    return {status:'pending',label:'À vérifier',message:c.lastMessage||'Teste la connexion.'}
  }

  window.renderGlobalSyncCenter=function(){
    pruneStaleQueueItems();
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
        <button id="globalSyncButton" class="btn" onclick="synchronizeEverything()" ${globalSyncRunning?'disabled':''}>${globalSyncRunning?'<span class="syncSpinner"></span>Synchronisation…':'Synchroniser maintenant'}</button>
        <button class="btn secondary" onclick="toggleSyncSettings()">Réglages</button>
        ${conflicts.length?`<button class="btn ghost" onclick="toggleConflictDetails()">Voir les conflits</button>`:''}
      </div>

      <div class="syncProgressWrap">
        <div class="syncProgressTrack"><div id="globalSyncProgressBar" class="syncProgressBar" style="width:${Math.round((globalSyncProgress.step||0)/6*100)}%"></div></div>
        <div class="syncProgressText">
          <span id="globalSyncProgressLabel">${escapeHtml(globalSyncProgress.label||'Prête')}</span>
          <span id="globalSyncProgressCount">${globalSyncProgress.step||0}/6</span>
        </div>
        <div id="globalSyncDone" class="syncDone" style="display:${globalSyncProgress.done?'block':'none'}">${globalSyncProgress.done?'Synchronisation terminée · toutes les données sont à jour':''}</div>
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

  window.saveApiSettings=function(options={}){
    const current=cfg();
    const urlField=document.getElementById('apiUrl');
    const athleteField=document.getElementById('apiAthlete');

    const next={
      url:urlField?urlField.value.trim():current.url,
      athleteId:athleteField?(athleteField.value.trim()||current.athleteId||'ath_demo_001'):current.athleteId,
      connected:current.connected,
      lastMessage:options.silent?current.lastMessage:'Configuration enregistrée'
    };

    saveCfg(next);
    if(!options.silent&&typeof toast==='function')toast('Configuration API enregistrée')
  };

  window.testSheetsApi=async function(){
    saveApiSettings({silent:true});saveCfg({lastMessage:'Test en cours…'});
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

  function replaceCoachPublishedWeeksFromRemote(options={}){
    const remoteWeeks=state.remoteWeeks||[];
    if(!remoteWeeks.length)return;

    const force=options.force===true;
    const now=Date.now();
    const protectionMs=2*60*1000;

    remoteWeeks.forEach(remoteWeek=>{
      const localIndex=(state.weeks||[]).findIndex(w=>Number(w.number)===Number(remoteWeek.number));
      const localWeek=localIndex>=0?state.weeks[localIndex]:null;

      if(localWeek&&!force){
        const localVersion=Number(localWeek.publicationVersion||0);
        const remoteVersion=Number(remoteWeek.publicationVersion||0);
        const confirmedAt=localWeek.localPublishConfirmedAt?new Date(localWeek.localPublishConfirmedAt).getTime():0;
        const freshlyConfirmed=confirmedAt>0&&(now-confirmedAt)<protectionMs;
        const sameConfirmedVersion=Number(localWeek.localPublishConfirmedVersion||0)===localVersion;
        const sameVersion=remoteVersion===localVersion;

        // Google Sheets may briefly return the previous snapshot immediately
        // after plan.publish. Keep the just-confirmed local plan in that case.
        if(freshlyConfirmed&&sameConfirmedVersion&&sameVersion){
          localWeek.planSync={
            ...(localWeek.planSync||{}),
            status:'synced',
            message:`Google Sheets v${localVersion}`,
            updatedAt:new Date().toISOString(),
            remoteWeekId:remoteWeek.remoteTrainingWeekId,
            remoteFingerprint:remoteWeek.remoteFingerprint||localWeek.planSync?.remoteFingerprint||null,
            remoteUpdatedAt:remoteWeek.remoteUpdatedAt||remoteWeek.publishedAt||null
          };
          return
        }

        // Never downgrade to an older remote version.
        if(remoteVersion<localVersion)return
      }

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
    saveApiSettings({silent:true});saveCfg({lastMessage:'Chargement de l’instantané…'});
    try{
      const r=await request('snapshot');
      window.__LTS_SUPPRESS_LOCAL_CHANGE__=true;
      try{
        mapSnapshotToLocal(r.snapshot);
        await hydratePlanConflictBaselines();
        replaceCoachPublishedWeeksFromRemote();
        if(typeof save==='function')save();
      }finally{
        window.__LTS_SUPPRESS_LOCAL_CHANGE__=false
      }
      const loaded=(state.remoteWeeks||[]).map(w=>`S${w.number} v${w.publicationVersion||1}`).join(', ');
      saveCfg({connected:true,lastSync:new Date().toISOString(),lastMessage:`Instantané chargé · ${r.counts?.weeks||0} semaine(s), ${r.counts?.sessions||0} séance(s)${loaded?' · '+loaded:''}`});
      render();if(!options.silent&&typeof toast==='function')toast('Instantané Google Sheets chargé')
    }catch(e){
      saveCfg({connected:false,lastMessage:e.message});
      if(!options.silent&&typeof toast==='function')toast('Synchronisation impossible')
    }
  };

  window.pushLocalAthleteData=async function(options={}){
    saveApiSettings({silent:true});saveCfg({lastMessage:'Envoi des données Athlète…'});
    let checkins=[];
    let measurements=[];
    try{
      checkins=(state.records?.checkins||[]).map(r=>({...r,athlete_id:cfg().athleteId}));
      measurements=(state.records?.measurements||[]).flatMap(r=>{
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
      replaceCoachPublishedWeeksFromRemote({force:true});
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
    localStorage.setItem(QUEUE_KEY,JSON.stringify(queue))
  }

  function discardLegacyPlanQueue(){
    const queue=loadQueue();
    const planItems=queue.filter(item=>item.type==='plan');
    if(!planItems.length)return 0;

    const kept=queue.filter(item=>item.type!=='plan');
    saveQueue(kept);

    planItems.forEach(item=>{
      const week=(state.weeks||[]).find(w=>String(w.weekId||w.number)===String(item.entityId));
      if(week){
        week.planSync={
          ...(week.planSync||{}),
          status:'error',
          message:'Publication à relancer manuellement',
          updatedAt:isoNow()
        };
        delete week.planSync.queueId
      }
    });

    if(typeof save==='function')save();
    return planItems.length
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
      <div class="sectiontitle"><div><h3 style="margin:0">File de synchronisation</h3><p class="muted small">${summary.total} élément(s) Athlète en attente · plans publiés manuellement</p></div><span class="queueCount">${summary.total}</span></div>
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
      removeQueueItem(item.queueId);
      if(!week)throw new Error('Semaine locale introuvable');

      setForceOnce(`plan:${week.weekId||week.number}`);
      await syncWeekPlan(week.number);

      if(week.planSync?.status!=='synced'){
        throw new Error(week.planSync?.message||'Publication du plan non confirmée')
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


  function pruneStaleQueueItems(){
    const queue=loadQueue();
    const filtered=queue.filter(item=>{
      if(item.type==='plan'){
        const week=(state.weeks||[]).find(w=>String(w.weekId||w.number)===String(item.entityId));
        if(!week)return false;
        if(week.planSync?.status==='synced'&&!weekHasRealLocalChanges(week))return false;
      }

      if(item.type==='execution'){
        const found=typeof findSession==='function'?findSession(item.entityId):null;
        if(!found?.session?.execution)return false;
        if(found.session.execution.sync?.status==='synced')return false;
      }

      if(item.type==='checkins'){
        if(!(item.records||[]).length)return false;
      }

      if(item.type==='measurements'){
        if(!(item.records||[]).length)return false;
      }

      return true
    });

    if(filtered.length!==queue.length)saveQueue(filtered);
    return queue.length-filtered.length
  }

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

  function reconcilePublishedWeekSyncStatus(){
    const remoteWeeks=state.remoteWeeks||[];

    (state.weeks||[]).forEach(week=>{
      if(week.status!=='PUBLISHED')return;

      const remote=remoteWeeks.find(r=>Number(r.number)===Number(week.number));
      if(!remote)return;

      const localVersion=Number(week.publicationVersion||0);
      const remoteVersion=Number(remote.publicationVersion||0);

      // When the remote version is the same or newer, and there is no
      // explicit open conflict, the plan is considered synchronized.
      const hasOpenConflict=loadConflicts().some(c=>
        c.status==='open' &&
        c.entityType==='plan' &&
        Number(c.weekNo)===Number(week.number)
      );

      if(!hasOpenConflict && remoteVersion>=localVersion){
        week.planSync={
          ...(week.planSync||{}),
          status:'synced',
          message:`Google Sheets v${remoteVersion||localVersion||1}`,
          updatedAt:isoNow(),
          remoteWeekId:remote.remoteTrainingWeekId||week.planSync?.remoteWeekId||null,
          remoteFingerprint:remote.remoteFingerprint||week.planSync?.remoteFingerprint||null,
          remoteUpdatedAt:remote.remoteUpdatedAt||remote.publishedAt||null
        };
        delete week.planSync.queueId
      }
    });

    if(typeof save==='function')save()
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
    if(globalSyncRunning||backgroundSyncRunning)return;
    clearTimeout(backgroundSyncTimer);
    backgroundSyncQueued=false;
    backgroundSyncSuspended=false;
    backgroundSyncFailureCount=0;
    backgroundSyncLastError='';

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

    globalSyncRunning=true;
    const previousSuppressState=window.__LTS_SUPPRESS_LOCAL_CHANGE__;
    window.__LTS_SUPPRESS_LOCAL_CHANGE__=true;
    globalSyncProgress={step:0,total:6,label:'Préparation…',done:false};
    updateGlobalSyncProgress(0,'Préparation…');
    saveCfg({lastMessage:'Synchronisation globale en cours…'});

    try{
      pruneStaleQueueItems();

      updateGlobalSyncProgress(1,'Lecture de Google Sheets…');
      await syncSheetsSnapshot({silent:true});

      updateGlobalSyncProgress(2,'Nettoyage des conflits obsolètes…');
      clearResolvedOrStaleConflicts();

      updateGlobalSyncProgress(3,'Traitement de la file locale…');
      await retrySyncQueue({silent:true});

      updateGlobalSyncProgress(4,'Envoi des plans et performances…');
      await syncPublishedPlans();
      await syncUnsyncedExecutions();

      updateGlobalSyncProgress(5,'Envoi des check-ins et mensurations…');
      await pushLocalAthleteData({silent:true});

      updateGlobalSyncProgress(6,'Vérification finale…');
      await syncSheetsSnapshot({silent:true});
      reconcilePublishedWeekSyncStatus();
      pruneStaleQueueItems();

      const remainingPlans=(state.weeks||[]).filter(w=>w.status==='PUBLISHED'&&w.planSync?.status!=='synced').length;
      const remainingQueue=loadQueue().length;
      const openConflicts=loadConflicts().filter(c=>c.status==='open').length;

      saveCfg({
        connected:true,
        lastSync:new Date().toISOString(),
        lastMessage:(remainingPlans||remainingQueue||openConflicts)
          ?'Synchronisation terminée avec éléments restant à traiter'
          :'Toutes les données sont à jour'
      });
      globalSyncRunning=false;
      globalSyncProgress={step:6,total:6,label:'Terminée',done:true};
      if(typeof render==='function')render();
      updateGlobalSyncProgress(6,'Terminée',true);
      if(typeof toast==='function')toast('Synchronisation terminée');

      setTimeout(()=>{
        globalSyncProgress={step:0,total:6,label:'Prête',done:false};
        if(typeof render==='function')render()
      },5000)
    }catch(error){
      console.error('Synchronisation globale',error);
      saveCfg({connected:false,lastMessage:error.message||'Synchronisation incomplète'});
      globalSyncRunning=false;
      globalSyncProgress={step:0,total:6,label:`Échec : ${error.message||'erreur inconnue'}`,done:false};
      if(typeof render==='function')render();
      if(typeof toast==='function')toast('Synchronisation incomplète')
    }finally{
      window.__LTS_SUPPRESS_LOCAL_CHANGE__=previousSuppressState
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
      week.localPublishConfirmedAt=isoNow();
      week.localPublishConfirmedVersion=Number(week.publicationVersion||1);
      if(typeof logAudit==='function')logAudit('SYNC_PLAN','WEEK',week.weekId||String(week.number),`Version ${week.publicationVersion}`);
      saveCfg({connected:true,lastSync:isoNow(),lastMessage:`Semaine ${week.number} publiée vers Google Sheets`});
      save();renderWeeks();
      if(typeof toast==='function')toast('Semaine synchronisée avec Google Sheets')
    }catch(error){
      console.error('Publication semaine',error);
      removeQueueItem(queueId('plan',week.weekId||week.number));
      week.planSync={
        ...previousPlanSync,
        status:'error',
        message:`Échec de publication · ${error.message||'Erreur réseau'}`,
        updatedAt:isoNow(),
        remoteFingerprint:knownRemoteFingerprint
      };
      delete week.planSync.queueId;
      saveCfg({connected:false,lastMessage:`Échec de publication · ${error.message||'Erreur réseau'}`});
      save();renderWeeks();
      if(typeof toast==='function')toast(`Publication non envoyée : ${error.message||'Erreur réseau'}`)
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
