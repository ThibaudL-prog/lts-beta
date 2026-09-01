
const SCHEMA_VERSION = '0.5.8.1';
const API_RELEASE = '0.5.9.0-beta1.12';

function doGet(e) {
  return handleRequest_('GET', e && e.parameter ? e.parameter : {});
}

function doPost(e) {
  let payload = {};
  try {
    payload = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : '{}');
  } catch (error) {
    return json_({ok:false,error:'JSON invalide'});
  }
  return handleRequest_('POST', payload);
}

function handleRequest_(method, p) {
  const started = Date.now();
  const requestId = Utilities.getUuid();
  const action = String(p.action || 'health');
  try {
    if (action !== 'health' && action !== 'schema.audit') assertApiEnabled_();
    let result;
    if (action === 'health') result = health_();
    else if (action === 'schema.audit') result = schemaAudit_();
    else if (action === 'snapshot') result = snapshot_(String(p.athlete_id || getConfig_('default_athlete_id') || 'ath_lgrd_001'));
    else if (action === 'checkins.upsert') { assertWriteEnabled_(); result = upsertCheckin_(p.record || {}, String(p.athlete_id || '')); }
    else if (action === 'measurements.append') { assertWriteEnabled_(); result = appendMeasurements_(p.records || [], String(p.athlete_id || '')); }
    else if (action === 'execution.upsert') { assertWriteEnabled_(); result = upsertById_('SESSION_EXECUTIONS','session_execution_id',p.record || {}); }
    else if (action === 'sets.replace') { assertWriteEnabled_(); result = replaceChildren_('SET_RESULTS','session_execution_id',String(p.session_execution_id || ''),p.records || []); }
    else if (action === 'climbing.replace') { assertWriteEnabled_(); result = replaceChildren_('CLIMBING_ATTEMPTS','session_execution_id',String(p.session_execution_id || ''),p.records || []); }
    else if (action === 'running.upsert') { assertWriteEnabled_(); result = upsertById_('RUNNING_RESULTS','running_result_id',p.record || {}); }
    else if (action === 'tests.upsert') { assertWriteEnabled_(); result = upsertTests_(p.records || [], String(p.athlete_id || '')); }
    else if (action === 'tests.metrics.rebuild') { assertWriteEnabled_(); result = rebuildTestMetrics_(String(p.athlete_id || getConfig_('default_athlete_id') || 'ath_lgrd_001')); }
    else if (action === 'cycle.upsert') { assertWriteEnabled_(); result = upsertCycle_(p.record || {}, String(p.athlete_id || ''), false); }
    else if (action === 'cycle.activate') { assertWriteEnabled_(); result = upsertCycle_(p.record || {}, String(p.athlete_id || ''), true); }
    else if (action === 'sync.meta') { result = syncMeta_(p); }
    else if (action === 'plan.publish') { assertWriteEnabled_(); result = publishPlan_(p); }
    else throw new Error('Action inconnue : ' + action);
    writeLog_(requestId, method, action, p, 'OK', Date.now()-started, '');
    return json_(Object.assign({ok:true,request_id:requestId},result));
  } catch (error) {
    writeLog_(requestId, method, action, p, 'ERROR', Date.now()-started, String(error.message || error));
    return json_({ok:false,request_id:requestId,error:String(error.message || error)});
  }
}

function health_() {
  return {
    schema_version: getConfig_('schema_version') || SCHEMA_VERSION,
    spreadsheet_id: SpreadsheetApp.getActive().getId(),
    server_time: new Date().toISOString(),
    api_enabled: configBoolean_('api_enabled', false),
    write_enabled: configBoolean_('write_enabled', false),
    default_athlete_id: String(getConfig_('default_athlete_id') || 'ath_lgrd_001')
  };
}

