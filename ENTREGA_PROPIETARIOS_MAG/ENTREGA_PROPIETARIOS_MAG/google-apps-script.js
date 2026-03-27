const SHEET_ID = '1JKsD6ZZfgunvFlquort_Ph4hYlupsR0mFDSCFVDjcf0';
const SHEET_NAME = 'Datos';

const SOURCE_FOLDER_ID = '1J4KvjOZb-VL0D_cigzT4Fcp9V-AG5AAp';
const ESCRITURAS_FILE_NAME = 'Magnolias - Escrituras.xlsx';
const ENTREGAS_FILE_NAME = 'Magnolias - Entregas.xlsx';
const ENTREGAS_IMPORT_SHEET_NAME = 'Entregas_Import';

const PROP_ENTREGAS_FINGERPRINT = 'ENTREGAS_FINGERPRINT_V1';
const PROP_ESCRITURAS_FINGERPRINT = 'ESCRITURAS_FINGERPRINT_V1';

function doGet(e) {
  const action = e && e.parameter ? String(e.parameter.action || '').trim() : '';
  if (action === 'sync') {
    const result = syncAll_();
    return responseJSON({ ok: true, action, result });
  }
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(30000);

  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = getDataSheet(ss);
    ensureSheetSchema(sheet);

    if (e && e.postData && e.postData.contents) {
      const params = JSON.parse(e.postData.contents);

      if (params.action === 'initialize') {
        setupSheet(true);
        return responseJSON({ success: true, message: 'Database initialized' });
      }

      const { towerId, aptNumber, status, weeklyGoalDate } = params;
      if (towerId && aptNumber && status) {
        if (String(status).trim().toLowerCase() === 'notarized') {
          return responseJSON({ success: false, error: 'status_notarized_is_list_controlled' });
        }
        updateApartmentStatus(sheet, towerId, aptNumber, status, weeklyGoalDate);
        return responseJSON({ success: true });
      }
    }

    const data = getAllData(sheet);
    return responseJSON({ towers: data });
  } catch (error) {
    return responseJSON({ error: String(error && error.stack ? error.stack : error) });
  } finally {
    lock.releaseLock();
  }
}

function syncAll_() {
  const escrituras = syncNotarizedFlagFromEscriturasXlsx_();
  const entregas = syncEntregasImportIfChanged_();
  return { escrituras, entregas };
}

function syncNotarizedFlagFromEscriturasXlsx_() {
  const file = findLatestFileInFolderByName_(SOURCE_FOLDER_ID, ESCRITURAS_FILE_NAME);
  if (!file) return { ok: false, message: `No se encontró ${ESCRITURAS_FILE_NAME}` };

  const fingerprint = `${file.getId()}@${file.getLastUpdated().getTime()}`;

  const temp = convertXlsxToTempSpreadsheet_(file);
  try {
    const values = readFirstSheetDisplayValues_(temp.spreadsheetId);
    const unitKeys = extractUnitKeysFromEscriturasValues_(values);

    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = getDataSheet(ss);
    ensureSheetSchema(sheet);

    const updated = applyNotarizedFlag_(sheet, unitKeys);

    PropertiesService.getScriptProperties().setProperty(PROP_ESCRITURAS_FINGERPRINT, fingerprint);

    return {
      ok: true,
      file: { name: file.getName(), id: file.getId(), updatedAt: file.getLastUpdated().toISOString() },
      inputUnits: unitKeys.size,
      updatedRows: updated
    };
  } finally {
    trashFileById_(temp.tempFileId);
  }
}

