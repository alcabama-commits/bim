/**
 * Configuración de modelos para cargar automáticamente
 * 
 * Puedes configurar aquí los modelos que quieres cargar automáticamente
 * cuando se inicie la aplicación.
 * 
 * Ejemplos:
 * - Modelos locales: "/models/mi-modelo.ifc"
 * - Modelos remotos: "https://ejemplo.com/modelos/edificio.ifc"
 * - Múltiples modelos: varios objetos en el array
 */

export interface ModelConfig {
  /** URL del modelo (puede ser relativa o absoluta) */
  url: string;
  /** Tipo de modelo: "ifc" o "frag" */
  type: "ifc" | "frag";
  /** Nombre opcional para el modelo (si no se proporciona, se extrae de la URL) */
  name?: string;
}

/**
 * Configuración de modelos iniciales
 * 
 * Para cargar modelos automáticamente, agrega objetos aquí.
 * Si quieres deshabilitar la carga automática, deja el array vacío.
 */
export const initialModels: ModelConfig[] = [
  // Ejemplo:
  // {
  //   url: "/models/mi-edificio.ifc",
  //   type: "ifc",
  //   name: "Mi Edificio"
  // },
  // {
  //   url: "https://ejemplo.com/modelos/estructura.frag",
  //   type: "frag",
  //   name: "Estructura"
  // }
];

/**
 * Si es true, los modelos configurados se cargarán automáticamente al iniciar
 * Si es false, solo se cargarán si se especifican en la URL
 */
export const autoLoadInitialModels = true;

/**
 * Si es true, los parámetros de URL tienen prioridad sobre la configuración inicial
 * Si es false, se cargan ambos (configuración + URL)
 */
export const urlParamsOverrideConfig = false;