function snapshot_(athleteId) {
  const athlete = first_(rows_('ATHLETES'), r => String(r.athlete_id) === athleteId) || null;
  const profile = first_(rows_('ATHLETE_PROFILES'), r => String(r.athlete_id) === athleteId) || null;
  const cycles = rows_('CYCLES').filter(r => String(r.athlete_id) === athleteId);
  const cycleIds = new Set(cycles.map(r => String(r.cycle_id)));
  const weeks = rows_('WEEKS').filter(r => String(r.athlete_id) === athleteId || cycleIds.has(String(r.cycle_id)));
  const weekIds = new Set(weeks.map(r => String(r.training_week_id)));
  const sessions = rows_('SESSIONS').filter(r => String(r.athlete_id) === athleteId || weekIds.has(String(r.training_week_id)));
  const sessionIds = new Set(sessions.map(r => String(r.planned_session_id)));
  const blocks = rows_('SESSION_BLOCKS').filter(r => sessionIds.has(String(r.planned_session_id)));
  const blockIds = new Set(blocks.map(r => String(r.session_block_id)));
  const prescriptions = rows_('EXERCISE_PRESCRIPTIONS').filter(r => blockIds.has(String(r.session_block_id)));
  const targets = rows_('SESSION_TARGETS').filter(r => sessionIds.has(String(r.planned_session_id)) || blockIds.has(String(r.session_block_id)));
  const executions = rows_('SESSION_EXECUTIONS').filter(r =>
    String(r.athlete_id) === athleteId ||
    sessionIds.has(String(r.planned_session_id)) ||
    blockIds.has(String(r.session_block_id))
  );
  const executionIds = new Set(executions.map(r => String(r.session_execution_id)));
  const setResults = rows_('SET_RESULTS').filter(r => executionIds.has(String(r.session_execution_id)));
  const climbing = rows_('CLIMBING_ATTEMPTS').filter(r => executionIds.has(String(r.session_execution_id)));
  const running = rows_('RUNNING_RESULTS').filter(r => executionIds.has(String(r.session_execution_id)));
  const checkins = rows_('CHECKINS').filter(r => String(r.athlete_id) === athleteId);
  const measurements = rows_('BODY_MEASUREMENTS').filter(r => String(r.athlete_id) === athleteId);
  const testResults = optionalRows_('TEST_RESULTS').filter(r => String(r.athlete_id) === athleteId);
  const testMetrics = optionalRows_('TEST_METRICS').filter(r => String(r.athlete_id) === athleteId);
  const referenceExercises = optionalRows_('REF_EXERCISES');
  const referenceTemplates = optionalRows_('REF_SESSION_TEMPLATES');
  const referenceQualities = optionalRows_('REF_QUALITIES');
  const referenceStimuli = optionalRows_('REF_STIMULI');

  return {
    snapshot:{
      athlete,profile,cycles,weeks,sessions,blocks,prescriptions,targets,executions,
      set_results:setResults,climbing_attempts:climbing,running_results:running,
      checkins,measurements,test_results:testResults,test_metrics:testMetrics,
      reference_exercises:referenceExercises,
      reference_session_templates:referenceTemplates,
      reference_qualities:referenceQualities,
      reference_stimuli:referenceStimuli
    },
    counts:{
      cycles:cycles.length,weeks:weeks.length,sessions:sessions.length,blocks:blocks.length,
      prescriptions:prescriptions.length,targets:targets.length,executions:executions.length,
      tests:testResults.length,test_metrics:testMetrics.length,reference_exercises:referenceExercises.length
    }
  };
}



function syncMeta_(payload) {
  const type = String(payload.entity_type || '');
  if (type === 'execution') {
    const id = String(payload.entity_id || '');
    const row = rows_('SESSION_EXECUTIONS').find(r => String(r.session_execution_id) === id);
    return row ? {found:true,entity_type:type,entity_id:id,updated_at:row.ended_at||row.started_at||'',fingerprint:fingerprintObject_(row)} : {found:false,entity_type:type,entity_id:id};
  }
  if (type === 'plan') {
    const athleteId=String(payload.athlete_id||''), weekNo=Number(payload.week_no||0);
    const cycleId=String(payload.cycle_id||'');
    const weeks=rows_('WEEKS').filter(r=>String(r.athlete_id)===athleteId&&Number(r.week_no)===weekNo&&(!cycleId||String(r.cycle_id)===cycleId)&&String(r.status).toLowerCase()==='published').sort((a,b)=>Number(b.version_no||0)-Number(a.version_no||0));
    if(!weeks.length)return {found:false,entity_type:type,athlete_id:athleteId,week_no:weekNo};
    const week=weeks[0];
    const sessions=rows_('SESSIONS').filter(r=>String(r.training_week_id)===String(week.training_week_id));
    const sessionIds=new Set(sessions.map(r=>String(r.planned_session_id)));
    const blocks=rows_('SESSION_BLOCKS').filter(r=>sessionIds.has(String(r.planned_session_id)));
    const blockIds=new Set(blocks.map(r=>String(r.session_block_id)));
    const prescriptions=rows_('EXERCISE_PRESCRIPTIONS').filter(r=>blockIds.has(String(r.session_block_id)));
    const targets=rows_('SESSION_TARGETS').filter(r=>sessionIds.has(String(r.planned_session_id))||blockIds.has(String(r.session_block_id)));
    return {found:true,entity_type:type,athlete_id:athleteId,week_no:weekNo,training_week_id:week.training_week_id,version_no:Number(week.version_no||0),updated_at:week.published_at||'',fingerprint:fingerprintObject_({week,sessions,blocks,prescriptions,targets})};
  }
  throw new Error('Type sync.meta inconnu : '+type);
}

