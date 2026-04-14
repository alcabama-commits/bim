// ==========================================
// GOOGLE APPS SCRIPT CODE FOR VSR_IFC VIEWPOINTS
// VERSION: 1.4.0 (Sharing + Users)
// ==========================================
// INSTRUCCIONES DE DESPLIEGUE:
// 1. Ve a https://script.google.com/home
// 2. Abre tu proyecto existente.
// 3. Borra todo el código en el editor (Code.gs) y pega este contenido ACTUALIZADO.
// 4. Guarda el proyecto (Ctrl+S).
// 5. Haz clic en el botón azul "Implementar" (arriba derecha) > "Gestionar implementaciones".
// 6. Haz clic en el icono de "Lápiz" (Editar) en la implementación activa.
// 7. En "Versión", selecciona "Nueva versión".
// 8. En "Quién tiene acceso", selecciona "Cualquier persona" (Anyone). 
//    (IMPORTANTE: Si dice "Solo yo", fallará con error CORS).
// 9. Haz clic en "Implementar".
// 10. La URL NO debería cambiar, pero si cambia, actualízala en `src/config.ts`.
// ==========================================

// ID de la carpeta de Google Drive donde se guardarán los JSONs
// Carpeta: "VSR_VIEWPOINTS_STORAGE" (https://drive.google.com/drive/folders/1ylvuOsv0zzWCthbGT1IwsCSD5nEBM8Kl)
const FOLDER_ID = "1ylvuOsv0zzWCthbGT1IwsCSD5nEBM8Kl";
const API_VERSION = "1.4.0";
const USERS_SHEET_ID = "1Jcxc9SwtbDrExyGeS_zy0BVnEER64iEEvzCnzCo5OCg";

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const lock = LockService.getScriptLock();
  // Wait up to 30 seconds for other processes to finish.
  lock.tryLock(30000);

  try {
    let action = e.parameter.action;
    let payload = null;

    // Intentar parsear el cuerpo del POST si existe
    if (e.postData && e.postData.contents) {
      try {
        const body = JSON.parse(e.postData.contents);
        if (body.action) action = body.action;
        if (body.data) payload = body.data;
        // Solo sobrescribir payload con ID si no existe data (para evitar conflictos)
        if (body.id && !payload) payload = { id: body.id }; 
      } catch (err) {
        // Si no es JSON, ignorar
      }
    }

    let result = { status: "error", message: "Invalid action" };

    if (action === "list") {
      // Listar vistas existentes
      const userId = e.parameter.userId || (payload ? payload.userId : null);
      result = listViewpoints(userId);
    } else if (action === "get") {
      // Devolver contenido de una vista específica
      const id = e.parameter.id || (payload ? payload.id : null);
      const userId = e.parameter.userId || (payload ? payload.userId : null);
      if (id) {
        result = getViewpoint(id, userId);
      } else {
        result = { error: "Missing ID" };
      }
    } else if (action === "save") {
      // Guardar una nueva vista
      const data = e.parameter.data || (payload ? payload : null);
      if (data) {
        result = saveViewpoint(data);
      } else {
        result = { status: "error", message: "Missing data" };
      }
    } else if (action === "delete") {
      // Eliminar una vista existente
      const id = e.parameter.id || (payload ? payload.id : null);
      if (id) {
        result = deleteViewpoint(id);
      } else {
        result = { status: "error", message: "Missing ID for deletion" };
      }
    } else if (action === "share") {
      const id = e.parameter.id || (payload ? payload.id : null);
      const userId = e.parameter.userId || (payload ? payload.userId : null);
      const sharedWith = e.parameter.sharedWith || (payload ? payload.sharedWith : null);
      if (!id || !userId) {
        result = { status: "error", message: "Missing id/userId" };
      } else {
        result = shareViewpoint(id, userId, sharedWith);
      }
    } else if (action === "users") {
      result = listActiveUsers();
    } else {
      result = { status: "error", message: "Invalid action: " + action };
    }
    
    // Agregar versión para depuración
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      result._version = API_VERSION;
    }

    // Preparar respuesta JSON
    const jsonString = JSON.stringify(result);
    const output = ContentService.createTextOutput(jsonString);
    output.setMimeType(ContentService.MimeType.JSON);
    
    return output;

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString(),
      _stack: err.stack
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function getFolder() {
  return DriveApp.getFolderById(FOLDER_ID);
}

