/**
 * INSTRUCCIONES:
 * Copia todo este código y pégalo en tu proyecto de Google Apps Script (Code.gs).
 * Guarda y publica una nueva versión de la aplicación web ("Manage Deployments" > "New Version").
 */

function doPost(e) {
  // Usamos un bloqueo para evitar que dos solicitudes simultáneas generen el mismo ID
  var lock = LockService.getScriptLock();
  lock.tryLock(10000); // Esperar hasta 10 segundos

  try {
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = doc.getActiveSheet();

    // 1. Definir los encabezados solicitados
    var headers = [
      "CÓDIGO", 
      "FECHA", 
      "TIPO DE SOLICITUD", 
      "RESPONSABLE", 
      "PROPÓSITO DE LA SOLICITUD", 
      "ESPECIALIDAD", 
      "UNIDADES ESTRUCTURALES", 
      "FORMATO", 
      "OBSERVACIONES"
    ];

    // 2. Verificar si la hoja está vacía para agregar encabezados
    var lastRow = sheet.getLastRow();
    if (lastRow === 0) {
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setValues([headers]);
      headerRange.setFontWeight("bold");
      lastRow = 1;
    }

    // 3. Generar código automático (000, 001, 002...)
    var nextId = "000";
    if (lastRow > 1) {
      // Obtenemos el valor de la primera columna (CÓDIGO) de la última fila
      var lastId = sheet.getRange(lastRow, 1).getValue();
      var num = parseInt(lastId, 10);
      
      if (!isNaN(num)) {
        var nextNum = num + 1;
        // Formatear a 3 dígitos (rellenar con ceros a la izquierda)
        nextId = nextNum.toString().padStart(3, '0');
      }
    }

    // 4. Parsear los datos recibidos del formulario
    var data = JSON.parse(e.postData.contents);
    
    // Procesar las Unidades y Formatos para que sean legibles en la celda
    var selectedUnits = [];
    var selectedFormats = new Set(); // Usamos Set para evitar formatos duplicados
    
    if (data.unidades) {
      for (var unit in data.unidades) {
        var formats = data.unidades[unit];
        var hasFiles = false;
        for (var fmt in formats) {
          if (formats[fmt] === true) {
            hasFiles = true;
            selectedFormats.add(fmt);
          }
        }
        if (hasFiles) {
          selectedUnits.push(unit);
        }
      }
    }

    // Crear la fila con el orden exacto de columnas
    var newRow = [
      nextId,                       // CÓDIGO
      new Date(),                   // FECHA
      data.tipoRequest,             // TIPO DE SOLICITUD
      data.responsable,             // RESPONSABLE
      data.proposito,               // PROPÓSITO
      data.especialidad,            // ESPECIALIDAD
      selectedUnits.join(", "),     // UNIDADES ESTRUCTURALES
      Array.from(selectedFormats).join(", "), // FORMATO
      data.observaciones            // OBSERVACIONES
    ];

    sheet.appendRow(newRow);

    return ContentService.createTextOutput(JSON.stringify({"result": "success", "code": nextId}))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({"result": "error", "message": error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
