const SPREADSHEET_ID = '1IYDpeHQU3TL9YhbjGd49suFObfVcRJhhiB0TqtxfgO4';
const VERSION = '2026-03-17.1';

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
    if (action === 'backfillCodes') {
      const result = backfillCodes_(sheet);
      return ContentService.createTextOutput(
        JSON.stringify({ ok: true, version: VERSION, sheetName: sheet.getName(), action, result }),
      ).setMimeType(ContentService.MimeType.JSON);
    }

    const headers = sheet.getRange(1, 1, 1, HEADERS.length).getDisplayValues()[0];
    return ContentService.createTextOutput(
      JSON.stringify({ ok: true, version: VERSION, sheetName: sheet.getName(), headers }),
    ).setMimeType(ContentService.MimeType.JSON);
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

    const codigo = getNextCodigo_(sheet);
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
    sheet.getRange(startRow, 1, rowsToInsert.length, HEADERS.length).setValues(rowsToInsert);

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

function getNextCodigo_(sheet) {
  const maxCodigo = getMaxCodigo_(sheet);
  if (maxCodigo === null) return '000';
  return String(maxCodigo + 1).padStart(3, '0');
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

function getMaxCodigo_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const startRow = Math.max(2, lastRow - 5000);
  const codes = sheet.getRange(startRow, 1, lastRow - startRow + 1, 1).getDisplayValues().flat();

  let maxCodigo = null;
  for (let i = 0; i < codes.length; i++) {
    const raw = String(codes[i] || '').trim();
    if (!raw) continue;

    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) continue;

    if (maxCodigo === null || parsed > maxCodigo) {
      maxCodigo = parsed;
    }
  }

  return maxCodigo;
}

function backfillCodes_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return { updatedRows: 0, startingFrom: '000', maxCodigo: null };
  }

  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getDisplayValues();
  let maxCodigo = getMaxCodigo_(sheet);
  let nextCodigo = maxCodigo === null ? 0 : maxCodigo + 1;

  const keyToCodigo = {};
  let updatedRows = 0;

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const existing = String(row[0] || '').trim();

    const fecha = String(row[2] || '').trim();
    const tipo = String(row[3] || '').trim();
    const responsable = String(row[4] || '').trim();
    const proposito = String(row[5] || '').trim();
    const especialidad = String(row[6] || '').trim();
    const observaciones = String(row[9] || '').trim();

    const key = [fecha, tipo, responsable, proposito, especialidad, observaciones].join('||');

    if (existing) {
      const parsed = Number.parseInt(existing, 10);
      if (!Number.isNaN(parsed)) {
        if (maxCodigo === null || parsed > maxCodigo) {
          maxCodigo = parsed;
          nextCodigo = parsed + 1;
        }
      }
      continue;
    }

    if (!keyToCodigo[key]) {
      keyToCodigo[key] = String(nextCodigo).padStart(3, '0');
      nextCodigo += 1;
    }

    row[0] = keyToCodigo[key];
    updatedRows += 1;
  }

  if (updatedRows > 0) {
    const codes = values.map(r => [r[0]]);
    sheet.getRange(2, 1, codes.length, 1).setValues(codes);
    SpreadsheetApp.flush();
  }

  return {
    updatedRows,
    startingFrom: String(maxCodigo === null ? 0 : maxCodigo + 1).padStart(3, '0'),
    maxCodigo,
  };
}
