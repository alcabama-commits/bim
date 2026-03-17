const SPREADSHEET_ID = '1IYDpeHQU3TL9YhbjGd49suFObfVcRJhhiB0TqtxfgO4';

const HEADERS = [
  'CÓDIGO',
  'FECHA',
  'TIPO DE SOLICITUD',
  'RESPONSABLE',
  'PROPÓSITO DE LA SOLICITUD',
  'ESPECIALIDAD',
  'UNIDADES ESTRUCTURALES',
  'FORMATO',
  'OBSERVACIONES',
];

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

  const hasEspecialidad = firstRowValues.includes(normalizeHeader_('ESPECIALIDAD'));
  if (!hasEspecialidad) {
    sheet.insertColumnAfter(5);
  }

  if (sheet.getMaxColumns() < HEADERS.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), HEADERS.length - sheet.getMaxColumns());
  }

  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.setFrozenRows(1);
}

function normalizeHeader_(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function getNextCodigo_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return '000';

  const startRow = Math.max(2, lastRow - 2000);
  const codes = sheet.getRange(startRow, 1, lastRow - startRow + 1, 1).getDisplayValues().flat();

  for (let i = codes.length - 1; i >= 0; i--) {
    const raw = String(codes[i] || '').trim();
    if (!raw) continue;

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isNaN(parsed)) {
      return String(parsed + 1).padStart(3, '0');
    }
  }

  return '000';
}

function buildRows_(payload, codigo, fecha) {
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
