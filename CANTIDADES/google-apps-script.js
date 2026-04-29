const DEFAULT_SHEET_ID = '19kpmTk5Ap2DaJEZH-BFejBt_ia8qALIKqaPyMdDVuEU';
const DEFAULT_MODELS_FOLDER_ID = '18gr5TvX3pYY5S3ZRfjmWagkTLhhG3B0W';

function doGet(e) {
  return handleRequest_(e);
}

function doPost(e) {
  return handleRequest_(e);
}

function handleRequest_(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(30000);
  try {
    let action = String((e && e.parameter && e.parameter.action) || '').trim();
    const callback = String((e && e.parameter && e.parameter.callback) || '').trim();

    let body = null;
    if (e && e.postData && e.postData.contents) {
      try {
        body = JSON.parse(e.postData.contents);
      } catch {
        body = null;
      }
    }
    if (body && body.action) action = String(body.action).trim();

    const sheetId = String(((body && body.sheetId) || (e && e.parameter && e.parameter.sheetId) || DEFAULT_SHEET_ID) ?? '').trim();
    const model = normalizeModelKey_(String(((body && body.model) || (e && e.parameter && e.parameter.model) || '') ?? ''));

    let result = { ok: false, error: 'Invalid action' };

    if (action === 'ping') {
      result = { ok: true };
    } else if (action === 'list') {
      result = listModels_(e, body);
    } else if (action === 'chunk') {
      result = chunkFile_(e, body);
    } else if (action === 'text') {
      result = textFile_(e, body);
    } else if (action === 'status_get') {
      if (!model) result = { ok: false, error: 'Missing model' };
      else result = statusGet_(sheetId, model);
    } else if (action === 'status_set') {
      if (!model) result = { ok: false, error: 'Missing model' };
      else {
        const elementId = String(((body && body.elementId) || (e && e.parameter && e.parameter.elementId) || (e && e.parameter && e.parameter.id) || '') ?? '').trim();
        const status = String(((body && body.status) || (e && e.parameter && e.parameter.status) || '') ?? '').trim();
        const at = String(((body && body.at) || (e && e.parameter && e.parameter.at) || '') ?? '').trim();
        if (!elementId || !status) result = { ok: false, error: 'Missing elementId/status' };
        else result = statusSet_(sheetId, model, elementId, status, at || new Date().toISOString());
      }
    } else if (action === 'status_set_many') {
      if (!model) result = { ok: false, error: 'Missing model' };
      else {
        const idsRaw = (body && body.ids) || (e && e.parameter && e.parameter.ids) || '';
        const ids = Array.isArray(idsRaw)
          ? idsRaw.map(String).map((s) => s.trim()).filter(Boolean)
          : String(idsRaw).split(',').map((s) => s.trim()).filter(Boolean);
        const status = String(((body && body.status) || (e && e.parameter && e.parameter.status) || '') ?? '').trim();
        const at = String(((body && body.at) || (e && e.parameter && e.parameter.at) || '') ?? '').trim() || new Date().toISOString();
        if (!status || ids.length === 0) result = { ok: false, error: 'Missing ids/status' };
        else result = statusSetMany_(sheetId, model, ids, status, at);
      }
    } else if (action === 'ensure_model') {
      if (!model) result = { ok: false, error: 'Missing model' };
      else {
        ensureModelSheets_(openSheet_(sheetId), model);
        result = { ok: true };
      }
    } else {
      result = { ok: false, error: 'Invalid action: ' + action };
    }

    return output_(result, callback);
  } catch (err) {
    return output_({ ok: false, error: String(err && err.message ? err.message : err) }, String((e && e.parameter && e.parameter.callback) || ''));
  } finally {
    lock.releaseLock();
  }
}

function output_(data, callback) {
  const json = JSON.stringify(data);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + json + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function openSheet_(sheetId) {
  return SpreadsheetApp.openById(sheetId);
}

function normalizeModelKey_(name) {
  const base = String(name || '').replace(/\.(frag|ifc)$/i, '').trim();
  if (!base) return '';
  const normalized = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!normalized) return '';
  return normalized.slice(0, 70);
}

function sheetNames_(model) {
  const statusName = (model + '__STATUS').slice(0, 100);
  const histName = (model + '__HIST').slice(0, 100);
  return { statusName: statusName, histName: histName };
}

function ensureModelSheets_(ss, model) {
  const names = sheetNames_(model);
  let statusSheet = ss.getSheetByName(names.statusName);
  if (!statusSheet) {
    statusSheet = ss.insertSheet(names.statusName);
    statusSheet.getRange(1, 1, 1, 4).setValues([['elementId', 'status', 'updatedAt', 'updatedBy']]);
    statusSheet.setFrozenRows(1);
  }
  let histSheet = ss.getSheetByName(names.histName);
  if (!histSheet) {
    histSheet = ss.insertSheet(names.histName);
    histSheet.getRange(1, 1, 1, 4).setValues([['at', 'elementId', 'status', 'updatedBy']]);
    histSheet.setFrozenRows(1);
  }
  return { statusSheet: statusSheet, histSheet: histSheet };
}

function statusGet_(sheetId, model) {
  const ss = openSheet_(sheetId);
  const sheets = ensureModelSheets_(ss, model);
  const statusValues = sheets.statusSheet.getDataRange().getValues();
  const statuses = {};
  for (let i = 1; i < statusValues.length; i++) {
    const row = statusValues[i];
    const elementId = String(row[0] || '').trim();
    const status = String(row[1] || '').trim();
    if (elementId && status) statuses[elementId] = status;
  }

  const histValues = sheets.histSheet.getDataRange().getValues();
  const history = {};
  for (let i = 1; i < histValues.length; i++) {
    const row = histValues[i];
    const at = String(row[0] || '').trim();
    const elementId = String(row[1] || '').trim();
    const status = String(row[2] || '').trim();
    if (!elementId || !status || !at) continue;
    if (!history[elementId]) history[elementId] = [];
    history[elementId].push({ status: status, at: at });
  }

  return { ok: true, model: model, statuses: statuses, history: history };
}

