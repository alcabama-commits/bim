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
      "PROYECTO",
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

    // 3. Generar código automático (000, 001, 002...) de forma robusta
    var nextId;
    if (lastRow < 2) { // Si solo hay encabezado o la hoja está vacía
      nextId = "000";
    } else {
      // Obtenemos todos los valores de la columna de CÓDIGO para encontrar el máximo
      var codeValues = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      var maxNum = -1;
      
      codeValues.forEach(function(row) {
        var num = parseInt(row[0], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      });
      
      var nextNum = maxNum + 1;
      nextId = nextNum.toString().padStart(3, '0');
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
      data.projectName,             // PROYECTO
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
    // Es útil registrar el error para verlo en los logs de Apps Script
    Logger.log(error.toString());
    return ContentService.createTextOutput(JSON.stringify({"result": "error", "message": error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