function upsertCycle_(record, athleteId, activate) {
  const cycle = Object.assign({}, record || {});
  cycle.athlete_id = cycle.athlete_id || athleteId;
  if (!cycle.cycle_id) throw new Error('cycle_id obligatoire');
  if (!cycle.athlete_id) throw new Error('athlete_id obligatoire');
  if (!cycle.name) throw new Error('name obligatoire');
  if (!cycle.start_date) throw new Error('start_date obligatoire');

  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    if (activate) {
      rows_('CYCLES')
        .filter(row => String(row.athlete_id) === String(cycle.athlete_id) && String(row.cycle_id) !== String(cycle.cycle_id) && String(row.status).toLowerCase() === 'active')
        .forEach(row => upsertById_('CYCLES', 'cycle_id', Object.assign({}, row, {status:'completed'})));
      cycle.status = 'active';
      cycle.validated_at = cycle.validated_at || new Date().toISOString();
      cycle.validated_by = cycle.validated_by || 'coach';
    }
    upsertById_('CYCLES', 'cycle_id', cycle);
    return {cycle_id:cycle.cycle_id,status:cycle.status,activated:activate};
  } finally {
    lock.releaseLock();
  }
}

function upsertTests_(records, athleteId) {
  const clean = (records || []).map(record => {
    const row = Object.assign({}, record || {});
    row.athlete_id = row.athlete_id || athleteId;
    if (!row.test_result_id) throw new Error('test_result_id obligatoire');
    if (!row.athlete_id) throw new Error('athlete_id obligatoire');
    if (!row.test_code) throw new Error('test_code obligatoire');
    if (!row.performed_at) throw new Error('performed_at obligatoire');
    return row;
  });
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const context = testMetricContext_();
    const metricIds = [];
    clean.forEach(row => {
      upsertById_('TEST_RESULTS', 'test_result_id', row);
      const metric = buildTestMetric_(row, context);
      if (metric) {
        upsertById_('TEST_METRICS', 'test_metric_id', metric);
        metricIds.push(metric.test_metric_id);
      }
    });
    return {count:clean.length,test_result_ids:clean.map(row => row.test_result_id),metric_count:metricIds.length,test_metric_ids:metricIds};
  } finally {
    lock.releaseLock();
  }
}

function rebuildTestMetrics_(athleteId) {
  const rows = optionalRows_('TEST_RESULTS').filter(row => !athleteId || String(row.athlete_id) === String(athleteId));
  const context = testMetricContext_();
  const metricIds = [];
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    rows.forEach(row => {
      const metric = buildTestMetric_(row, context);
      if (!metric) return;
      upsertById_('TEST_METRICS', 'test_metric_id', metric);
      metricIds.push(metric.test_metric_id);
    });
    return {count:metricIds.length,test_metric_ids:metricIds,rebuilt_at:new Date().toISOString()};
  } finally {
    lock.releaseLock();
  }
}

function testMetricContext_() {
  return {
    tests: optionalRowsByHeaders_(['test_id','test_code','classifying_metric_code']),
    thresholds: optionalRowsByHeaders_(['threshold_id','test_code','metric_code','level_code','min_inclusive','max_exclusive'])
  };
}

function optionalRowsByHeaders_(requiredHeaders) {
  const sheets = SpreadsheetApp.getActive().getSheets();
  for (let i = 0; i < sheets.length; i++) {
    const data = sheets[i].getDataRange().getValues();
    if (!data.length) continue;
    const headers = data[0].map(String);
    if (!requiredHeaders.every(header => headers.indexOf(header) >= 0)) continue;
    return data.slice(1).filter(row => row.some(value => value !== '' && value !== null)).map(row => {
      const object = {};
      headers.forEach((header, index) => object[header] = serialize_(row[index]));
      return object;
    });
  }
  return [];
}

function metricNumber_(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return isFinite(number) ? number : null;
}

function metricBoolean_(value, defaultValue) {
  if (value === '' || value === null || value === undefined) return defaultValue;
  if (value === true || String(value).toLowerCase() === 'true') return true;
  if (value === false || String(value).toLowerCase() === 'false') return false;
  return defaultValue;
}

