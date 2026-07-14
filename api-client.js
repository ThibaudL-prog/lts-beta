
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
})();
