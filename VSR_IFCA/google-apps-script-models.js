const DEFAULT_MODELS_FOLDER_ID = '1fn1umYzIYsxymmwbmap6YbjTB33XJrG8';

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

    let result = { ok: false, error: 'Invalid action' };
    if (action === 'ping') {
      result = { ok: true };
    } else if (action === 'list') {
      result = listModels_(e, body);
    } else if (action === 'chunk') {
      result = chunkFile_(e, body);
    } else if (action === 'text') {
      result = textFile_(e, body);
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

function listModels_(e, body) {
  const folderId = String(((body && body.folderId) || (e && e.parameter && e.parameter.folderId) || DEFAULT_MODELS_FOLDER_ID) ?? '').trim();
  if (!folderId) return { error: 'Falta folderId' };
  const root = DriveApp.getFolderById(folderId);

  const frags = [];
  const jsonByBase = {};

  const normalizeBase_ = (name) => String(name || '').trim().toLowerCase();

  const walk_ = (folder) => {
    const it = folder.getFiles();
    while (it.hasNext()) {
      const f = it.next();
      const name = f.getName();
      const lower = String(name).toLowerCase();

      if (lower.endsWith('.frag')) {
        frags.push({ name: name, fragId: f.getId() });
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

  const models = frags
    .map((m) => {
      const base = normalizeBase_(m.name.slice(0, -5));
      const jsonId = jsonByBase[base] || null;
      return { name: m.name, fragId: m.fragId, jsonId: jsonId };
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