function testMetricId_(testResultId) {
  const id = String(testResultId || '');
  if (/^tr_/.test(id)) return 'tm_' + id.slice(3);
  if (/^tr-/.test(id)) return 'tm-' + id.slice(3);
  return 'tm-' + id;
}

function testMetricFallback_(testCode) {
  const map = {
    CLIMB_K40_AW:['grade_rank','rank'],
    FINGER_MAX_20_5:['supported_load_ratio','ratio'],
    FINGER_END_20_7_3:['repetitions_valid','rep'],
    FINGER_POWER_CAMPUS:['raw_value','level_rank'],
    PULLUP_1RM:['added_load_ratio','ratio'],
    DIP_1RM:['added_load_ratio','ratio'],
    PULLUP_MAX_REPS:['max_reps','rep'],
    DIP_MAX_REPS:['max_reps','rep'],
    POWER_SLAP:['power_height_cm','cm'],
    PLYO_PUSHUP:['power_height_cm','cm'],
    RUN_5K_AGE:['age_score','ratio'],
    MCGILL_SIDE:['side_plank_mean_s','s'],
    MCGILL_FLEX:['duration_seconds','s'],
    MCGILL_SORENSEN:['duration_seconds','s'],
    LOWER_CMJ:['jump_height_cm','cm'],
    LOWER_BROAD_JUMP:['distance_height_ratio','ratio']
  };
  return map[String(testCode || '').toUpperCase()] || ['raw_value',''];
}

function thresholdForMetric_(context, testCode, metricCode, metricValue, performedAt) {
  const day = String(performedAt || '').slice(0,10);
  return (context.thresholds || []).filter(row => {
    if (String(row.test_code || '').toUpperCase() !== testCode) return false;
    if (String(row.metric_code || '') !== metricCode) return false;
    if (!metricBoolean_(row.active, true)) return false;
    const validFrom = String(row.valid_from || '').slice(0,10);
    const validTo = String(row.valid_to || '').slice(0,10);
    if (day && validFrom && day < validFrom) return false;
    if (day && validTo && day > validTo) return false;
    const min = metricNumber_(row.min_inclusive);
    const max = metricNumber_(row.max_exclusive);
    return (min === null || metricValue >= min) && (max === null || metricValue < max);
  }).sort((a,b) => String(b.valid_from || '').localeCompare(String(a.valid_from || '')))[0] || null;
}