function listViewpoints(requestUserId) {
  const folder = getFolder();
  const files = folder.getFiles();
  const list = [];
  const scriptUrl = ScriptApp.getService().getUrl();

  while (files.hasNext()) {
    const file = files.next();
    // Procesar solo archivos JSON y excluir los que están en la papelera (por si acaso)
    if ((file.getMimeType() === "application/json" || file.getName().endsWith(".json")) && !file.isTrashed()) {
      try {
        const content = file.getBlob().getDataAsString();
        const data = JSON.parse(content);

        if (requestUserId && !canAccessViewpoint(data, requestUserId)) {
          continue;
        }

        const userQuery = requestUserId ? `&userId=${encodeURIComponent(requestUserId)}` : "";
        
        list.push({
          id: data.id,
          title: data.title,
          description: data.description || "",
          category: data.category || "General",
          userId: data.userId || "anonymous",
          date: data.date || new Date(file.getLastUpdated()).getTime(),
          sharedWith: data.sharedWith || [],
          file: `${scriptUrl}?action=get&id=${data.id}${userQuery}`
        });
      } catch (e) {
        // Archivo corrupto o no válido, ignorar
      }
    }
  }
  
  // Ordenar por fecha, más reciente primero
  list.sort((a, b) => b.date - a.date);
  
  return list;
}

function getViewpoint(id, requestUserId) {
  const folder = getFolder();
  const fileName = `${id}.json`;
  const files = folder.getFilesByName(fileName);
  
  if (files.hasNext()) {
    const file = files.next();
    if (file.isTrashed()) return { error: "Viewpoint is deleted" };

    const content = file.getBlob().getDataAsString();
    const data = JSON.parse(content);
    if (requestUserId && !canAccessViewpoint(data, requestUserId)) {
      return { error: "Unauthorized" };
    }
    return data;
  }
  
  return { error: "Not found" };
}

function saveViewpoint(data) {
  const folder = getFolder();
  const id = data.id;
  
  // Usamos el ID como nombre de archivo para búsquedas rápidas
  const fileName = `${id}.json`;
  
  const files = folder.getFilesByName(fileName);
  if (files.hasNext()) {
    // Actualizar existente
    const file = files.next();
    if (file.isTrashed()) {
       // Si estaba en la papelera, restaurar
       file.setTrashed(false);
    }
    file.setContent(JSON.stringify(data, null, 2));
    return { status: "success", action: "updated", id: id };
  } else {
    // Crear nuevo
    folder.createFile(fileName, JSON.stringify(data, null, 2), "application/json");
    return { status: "success", action: "created", id: id };
  }
}

function deleteViewpoint(id) {
  const folder = getFolder();
  const fileName = `${id}.json`;
  
  // 1. Buscar por nombre exacto (con .json)
  const files = folder.getFilesByName(fileName);
  let deletedCount = 0;
  
  while (files.hasNext()) {
    const file = files.next();
    try {
      if (!file.isTrashed()) {
        file.setTrashed(true); // Mover a la papelera
        deletedCount++;
      }
    } catch (e) {
      // Error al borrar un archivo específico
    }
  }

  // 2. Buscar por nombre sin extensión (fallback)
  if (deletedCount === 0) {
    const filesNoExt = folder.getFilesByName(id);
    while (filesNoExt.hasNext()) {
        const file = filesNoExt.next();
        try {
          if (!file.isTrashed()) {
            file.setTrashed(true);
            deletedCount++;
          }
        } catch (e) {}
    }
  }

  if (deletedCount > 0) {
    return { status: "success", action: "deleted", id: id, count: deletedCount };
  } else {
    return { status: "error", message: "Viewpoint file not found in Drive", id: id };
  }
}

function canAccessViewpoint(data, userId) {
  if (!userId) return true;
  if (!data) return false;
  if (data.userId && String(data.userId).toLowerCase() === String(userId).toLowerCase()) return true;
  const sharedWith = data.sharedWith;
  if (Array.isArray(sharedWith)) {
    const set = {};
    for (let i = 0; i < sharedWith.length; i++) {
      const v = String(sharedWith[i] || "").trim().toLowerCase();
      if (v) set[v] = true;
    }
    return !!set[String(userId).trim().toLowerCase()];
  }
  return false;
}

