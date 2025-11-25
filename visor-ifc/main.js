import './style.css'
import { IfcViewerApp } from 'thatopenengine'
import { SidebarComponent } from './ui/SidebarComponent'

// --- CONFIGURACIÓN DE MODELOS IFC ---
const models = [
  {
    id: "estructura_T1_T2",
    name: "Estructura Torre Modulo A T1-T2",
    path: "./models/19_ZI_ALL_Estructura_Torre_ModuloA_T1-T2.ifc",
    visible: false
  },
  {
    id: "estructura_T3_T4",
    name: "Estructura Torre Modulo A T3-T4",
    path: "./models/19_ZI_ALL_Estructura_Torre_ModuloA_T3-T4.ifc",
    visible: false
  }
]

// --- INICIALIZACIÓN DEL VISOR ---
const container = document.getElementById('container') as HTMLDivElement;

const app = new IfcViewerApp({
  container,
  backgroundColor: "#1A1A1A",
  ui: false,
});

// --- CARGAR MODELOS APAGADOS ---
(async () => {
  for (const model of models) {
    const loadedModel = await app.loadIfcUrl(model.path, {
      modelId: model.id,
      storeys: true
    });

    // Mantenerlos ocultos al cargar
    loadedModel.setVisibility(model.visible);
  }

  // Crear sidebar cuando todo esté cargado
  new SidebarComponent(app, models);
})();