function buildTestMetric_(row, context) {
  const testCode = String(row.test_code || '').toUpperCase();
  if (!row.test_result_id || !testCode) return null;
  const bodyWeight = metricNumber_(row.body_weight_kg);
  const addedLoad = metricNumber_(row.added_load_kg);
  const assistance = metricNumber_(row.assistance_kg);
  const addedLoadRatio = bodyWeight > 0 ? (addedLoad || 0) / bodyWeight : null;
  const assistanceRatio = bodyWeight > 0 ? (assistance || 0) / bodyWeight : null;
  const supportedLoadKg = bodyWeight === null ? null : bodyWeight + (addedLoad || 0) - (assistance || 0);
  const supportedLoadRatio = bodyWeight > 0 ? supportedLoadKg / bodyWeight : null;
  const left = metricNumber_(row.left_seconds), right = metricNumber_(row.right_seconds);
  const sideMean = left !== null && right !== null ? (left + right) / 2 : null;
  const sideAsymmetry = left !== null && right !== null && Math.max(left,right) > 0 ? Math.abs(left-right) / Math.max(left,right) * 100 : null;
  const touch = metricNumber_(row.touch_height_cm), bar = metricNumber_(row.bar_height_cm);
  const powerHeight = metricNumber_(row.power_height_cm) !== null ? metricNumber_(row.power_height_cm) : (touch !== null && bar !== null ? touch - bar : null);
  const timeSeconds = metricNumber_(row.time_seconds), ageStandardSeconds = metricNumber_(row.age_standard_seconds);
  const derived = {
    raw_value:metricNumber_(row.raw_value),
    grade_rank:metricNumber_(row.grade_rank),
    repetitions_valid:metricNumber_(row.repetitions_valid),
    completed_tours:metricNumber_(row.completed_tours),
    max_reps:metricNumber_(row.repetitions_valid),
    added_load_ratio:addedLoadRatio,
    assistance_ratio:assistanceRatio,
    supported_load_kg:supportedLoadKg,
    supported_load_ratio:supportedLoadRatio,
    power_height_cm:powerHeight,
    side_plank_mean_s:sideMean,
    duration_seconds:metricNumber_(row.flexion_seconds) !== null ? metricNumber_(row.flexion_seconds) : (metricNumber_(row.sorensen_seconds) !== null ? metricNumber_(row.sorensen_seconds) : metricNumber_(row.duration_seconds)),
    age_score:timeSeconds > 0 && ageStandardSeconds !== null ? ageStandardSeconds / timeSeconds : null,
    jump_height_cm:metricNumber_(row.jump_height_cm),
    distance_height_ratio:metricNumber_(row.distance_height_ratio)
  };
  const reference = (context.tests || []).find(item => String(item.test_code || '').toUpperCase() === testCode) || {};
  const fallback = testMetricFallback_(testCode);
  // Le test Density mesure désormais des répétitions 7/3 continues, jamais des tours.
  const metricCode = testCode === 'FINGER_END_20_7_3' ? 'repetitions_valid' : String(reference.classifying_metric_code || fallback[0]);
  const metricUnit = testCode === 'FINGER_END_20_7_3' ? 'rep' : String(reference.default_unit || fallback[1] || row.raw_unit || '');
  const metricValue = Object.prototype.hasOwnProperty.call(derived,metricCode) ? derived[metricCode] : metricNumber_(row[metricCode]);
  if (metricValue === null || metricValue === undefined) return null;
  const valid = metricBoolean_(row.valid, false);
  const classificationEnabled = metricBoolean_(reference.classification_enabled, true);
  const threshold = valid && classificationEnabled ? thresholdForMetric_(context,testCode,metricCode,metricValue,row.performed_at) : null;
  return {
    test_metric_id:testMetricId_(row.test_result_id),
    test_result_id:row.test_result_id,
    athlete_id:row.athlete_id,
    test_code:testCode,
    metric_code:metricCode,
    metric_value:metricValue,
    metric_unit:metricUnit,
    added_load_ratio:addedLoadRatio,
    assistance_ratio:assistanceRatio,
    supported_load_kg:supportedLoadKg,
    supported_load_ratio:supportedLoadRatio,
    side_plank_mean_s:sideMean,
    side_asymmetry_pct:sideAsymmetry,
    running_age_score:derived.age_score,
    level_code:threshold ? threshold.level_code : '',
    threshold_id:threshold ? threshold.threshold_id : '',
    rule_version:threshold ? threshold.rule_version : '',
    classification_status:!valid ? 'INVALID' : (threshold ? 'CLASSIFIED' : 'NOT_CLASSIFIED'),
    valid:valid,
    calculated_at:new Date().toISOString(),
    notes:'Calcul automatique ' + API_RELEASE
  };
}

function fingerprintObject_(value) {
  const json=JSON.stringify(sortObject_(value));
  const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,json,Utilities.Charset.UTF_8);
  return bytes.map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');
}
function sortObject_(value) {
  if(Array.isArray(value))return value.map(sortObject_);
  if(value&&typeof value==='object'&&!(value instanceof Date)){const out={};Object.keys(value).sort().forEach(k=>out[k]=sortObject_(value[k]));return out}
  return value;
}


