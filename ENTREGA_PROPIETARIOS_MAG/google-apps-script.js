// Copia todo este código en tu proyecto de Google Apps Script
// Vinculado a la hoja: https://docs.google.com/spreadsheets/d/1JKsD6ZZfgunvFlquort_Ph4hYlupsR0mFDSCFVDjcf0/edit?gid=0#gid=0

const SHEET_ID = '1JKsD6ZZfgunvFlquort_Ph4hYlupsR0mFDSCFVDjcf0';
const SHEET_NAME = 'Datos';

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sheet = ss.getSheetByName(SHEET_NAME);
    
    // Si la hoja no existe, la creamos y configuramos
    if (!sheet) {
      setupSheet();
      sheet = ss.getSheetByName(SHEET_NAME);
    }

    // Si es una petición POST (Actualización)
    if (e.postData) {
      const params = JSON.parse(e.postData.contents);
      
      // Si la acción es inicializar la base de datos
      if (params.action === 'initialize') {
        setupSheet(true); // true para forzar reset si es necesario
        return responseJSON({ success: true, message: 'Database initialized' });
      }

      // Actualizar estado de un apartamento
      const { towerId, aptNumber, status } = params;
      if (towerId && aptNumber && status) {
        updateApartmentStatus(sheet, towerId, aptNumber, status);
        return responseJSON({ success: true });
      }
    }
    
    // Si es GET (o POST sin datos específicos), devolvemos todos los datos
    const data = getAllData(sheet);
    return responseJSON({ towers: data });
    
  } catch (error) {
    return responseJSON({ error: error.toString() });
  } finally {
    lock.releaseLock();
  }
}

function getAllData(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return []; // Solo encabezados o vacía
  
  const data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  // Mapeamos a un formato fácil de consumir
  // Estructura esperada por el frontend: array de objetos { towerId, aptNumber, status }
  return data.map(row => ({
    towerId: row[0],
    aptNumber: row[1],
    status: row[2]
  }));
}

function updateApartmentStatus(sheet, towerId, aptNumber, status) {
  const lastRow = sheet.getLastRow();
  const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues(); // Leemos solo columnas Torre y Apto
  
  let rowIndex = -1;
  
  // Buscar la fila correspondiente
  for (let i = 0; i < data.length; i++) {
    // Comparamos como strings para evitar problemas de tipos
    if (String(data[i][0]) === String(towerId) && String(data[i][1]) === String(aptNumber)) {
      rowIndex = i + 2; // +2 porque el array empieza en 0 y la hoja tiene header
      break;
    }
  }
  
  if (rowIndex !== -1) {
    // Actualizar existente
    sheet.getRange(rowIndex, 3).setValue(status);
    sheet.getRange(rowIndex, 4).setValue(new Date()); // Timestamp
  } else {
    // Si no existe (no debería pasar si está inicializado, pero por seguridad)
    sheet.appendRow([towerId, aptNumber, status, new Date()]);
  }
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function setupSheet(force = false) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  } else if (force) {
    sheet.clear();
  } else {
    // Si ya existe y no forzamos, revisamos si tiene datos
    if (sheet.getLastRow() > 1) return;
  }
  
  // Encabezados
  sheet.getRange(1, 1, 1, 4).setValues([['Torre', 'Apartamento', 'Estado', 'Última Actualización']]);
  sheet.setFrozenRows(1);
  
  // Generar datos iniciales (Estructura base)
  const data = [];
  const TOTAL_TOWERS = 21;
  const FLOORS_PER_TOWER = 9;
  const APTS_PER_FLOOR = 4;
  
  for (let t = 1; t <= TOTAL_TOWERS; t++) {
    for (let f = 1; f <= FLOORS_PER_TOWER; f++) {
      for (let a = 1; a <= APTS_PER_FLOOR; a++) {
        let aptNumber = `${f}0${a}`;
        let status = 'in_process'; // Estado por defecto
        
        // Caso especial COW
        if (f === 1 && a === 4) {
          aptNumber = 'COW';
          status = 'special';
        }
        
        data.push([t, aptNumber, status, new Date()]);
      }
    }
  }
  
  // Escribir en lotes para mejorar rendimiento
  if (data.length > 0) {
    sheet.getRange(2, 1, data.length, 4).setValues(data);
  }
}
