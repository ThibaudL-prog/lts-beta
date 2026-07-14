
const SCHEMA_VERSION = '0.5.0';

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
    assertApiEnabled_();
    let result;
    if (action === 'health') result = health_();
    else if (action === 'snapshot') result = snapshot_(String(p.athlete_id || getConfig_('default_athlete_id') || 'ath_demo_001'));
    else if (action === 'checkins.upsert') { assertWriteEnabled_(); result = upsertCheckin_(p.record || {}, String(p.athlete_id || '')); }
    else if (action === 'measurements.append') { assertWriteEnabled_(); result = appendMeasurements_(p.records || [], String(p.athlete_id || '')); }
    else if (action === 'execution.upsert') { assertWriteEnabled_(); result = upsertById_('SESSION_EXECUTIONS','session_execution_id',p.record || {}); }
    else if (action === 'sets.replace') { assertWriteEnabled_(); result = replaceChildren_('SET_RESULTS','session_execution_id',String(p.session_execution_id || ''),p.records || []); }
    else if (action === 'climbing.replace') { assertWriteEnabled_(); result = replaceChildren_('CLIMBING_ATTEMPTS','session_execution_id',String(p.session_execution_id || ''),p.records || []); }
    else if (action === 'running.upsert') { assertWriteEnabled_(); result = upsertById_('RUNNING_RESULTS','running_result_id',p.record || {}); }
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
    write_enabled: String(getConfig_('write_enabled')).toLowerCase() !== 'false'
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
  const executions = rows_('SESSION_EXECUTIONS').filter(r => String(r.athlete_id) === athleteId || sessionIds.has(String(r.planned_session_id)));
  const executionIds = new Set(executions.map(r => String(r.session_execution_id)));
  const setResults = rows_('SET_RESULTS').filter(r => executionIds.has(String(r.session_execution_id)));
  const climbing = rows_('CLIMBING_ATTEMPTS').filter(r => executionIds.has(String(r.session_execution_id)));
  const running = rows_('RUNNING_RESULTS').filter(r => executionIds.has(String(r.session_execution_id)));
  const checkins = rows_('CHECKINS').filter(r => String(r.athlete_id) === athleteId);
  const measurements = rows_('BODY_MEASUREMENTS').filter(r => String(r.athlete_id) === athleteId);

  return {
    snapshot:{athlete,profile,cycles,weeks,sessions,blocks,prescriptions,executions,set_results:setResults,climbing_attempts:climbing,running_results:running,checkins,measurements},
    counts:{cycles:cycles.length,weeks:weeks.length,sessions:sessions.length,prescriptions:prescriptions.length,executions:executions.length}
  };
}

function upsertCheckin_(record, athleteId) {
  record = Object.assign({}, record);
  record.athlete_id = record.athlete_id || athleteId;
  record.checkin_id = record.checkin_id || ('ci-' + record.athlete_id + '-' + String(record.date || new Date().toISOString()).slice(0,10) + '-' + String(record.source || 'PWA').replace(/\s+/g,'_'));
  record.checkin_type = record.checkin_type || (String(record.source || '').toLowerCase().indexOf('soir') >= 0 ? 'EVENING' : 'MORNING');
  record.checked_at = record.checked_at || record.date || new Date().toISOString();
  record.sleep_duration_h = value_(record.sleep);
  record.sleep_quality_0_10 = value_(record.sleepQuality);
  record.energy_0_10 = value_(record.energy);
  record.motivation_0_10 = value_(record.motivation);
  record.stress_0_10 = value_(record.stress);
  record.soreness_0_10 = value_(record.fatigue);
  record.pain_present = value_(record.pain) > 0;
  record.notes = record.notes || record.source || 'PWA';
  record.status = 'valid';
  record.created_at = record.created_at || new Date().toISOString();
  return upsertById_('CHECKINS','checkin_id',record);
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
  const rows = rows_('API_CONFIG');
  const row = rows.find(r => String(r.setting_key) === key);
  return row ? row.setting_value : null;
}

function assertApiEnabled_() {
  if (String(getConfig_('api_enabled')).toLowerCase() === 'false') throw new Error('API désactivée');
}
function assertWriteEnabled_() {
  if (String(getConfig_('write_enabled')).toLowerCase() === 'false') throw new Error('Écritures désactivées');
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