function shareViewpoint(id, requesterUserId, sharedWith) {
  const folder = getFolder();
  const fileName = `${id}.json`;
  const files = folder.getFilesByName(fileName);
  if (!files.hasNext()) {
    return { status: "error", message: "Viewpoint not found", id };
  }

  const file = files.next();
  if (file.isTrashed()) return { status: "error", message: "Viewpoint is deleted", id };

  const content = file.getBlob().getDataAsString();
  const data = JSON.parse(content);

  const owner = String(data.userId || "").trim().toLowerCase();
  const requester = String(requesterUserId || "").trim().toLowerCase();
  if (!owner || owner !== requester) {
    return { status: "error", message: "Only the owner can share this viewpoint", id };
  }

  let recipients = [];
  if (Array.isArray(sharedWith)) {
    recipients = sharedWith;
  } else if (typeof sharedWith === "string") {
    recipients = sharedWith.split(/[,;\n]+/g);
  }

  const normalized = [];
  const seen = {};
  for (let i = 0; i < recipients.length; i++) {
    const email = String(recipients[i] || "").trim().toLowerCase();
    if (!email) continue;
    if (email === requester) continue;
    if (seen[email]) continue;
    seen[email] = true;
    normalized.push(email);
  }

  data.sharedWith = normalized;
  file.setContent(JSON.stringify(data, null, 2));
  return { status: "success", action: "shared", id, sharedWith: normalized };
}

function listActiveUsers() {
  try {
    const ss = SpreadsheetApp.openById(USERS_SHEET_ID);
    const sheet = ss.getSheets()[0];
    const values = sheet.getDataRange().getValues();

    if (!values || values.length === 0) return [];

    const header = values[0].map(v => String(v || "").trim().toLowerCase());
    const findCol = (candidates) => {
      for (let i = 0; i < candidates.length; i++) {
        const idx = header.indexOf(candidates[i]);
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const colId = findCol(["id", "userid", "user_id", "uid", "usuario id", "identificador"]);
    const colEmail = findCol(["email", "correo", "correo electronico", "correo electrónico", "mail", "e-mail"]);
    const colName = findCol(["name", "nombre", "displayname", "display_name", "usuario", "user", "nombre completo"]);
    const colActive = findCol(["activo", "active", "estado", "status", "habilitado", "enabled"]);

    const result = [];
    const seen = {};
    const isActiveValue = function(value) {
      if (colActive === -1) return true;
      const raw = String(value || "").trim().toLowerCase();
      if (!raw) return false;
      return raw === "true" || raw === "1" || raw === "si" || raw === "sí" || raw === "yes" || raw === "activo" || raw === "active" || raw === "habilitado";
    };

    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      if (!row) continue;
      if (!isActiveValue(row[colActive])) continue;

      const rawId = colId !== -1 ? String(row[colId] || "").trim() : "";
      const rawEmail = colEmail !== -1 ? String(row[colEmail] || "").trim() : "";
      const rawName = colName !== -1 ? String(row[colName] || "").trim() : "";

      let id = rawId || rawEmail || rawName;
      if (!id) continue;
      id = String(id).trim();

      const email = rawEmail ? String(rawEmail).trim().toLowerCase() : "";
      const name = rawName ? String(rawName).trim() : (email || id);

      const key = String(id).trim().toLowerCase();
      if (seen[key]) continue;
      seen[key] = true;

      result.push({
        id: String(id).trim(),
        name: String(name).trim(),
        email: email || undefined
      });
    }

    if (result.length === 0) {
      const emails = [];
      const flatSeen = {};
      for (let r = 0; r < values.length; r++) {
        for (let c = 0; c < values[r].length; c++) {
          const cell = String(values[r][c] || "").trim();
          if (!cell) continue;
          if (cell.indexOf("@") === -1) continue;
          const normalized = cell.toLowerCase();
          if (flatSeen[normalized]) continue;
          flatSeen[normalized] = true;
          emails.push({ id: normalized, name: normalized, email: normalized });
        }
      }
      emails.sort((a, b) => a.id.localeCompare(b.id));
      return emails;
    }

    result.sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));
    return result;
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}