function schemaAudit_() {
  const requiredHeaders = {
    WEEKS: ['training_week_id','cycle_id','athlete_id','week_no','start_date','end_date','status','version_no'],
    SESSIONS: ['planned_session_id','training_week_id','athlete_id','session_date','planned_start_time','status'],
    SESSION_BLOCKS: ['session_block_id','planned_session_id','session_template_id','block_order','name','duration_target_min'],
    EXERCISE_PRESCRIPTIONS: ['exercise_prescription_id','session_block_id','exercise_catalog_id','progression_rule_text','coach_notes'],
    SESSION_TARGETS: ['session_target_id','planned_session_id','session_block_id','target_scope','quality_id','stimulus_code'],
    SESSION_EXECUTIONS: ['session_execution_id','athlete_id','planned_session_id','session_block_id','execution_scope'],
    SET_RESULTS: ['set_result_id','session_execution_id','exercise_prescription_id','exercise_catalog_id','set_no','valid'],
    CLIMBING_ATTEMPTS: ['climbing_attempt_id','session_execution_id','grading_system','grade_code','result_status','validation_status'],
    RUNNING_RESULTS: ['running_result_id','session_execution_id','distance_m','time_seconds','valid'],
    TEST_RESULTS: ['test_result_id','athlete_id','test_code','performed_at','valid'],
    TEST_METRICS: ['test_metric_id','test_result_id','athlete_id','test_code','metric_code','metric_value','metric_unit','classification_status','valid'],
    REF_INTERFERENCE_RULES: ['interference_rule_version_id','source_stimulus_code','target_stimulus_code','same_day_allowed']
  };
  const checks = [];

  Object.keys(requiredHeaders).forEach(name => {
    const sheet = sheet_(name);
    const headers = sheet.getDataRange().getValues()[0].map(String);
    const missing = requiredHeaders[name].filter(header => headers.indexOf(header) < 0);
    checks.push({
      code: 'HEADERS_' + name,
      ok: missing.length === 0,
      details: missing.length ? ('Colonnes absentes : ' + missing.join(', ')) : 'Colonnes présentes'
    });
  });

  const requiredStimuli = [
    'FINGER_MAX','FINGER_END','FINGER_POWER','UPPER_MAX','UPPER_END','UPPER_POWER',
    'LOWER_MAX','LOWER_END','LOWER_POWER','BLOC_MAX','CLIMB_VOLUME','CLIMB_TECHNIQUE',
    'CLIMB_COORDINATION','CLIMB_ANAEROBIC','CORE','MOBILITY','FLEXIBILITY','PREVENTION',
    'RUN_EASY','RUN_LONG','RUN_THRESHOLD','RUN_INTERVAL','RUN_TEST'
  ];
  const stimulusCodes = new Set(rows_('REF_STIMULI').map(r => String(r.stimulus_code)));
  const missingStimuli = requiredStimuli.filter(code => !stimulusCodes.has(code));
  checks.push({
    code: 'REF_STIMULI_V02',
    ok: missingStimuli.length === 0,
    details: missingStimuli.length ? ('Stimuli absents : ' + missingStimuli.join(', ')) : (requiredStimuli.length + ' stimuli présents')
  });

  const athlete = rows_('ATHLETES').find(r => String(r.athlete_id) === 'ath_lgrd_001');
  checks.push({
    code: 'ATHLETE_REAL',
    ok: !!athlete,
    details: athlete ? 'ath_lgrd_001 présent' : 'ath_lgrd_001 absent'
  });

  const realWeeks = rows_('WEEKS').filter(r =>
    String(r.athlete_id) === 'ath_lgrd_001' && String(r.status).toLowerCase() === 'published'
  );
  checks.push({
    code: 'PUBLISHED_WEEKS_REAL',
    ok: realWeeks.length > 0,
    details: realWeeks.length ? (realWeeks.length + ' semaine(s) publiée(s) trouvée(s)') : 'Aucune semaine publiée pour ath_lgrd_001'
  });

  const realWeekIds = new Set(realWeeks.map(r => String(r.training_week_id)));
  const realSessions = rows_('SESSIONS').filter(r =>
    realWeekIds.has(String(r.training_week_id)) && String(r.status).toLowerCase() === 'published'
  );
  checks.push({
    code: 'PUBLISHED_SESSIONS_REAL',
    ok: realSessions.length > 0,
    details: realSessions.length ? (realSessions.length + ' séance(s) publiée(s) trouvée(s)') : 'Aucune séance publiée pour les semaines réelles'
  });

  const configVersion = String(getConfig_('schema_version') || SCHEMA_VERSION);
  checks.push({
    code: 'SCHEMA_VERSION',
    ok: configVersion === '0.5.8.1',
    details: 'Version déclarée : ' + configVersion
  });

  return {
    schema_version: SCHEMA_VERSION,
    valid: checks.every(check => check.ok),
    checks: checks,
    checked_at: new Date().toISOString()
  };
}

function publishPlan_(payload) {
  const cycle = payload.cycle || {};
  const week = payload.week || {};
  const sessions = payload.sessions || [];
  const blocks = payload.blocks || [];
  const prescriptions = payload.prescriptions || [];
  const targets = payload.targets || [];

  if (!cycle.cycle_id) throw new Error('cycle_id obligatoire');
  if (!week.training_week_id) throw new Error('training_week_id obligatoire');
  if (!week.athlete_id) throw new Error('athlete_id obligatoire');

  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    upsertById_('CYCLES', 'cycle_id', cycle);
    upsertById_('WEEKS', 'training_week_id', week);

    replaceRowsByValue_('SESSIONS', 'training_week_id', week.training_week_id, sessions);

    const sessionIds = sessions.map(r => String(r.planned_session_id));
    replaceRowsByValues_('SESSION_BLOCKS', 'planned_session_id', sessionIds, blocks);

    const blockIds = blocks.map(r => String(r.session_block_id));
    replaceRowsByValues_('EXERCISE_PRESCRIPTIONS', 'session_block_id', blockIds, prescriptions);
    replaceRowsByValues_('SESSION_TARGETS', 'planned_session_id', sessionIds, targets);

    return {
      training_week_id: week.training_week_id,
      version_no: week.version_no,
      counts: {
        sessions: sessions.length,
        blocks: blocks.length,
        prescriptions: prescriptions.length,
        targets: targets.length
      }
    };
  } finally {
    lock.releaseLock();
  }
}

