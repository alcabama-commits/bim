const SPREADSHEET_ID = '1IYDpeHQU3TL9YhbjGd49suFObfVcRJhhiB0TqtxfgO4';
const VERSION = '2026-03-20.1';

const HEADERS = [
  'CÓDIGO',
  'PROYECTO',
  'FECHA',
  'TIPO DE SOLICITUD',
  'RESPONSABLE',
  'PROPÓSITO DE LA SOLICITUD',
  'ESPECIALIDAD',
  'UNIDADES ESTRUCTURALES',
  'FORMATO',
  'OBSERVACIONES',
];

function doGet(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = getTargetSheet_(spreadsheet, e && e.parameter ? e.parameter.projectName : undefined);
    ensureSheetReady_(sheet);

    const action = e && e.parameter ? String(e.parameter.action || '').trim() : '';
    const callback = e && e.parameter && e.parameter.callback ? String(e.parameter.callback || '').trim() : '';

    if (action === 'backfillCodes') {
      const result = backfillCodes_(sheet);
      const payload = { ok: true, version: VERSION, sheetName: sheet.getName(), action, result };
      return callback
        ? ContentService.createTextOutput(`${callback}(${JSON.stringify(payload)});`).setMimeType(
            ContentService.MimeType.JAVASCRIPT,
          )
        : ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'backfillCodesAll') {
      const sheets = spreadsheet.getSheets();
      const results = [];
      for (let i = 0; i < sheets.length; i++) {
        const s = sheets[i];
        try {
          ensureSheetReady_(s);
          results.push({ sheetName: s.getName(), result: backfillCodes_(s) });
        } catch (err) {
          results.push({ sheetName: s.getName(), error: String(err && err.stack ? err.stack : err) });
        }
      }
      const payload = { ok: true, version: VERSION, action, results };
      return callback
        ? ContentService.createTextOutput(`${callback}(${JSON.stringify(payload)});`).setMimeType(
            ContentService.MimeType.JAVASCRIPT,
          )
        : ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'latestCode') {
      const codigo = getLatestCodigo_(sheet);
      const payload = { ok: true, version: VERSION, sheetName: sheet.getName(), action, codigo };
      return callback
        ? ContentService.createTextOutput(`${callback}(${JSON.stringify(payload)});`).setMimeType(
            ContentService.MimeType.JAVASCRIPT,
          )
        : ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
    }

    const headers = sheet.getRange(1, 1, 1, HEADERS.length).getDisplayValues()[0];
    const payload = { ok: true, version: VERSION, sheetName: sheet.getName(), headers };
    return callback
      ? ContentService.createTextOutput(`${callback}(${JSON.stringify(payload)});`).setMimeType(
          ContentService.MimeType.JAVASCRIPT,
        )
      : ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ ok: false, version: VERSION, error: String(error && error.stack ? error.stack : error) }),
    ).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const payload = parsePayload_(e);

    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = getTargetSheet_(spreadsheet, payload.projectName);
    ensureSheetReady_(sheet);

    const codigo = getNextCodigo_(spreadsheet, payload.projectName);
    const fecha = new Date();

    const rows = buildRows_(payload, codigo, fecha);
    const rowsToInsert =
      rows.length > 0
        ? rows
        : [
            [
              codigo,
              payload.projectName || '',
              fecha,
              payload.tipoRequest || '',
              payload.responsable || '',
              payload.proposito || '',
              payload.especialidad || '',
              '',
              '',
              payload.observaciones || '',
            ],
          ];

    const startRow = sheet.getLastRow() + 1;
    const range = sheet.getRange(startRow, 1, rowsToInsert.length, HEADERS.length);
    range.offset(0, 0, rowsToInsert.length, 1).setNumberFormat('@');
    range.setValues(rowsToInsert);

    return ContentService.createTextOutput(JSON.stringify({ ok: true, codigo })).setMimeType(
      ContentService.MimeType.JSON,
    );
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ ok: false, error: String(error && error.stack ? error.stack : error) }),
    ).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function parsePayload_(e) {
  if (!e || !e.postData || typeof e.postData.contents !== 'string') {
    return {};
  }

  const raw = e.postData.contents.trim();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch (_) {
    return {};
  }
}

function getTargetSheet_(spreadsheet, projectName) {
  const byProject =
    typeof projectName === 'string' && projectName.trim()
      ? spreadsheet.getSheetByName(projectName.trim())
      : null;

  return byProject || spreadsheet.getSheets()[0];
}

