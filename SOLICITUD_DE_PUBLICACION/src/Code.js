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
    var data = JSON.parse(e.postData.contents);
    var projectName = data && data.projectName ? String(data.projectName) : "";
    var sheet = doc.getSheetByName(projectName) || doc.getActiveSheet();

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

    var normalizeHeader = function(value) {
      return String(value || "")
        .trim()
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    };

    var getProjectPrefix = function(name) {
      var normalized = normalizeHeader(name);
      if (!normalized) return "XXX";
      var mapping = {
        VENTURA: "VEN",
        IRIS: "IRI",
        MADERO: "MAD",
        MAGNOLIAS: "MAG",
        BLUE: "BLU",
        ORION: "ORI"
      };
      if (mapping[normalized]) return mapping[normalized];
      return normalized.replace(/[^A-Z]/g, "").slice(0, 3) || "XXX";
    };

    var parseCodigo = function(raw, expectedPrefix, sheetPrefix) {
      var value = String(raw || "").trim();
      if (!value) return null;
      var normalized = normalizeHeader(value);
      var prefixed = normalized.match(/^([A-Z]{3})(\d+)$/);
      if (prefixed) {
        if (prefixed[1] !== expectedPrefix) return null;
        var n1 = parseInt(prefixed[2], 10);
        return isNaN(n1) ? null : n1;
      }
      var plain = normalized.match(/^(\d+)$/);
      if (plain && sheetPrefix === expectedPrefix) {
        var n2 = parseInt(plain[1], 10);
        return isNaN(n2) ? null : n2;
      }
      return null;
    };

    var getMaxCodigoForPrefix = function(prefix) {
      var sheets = doc.getSheets();
      var max = null;

      sheets.forEach(function(sh) {
        var lr = sh.getLastRow();
        if (lr < 2) return;
        var startRow = Math.max(2, lr - 5000);
        var codes = sh.getRange(startRow, 1, lr - startRow + 1, 1).getDisplayValues();
        var sheetPrefix = getProjectPrefix(sh.getName());
        codes.forEach(function(r) {
          var parsed = parseCodigo(r[0], prefix, sheetPrefix);
          if (parsed === null) return;
          if (max === null || parsed > max) max = parsed;
        });
      });

      return max;
    };

    var prefix = getProjectPrefix(projectName);
    var maxCodigo = getMaxCodigoForPrefix(prefix);
    var nextNum = maxCodigo === null ? 0 : maxCodigo + 1;
    var nextId = prefix + String(nextNum).padStart(3, "0");
    
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
      projectName,                  // PROYECTO
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