function syncEntregasImportIfChanged_() {
  const file = findLatestFileInFolderByName_(SOURCE_FOLDER_ID, ENTREGAS_FILE_NAME);
  if (!file) return { ok: false, message: `No se encontró ${ENTREGAS_FILE_NAME}` };

  const fingerprint = `${file.getId()}@${file.getLastUpdated().getTime()}`;
  const props = PropertiesService.getScriptProperties();
  const lastFingerprint = props.getProperty(PROP_ENTREGAS_FINGERPRINT) || '';

  if (fingerprint === lastFingerprint) {
    return { ok: true, changed: false, message: 'Sin cambios en Entregas.xlsx' };
  }

  const temp = convertXlsxToTempSpreadsheet_(file);
  try {
    const values = readFirstSheetDisplayValues_(temp.spreadsheetId);

    const ss = SpreadsheetApp.openById(SHEET_ID);
    const importSheet = getOrCreateSheet_(ss, ENTREGAS_IMPORT_SHEET_NAME);
    importSheet.clearContents();

    if (values.length > 0 && values[0] && values[0].length > 0) {
      importSheet.getRange(1, 1, values.length, values[0].length).setValues(values);
    }

    props.setProperty(PROP_ENTREGAS_FINGERPRINT, fingerprint);

    return {
      ok: true,
      changed: true,
      file: { name: file.getName(), id: file.getId(), updatedAt: file.getLastUpdated().toISOString() },
      importedRows: values.length,
      importedCols: values[0] ? values[0].length : 0,
      sheet: ENTREGAS_IMPORT_SHEET_NAME
    };
  } finally {
    trashFileById_(temp.tempFileId);
  }
}

function extractUnitKeysFromEscriturasValues_(values) {
  const set = new Set();
  for (let r = 1; r < values.length; r++) {
    const raw = values[r] && values[r][3] != null ? String(values[r][3]).trim() : '';
    if (!raw) continue;
    const parsed = parseTipoTorreApartamento_(raw);
    if (!parsed) continue;
    set.add(`${parsed.towerId}-${parsed.aptNumber}`);
  }
  return set;
}

function parseTipoTorreApartamento_(s) {
  const raw = String(s || '').trim();
  if (!raw) return null;
  const parts = raw.split('-').map(p => String(p || '').trim()).filter(Boolean);
  if (parts.length < 3) return null;

  const towerId = Number(parts[parts.length - 2]);
  const aptNumber = String(parts[parts.length - 1]).trim();
  if (!Number.isFinite(towerId) || towerId <= 0) return null;
  if (!aptNumber) return null;
  return { towerId, aptNumber };
}

function applyNotarizedFlag_(sheet, unitKeysSet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 0;

  const range = sheet.getRange(2, 1, lastRow - 1, 6);
  const values = range.getValues();

  const now = new Date();
  let updated = 0;

  for (let i = 0; i < values.length; i++) {
    const towerId = String(values[i][0] ?? '').trim();
    const aptNumber = String(values[i][1] ?? '').trim();
    const baseStatus = String(values[i][2] ?? '').trim().toLowerCase();

    if (baseStatus === 'special') continue;

    const key = `${towerId}-${aptNumber}`;
    const nextFlag = unitKeysSet.has(key);
    const prevFlag = Boolean(values[i][5]);

    if (prevFlag === nextFlag) continue;

    values[i][5] = nextFlag;
    values[i][3] = now;
    updated++;
  }

  range.setValues(values);
  return updated;
}

function getAllData(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const data = sheet.getRange(2, 1, lastRow - 1, 6).getValues();

  return data.map(row => {
    const towerId = row[0];
    const aptNumber = row[1];
    const baseStatusRaw = String(row[2] ?? '').trim().toLowerCase();
    const isListNotarized = Boolean(row[5]);

    let status = baseStatusRaw || 'in_process';
    if (status === 'special') {
      status = 'special';
    } else if (isListNotarized) {
      status = 'notarized';
    } else if (status === 'notarized') {
      status = 'in_process';
    }

    return {
      towerId,
      aptNumber,
      status,
      weeklyGoalDate: row[4] || null
    };
  });
}