function ensureSheetReady_(sheet) {
  const needsHeaderRow = (() => {
    const existing = sheet.getRange(1, 1, 1, Math.min(sheet.getMaxColumns(), HEADERS.length)).getDisplayValues()[0];
    const normalized = existing.map(normalizeHeader_);
    const expectedFirst = normalizeHeader_(HEADERS[0]);

    if (normalized[0] === expectedFirst) return false;

    const looksLikeHeader =
      normalized.includes(normalizeHeader_('FECHA')) ||
      normalized.includes(normalizeHeader_('TIPO DE SOLICITUD')) ||
      normalized.includes(normalizeHeader_('RESPONSABLE')) ||
      normalized.includes(normalizeHeader_('OBSERVACIONES'));

    if (looksLikeHeader) return false;

    const hasAnyContent = existing.some(v => String(v).trim() !== '');
    return hasAnyContent;
  })();

  if (needsHeaderRow) {
    sheet.insertRowBefore(1);
  }

  const currentFirstHeader = normalizeHeader_(sheet.getRange(1, 1).getDisplayValue());
  if (currentFirstHeader !== normalizeHeader_(HEADERS[0])) {
    sheet.insertColumnBefore(1);
  }

  const firstRowValues = sheet
    .getRange(1, 1, 1, Math.min(sheet.getMaxColumns(), 30))
    .getDisplayValues()[0]
    .map(normalizeHeader_);

  const hasProyecto = firstRowValues.includes(normalizeHeader_('PROYECTO'));
  if (!hasProyecto) {
    sheet.insertColumnAfter(1);
  }

  const hasEspecialidad = firstRowValues.includes(normalizeHeader_('ESPECIALIDAD'));
  if (!hasEspecialidad) {
    sheet.insertColumnAfter(6);
  }

  if (sheet.getMaxColumns() < HEADERS.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), HEADERS.length - sheet.getMaxColumns());
  }

  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  const rowsToFormat = Math.max(1000, sheet.getLastRow() + 1000);
  sheet.getRange(1, 1, rowsToFormat, 1).setNumberFormat('@');
  sheet.setFrozenRows(1);
  SpreadsheetApp.flush();
}

function normalizeHeader_(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function getProjectPrefix_(projectName) {
  const normalized = normalizeHeader_(projectName);
  if (!normalized) return 'XXX';

  const mapping = {
    VENTURA: 'VEN',
    IRIS: 'IRI',
    MADERO: 'MAD',
    MAGNOLIAS: 'MAG',
    BLUE: 'BLU',
    ORION: 'ORI',
  };

  if (mapping[normalized]) return mapping[normalized];
  return normalized.replace(/[^A-Z]/g, '').slice(0, 3) || 'XXX';
}

function getNextCodigo_(spreadsheet, projectName) {
  const prefix = getProjectPrefix_(projectName);
  const maxCodigo = getMaxCodigoForPrefix_(spreadsheet, prefix);
  const next = maxCodigo === null ? 0 : maxCodigo + 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
}

function buildRows_(payload, codigo, fecha) {
  const projectName = payload && payload.projectName ? String(payload.projectName) : '';
  const tipoRequest = payload && payload.tipoRequest ? String(payload.tipoRequest) : '';
  const responsable = payload && payload.responsable ? String(payload.responsable) : '';
  const proposito = payload && payload.proposito ? String(payload.proposito) : '';
  const especialidad = payload && payload.especialidad ? String(payload.especialidad) : '';
  const observaciones = payload && payload.observaciones ? String(payload.observaciones) : '';
  const unidades = payload && payload.unidades && typeof payload.unidades === 'object' ? payload.unidades : null;

  const rows = [];
  if (!unidades) return rows;

  Object.keys(unidades).forEach(unidad => {
    const formatos = unidades[unidad];
    if (!formatos || typeof formatos !== 'object') return;

    Object.keys(formatos).forEach(formato => {
      if (formatos[formato] !== true) return;

      rows.push([
        codigo,
        projectName,
        fecha,
        tipoRequest,
        responsable,
        proposito,
        especialidad,
        String(unidad),
        String(formato),
        observaciones,
      ]);
    });
  });

  return rows;
}

function getCodigoColumnIndex_(sheet) {
  const firstRow = sheet.getRange(1, 1, 1, Math.min(sheet.getMaxColumns(), HEADERS.length)).getDisplayValues()[0];
  const normalized = firstRow.map(normalizeHeader_);
  const idx = normalized.indexOf(normalizeHeader_(HEADERS[0]));
  return idx === -1 ? 1 : idx + 1;
}

function parseCodigo_(raw, expectedPrefix, sheetPrefix) {
  const value = String(raw || '').trim();
  if (!value) return null;
  const normalized = normalizeHeader_(value);

  const matchPrefixed = normalized.match(/^([A-Z]{3})(\d+)$/);
  if (matchPrefixed) {
    const prefix = matchPrefixed[1];
    if (prefix !== expectedPrefix) return null;
    const n = Number.parseInt(matchPrefixed[2], 10);
    return Number.isNaN(n) ? null : n;
  }

  const matchPlain = normalized.match(/^(\d+)$/);
  if (matchPlain && sheetPrefix === expectedPrefix) {
    const n = Number.parseInt(matchPlain[1], 10);
    return Number.isNaN(n) ? null : n;
  }

  return null;
}

function normalizeCodigoForSheet_(raw, sheetPrefix) {
  const value = String(raw || '').trim();
  if (!value) return null;
  const normalized = normalizeHeader_(value);

  const matchPrefixed = normalized.match(/^([A-Z]{3})(\d+)$/);
  if (matchPrefixed) {
    const prefix = matchPrefixed[1];
    const n = Number.parseInt(matchPrefixed[2], 10);
    if (Number.isNaN(n)) return null;
    if (prefix !== sheetPrefix) return null;
    return `${sheetPrefix}${String(n).padStart(3, '0')}`;
  }

  const matchPlain = normalized.match(/^(\d+)$/);
  if (matchPlain) {
    const n = Number.parseInt(matchPlain[1], 10);
    if (Number.isNaN(n)) return null;
    return `${sheetPrefix}${String(n).padStart(3, '0')}`;
  }

  return null;
}

function getMaxCodigoForPrefix_(spreadsheet, prefix) {
  const sheets = spreadsheet.getSheets();
  let maxCodigo = null;

  for (let s = 0; s < sheets.length; s++) {
    const sheet = sheets[s];
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) continue;

    const col = getCodigoColumnIndex_(sheet);
    const startRow = Math.max(2, lastRow - 5000);
    const codes = sheet.getRange(startRow, col, lastRow - startRow + 1, 1).getDisplayValues().flat();
    const sheetPrefix = getProjectPrefix_(sheet.getName());

    for (let i = 0; i < codes.length; i++) {
      const parsed = parseCodigo_(codes[i], prefix, sheetPrefix);
      if (parsed === null) continue;
      if (maxCodigo === null || parsed > maxCodigo) maxCodigo = parsed;
    }
  }

  return maxCodigo;
}