function replaceRowsByValue_(sheetName, columnName, value, records) {
  return replaceRowsByValues_(sheetName, columnName, [String(value)], records);
}

function replaceRowsByValues_(sheetName, columnName, valuesToReplace, records) {
  const sheet = sheet_(sheetName);
  const data = sheet.getDataRange().getValues();
  if (!data.length) throw new Error('Feuille vide : ' + sheetName);
  const headers = data[0].map(String);
  const columnIndex = headers.indexOf(columnName);
  if (columnIndex < 0) throw new Error('Colonne absente : ' + columnName);

  const wanted = new Set((valuesToReplace || []).map(String));
  for (let i = data.length - 1; i >= 1; i--) {
    if (wanted.has(String(data[i][columnIndex]))) sheet.deleteRow(i + 1);
  }
  appendObjects_(sheetName, records || []);
  return {written:(records || []).length};
}

function upsertCheckin_(record, athleteId) {
  record = Object.assign({}, record);
  record.athlete_id = record.athlete_id || athleteId;
  const localDay = String(record.localDate || record.local_date || record.date || new Date().toISOString()).slice(0,10);
  record.checkin_id = record.checkin_id || ('ci-' + record.athlete_id + '-' + localDay + '-' + String(record.source || 'PWA').replace(/\s+/g,'_'));
  if (!record.checkin_type) {
    const sourceLower = String(record.source || '').toLowerCase();
    record.checkin_type = (sourceLower.indexOf('dimanche') >= 0 || sourceLower.indexOf('weekly') >= 0 || sourceLower.indexOf('hebdo') >= 0)
      ? 'WEEKLY'
      : (sourceLower.indexOf('soir') >= 0 ? 'EVENING' : 'MORNING');
  }
  record.checked_at = record.checked_at || record.date || new Date().toISOString();
  record.sleep_duration_h = value_(record.sleep);
  record.sleep_quality_0_10 = value_(record.sleepQuality);
  record.energy_0_10 = value_(record.energy);
  record.motivation_0_10 = value_(record.motivation);
  record.stress_0_10 = value_(record.stress);
  record.mood_0_10 = value_(record.mood);
  record.fatigue_0_10 = value_(record.fatigue);
  record.soreness_0_10 = value_(record.soreness);
  record.pain_intensity_0_10 = value_(record.pain);
  record.day_rpe_0_10 = value_(record.rpe);
  record.cycling_distance_km = value_(record.bike);
  record.cycling_duration_min = value_(record.bikeDuration);
  ensureHeader_('CHECKINS', 'cycling_duration_min');
  const hrSupine = value_(record.hrSupine);
  const hrStanding = value_(record.hrStanding);
  record.lying_hr_bpm = hrSupine;
  record.supine_hr_bpm = hrSupine;
  record.hr_supine_bpm = hrSupine;
  record.standing_hr_bpm = hrStanding;
  record.upright_hr_bpm = hrStanding;
  record.hr_standing_bpm = hrStanding;
  record.pain_present = value_(record.pain) > 0;
  record.notes = record.notes || record.source || 'PWA';
  record.status = 'valid';
  record.created_at = record.created_at || new Date().toISOString();
  record.updated_at = new Date().toISOString();
  record.sync_status = 'SYNCED';
  record.client_created_at = record.client_created_at || record.checked_at;
  return upsertById_('CHECKINS','checkin_id',record);
}

function ensureHeader_(sheetName, headerName) {
  const sheet = sheet_(sheetName);
  const lastColumn = Math.max(1, sheet.getLastColumn());
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(String);
  if (headers.indexOf(headerName) >= 0) return;
  sheet.getRange(1, lastColumn + 1).setValue(headerName);
}

function appendMeasurements_(records, athleteId) {
  const clean = records.map(r => Object.assign({}, r, {athlete_id:r.athlete_id || athleteId}));
  appendObjects_('BODY_MEASUREMENTS', clean);
  return {written:clean.length};
}

