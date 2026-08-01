
(function(){
  const CONFIG_KEY='lts-api-config-v050';
  const MIGRATION_LOCK_KEY='lts-production-sync-lock-v0580';
  const RELEASE_UNLOCK_KEY='lts-production-sync-unlock-v0582';
  const DEFAULT={url:'',athleteId:'ath_lgrd_001',connected:false,lastSync:null,lastMessage:'Prête à synchroniser',schemaVersion:null,writeEnabled:false};

  // v0.5.8.8 conserve la migration clôturée et normalise les stimuli distants. Le verrou hérité de v0.5.8.0/1
  // est retiré une seule fois sur chaque appareil, sans effacer les données locales.
  if(localStorage.getItem(RELEASE_UNLOCK_KEY)!=='done'){
    localStorage.setItem(MIGRATION_LOCK_KEY,'0');
    localStorage.setItem(RELEASE_UNLOCK_KEY,'done')
  }

  function migrationLocked(){
    return localStorage.getItem(MIGRATION_LOCK_KEY)==='1'
  }

  function unlockMigration(){
    localStorage.setItem(MIGRATION_LOCK_KEY,'0');
    localStorage.setItem(RELEASE_UNLOCK_KEY,'done')
  }

  try{
    const existing=JSON.parse(localStorage.getItem(CONFIG_KEY)||'{}');
    if(!existing.athleteId||existing.athleteId==='ath_demo_001'){
      localStorage.setItem(CONFIG_KEY,JSON.stringify({
        ...existing,
        athleteId:'ath_lgrd_001',
        connected:false,
        lastSync:null,
        lastMessage:'Prête à synchroniser'
      }))
    }
  }catch(error){
    console.error('Migration de l’identifiant Athlète',error)
  }

  function cfg(){try{return {...DEFAULT,...JSON.parse(localStorage.getItem(CONFIG_KEY)||'{}')}}catch(e){return {...DEFAULT}}}
  function saveCfg(next){localStorage.setItem(CONFIG_KEY,JSON.stringify({...cfg(),...next}));window.dispatchEvent(new Event('lts-api-status'))}
  function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}

  async function request(action,options={}){
    if(migrationLocked()&&!['health','schema.audit'].includes(String(action))){
      throw new Error('Migration du schéma en cours · synchronisation verrouillée')
    }
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


  const executionSyncInFlight=new Map();
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

    const dirtyCheckin=(state.records?.checkins||[]).some(record=>!record._remote);
    const dirtyMeasurement=(state.records?.measurements||[]).some(record=>!record._remote);
    return dirtyCheckin||dirtyMeasurement
  }

  function scheduleBackgroundSync(reason='local-change'){
    if(migrationLocked())return;
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
    if(migrationLocked())return;
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
    if(migrationLocked()){
      return {
        status:'locked',
        label:'Verrouillée',
        message:'Migration du schéma stimuli/exécutions en cours. Aucune donnée ne peut être envoyée.'
      }
    }
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


  window.auditMigrationSchema=async function(){
    const button=document.getElementById('schemaAuditButton');
    if(button){button.disabled=true;button.textContent='Vérification…'}
    try{
      const result=await request('schema.audit');
      state.productionMigration=state.productionMigration||{};
      state.productionMigration.schemaAudit=result;
      state.productionMigration.schemaAuditAt=new Date().toISOString();
      if(result.valid){
        unlockMigration();
        state.productionMigration.status='READY'
      }
      if(typeof save==='function')save();
      if(typeof render==='function')render();
      if(typeof toast==='function')toast(result.valid?'Schéma Google Sheets valide · synchronisation déverrouillée':'Schéma incomplet')
    }catch(error){
      if(typeof toast==='function')toast(`Audit impossible : ${error.message||error}`);
      if(button){button.disabled=false;button.textContent='Vérifier le schéma'}
    }
  };

  window.renderGlobalSyncCenter=function(){
    pruneStaleQueueItems();
    const c=cfg();
    const locked=migrationLocked();
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

      ${locked?`<div class="productionMigrationBanner">
        <b>Migration du schéma en cours</b>
        <span class="muted small">Les données réelles déjà saisies sont conservées. La synchronisation reste bloquée pendant la correction du schéma relationnel et des références.</span>
        ${state.productionMigration?.schemaAudit?`<div class="small" style="margin-top:8px"><b>${state.productionMigration.schemaAudit.valid?'Schéma valide':'Schéma incomplet'}</b> · ${(state.productionMigration.schemaAudit.checks||[]).filter(c=>c.ok).length}/${(state.productionMigration.schemaAudit.checks||[]).length} contrôles réussis</div>`:''}
        <button id="schemaAuditButton" class="btn secondary" style="margin-top:10px" onclick="auditMigrationSchema()">Vérifier le schéma Google Sheets</button>
      </div>`:''}

      <div class="syncStats">
        <div class="syncStat"><span class="muted small">En attente</span><b>${queue.length}</b></div>
        <div class="syncStat"><span class="muted small">Conflits</span><b>${conflicts.length}</b></div>
        <div class="syncStat"><span class="muted small">Non synchronisés</span><b>${localWeeks+unsyncedExecutions}</b></div>
      </div>

      <div class="syncActions">
        <button id="globalSyncButton" class="btn" onclick="synchronizeEverything()" ${(locked||globalSyncRunning)?'disabled':''}>${locked?'Migration verrouillée':(globalSyncRunning?'<span class="syncSpinner"></span>Synchronisation…':'Synchroniser maintenant')}</button>
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
      athleteId:athleteField?(athleteField.value.trim()||current.athleteId||'ath_lgrd_001'):current.athleteId,
      connected:current.connected,
      lastMessage:options.silent?current.lastMessage:'Configuration enregistrée'
    };

    saveCfg(next);
    if(!options.silent&&typeof toast==='function')toast('Configuration API enregistrée')
  };

  window.testSheetsApi=async function(options={}){
    saveApiSettings({silent:true});saveCfg({lastMessage:'Test et chargement en cours…'});
    try{
      const health=await request('health');
      const audit=await request('schema.audit');
      if(!audit.valid){
        const failed=(audit.checks||[]).filter(check=>!check.ok).map(check=>check.code).join(', ');
        throw new Error(`Schéma Google Sheets incomplet${failed?' · '+failed:''}`)
      }
      if(String(health.schema_version||'')!=='0.5.8.1'&&String(health.schema_version||'')!=='0.5.8.2'&&String(health.schema_version||'')!=='0.5.8.3'){
        throw new Error(`Version de schéma incompatible : ${health.schema_version||'inconnue'}`)
      }
      unlockMigration();
      state.productionMigration=state.productionMigration||{};
      state.productionMigration.status='READY';
      state.productionMigration.schemaAudit=audit;
      state.productionMigration.schemaAuditAt=new Date().toISOString();
      if(typeof save==='function')save();
      saveCfg({
        connected:true,
        lastSync:new Date().toISOString(),
        schemaVersion:health.schema_version,
        writeEnabled:health.write_enabled===true,
        lastMessage:`API disponible · schéma ${health.schema_version} · chargement du planning…`
      });
      await syncSheetsSnapshot({silent:true,forceRemote:true});
      const counts=state.remoteSnapshot?{
        weeks:(state.remoteSnapshot.weeks||[]).length,
        sessions:(state.remoteSnapshot.sessions||[]).length,
        prescriptions:(state.remoteSnapshot.prescriptions||[]).length
      }:{weeks:0,sessions:0,prescriptions:0};
      saveCfg({
        connected:true,
        lastSync:new Date().toISOString(),
        schemaVersion:health.schema_version,
        writeEnabled:health.write_enabled===true,
        lastMessage:`Connexion validée · ${counts.weeks} semaine(s), ${counts.sessions} séance(s), ${counts.prescriptions} prescription(s)`
      });
      if(typeof render==='function')render();
      if(!options.silent&&typeof toast==='function')toast('Connexion et planning Google Sheets chargés')
    }catch(e){
      saveCfg({connected:false,lastMessage:e.message});
      if(!options.silent&&typeof toast==='function')toast(`Connexion impossible : ${e.message||e}`)
    }
  };


  function cloneExecution(value){
    return value?JSON.parse(JSON.stringify(value)):null
  }

  function executionTime(value){
    if(!value)return 0;
    const candidates=[value.sync?.updatedAt,value.completedAt,value.startedAt];
    for(const candidate of candidates){
      const time=candidate?new Date(candidate).getTime():0;
      if(Number.isFinite(time)&&time>0)return time
    }
    return 0
  }

  function collectExecutionOverlay(){
    const overlay=new Map();
    const ingest=weeks=>{
      (weeks||[]).forEach(w=>(w.sessions||[]).forEach(p=>{
        if(!p.sessionId||!p.execution)return;
        const id=String(p.sessionId);
        const current=overlay.get(id);
        const currentUnsynced=current&&current.sync?.status!=='synced';
        const incomingUnsynced=p.execution.sync?.status!=='synced';
        if(!current||(
          incomingUnsynced&&!currentUnsynced
        )||(
          executionTime(p.execution)>executionTime(current)
        )){
          overlay.set(id,cloneExecution(p.execution))
        }
      }))
    };
    ingest(state.weeks);
    ingest(state.remoteWeeks);
    return overlay
  }

  function snapshotCheckinRecords(snapshot){
    return (snapshot?.checkins||[]).map(row=>{
      const type=String(row.checkin_type||'').toUpperCase();
      const painValue=sheetNumber(row.pain_intensity_0_10)??sheetNumber(row.pain_0_10)??(String(row.pain_present).toLowerCase()==='true'?1:0);
      return {
        date:row.checked_at||row.date||row.created_at||new Date().toISOString(),
        source:type==='EVENING'?'Check-in soir':type==='WEEKLY'?'Check-up dimanche':'Check-in matin',
        sleep:sheetNumber(row.sleep_duration_h),
        sleepQuality:sheetNumber(row.sleep_quality_0_10),
        fatigue:sheetNumber(row.fatigue_0_10)??sheetNumber(row.soreness_0_10),
        soreness:sheetNumber(row.soreness_0_10),
        stress:sheetNumber(row.stress_0_10),
        energy:sheetNumber(row.energy_0_10),
        motivation:sheetNumber(row.motivation_0_10),
        pain:painValue,
        rpe:sheetNumber(row.day_rpe_0_10)??sheetNumber(row.rpe_day_0_10),
        bike:sheetNumber(row.cycling_distance_km)??sheetNumber(row.bike_distance_km),
        hrSupine:sheetNumber(row.lying_hr_bpm)??sheetNumber(row.supine_hr_bpm)??sheetNumber(row.hr_supine_bpm)??sheetNumber(row.resting_hr_bpm),
        hrStanding:sheetNumber(row.standing_hr_bpm)??sheetNumber(row.upright_hr_bpm)??sheetNumber(row.hr_standing_bpm),
        _remote:true,
        _remoteId:row.checkin_id||''
      }
    })
  }

  function snapshotMeasurementRecords(snapshot){
    const typeMap={
      weight_kg:'weight',waist_cm:'waist',chest_cm:'chest',hips_cm:'hips',
      arm_relaxed_cm:'armRelaxed',arm_contract_cm:'armContracted',arm_contracted_cm:'armContracted',
      thigh_cm:'thigh',calf_cm:'calf',hr_supine_bpm:'hrSupine',lying_hr_bpm:'hrSupine',supine_hr_bpm:'hrSupine',
      hr_standing_bpm:'hrStanding',standing_hr_bpm:'hrStanding',upright_hr_bpm:'hrStanding'
    };
    const groups=new Map();
    (snapshot?.measurements||[]).forEach(row=>{
      const date=row.measured_at||row.created_at||row.date;
      if(!date)return;
      const day=String(date).slice(0,10);
      if(!groups.has(day))groups.set(day,{date,source:'Google Sheets',_remote:true});
      const key=typeMap[String(row.measurement_type||'').toLowerCase()];
      if(key)groups.get(day)[key]=sheetNumber(row.value)
    });
    return [...groups.values()].sort((a,b)=>String(a.date).localeCompare(String(b.date)))
  }


  function snapshotTestRecords(snapshot){
    const groups=new Map();
    const metricForCode={
      PULLUP_1RM:['pull1rm',['added_load_kg','raw_value']],
      DIP_1RM:['dip1rm',['added_load_kg','raw_value']],
      PULLUP_MAX_REPS:['pullReps',['repetitions_valid','raw_value']],
      DIP_MAX_REPS:['dipReps',['repetitions_valid','raw_value']],
      FINGER_MAX_20_5:['fingerMax',['added_load_kg','raw_value']],
      FINGER_END_20_7_3:['fingerRepeaters',['completed_tours','raw_value']],
      MCGILL_FLEX:['coreFlexor',['duration_seconds','flexion_seconds','raw_value']],
      MCGILL_SORENSEN:['coreExtensor',['duration_seconds','sorensen_seconds','raw_value']]
    };
    (snapshot?.test_results||[]).forEach(row=>{
      const valid=row.valid===true||String(row.valid).toLowerCase()==='true'||String(row.validation_status||'').toUpperCase()==='VALIDATED';
      if(!valid)return;
      const mapping=metricForCode[String(row.test_code||'').toUpperCase()];
      if(!mapping)return;
      const date=row.performed_at||row.created_at||row.updated_at;
      if(!date)return;
      const day=String(date).slice(0,10);
      if(!groups.has(day))groups.set(day,{date,source:'Tests Google Sheets',_remote:true});
      const [metric,candidates]=mapping;
      let value=null;
      for(const field of candidates){
        value=sheetNumber(row[field]);
        if(value!==null)break
      }
      if(value!==null)groups.get(day)[metric]=value
    });
    return [...groups.values()].sort((a,b)=>String(a.date).localeCompare(String(b.date)))
  }

  function mergeSnapshotRecords(remoteRows,localRows){
    const map=new Map();
    (remoteRows||[]).forEach(row=>map.set(`${String(row.date||'').slice(0,10)}|${row.source||''}`,row));
    (localRows||[]).forEach(row=>map.set(`${String(row.date||'').slice(0,10)}|${row.source||''}`,row));
    return [...map.values()].sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')))
  }

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
    state.records=state.records||{measurements:[],checkins:[],tests:[]};
    const localCheckinOverlay=(state.records.checkins||[]).filter(record=>!record._remote);
    const localMeasurementOverlay=(state.records.measurements||[]).filter(record=>!record._remote);
    const localTestOverlay=(state.records.tests||[]).filter(record=>!record._remote);
    state.records.checkins=mergeSnapshotRecords(snapshotCheckinRecords(snapshot),localCheckinOverlay);
    state.records.measurements=mergeSnapshotRecords(snapshotMeasurementRecords(snapshot),localMeasurementOverlay);
    state.records.tests=mergeSnapshotRecords(snapshotTestRecords(snapshot),localTestOverlay);
    const latestMeasurement=state.records.measurements[state.records.measurements.length-1];
    if(latestMeasurement){
      state.weekly={...(state.weekly||{}),...latestMeasurement};
      if(latestMeasurement.armContracted!==undefined)state.weekly.armFlexed=latestMeasurement.armContracted
    }
    if(snapshot.athlete){
      state.athlete={...state.athlete,name:snapshot.athlete.display_name||state.athlete.name,weight:snapshot.athlete.body_weight_kg||state.athlete.weight}
    }
    const remoteCycle=(snapshot.cycles||[]).slice().sort((a,b)=>{
      const activeA=String(a.status||'').toLowerCase()==='active'?1:0;
      const activeB=String(b.status||'').toLowerCase()==='active'?1:0;
      return activeB-activeA||String(b.start_date||'').localeCompare(String(a.start_date||''))
    })[0];
    if(remoteCycle){
      const today=new Date().toISOString().slice(0,10);
      const current=rebuiltRemoteWeeks.find(w=>w.startDate&&w.endDate&&today>=w.startDate&&today<=w.endDate);
      state.cycle={
        ...(state.cycle||{}),
        cycleId:remoteCycle.cycle_id||state.cycle?.cycleId,
        name:remoteCycle.name||state.cycle?.name||'Cycle LTS',
        start:String(remoteCycle.start_date||state.cycle?.start||'').slice(0,10),
        comment:remoteCycle.objective_summary||state.cycle?.comment||'',
        currentWeek:current?.number||state.cycle?.currentWeek||1,
        status:String(remoteCycle.status||'').toLowerCase()==='active'?'VALIDATED':state.cycle?.status||'DRAFT',
        isDemo:false
      }
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
        // A real local draft must never be overwritten by an automatic pull.
        if(weekHasUnpublishedLocalContent(localWeek))return;

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

      const executionBySessionId=new Map(options.executionOverlay||[]);
      (localWeek?.sessions||[]).forEach(p=>{
        if(!p.sessionId||!p.execution)return;
        const id=String(p.sessionId);
        const current=executionBySessionId.get(id);
        const currentUnsynced=current&&current.sync?.status!=='synced';
        const incomingUnsynced=p.execution.sync?.status!=='synced';
        if(!current||(incomingUnsynced&&!currentUnsynced)||executionTime(p.execution)>executionTime(current)){
          executionBySessionId.set(id,cloneExecution(p.execution))
        }
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
        })),
        localPublishConfirmedAt:null,
        localPublishConfirmedVersion:null,
        lastPublishedFingerprint:typeof weekPlanningFingerprint==='function'
          ? weekPlanningFingerprint(remoteWeek)
          : localWeek?.lastPublishedFingerprint||null
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
    const executionOverlay=collectExecutionOverlay();
    try{
      const r=await request('snapshot');
      window.__LTS_SUPPRESS_LOCAL_CHANGE__=true;
      try{
        mapSnapshotToLocal(r.snapshot);
        await hydratePlanConflictBaselines();
        replaceCoachPublishedWeeksFromRemote({force:options.forceRemote===true,executionOverlay});
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
      const localCheckinRecords=(state.records?.checkins||[]).filter(r=>!r._remote);
      const localMeasurementRecords=(state.records?.measurements||[]).filter(r=>!r._remote);
      checkins=localCheckinRecords.map(r=>({...r,athlete_id:cfg().athleteId}));
      measurements=localMeasurementRecords.flatMap(r=>{
        const mapping={weight:'weight_kg',waist:'waist_cm',chest:'chest_cm',hips:'hips_cm',armRelaxed:'arm_relaxed_cm',armContracted:'arm_contract_cm',thigh:'thigh_cm',calf:'calf_cm'};
        return Object.entries(mapping).filter(([k])=>r[k]!==null&&r[k]!==undefined&&r[k]!=='').map(([k,type])=>({
          body_measurement_id:`bm-${r.date?.slice(0,10)}-${type}`,athlete_id:cfg().athleteId,measured_at:r.date,measurement_type:type,body_side:'none',value:r[k],unit:type==='weight_kg'?'kg':'cm',protocol_code:'PWA',source_type:'athlete',data_quality:'measured',notes:r.source||''
        }))
      });
      for(const record of checkins)await request('checkins.upsert',{method:'POST',payload:{record}});
      if(measurements.length)await request('measurements.append',{method:'POST',payload:{records:measurements}});
      localCheckinRecords.forEach(record=>record._remote=true);
      localMeasurementRecords.forEach(record=>record._remote=true);
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
    const sets=buildSetRows(session,found.week);
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

  function weekHasUnpublishedLocalContent(week){
    if(!week)return false;
    if(week.status==='DRAFT')return true;

    if(week.lastPublishedFingerprint&&typeof weekPlanningFingerprint==='function'){
      try{
        return weekPlanningFingerprint(week)!==week.lastPublishedFingerprint
      }catch(error){
        console.warn('Empreinte locale indisponible',error)
      }
    }

    return false
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
    if(typeof migrateAthleteExecutionCanonicalV0575==='function'){
      migrateAthleteExecutionCanonicalV0575()
    }
    const sessions=(state.weeks||[]).flatMap(w=>w.sessions||[]);
    for(const session of sessions){
      if(!session.execution)continue;
      if(session.execution.sync?.status==='synced')continue;
      await syncSessionExecution(session.sessionId)
    }
  }

  window.synchronizeEverything=async function(){
    if(migrationLocked()){
      if(typeof toast==='function')toast('Migration du schéma verrouillée');
      return
    }
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

      if(typeof migrateAthleteExecutionCanonicalV0575==='function'){
        migrateAthleteExecutionCanonicalV0575()
      }

      updateGlobalSyncProgress(1,'Sécurisation des performances locales…');
      await syncUnsyncedExecutions();

      const hasLocalPlanEditsBeforePull=(state.weeks||[]).some(weekHasUnpublishedLocalContent);

      updateGlobalSyncProgress(1,'Lecture de Google Sheets…');
      await syncSheetsSnapshot({
        silent:true,
        forceRemote:!hasLocalPlanEditsBeforePull
      });

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
      const hasLocalPlanEditsAfterPush=(state.weeks||[]).some(weekHasUnpublishedLocalContent);
      await syncSheetsSnapshot({
        silent:true,
        forceRemote:!hasLocalPlanEditsAfterPush
      });
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


  const STIMULUS_CATALOG_V02={
    FINGER_MAX:{qualityId:'q_finger_max',magnitude:5,local:5,systemic:3,tmr:5,recoveryH:48},
    FINGER_END:{qualityId:'q_finger_end',magnitude:4,local:5,systemic:3,tmr:4,recoveryH:36},
    FINGER_POWER:{qualityId:'q_finger_power',magnitude:5,local:5,systemic:3,tmr:5,recoveryH:48},
    UPPER_MAX:{qualityId:'q_upper_max',magnitude:5,local:4,systemic:4,tmr:5,recoveryH:48},
    UPPER_END:{qualityId:'q_upper_end',magnitude:4,local:4,systemic:4,tmr:4,recoveryH:36},
    UPPER_POWER:{qualityId:'q_upper_power',magnitude:5,local:4,systemic:4,tmr:5,recoveryH:48},
    LOWER_MAX:{qualityId:'q_lower_max',magnitude:5,local:4,systemic:4,tmr:5,recoveryH:48},
    LOWER_END:{qualityId:'q_lower_end',magnitude:4,local:4,systemic:4,tmr:4,recoveryH:36},
    LOWER_POWER:{qualityId:'q_lower_power',magnitude:5,local:4,systemic:4,tmr:5,recoveryH:48},
    BLOC_MAX:{qualityId:'q_upper_power',magnitude:5,local:4,systemic:4,tmr:5,recoveryH:48},
    CLIMB_VOLUME:{qualityId:'q_technique',magnitude:3,local:3,systemic:3,tmr:3,recoveryH:24},
    CLIMB_TECHNIQUE:{qualityId:'q_technique',magnitude:2,local:2,systemic:2,tmr:2,recoveryH:12},
    CLIMB_COORDINATION:{qualityId:'q_full_coord',magnitude:3,local:3,systemic:3,tmr:3,recoveryH:24},
    CLIMB_ANAEROBIC:{qualityId:'q_anaerobic',magnitude:5,local:4,systemic:5,tmr:5,recoveryH:48},
    CORE:{qualityId:'q_core',magnitude:3,local:3,systemic:2,tmr:3,recoveryH:24},
    MOBILITY:{qualityId:'q_mobility',magnitude:1,local:1,systemic:1,tmr:1,recoveryH:6},
    FLEXIBILITY:{qualityId:'q_mobility',magnitude:2,local:2,systemic:1,tmr:2,recoveryH:12},
    PREVENTION:{qualityId:'q_prevention',magnitude:2,local:2,systemic:1,tmr:2,recoveryH:12},
    RUN_EASY:{qualityId:'q_aerobic_end',magnitude:2,local:2,systemic:2,tmr:2,recoveryH:12},
    RUN_LONG:{qualityId:'q_aerobic_end',magnitude:3,local:3,systemic:4,tmr:4,recoveryH:36},
    RUN_THRESHOLD:{qualityId:'q_aerobic_threshold',magnitude:4,local:3,systemic:4,tmr:4,recoveryH:36},
    RUN_INTERVAL:{qualityId:'q_aerobic_power',magnitude:5,local:4,systemic:5,tmr:5,recoveryH:48},
    RUN_TEST:{qualityId:'q_aerobic_power',magnitude:5,local:4,systemic:5,tmr:5,recoveryH:48}
  };

  function stimulusCodeFor(session){
    if(session?.stimulusTarget?.stimulus_code)return String(session.stimulusTarget.stimulus_code);
    const id=String(session?.templateId||'').toLowerCase();
    const map={
      maxhang:'FINGER_MAX',repeaters:'FINGER_END',fingerpower:'FINGER_POWER',
      pullstrength:'UPPER_MAX',dipstrength:'UPPER_MAX',
      pullend:'UPPER_END',dipend:'UPPER_END',
      pullpower:'UPPER_POWER',pushpower:'UPPER_POWER',
      climbmax:'BLOC_MAX',kilterintense:'BLOC_MAX',
      climbfun:'CLIMB_VOLUME',kiltervolume:'CLIMB_VOLUME',
      climbtech:'CLIMB_TECHNIQUE',kiltertech:'CLIMB_TECHNIQUE',precision:'CLIMB_TECHNIQUE',
      coordination:'CLIMB_COORDINATION',
      core:'CORE',corearc:'CORE',
      mobility:'MOBILITY',mob:'MOBILITY',
      flexibility:'FLEXIBILITY',flex:'FLEXIBILITY',
      prevshoulder:'PREVENTION',prevfinger:'PREVENTION',prevwrist:'PREVENTION',
      prevelbow:'PREVENTION',prevlower:'PREVENTION',prevtrunk:'PREVENTION',prev:'PREVENTION',
      runef:'RUN_EASY',run:'RUN_EASY',
      runtempo:'RUN_THRESHOLD',
      run4x4:'RUN_INTERVAL',runshort:'RUN_INTERVAL',runhills:'RUN_INTERVAL',
      runsprint:'RUN_TEST',speedtech:'RUN_TEST'
    };
    return map[id]||'PREVENTION'
  }

  function sessionTemplateIdFor(session){
    const code=stimulusCodeFor(session);
    const map={
      FINGER_MAX:'st_fmax',FINGER_END:'st_fend',FINGER_POWER:'st_upper_power',
      UPPER_MAX:'st_strength',UPPER_END:'st_end',UPPER_POWER:'st_upper_power',
      LOWER_MAX:'st_lower_max',LOWER_END:'st_lower_max',LOWER_POWER:'st_lower_power',
      BLOC_MAX:'st_bloc',CLIMB_VOLUME:'st_climb_volume',CLIMB_TECHNIQUE:'st_climb_tech',
      CLIMB_COORDINATION:'st_climb_coord',CLIMB_ANAEROBIC:'st_climb_ana',
      CORE:'st_core',MOBILITY:'st_mobility',FLEXIBILITY:'st_flex',PREVENTION:'st_prevention',
      RUN_EASY:'st_run',RUN_LONG:'st_run_long',RUN_THRESHOLD:'st_run_threshold',
      RUN_INTERVAL:'st_run_interval',RUN_TEST:'st_run_interval'
    };
    return map[code]||'st_multi'
  }

  function exerciseCatalogIdFor(session,index=0){
    const id=String(session?.templateId||'').toLowerCase();
    const templateMap={
      maxhang:'ex_hang5',repeaters:'ex_hang73',fingerpower:'ex_finger_power',
      pullstrength:'ex_pull_w',dipstrength:'ex_dip_w',
      pullend:'ex_pull_bw',dipend:'ex_dip_bw',
      pullpower:'ex_pull_power',pushpower:'ex_dip_power',
      climbmax:'ex_climb_general',kilterintense:'ex_kilter',
      climbfun:'ex_climb_general',kiltervolume:'ex_kilter',
      climbtech:'ex_climb_general',kiltertech:'ex_kilter',precision:'ex_climb_general',
      coordination:'ex_climb_coord',
      core:'ex_core_circuit',corearc:'ex_core_circuit',
      mobility:'ex_mobility',mob:'ex_mobility',
      flexibility:'ex_flexibility',flex:'ex_flexibility',
      runef:'ex_run',run:'ex_run',runtempo:'ex_run_threshold',
      run4x4:'ex_run_interval',runshort:'ex_run_interval',runhills:'ex_run_interval',
      runsprint:'ex_run_interval',speedtech:'ex_run_interval'
    };
    const exerciseName=String(session?.exercises?.[index]?.name||'').toLowerCase();
    if(exerciseName.includes('rotation externe'))return 'ex_external_rotation';
    if(exerciseName.includes('face pull'))return 'ex_face_pull';
    if(exerciseName.includes('scapular'))return 'ex_scap_pull';
    return templateMap[id]||'ex_generic'
  }

  function remoteVersionForWeek(week){
    return Number(week?.publicationVersion||week?.remoteVersion||1)||1
  }
  function resolvedPlannedSessionId(session,week){
    return session.remotePlannedSessionId||
      (session.containerId?planVersionId(session.containerId,remoteVersionForWeek(week)):'')
  }
  function resolvedBlockId(session,week){
    return session.remoteBlockId||
      (session.sessionId?planVersionId(session.sessionId,remoteVersionForWeek(week)):'')
  }
  function resolvedExercisePrescriptionId(session,week,index=0){
    const ids=session.remoteExercisePrescriptionIds||[];
    if(ids[index])return ids[index];
    const blockId=resolvedBlockId(session,week);
    const exerciseCount=Array.isArray(session.exercises)&&session.exercises.length?session.exercises.length:1;
    return exerciseCount>1?`${blockId}-ex${index+1}`:blockId
  }

  function buildExecutionRecord(session,week){
    const e=session.execution||{};
    const completedAt=e.completedAt||isoNow();
    return {
      session_execution_id:executionId(session.sessionId),
      athlete_id:cfg().athleteId,
      planned_session_id:resolvedPlannedSessionId(session,week),
      session_block_id:resolvedBlockId(session,week),
      execution_scope:'PRESCRIPTION',
      started_at:e.startedAt||completedAt,
      ended_at:completedAt,
      status:e.completed?'completed':'in_progress',
      rpe_session:num(e.rpe),
      enjoyment:num(e.enjoyment),
      pain_during:num(e.pain),
      completion_pct:e.completed?100:Math.round(((e.sets||[]).filter(x=>x.completed).length/Math.max(1,(e.sets||[]).length))*100),
      deviation_summary:'',
      athlete_comment:e.note||'',
      coach_comment:session.coachComment||session.progressionRule||'',
      data_quality:'athlete_entered',
      duration_minutes:num(e.duration)||num(session.duration),
      session_load_au:(num(e.duration)||num(session.duration))&&num(e.rpe)?(num(e.duration)||num(session.duration))*num(e.rpe):null
    }
  }

  function buildSetRows(session,week){
    const e=session.execution||{}, bodyweight=num(state.athlete?.weight)||null;
    const schema=typeof guideSchemaFor==='function'?guideSchemaFor(session):null;
    const totalSupported=load=>{
      const added=num(load);
      if(bodyweight===null)return added;
      return bodyweight+(added||0)
    };
    if(e.type==='SETS'){
      return (e.sets||[]).map((x,i)=>{
        const timed=schema?.type==='TIMED_SETS';
        const repeaters=schema?.type==='REPEATERS';
        const reps=timed?1:num(x.reps);
        const duration=timed?num(x.reps):null;
        const supported=totalSupported(x.load);
        return {
          set_result_id:`set-${session.sessionId}-${i+1}`,
          session_execution_id:executionId(session.sessionId),
          exercise_prescription_id:resolvedExercisePrescriptionId(session,week,0),
          exercise_catalog_id:session.remoteExerciseCatalogIds?.[0]||exerciseCatalogIdFor(session,0),
          set_no:i+1,
          side:'both',
          reps_completed:repeaters?num(x.reps):reps,
          duration_s:duration,
          load_added_kg:num(x.load),
          assistance_kg:0,
          bodyweight_kg_context:bodyweight,
          rpe:null,
          rir:num(x.rir),
          valid:!!x.completed,
          notes:x.completed?'':'Série non validée',
          supported_load_kg:supported,
          volume_load_kg:supported!==null&&reps!==null?supported*reps:null
        }
      })
    }
    if(e.type==='EXERCISES'){
      const rows=[];
      (e.exercises||[]).forEach((x,i)=>{
        const sets=Math.max(1,num(x.sets)||1);
        const reps=num(x.reps);
        const added=num(x.load);
        // Pour les exercices génériques (mobilité, prévention, gainage, jambes),
        // la charge supportée totale est ambiguë : on conserve uniquement la charge externe.
        const supported=added;
        for(let n=1;n<=sets;n++)rows.push({
          set_result_id:`set-${session.sessionId}-${i+1}-${n}`,
          session_execution_id:executionId(session.sessionId),
          exercise_prescription_id:resolvedExercisePrescriptionId(session,week,i),
          exercise_catalog_id:session.remoteExerciseCatalogIds?.[i]||exerciseCatalogIdFor(session,i),
          set_no:n,
          side:'both',
          reps_completed:reps,
          duration_s:num(x.hold),
          load_added_kg:added,
          assistance_kg:0,
          bodyweight_kg_context:bodyweight,
          rpe:num(x.quality),
          valid:true,
          notes:'',
          supported_load_kg:supported,
          volume_load_kg:supported!==null&&reps!==null?supported*reps:null
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
    const allowed=['4a','4a+','4b','4b+','4c','4c+','5a','5a+','5b','5b+','5c','5c+','6a','6a+','6b','6b+','6c','6c+','7a','7a+','7b','7b+','7c','7c+','8a','8a+','8b','8b+','8c'];
    const raw=String(value||'').trim().toLowerCase().replace(/\s+/g,'');
    if(allowed.includes(raw))return raw;

    // A range such as 5C-6A is stored using its upper bound.
    const parts=raw.split(/[-–—]/).filter(Boolean);
    for(let i=parts.length-1;i>=0;i--){
      if(allowed.includes(parts[i]))return parts[i]
    }

    const matches=raw.match(/[4-8][abc]\+?/g)||[];
    for(let i=matches.length-1;i>=0;i--){
      if(allowed.includes(matches[i]))return matches[i]
    }
    return ''
  }

  function buildClimbingRows(session){
    const e=session.execution||{};
    if(e.type!=='CLIMBING')return [];
    const angleMatch=String(session.climbing?.angle||'').match(/[\d.]+/);
    return (e.problems||[]).map((p,i)=>{
      const fontGrade=normalizeFontGrade(p.grade);
      const rawGrade=String(p.grade||'').trim();
      return {
        climbing_attempt_id:`climb-${session.sessionId}-${i+1}`,
        session_execution_id:executionId(session.sessionId),
        problem_external_id:p.name||`bloc-${i+1}`,
        problem_name:p.name||`Bloc ${i+1}`,
        grading_system:fontGrade?'FONT':'INTERNAL',
        grade_code:fontGrade||rawGrade,
        wall_angle_deg:angleMatch?Number(angleMatch[0]):null,
        attempt_no:p.attempts||1,
        result_status:p.flash?'FLASH':p.success?'AFTER_WORK':'NOT_DONE',
        attempts_to_send:p.success?(p.attempts||1):null,
        perceived_difficulty:num(e.quality),
        notes:p.comment||'',
        validation_status:'athlete_entered'
      }
    })
  }

  window.syncSessionExecution=async function(sessionId){
    const key=String(sessionId);
    if(executionSyncInFlight.has(key))return executionSyncInFlight.get(key);

    const task=(async()=>{
      if(typeof migrateAthleteExecutionCanonicalV0575==='function'){
        migrateAthleteExecutionCanonicalV0575()
      }
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
            const conflict=addConflict({
              conflictId:conflictId('execution',sessionId),
              entityType:'execution',
              entityId:sessionId,
              label:session.title||sessionId,
              message:'Cette séance a été modifiée sur un autre appareil.'
            });
            e.sync={
              status:'error',
              message:'Conflit multi-appareils',
              updatedAt:isoNow(),
              conflictId:conflict.conflictId
            };
            refreshExecutionViews();
            if(typeof toast==='function')toast('Conflit détecté');
            return
          }
        }

        for(const step of payloads){
          await request(step.action,{method:'POST',payload:step.payload})
        }

        removeQueueItem(queueId('execution',sessionId));
        const freshMeta=await fetchSyncMeta('execution',{entity_id:executionId(sessionId)});
        e.sync={
          status:'synced',
          message:'Synchronisée avec Google Sheets',
          updatedAt:isoNow(),
          remoteFingerprint:freshMeta.fingerprint||null
        };
        if(typeof logAudit==='function'){
          logAudit('SYNC_EXECUTION','SESSION',sessionId,session.title||'')
        }
        saveCfg({
          connected:true,
          lastSync:isoNow(),
          lastMessage:`Séance synchronisée · ${session.title||sessionId}`
        });
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
        e.sync={
          status:'error',
          message:`En attente de synchronisation · ${error.message||'Erreur réseau'}`,
          updatedAt:isoNow(),
          queueId:queued.queueId
        };
        saveCfg({
          connected:false,
          lastMessage:`Séance mise en attente · ${error.message||'Erreur réseau'}`
        });
        refreshExecutionViews();
        if(typeof toast==='function'){
          toast('Séance conservée localement et mise en attente')
        }
      }
    })();

    executionSyncInFlight.set(key,task);
    try{
      return await task
    }finally{
      executionSyncInFlight.delete(key)
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
    const targets=[];

    const orderedContainers=typeof orderedSessionContainers==='function'
      ?orderedSessionContainers(week)
      :[...(week.containers||[])];

    orderedContainers.forEach((container,containerIndex)=>{
      const remoteSessionId=planVersionId(container.containerId,version);
      const sessionDate=addDaysIso(weekStart,({Lun:0,Mar:1,Mer:2,Jeu:3,Ven:4,Sam:5,Dim:6}[container.day]??0));
      const containerPrescs=typeof orderedContainerPrescriptions==='function'
        ?orderedContainerPrescriptions(week,container)
        :(week.sessions||[]).filter(p=>p.containerId===container.containerId);
      sessions.push({
        planned_session_id:remoteSessionId,
        training_week_id:remoteWeekId,
        athlete_id:cfg().athleteId,
        session_template_id:'st_multi',
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
        const stimulusCode=stimulusCodeFor(p);
        const stimulus=STIMULUS_CATALOG_V02[stimulusCode]||STIMULUS_CATALOG_V02.PREVENTION;
        blocks.push({
          session_block_id:blockId,
          planned_session_id:remoteSessionId,
          session_template_id:sessionTemplateIdFor(p),
          block_order:pIndex+1,
          block_type:'prescription',
          name:p.title||'Prescription',
          duration_target_min:Number(p.duration)||0,
          objective_text:[p.guide,stimulus.qualityId].filter(Boolean).join(' · '),
          completion_rule:'Athlète valide la prescription',
          notes:safeJson({...p,execution:null,stimulusCode,remoteVersion:version,remoteWeekId})
        });

        const structured=Array.isArray(p.structuredSets)?p.structuredSets:[];
        const exerciseItems=Array.isArray(p.exercises)&&p.exercises.length?p.exercises:[null];
        exerciseItems.forEach((exercise,exerciseIndex)=>{
          const first=structured[exerciseIndex]||structured[0]||{};
          const exercisePrescriptionId=exerciseItems.length>1?`${blockId}-ex${exerciseIndex+1}`:blockId;
          prescriptions.push({
            exercise_prescription_id:exercisePrescriptionId,
            session_block_id:blockId,
            exercise_catalog_id:exerciseCatalogIdFor(p,exerciseIndex),
            exercise_order:exerciseIndex+1,
            sets_target:Number(exercise?.sets)||structured.length||Number(p.sets)||1,
            reps_target_min:Number(exercise?.reps)||Number(first.reps)||Number(p.reps)||'',
            reps_target_max:Number(exercise?.reps)||Number(first.reps)||Number(p.reps)||'',
            duration_target_s:Number(exercise?.hold)||Number(first.work)||Number(p.workSeconds)||'',
            distance_target_m:'',
            load_target_value:Number(first.load)||Number(p.load)||'',
            load_target_unit:first.loadMode||'',
            rir_target:first.rir!==''&&first.rir!==undefined?Number(first.rir):(p.rir??''),
            rpe_target:p.rpe??'',
            rest_seconds:Number(exercise?.rest)||Number(first.rest)||Number(p.restSeconds)||'',
            tempo_code:'',
            progression_rule_text:'',
            optional:false,
            coach_notes:safeJson({notes:p.notes||'',exercise:exercise||null,structuredSets:p.structuredSets||[],climbing:p.climbing||null})
          })
        });

        targets.push({
          session_target_id:`target-${blockId}`,
          planned_session_id:remoteSessionId,
          quality_id:stimulus.qualityId,
          stimulus_code:stimulusCode,
          target_role:pIndex===0?'primary':'secondary',
          magnitude_target:stimulus.magnitude,
          local_load_target:stimulus.local,
          systemic_load_target:stimulus.systemic,
          tmr_target:stimulus.tmr,
          recovery_target_h:stimulus.recoveryH,
          source_rule_version:'STIM-0.2',
          coach_override:false,
          override_reason:'',
          session_block_id:blockId,
          target_scope:'PRESCRIPTION'
        });
      });
    });

    return {cycle,week:remoteWeek,sessions,blocks,prescriptions,targets};
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
      if(!payload.targets?.length)throw new Error('Aucune cible de stimulus à publier');
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


  function sheetNumber(value){
    if(value===null||value===undefined||value==='')return null;
    const number=Number(value);
    return Number.isFinite(number)?number:null
  }

  function executionFromSnapshot(snapshot,sessionId,prescription){
    const executionIdValue=`exec-${sessionId}`;
    const remoteBlockId=prescription?.remoteBlockId||'';
    const rows=(snapshot?.executions||[])
      .filter(row=>
        String(row.session_execution_id)===executionIdValue||
        (remoteBlockId&&String(row.session_block_id)===String(remoteBlockId))||
        String(row.planned_session_id)===String(sessionId)
      )
      .sort((a,b)=>new Date(b.ended_at||b.started_at||0)-new Date(a.ended_at||a.started_at||0));
    const row=rows[0];
    if(!row)return null;

    const completed=String(row.status||'').toLowerCase()==='completed'||Number(row.completion_pct||0)>=100;
    const base={
      type:'GENERIC',
      duration:sheetNumber(row.duration_minutes)||sheetNumber(prescription?.duration)||0,
      rpe:sheetNumber(row.rpe_session),
      enjoyment:sheetNumber(row.enjoyment),
      pain:sheetNumber(row.pain_during)||0,
      note:row.athlete_comment||'',
      completed,
      startedAt:row.started_at||null,
      completedAt:row.ended_at||row.started_at||null,
      sync:{
        status:'synced',
        message:'Chargée depuis Google Sheets',
        updatedAt:row.ended_at||row.started_at||new Date().toISOString()
      }
    };

    const running=(snapshot?.running_results||[])
      .find(result=>String(result.session_execution_id)===String(row.session_execution_id));
    if(running){
      const seconds=sheetNumber(running.time_seconds);
      const distanceM=sheetNumber(running.distance_m);
      return {
        ...base,
        type:'RUN',
        duration:seconds!==null?seconds/60:base.duration,
        distance:distanceM!==null?distanceM/1000:0,
        speed:sheetNumber(running.speed_kmh),
        paceMinutes:sheetNumber(running.pace_seconds_per_km)!==null
          ?sheetNumber(running.pace_seconds_per_km)/60
          :null,
        hr:sheetNumber(running.average_hr_bpm),
        note:running.notes||base.note
      }
    }

    const climbing=(snapshot?.climbing_attempts||[])
      .filter(result=>String(result.session_execution_id)===String(row.session_execution_id));
    if(climbing.length){
      return {
        ...base,
        type:'CLIMBING',
        problems:climbing.map((result,index)=>({
          name:result.problem_name||`Bloc ${index+1}`,
          grade:result.grade_code||'',
          flash:String(result.result_status||'').toUpperCase()==='FLASH',
          success:['FLASH','AFTER_WORK'].includes(String(result.result_status||'').toUpperCase()),
          attempts:sheetNumber(result.attempts_to_send)||sheetNumber(result.attempt_no)||1,
          comment:result.notes||''
        })),
        quality:sheetNumber(climbing[0]?.perceived_difficulty)
      }
    }

    const setRows=(snapshot?.set_results||[])
      .filter(result=>String(result.session_execution_id)===String(row.session_execution_id))
      .sort((a,b)=>Number(a.set_no||0)-Number(b.set_no||0));

    if(setRows.length){
      const schema=typeof guideSchemaFor==='function'?guideSchemaFor(prescription):null;
      if(schema?.type==='EXERCISES'){
        const groups=new Map();
        setRows.forEach(result=>{
          const key=String(result.exercise_prescription_id||result.exercise_catalog_id||'exercise');
          if(!groups.has(key))groups.set(key,[]);
          groups.get(key).push(result)
        });
        return {
          ...base,
          type:'EXERCISES',
          exercises:[...groups.values()].map(group=>({
            sets:group.length,
            reps:sheetNumber(group[0]?.reps_completed)??'',
            hold:sheetNumber(group[0]?.duration_s)??'',
            load:sheetNumber(group[0]?.load_added_kg)??'',
            quality:sheetNumber(group[0]?.rpe)??''
          }))
        }
      }

      const timed=schema?.type==='TIMED_SETS';
      return {
        ...base,
        type:'SETS',
        sets:setRows.map(result=>({
          load:sheetNumber(result.load_added_kg)??'',
          reps:timed?(sheetNumber(result.duration_s)??''):(sheetNumber(result.reps_completed)??''),
          rir:sheetNumber(result.rir)??'',
          completed:result.valid===true||String(result.valid).toLowerCase()==='true'
        }))
      }
    }

    return base
  }

  function remoteText(value){
    if(value===null||value===undefined)return '';
    if(typeof value==='string'){
      const trimmed=value.trim();
      if(!trimmed)return '';
      const parsed=parseJson(trimmed,null);
      if(parsed&&typeof parsed==='object'){
        if(typeof parsed.notes==='string')return parsed.notes;
        if(typeof parsed.comment==='string')return parsed.comment;
      }
      return trimmed
    }
    if(typeof value==='object'){
      if(typeof value.notes==='string')return value.notes;
      if(typeof value.comment==='string')return value.comment;
      try{return JSON.stringify(value)}catch(error){return ''}
    }
    return String(value)
  }

  function remoteDayFromDate(value){
    const date=value?new Date(`${String(value).slice(0,10)}T12:00:00`):null;
    if(!date||Number.isNaN(date.getTime()))return 'Lun';
    return ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'][date.getDay()]||'Lun'
  }

  function remoteSlotFromTime(value){
    const raw=String(value||'').trim();
    const matches=[...raw.matchAll(/(?:^|T|\s)(\d{1,2}):(\d{2})(?::\d{2})?/g)];
    const match=matches.length?matches[matches.length-1]:raw.match(/(\d{1,2}):(\d{2})/);
    if(!match)return 'midi';
    const hour=Number(match[1]);
    if(hour<11)return 'matin';
    if(hour<18)return 'midi';
    return 'soir'
  }

  function remoteSlotForSession(session,meta={}){
    const explicit=String(meta.slot||'').trim().toLowerCase();
    if(['matin','midi','soir'].includes(explicit))return explicit;
    const id=String(session?.planned_session_id||'').trim().toLowerCase();
    const idMatch=id.match(/(?:^|[-_])(matin|midi|soir)(?:-v\d+)?$/);
    if(idMatch)return idMatch[1];
    return remoteSlotFromTime(session?.planned_start_time)
  }

  function remoteExerciseReferenceMap(snapshot){
    const map=new Map();
    (snapshot?.reference_exercises||[]).forEach(row=>{
      const id=row.exercise_catalog_id||row.exercise_id||row.id;
      if(id)map.set(String(id),row)
    });
    return map
  }

  function remoteExerciseName(row,referenceMap){
    const id=String(row.exercise_catalog_id||'');
    const ref=referenceMap.get(id)||{};
    return ref.exercise_name||ref.name||ref.label||ref.display_name||ref.exercise_code||id||'Exercice'
  }

  function remoteExerciseCategory(row,referenceMap,fallback='Exercice'){
    const ref=referenceMap.get(String(row.exercise_catalog_id||''))||{};
    return ref.category||ref.exercise_category||ref.family||ref.discipline||fallback
  }

  function remoteCoachNotes(row){
    const parsed=parseJson(row?.coach_notes,null);
    if(parsed&&typeof parsed==='object'){
      const parts=[];
      if(parsed.notes)parts.push(remoteText(parsed.notes));
      if(parsed.exercise?.name)parts.push(remoteText(parsed.exercise.name));
      return parts.filter(Boolean).join(' · ')
    }
    return remoteText(row?.coach_notes)
  }

  const REMOTE_STIMULUS_DOMAIN_MAP={
    FINGER_MAX:['B'],FINGER_END:['B'],FINGER_POWER:['B'],
    BLOC_MAX:['ESC','BM'],
    CLIMB_VOLUME:['ESC'],CLIMB_TECHNIQUE:['ESC','C'],CLIMB_COORDINATION:['ESC','C'],CLIMB_ANAEROBIC:['ESC'],
    CORE:['E'],MOBILITY:['MOB'],FLEXIBILITY:['SOUP'],PREVENTION:['PREV'],
    RUN_EASY:['D'],RUN_LONG:['D'],RUN_THRESHOLD:['D'],RUN_INTERVAL:['D'],RUN_TEST:['D'],
    LOWER_MAX:['LOWER'],LOWER_END:['LOWER'],LOWER_POWER:['LOWER']
  };

  function remoteDomainsForPrescription(targetRow,templateId,title,exerciseRows){
    const code=String(targetRow?.stimulus_code||'').trim().toUpperCase();
    const quality=String(targetRow?.quality_id||'').trim().toLowerCase();
    const qualityMap={
      q_finger_max:['B'],q_finger_end:['B'],q_finger_power:['B'],
      q_core:['E'],q_mobility:['MOB'],q_prevention:['PREV'],
      q_aerobic_end:['D'],q_aerobic_threshold:['D'],q_aerobic_power:['D'],
      q_technique:['ESC'],q_full_coord:['ESC','C'],q_anaerobic:['ESC'],
      q_calisthenics:['CALI'],q_lower_max:['LOWER'],q_lower_end:['LOWER'],q_lower_power:['LOWER']
    };
    const domains=[...(REMOTE_STIMULUS_DOMAIN_MAP[code]||qualityMap[quality]||[])];
    if(/^UPPER_(MAX|END|POWER)$/.test(code)||quality.startsWith('q_upper_')){
      const text=[templateId,title,...(exerciseRows||[]).map(row=>row.exercise_catalog_id)].join(' ').toLowerCase();
      if(/pull|traction|tirage|ex_pull/.test(text))domains.push('A_PULL');
      if(/dip|push|poussée|poussee|ex_dip/.test(text))domains.push('A_PUSH')
    }
    if(String(templateId||'').toLowerCase()==='kilterintense')domains.push('B');
    const unique=[...new Set(domains.filter(Boolean))];
    return {domain:unique[0]||'',extraDomains:unique.slice(1)}
  }

  function remoteGuideForTemplate(templateId){
    const map={
      maxhang:'G01',pullstrength:'G02',dipstrength:'G03',pullend:'G08',dipend:'G09',
      corearc:'G10',mobility:'G11',flexibility:'G12',climbtech:'G13-G15 / G21',
      climbfun:'G21',climbmax:'G21',kiltervolume:'G21',runef:'G17',
      prevfinger:'G20',prevshoulder:'G20',lowerstrength:'G23',lowerpower:'G24'
    };
    return map[templateId]||''
  }

  function inferRemoteTemplateId(block,exerciseRows){
    const ids=exerciseRows.map(row=>String(row.exercise_catalog_id||'').toLowerCase());
    const template=String(block.session_template_id||'').toLowerCase();
    const text=[block.name,block.objective_text,block.notes,...exerciseRows.map(remoteCoachNotes)].join(' ').toLowerCase();
    if(ids.includes('ex_hang5'))return 'maxhang';
    if(ids.includes('ex_pull_w'))return 'pullstrength';
    if(ids.includes('ex_dip_w'))return 'dipstrength';
    if(ids.includes('ex_pull_bw'))return 'pullend';
    if(ids.includes('ex_dip_bw'))return 'dipend';
    if(ids.some(id=>id==='ex_run'||id.startsWith('ex_run_'))||template==='st_run')return 'runef';
    if(template==='st_bloc'||text.includes('bloc maximal'))return 'climbmax';
    if(template==='st_climb_tech'||template==='st_climb_coord')return 'climbtech';
    if(template==='st_climb_volume'||ids.includes('ex_climb_general')||ids.includes('ex_kilter')){
      if(text.includes('kilter'))return 'kiltervolume';
      if(text.includes('libre')||text.includes('fun'))return 'climbfun';
      return 'climbfun'
    }
    if(template==='st_flex'||ids.some(id=>id.startsWith('ex_flex')))return 'flexibility';
    if(template==='st_core')return 'corearc';
    if(template==='st_mobility')return 'mobility';
    if(template==='st_prevention'){
      return ids.some(id=>id.includes('finger')||id.includes('wrist'))?'prevfinger':'prevshoulder'
    }
    if(template==='st_lower_power')return 'lowerpower';
    if(template==='st_lower_max')return 'lowerstrength';
    return text.includes('prévention')?'prevshoulder':'generic'
  }

  function remoteExerciseObject(row,referenceMap,block){
    const reps=sheetNumber(row.reps_target_max)??sheetNumber(row.reps_target_min)??'';
    return {
      name:remoteExerciseName(row,referenceMap),
      category:remoteExerciseCategory(row,referenceMap,block.name||'Exercice'),
      sets:sheetNumber(row.sets_target)??1,
      reps,
      hold:sheetNumber(row.duration_target_s)??'',
      distance:sheetNumber(row.distance_target_m)??'',
      load:sheetNumber(row.load_target_value)??'',
      loadUnit:row.load_target_unit||'',
      rir:sheetNumber(row.rir_target)??'',
      rpe:sheetNumber(row.rpe_target)??'',
      rest:sheetNumber(row.rest_seconds)??'',
      tempo:row.tempo_code||'',
      progressionRule:remoteText(row.progression_rule_text),
      coachNotes:remoteCoachNotes(row),
      exerciseCatalogId:row.exercise_catalog_id||''
    }
  }

  function remoteWeightedPairs(text){
    const rows=[];
    const regex=/(\d+)\s*[×x]\s*\+?(-?\d+(?:[.,]\d+)?)\s*kg/gi;
    let match;
    while((match=regex.exec(String(text||'')))){
      rows.push({reps:Number(match[1]),load:Number(String(match[2]).replace(',','.'))})
    }
    return rows
  }

  function remoteStructuredSets(templateId,exerciseRows,notes){
    const row=exerciseRows[0]||{};
    const count=Math.max(1,sheetNumber(row.sets_target)||1);
    const rest=sheetNumber(row.rest_seconds)??180;
    const rir=sheetNumber(row.rir_target)??'';
    const work=sheetNumber(row.duration_target_s)??'';
    if(templateId==='maxhang'){
      let loads=[];
      if(count===8)loads=[0,4,8,12,12,12,12,12];
      else if(count===6)loads=[0,4,8,10,12,12];
      else{
        const singles=[...String(notes||'').matchAll(/\+(\d+(?:[.,]\d+)?)\s*kg/gi)].map(match=>Number(match[1].replace(',','.')));
        loads=[0,...singles];
        while(loads.length<count)loads.push(loads[loads.length-1]??sheetNumber(row.load_target_value)??0);
        loads=loads.slice(0,count)
      }
      return loads.map((load,index)=>({
        role:index<Math.min(3,count-1)?'MONTÉE '+(index+1):'SÉRIE DE TRAVAIL '+(index-Math.min(3,count-1)+1),
        loadMode:'kg lest/délestage',load,reps:1,work:work||5,rir,rest
      }))
    }
    if(templateId==='pullstrength'||templateId==='dipstrength'){
      const pairs=remoteWeightedPairs(notes);
      if(pairs.length<count){
        const maxMatch=String(notes||'').match(/s[ée]rie\s+max(?:imale)?[^+\d-]*\+?(-?\d+(?:[.,]\d+)?)\s*kg/i);
        if(maxMatch)pairs.push({reps:'Max',load:Number(maxMatch[1].replace(',','.'))})
      }
      if(pairs.length){
        return pairs.slice(0,count).map((pair,index)=>({
          role:index<4?'RAMP':index===4?'TOP SET':index<7?'BACK-OFF':'SÉRIE MAX',
          loadMode:'kg lest',load:pair.load,reps:pair.reps,work:'',rir:index===4?rir:'',rest
        }))
      }
    }
    if(templateId==='pullend'||templateId==='dipend'){
      const reps=sheetNumber(row.reps_target_max)??sheetNumber(row.reps_target_min)??'';
      return Array.from({length:count},(_,index)=>({
        role:'SÉRIE '+(index+1),loadMode:'PDC',load:0,reps,work:'',rir,rest
      }))
    }
    return null
  }

  function remoteClimbingConfig(templateId,block,exerciseRows){
    if(!['climbtech','climbfun','climbmax','kiltervolume'].includes(templateId))return null;
    const text=[block.name,block.objective_text,block.notes,...exerciseRows.map(remoteCoachNotes)].join(' ');
    const angleMatch=text.match(/(\d{1,2})\s*°/);
    const gradeMatch=text.match(/(Rouge\+|Rose-?|Noir-?|[4-8][abc]\+?)/i);
    const mode=templateId==='climbfun'?'FREE_FUN':templateId==='climbmax'?'BOULDER_MAX':templateId==='kiltervolume'?'KILTER_VOLUME':'CLIMB_TECH';
    return {
      mode,
      angle:angleMatch?`${angleMatch[1]}°`:null,
      problemCount:/un seul bloc/i.test(text)?1:0,
      attemptLimit:5,
      targetGrade:gradeMatch?gradeMatch[1]:'',
      technicalFocus:templateId==='climbtech'?(block.name||'Technique'):'',
      fingerStimulus:false
    }
  }

  function rebuildRemoteWeeks(snapshot){
    const remoteWeeks=snapshot?.weeks||[];
    const remoteSessions=snapshot?.sessions||[];
    const remoteBlocks=snapshot?.blocks||[];
    const remotePrescriptions=snapshot?.prescriptions||[];
    const remoteTargets=snapshot?.targets||[];
    const exerciseReferences=remoteExerciseReferenceMap(snapshot);
    if(!remoteWeeks.length)return [];

    const latestByNo=new Map();
    remoteWeeks.filter(w=>String(w.status).toLowerCase()==='published').forEach(w=>{
      const no=Number(w.week_no);
      const current=latestByNo.get(no);
      if(!current||Number(w.version_no||0)>Number(current.version_no||0))latestByNo.set(no,w)
    });

    return [...latestByNo.values()].sort((a,b)=>Number(a.week_no)-Number(b.week_no)).map(w=>{
      const sessionRows=remoteSessions
        .filter(s=>String(s.training_week_id)===String(w.training_week_id)&&String(s.status||'published').toLowerCase()==='published')
        .sort((a,b)=>String(a.session_date||'').localeCompare(String(b.session_date||''))||String(a.planned_start_time||'').localeCompare(String(b.planned_start_time||''))||Number(a.priority_order||0)-Number(b.priority_order||0));
      const containers=[];
      const prescriptions=[];
      sessionRows.forEach((s,sessionIndex)=>{
        const parsedMeta=parseJson(s.coach_instructions,null);
        const meta=parsedMeta&&typeof parsedMeta==='object'?parsedMeta:{};
        const plainInstructions=parsedMeta&&typeof parsedMeta==='object'?'':remoteText(s.coach_instructions);
        const blockRows=remoteBlocks
          .filter(b=>String(b.planned_session_id)===String(s.planned_session_id))
          .sort((a,b)=>Number(a.block_order)-Number(b.block_order));
        const containerId=meta.localContainerId||String(s.planned_session_id);
        const day=meta.day||remoteDayFromDate(s.session_date);
        const slot=remoteSlotForSession(s,meta);
        const fallbackTitle=blockRows.length===1?(blockRows[0].name||`Séance ${sessionIndex+1}`):`Séance du ${slot}`;
        containers.push({
          containerId,
          day,
          slot,
          sessionDate:String(s.session_date||'').slice(0,10),
          title:meta.title||fallbackTitle,
          comment:meta.comment||plainInstructions||'',
          status:'PLANNED',
          sessionOrder:Number(s.priority_order)||sessionIndex+1,
          structureType:'SESSION_CONTAINER',
          remotePlannedSessionId:s.planned_session_id
        });
        blockRows.forEach(b=>{
          const parsedBlockNotes=parseJson(b.notes,null);
          const p=parsedBlockNotes&&typeof parsedBlockNotes==='object'?parsedBlockNotes:{};
          const sessionId=p.sessionId||String(b.session_block_id).replace(/-v\d+$/,'');
          const exerciseRows=remotePrescriptions
            .filter(row=>String(row.session_block_id)===String(b.session_block_id))
            .sort((a,b)=>Number(a.exercise_order||0)-Number(b.exercise_order||0));
          const targetRow=remoteTargets.find(row=>String(row.session_block_id)===String(b.session_block_id))||null;
          const templateId=p.templateId||inferRemoteTemplateId(b,exerciseRows);
          const exerciseObjects=exerciseRows.map(row=>remoteExerciseObject(row,exerciseReferences,b));
          const progressionRule=[...new Set(exerciseObjects.map(x=>x.progressionRule).filter(Boolean))].join('\n');
          const coachRows=[...new Set(exerciseObjects.map(x=>x.coachNotes).filter(Boolean))];
          const plainBlockNotes=parsedBlockNotes&&typeof parsedBlockNotes==='object'?'':remoteText(b.notes);
          const notes=[p.notes,plainBlockNotes,...coachRows].filter(Boolean).join(' · ');
          const structuredSets=(Array.isArray(p.structuredSets)&&p.structuredSets.length)
            ?p.structuredSets
            :remoteStructuredSets(templateId,exerciseRows,notes);
          const climbing=p.climbing||remoteClimbingConfig(templateId,b,exerciseRows);
          const remoteDomains=remoteDomainsForPrescription(targetRow,templateId,p.title||b.name,exerciseRows);
          const prescription={
            ...p,
            domain:p.domain||remoteDomains.domain,
            extraDomains:[...new Set([...(p.extraDomains||[]),...remoteDomains.extraDomains])],
            sessionId,
            containerId,
            day,
            slot,
            sessionDate:String(s.session_date||'').slice(0,10),
            title:p.title||b.name||'Prescription',
            guide:p.guide||remoteGuideForTemplate(templateId),
            templateId,
            duration:Number(p.duration||b.duration_target_min)||0,
            prescriptionOrder:Number(b.block_order)||1,
            structureType:'PRESCRIPTION',
            execution:null,
            notes,
            coachComment:progressionRule||coachRows.join(' · ')||notes,
            progressionRule,
            structuredSets:structuredSets||undefined,
            exercises:(Array.isArray(p.exercises)&&p.exercises.length)?p.exercises:(structuredSets?undefined:exerciseObjects),
            climbing:climbing||undefined,
            rpe:sheetNumber(exerciseRows[0]?.rpe_target)??p.rpe??'',
            load:sheetNumber(exerciseRows[0]?.load_target_value)??p.load??'',
            remotePlannedSessionId:s.planned_session_id,
            remoteBlockId:b.session_block_id,
            remoteExercisePrescriptionIds:exerciseRows.map(row=>row.exercise_prescription_id),
            remoteExerciseCatalogIds:exerciseRows.map(row=>row.exercise_catalog_id),
            stimulusTarget:targetRow,
            remoteWeekId:w.training_week_id
          };
          prescription.execution=executionFromSnapshot(snapshot,sessionId,prescription);
          prescriptions.push(prescription)
        })
      });
      return {
        weekId:w.local_week_id||String(w.training_week_id).replace(/-v\d+$/,''),
        remoteTrainingWeekId:w.training_week_id,
        number:Number(w.week_no),
        startDate:String(w.start_date||'').slice(0,10),
        endDate:String(w.end_date||'').slice(0,10),
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
