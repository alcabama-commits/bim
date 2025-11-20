import * as OBC from "@thatopen/components";

/**
 * Carga un modelo IFC desde una URL
 * @param ifcLoader - Instancia del IfcLoader
 * @param url - URL del archivo IFC
 * @param modelName - Nombre opcional para el modelo (si no se proporciona, se usa el nombre del archivo)
 * @returns Promise que se resuelve cuando el modelo se carga
 */
export async function loadIfcFromUrl(
  ifcLoader: OBC.IfcLoader,
  url: string,
  modelName?: string
): Promise<void> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error al cargar el modelo: ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    
    // Si no se proporciona un nombre, intentar extraerlo de la URL
    const name = modelName || extractFileName(url);
    
    await ifcLoader.load(bytes, true, name);
    console.log(`Modelo IFC cargado: ${name} desde ${url}`);
  } catch (error) {
    console.error(`Error al cargar modelo IFC desde ${url}:`, error);
    throw error;
  }
}

/**
 * Carga un modelo Fragments desde una URL
 * @param fragments - Instancia del FragmentsManager
 * @param url - URL del archivo .frag
 * @param modelName - Nombre opcional para el modelo
 * @returns Promise que se resuelve cuando el modelo se carga
 */
export async function loadFragmentsFromUrl(
  fragments: OBC.FragmentsManager,
  url: string,
  modelName?: string
): Promise<void> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error al cargar el modelo: ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    
    const name = modelName || extractFileName(url);
    
    await fragments.core.load(bytes, {
      modelId: name,
    });
    console.log(`Modelo Fragments cargado: ${name} desde ${url}`);
  } catch (error) {
    console.error(`Error al cargar modelo Fragments desde ${url}:`, error);
    throw error;
  }
}

/**
 * Extrae el nombre del archivo de una URL
 */
function extractFileName(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const fileName = pathname.split("/").pop() || "model";
    // Remover extensión
    return fileName.replace(/\.(ifc|frag)$/i, "");
  } catch {
    // Si no es una URL válida, usar el string como está
    return url.split("/").pop()?.replace(/\.(ifc|frag)$/i, "") || "model";
  }
}

/**
 * Carga múltiples modelos desde URLs
 * @param ifcLoader - Instancia del IfcLoader
 * @param fragments - Instancia del FragmentsManager
 * @param models - Array de objetos con url, type y opcionalmente name
 */
export async function loadModelsFromUrls(
  ifcLoader: OBC.IfcLoader,
  fragments: OBC.FragmentsManager,
  models: Array<{ url: string; type: "ifc" | "frag"; name?: string }>
): Promise<void> {
  const loadPromises = models.map((model) => {
    if (model.type === "ifc") {
      return loadIfcFromUrl(ifcLoader, model.url, model.name);
    } else {
      return loadFragmentsFromUrl(fragments, model.url, model.name);
    }
  });

  await Promise.all(loadPromises);
  console.log(`Todos los modelos cargados: ${models.length}`);
}

/**
 * Obtiene modelos desde parámetros URL
 * Ejemplo: ?model=url1.ifc,url2.frag o ?ifc=url1.ifc&frag=url2.frag
 */
export function getModelsFromUrlParams(): Array<{
  url: string;
  type: "ifc" | "frag";
  name?: string;
}> {
  const params = new URLSearchParams(window.location.search);
  const models: Array<{ url: string; type: "ifc" | "frag"; name?: string }> =
    [];

  // Formato: ?model=url1.ifc,url2.frag
  const modelParam = params.get("model");
  if (modelParam) {
    const urls = modelParam.split(",").map((url) => url.trim());
    urls.forEach((url) => {
      const type = url.toLowerCase().endsWith(".frag") ? "frag" : "ifc";
      models.push({ url, type });
    });
  }

  // Formato: ?ifc=url1.ifc&frag=url2.frag
  const ifcParam = params.get("ifc");
  if (ifcParam) {
    const urls = ifcParam.split(",").map((url) => url.trim());
    urls.forEach((url) => {
      models.push({ url, type: "ifc" });
    });
  }

  const fragParam = params.get("frag");
  if (fragParam) {
    const urls = fragParam.split(",").map((url) => url.trim());
    urls.forEach((url) => {
      models.push({ url, type: "frag" });
    });
  }

  return models;
}