function statusSet_(sheetId, model, elementId, status, at) {
  const ss = openSheet_(sheetId);
  const sheets = ensureModelSheets_(ss, model);
  const email = (() => {
    try {
      return Session.getActiveUser().getEmail() || '';
    } catch {
      return '';
    }
  })();

  const statusSheet = sheets.statusSheet;
  const values = statusSheet.getDataRange().getValues();
  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === elementId) {
      rowIndex = i + 1;
      break;
    }
  }
  if (rowIndex === -1) rowIndex = statusSheet.getLastRow() + 1;
  statusSheet.getRange(rowIndex, 1, 1, 4).setValues([[elementId, status, at, email]]);

  sheets.histSheet.appendRow([at, elementId, status, email]);
  return { ok: true };
}

function statusSetMany_(sheetId, model, ids, status, at) {
  const ss = openSheet_(sheetId);
  const sheets = ensureModelSheets_(ss, model);
  const email = (() => {
    try {
      return Session.getActiveUser().getEmail() || '';
    } catch {
      return '';
    }
  })();

  const statusSheet = sheets.statusSheet;
  const values = statusSheet.getDataRange().getValues();
  const existingRowById = {};
  for (let i = 1; i < values.length; i++) {
    const id = String(values[i][0] || '').trim();
    if (id) existingRowById[id] = i + 1;
  }

  const updates = [];
  const newRows = [];
  for (let i = 0; i < ids.length; i++) {
    const id = String(ids[i] || '').trim();
    if (!id) continue;
    const row = existingRowById[id];
    if (row) updates.push({ row: row, vals: [id, status, at, email] });
    else newRows.push([id, status, at, email]);
  }

  for (let i = 0; i < updates.length; i++) {
    const u = updates[i];
    statusSheet.getRange(u.row, 1, 1, 4).setValues([u.vals]);
  }
  if (newRows.length > 0) {
    statusSheet.getRange(statusSheet.getLastRow() + 1, 1, newRows.length, 4).setValues(newRows);
  }
  if (ids.length > 0) {
    const histRows = ids.map((id) => [at, String(id).trim(), status, email]).filter((r) => r[1]);
    if (histRows.length > 0) {
      sheets.histSheet.getRange(sheets.histSheet.getLastRow() + 1, 1, histRows.length, 4).setValues(histRows);
    }
  }
  return { ok: true, count: ids.length };
}

function listModels_(e, body) {
  const folderId = String(((body && body.folderId) || (e && e.parameter && e.parameter.folderId) || DEFAULT_MODELS_FOLDER_ID) ?? '').trim();
  if (!folderId) return { error: 'Falta folderId' };
  const root = DriveApp.getFolderById(folderId);

  const modelFiles = [];
  const jsonByBase = {};

  const normalizeBase_ = (name) => String(name || '').trim().toLowerCase();

  const walk_ = (folder) => {
    const it = folder.getFiles();
    while (it.hasNext()) {
      const f = it.next();
      const name = f.getName();
      const lower = String(name).toLowerCase();

      if (lower.endsWith('.frag')) {
        modelFiles.push({ name: name, fileId: f.getId(), format: 'frag' });
        continue;
      }

      if (lower.endsWith('.ifc')) {
        modelFiles.push({ name: name, fileId: f.getId(), format: 'ifc' });
        continue;
      }

      if (lower.endsWith('.json')) {
        const base = normalizeBase_(name.slice(0, -5));
        jsonByBase[base] = f.getId();
      }
    }

    const sub = folder.getFolders();
    while (sub.hasNext()) {
      walk_(sub.next());
    }
  };

  walk_(root);

  const models = modelFiles
    .map((m) => {
      const extLen = m.format === 'ifc' ? 4 : 5;
      const base = normalizeBase_(m.name.slice(0, -extLen));
      const jsonId = jsonByBase[base] || null;
      return {
        name: m.name,
        format: m.format,
        fileId: m.fileId,
        fragId: m.format === 'frag' ? m.fileId : null,
        ifcId: m.format === 'ifc' ? m.fileId : null,
        jsonId: jsonId
      };
    })
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));

  return { models: models };
}

function chunkFile_(e, body) {
  const id = String(((body && body.id) || (e && e.parameter && e.parameter.id) || '') ?? '').trim();
  if (!id) return { error: 'Falta id' };

  const offset = Math.max(0, Number(((body && body.offset) || (e && e.parameter && e.parameter.offset) || 0) ?? 0) || 0);
  const limit = Math.min(
    2 * 1024 * 1024,
    Math.max(1, Number(((body && body.limit) || (e && e.parameter && e.parameter.limit) || (2 * 1024 * 1024)) ?? (2 * 1024 * 1024)) || (2 * 1024 * 1024)),
  );

  const file = DriveApp.getFileById(id);
  const bytes = file.getBlob().getBytes();
  const total = bytes.length;

  const end = Math.min(total, offset + limit);
  const slice = bytes.slice(offset, end);

  const nextOffset = end;
  const done = nextOffset >= total;

  return {
    total: total,
    nextOffset: nextOffset,
    done: done,
    data: Utilities.base64Encode(slice)
  };
}

function textFile_(e, body) {
  const id = String(((body && body.id) || (e && e.parameter && e.parameter.id) || '') ?? '').trim();
  if (!id) return { error: 'Falta id' };

  const file = DriveApp.getFileById(id);
  const text = file.getBlob().getDataAsString('UTF-8');
  return { text: text };
}