function upsertById_(sheetName, idColumn, record) {
  if (!record[idColumn]) throw new Error(idColumn + ' obligatoire');
  const sheet = sheet_(sheetName), values = sheet.getDataRange().getValues(), headers = values[0].map(String);
  const idIndex = headers.indexOf(idColumn);
  if (idIndex < 0) throw new Error('Colonne absente : ' + idColumn);
  const rowIndex = values.slice(1).findIndex(r => String(r[idIndex]) === String(record[idColumn]));
  const row = headers.map(h => normalizeForSheet_(record[h]));
  if (rowIndex >= 0) sheet.getRange(rowIndex + 2, 1, 1, headers.length).setValues([row]);
  else sheet.appendRow(row);
  return {written:1,id:record[idColumn],mode:rowIndex >= 0 ? 'updated' : 'inserted'};
}

function replaceChildren_(sheetName, parentColumn, parentId, records) {
  if (!parentId) throw new Error(parentColumn + ' obligatoire');
  const sheet = sheet_(sheetName), data = sheet.getDataRange().getValues(), headers = data[0].map(String);
  const parentIndex = headers.indexOf(parentColumn);
  if (parentIndex < 0) throw new Error('Colonne absente : ' + parentColumn);
  for (let i = data.length - 1; i >= 1; i--) if (String(data[i][parentIndex]) === parentId) sheet.deleteRow(i + 1);
  appendObjects_(sheetName, records.map(r => Object.assign({}, r, {[parentColumn]:parentId})));
  return {written:records.length,replaced_parent_id:parentId};
}

function appendObjects_(sheetName, records) {
  if (!records.length) return;
  const sheet = sheet_(sheetName), headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
  const rows = records.map(r => headers.map(h => normalizeForSheet_(r[h])));
  sheet.getRange(sheet.getLastRow()+1,1,rows.length,headers.length).setValues(rows);
}

function optionalRows_(sheetName) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0].map(String);
  return data.slice(1).filter(r => r.some(v => v !== '' && v !== null)).map(r => {
    const o = {};headers.forEach((h,i) => o[h] = serialize_(r[i]));return o;
  });
}

function rows_(sheetName) {
  const sheet = sheet_(sheetName), data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0].map(String);
  return data.slice(1).filter(r => r.some(v => v !== '' && v !== null)).map(r => {
    const o = {};headers.forEach((h,i) => o[h] = serialize_(r[i]));return o;
  });
}

function sheet_(name) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sheet) throw new Error('Feuille absente : ' + name);
  return sheet;
}

function getConfig_(key) {
  const sheet = sheet_('API_CONFIG');
  const values = sheet.getDataRange().getValues();
  if (values.length < 3) return null;

  // API_CONFIG has a title on row 1 and real headers on row 2.
  const headers = values[1].map(String);
  const keyIndex = headers.indexOf('setting_key');
  const valueIndex = headers.indexOf('setting_value');

  if (keyIndex < 0 || valueIndex < 0) {
    throw new Error('En-têtes API_CONFIG introuvables');
  }

  for (let i = 2; i < values.length; i++) {
    if (String(values[i][keyIndex]).trim() === String(key).trim()) {
      return values[i][valueIndex];
    }
  }
  return null;
}

function configBoolean_(key, defaultValue) {
  const value = getConfig_(key);
  if (value === null || value === '') return defaultValue;
  if (value === true || String(value).trim().toLowerCase() === 'true') return true;
  if (value === false || String(value).trim().toLowerCase() === 'false') return false;
  throw new Error('Valeur booléenne invalide dans API_CONFIG : ' + key);
}

function assertApiEnabled_() {
  if (!configBoolean_('api_enabled', false)) throw new Error('API désactivée');
}
function assertWriteEnabled_() {
  if (!configBoolean_('write_enabled', false)) throw new Error('Écritures désactivées');
}

function writeLog_(requestId, method, action, payload, status, duration, message) {
  try {
    appendObjects_('API_LOG',[{
      request_id:requestId,requested_at:new Date(),method,action,
      athlete_id:payload.athlete_id || '',entity_type:payload.entity_type || '',
      entity_id:payload.entity_id || '',status,duration_ms:duration,message,
      payload_excerpt:JSON.stringify(payload).slice(0,500)
    }]);
  } catch (ignored) {}
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function first_(arr, predicate) { for (let i=0;i<arr.length;i++) if (predicate(arr[i])) return arr[i]; return null; }
function value_(v) { return v === '' || v === null || v === undefined ? null : Number(v); }
function serialize_(v) { return v instanceof Date ? v.toISOString() : v; }
function normalizeForSheet_(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v);
  return v;
}