function getLatestCodigo_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const col = getCodigoColumnIndex_(sheet);
  const startRow = Math.max(2, lastRow - 200);
  const codes = sheet.getRange(startRow, col, lastRow - startRow + 1, 1).getDisplayValues().flat();
  for (let i = codes.length - 1; i >= 0; i--) {
    const v = String(codes[i] || '').trim();
    if (v) return v;
  }
  return null;
}

function backfillCodes_(sheet) {
  const spreadsheet = sheet.getParent();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    const prefix = getProjectPrefix_(sheet.getName());
    return { updatedRows: 0, startingFrom: `${prefix}000`, maxCodigo: null };
  }

  const col = getCodigoColumnIndex_(sheet);
  const prefix = getProjectPrefix_(sheet.getName());
  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getDisplayValues();
  let maxCodigo = getMaxCodigoForPrefix_(spreadsheet, prefix);
  let nextCodigo = maxCodigo === null ? 0 : maxCodigo + 1;

  const keyToCodigo = {};
  let updatedRows = 0;

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const existing = String(row[col - 1] || '').trim();

    const fecha = String(row[2] || '').trim();
    const tipo = String(row[3] || '').trim();
    const responsable = String(row[4] || '').trim();
    const proposito = String(row[5] || '').trim();
    const especialidad = String(row[6] || '').trim();
    const observaciones = String(row[9] || '').trim();

    const key = [fecha, tipo, responsable, proposito, especialidad, observaciones].join('||');

    const normalizedExisting = normalizeCodigoForSheet_(existing, prefix);
    if (normalizedExisting) {
      const parsed = parseCodigo_(normalizedExisting, prefix, prefix);
      if (parsed !== null && (maxCodigo === null || parsed > maxCodigo)) {
        maxCodigo = parsed;
        nextCodigo = parsed + 1;
      }
      if (!keyToCodigo[key]) keyToCodigo[key] = normalizedExisting;
      if (existing !== normalizedExisting) {
        row[col - 1] = normalizedExisting;
        updatedRows += 1;
      }
      continue;
    }

    if (!keyToCodigo[key]) {
      keyToCodigo[key] = `${prefix}${String(nextCodigo).padStart(3, '0')}`;
      nextCodigo += 1;
    }

    row[col - 1] = keyToCodigo[key];
    updatedRows += 1;
  }

  if (updatedRows > 0) {
    const codes = values.map(r => [r[col - 1]]);
    const range = sheet.getRange(2, col, codes.length, 1);
    range.setNumberFormat('@');
    range.setValues(codes);
    SpreadsheetApp.flush();
  }

  return {
    updatedRows,
    startingFrom: `${prefix}${String(maxCodigo === null ? 0 : maxCodigo + 1).padStart(3, '0')}`,
    maxCodigo,
  };
}
