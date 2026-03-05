// ==========================================
// GOOGLE APPS SCRIPT CODE FOR VSR_IFC VIEWPOINTS
// ==========================================
// INSTRUCCIONES DE DESPLIEGUE:
// 1. Ve a https://script.google.com/home
// 2. Crea un "Nuevo proyecto".
// 3. Borra todo el código en el editor (Code.gs) y pega este contenido.
// 4. Guarda el proyecto con el nombre "VSR Viewpoints API".
// 5. Haz clic en el botón azul "Implementar" (arriba derecha) > "Nueva implementación".
// 6. Selecciona el tipo: "Aplicación web" (icono de engranaje).
// 7. Configura los siguientes campos EXACTAMENTE así:
//    - Descripción: "V1"
//    - Ejecutar como: "Yo" (tu cuenta de Google)
//    - Quién tiene acceso: "Cualquier persona" (IMPORTANTE: Esto permite que la app acceda sin login de Google)
// 8. Haz clic en "Implementar".
// 9. Copia la "URL de la aplicación web" (termina en /exec).
// 10. Pega esa URL en el archivo `src/config.ts` de tu proyecto VSR_IFC.
// ==========================================

// ID de la carpeta de Google Drive donde se guardarán los JSONs
// Carpeta: "VSR_VIEWPOINTS_STORAGE" (https://drive.google.com/drive/folders/1ylvuOsv0zzWCthbGT1IwsCSD5nEBM8Kl)
const FOLDER_ID = "1ylvuOsv0zzWCthbGT1IwsCSD5nEBM8Kl";

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
        if (body.id) payload = { id: body.id }; // Handle direct ID payload
      } catch (err) {
        // Si no es JSON, ignorar
      }
    }

    let result = { status: "error", message: "Invalid action" };

    if (action === "list") {
      // Listar vistas existentes
      result = listViewpoints();
    } else if (action === "get") {
      // Devolver contenido de una vista específica
      const id = e.parameter.id;
      if (id) {
        result = getViewpoint(id);
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
    } else {
      result = { status: "error", message: "Invalid action: " + action };
    }
    
    // Agregar versión para depuración
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      result._version = "1.1.0";
    }

    // Preparar respuesta JSON
    // NOTA: Si 'result' es un array (caso 'list'), se devuelve el array directamente.
    // Si es objeto, se devuelve el objeto.
    const jsonString = JSON.stringify(result);
    const output = ContentService.createTextOutput(jsonString);
    output.setMimeType(ContentService.MimeType.JSON);
    
    return output;

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function getFolder() {
  return DriveApp.getFolderById(FOLDER_ID);
}

function listViewpoints() {
  const folder = getFolder();
  const files = folder.getFiles();
  const list = [];
  const scriptUrl = ScriptApp.getService().getUrl();

  while (files.hasNext()) {
    const file = files.next();
    // Procesar solo archivos JSON
    if (file.getMimeType() === "application/json" || file.getName().endsWith(".json")) {
      try {
        // Leer contenido para metadatos
        // OPTIMIZACIÓN: Si hay muchos archivos, esto será lento. 
        // Idealmente guardaríamos un 'index.json' separado.
        const content = file.getBlob().getDataAsString();
        const data = JSON.parse(content);
        
        list.push({
          id: data.id,
          title: data.title,
          description: data.description || "",
          category: data.category || "General",
          userId: data.userId || "anonymous",
          date: data.date || new Date(file.getLastUpdated()).getTime(),
          // URL mágica para obtener el contenido a través de este mismo script
          file: `${scriptUrl}?action=get&id=${data.id}`
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

function getViewpoint(id) {
  const folder = getFolder();
  const fileName = `${id}.json`;
  const files = folder.getFilesByName(fileName);
  
  if (files.hasNext()) {
    const file = files.next();
    const content = file.getBlob().getDataAsString();
    return JSON.parse(content);
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
  const files = folder.getFilesByName(fileName);
  
  if (files.hasNext()) {
    const file = files.next();
    file.setTrashed(true);
    return { status: "success", action: "deleted", id: id };
  } else {
    return { status: "error", message: "Viewpoint file not found", id: id };
  }
}