function updateApartmentStatus(sheet, towerId, aptNumber, status, weeklyGoalDate) {
  const lastRow = sheet.getLastRow();
  const data = sheet.getRange(2, 1, Math.max(0, lastRow - 1), 2).getValues();

  let rowIndex = -1;
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]) === String(towerId) && String(data[i][1]) === String(aptNumber)) {
      rowIndex = i + 2;
      break;
    }
  }

  if (rowIndex !== -1) {
    sheet.getRange(rowIndex, 3).setValue(status);
    sheet.getRange(rowIndex, 4).setValue(new Date());
    sheet.getRange(rowIndex, 5).setValue(status === 'weekly_goal' ? (weeklyGoalDate || '') : '');
  } else {
    sheet.appendRow([towerId, aptNumber, status, new Date(), status === 'weekly_goal' ? (weeklyGoalDate || '') : '', false]);
  }
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function getDataSheet(ss) {
  const explicit = ss.getSheetByName(SHEET_NAME);
  if (explicit) return explicit;

  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];
    const headerRow = sheet.getRange(1, 1, 1, Math.min(10, sheet.getMaxColumns())).getValues()[0];
    const header = headerRow.map(v => String(v ?? '').trim().toLowerCase());
    const hasCoreHeaders = header.includes('torre') && header.includes('apartamento') && header.includes('estado');
    if (hasCoreHeaders) return sheet;
  }

  if (sheets.length > 0) return sheets[0];

  setupSheet();
  return ss.getSheetByName(SHEET_NAME);
}

function ensureSheetSchema(sheet) {
  const headers = sheet.getRange(1, 1, 1, 6).getValues()[0];
  const expected = ['Torre', 'Apartamento', 'Estado', 'Última Actualización', 'Fecha Meta Semanal', 'Escriturado (Lista)'];
  const needsUpdate = expected.some((v, i) => String(headers[i] ?? '').trim() !== v);
  if (!needsUpdate) return;

  sheet.getRange(1, 1, 1, 6).setValues([expected]);
  sheet.setFrozenRows(1);
}

function setupSheet(force = false) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  } else if (force) {
    sheet.clear();
  } else {
    if (sheet.getLastRow() > 1) {
      ensureSheetSchema(sheet);
      return;
    }
  }

  sheet.getRange(1, 1, 1, 6).setValues([['Torre', 'Apartamento', 'Estado', 'Última Actualización', 'Fecha Meta Semanal', 'Escriturado (Lista)']]);
  sheet.setFrozenRows(1);

  const data = [];
  const TOTAL_TOWERS = 21;
  const FLOORS_PER_TOWER = 9;
  const APTS_PER_FLOOR = 4;

  for (let t = 1; t <= TOTAL_TOWERS; t++) {
    for (let f = 1; f <= FLOORS_PER_TOWER; f++) {
      for (let a = 1; a <= APTS_PER_FLOOR; a++) {
        let aptNumber = `${f}0${a}`;
        let status = 'in_process';

        if (f === 1 && a === 4) {
          aptNumber = 'COW';
          status = 'special';
        }

        data.push([t, aptNumber, status, new Date(), '', false]);
      }
    }
  }

  if (data.length > 0) {
    sheet.getRange(2, 1, data.length, 6).setValues(data);
  }
}

function getOrCreateSheet_(ss, name) {
  const sh = ss.getSheetByName(name);
  if (sh) return sh;
  return ss.insertSheet(name);
}

function findLatestFileInFolderByName_(folderId, name) {
  const folder = DriveApp.getFolderById(folderId);
  const files = folder.getFilesByName(name);
  let best = null;
  while (files.hasNext()) {
    const f = files.next();
    if (f.isTrashed()) continue;
    if (!best || f.getLastUpdated().getTime() > best.getLastUpdated().getTime()) best = f;
  }
  return best;
}

function convertXlsxToTempSpreadsheet_(file) {
  const resource = {
    title: `TEMP_IMPORT_${file.getName()}_${Date.now()}`,
    mimeType: MimeType.GOOGLE_SHEETS
  };
  const converted = Drive.Files.copy(resource, file.getId());
  return { spreadsheetId: converted.id, tempFileId: converted.id };
}

function trashFileById_(fileId) {
  try {
    DriveApp.getFileById(fileId).setTrashed(true);
  } catch (_) {}
}

function readFirstSheetDisplayValues_(spreadsheetId) {
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sheet = ss.getSheets()[0];
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (!lastRow || !lastCol) return [];
  return sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();
}
