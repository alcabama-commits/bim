/** 
 *  ⭐⭐ ARCHIVO COMPLETO MAIN.TS ⭐⭐
 *  Incluye Models en el sidebar (Opción 1)
 */

import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as BUI from "@thatopen/ui";
import * as BUIC from "@thatopen/ui-obc";

import * as TEMPLATES from "./ui-templates";
import { appIcons, CONTENT_GRID_ID } from "./globals";
import { viewportSettingsTemplate } from "./ui-templates/buttons/viewport-settings";

BUI.Manager.init();

// Components Setup
const components = new OBC.Components();
const worlds = components.get(OBC.Worlds);

// WORLD
const world = worlds.create<
  OBC.SimpleScene,
  OBC.OrthoPerspectiveCamera,
  OBF.PostproductionRenderer
>();

world.name = "Main";
world.scene = new OBC.SimpleScene(components);
world.scene.setup();
world.scene.three.background = new THREE.Color(0x1a1d23);

const viewport = BUI.Component.create<BUI.Viewport>(() => {
  return BUI.html`<bim-viewport></bim-viewport>`;
});

world.renderer = new OBF.PostproductionRenderer(components, viewport);
world.camera = new OBC.OrthoPerspectiveCamera(components);
world.camera.threePersp.near = 0.01;
world.camera.threePersp.updateProjectionMatrix();
world.camera.controls.restThreshold = 0.05;

// GRID
const worldGrid = components.get(OBC.Grids).create(world);
worldGrid.material.uniforms.uColor.value = new THREE.Color(0x494b50);
worldGrid.material.uniforms.uSize1.value = 2;
worldGrid.material.uniforms.uSize2.value = 8;

const resizeWorld = () => {
  world.renderer?.resize();
  world.camera.updateAspect();
};
viewport.addEventListener("resize", resizeWorld);

world.dynamicAnchor = false;

components.init();

components.get(OBC.Raycasters).get(world);

const { postproduction } = world.renderer;
postproduction.enabled = true;
postproduction.style = OBF.PostproductionAspect.COLOR_SHADOWS;

const { aoPass, edgesPass } = world.renderer.postproduction;
edgesPass.color = new THREE.Color(0x494b50);

aoPass.updateGtaoMaterial({
  radius: 0.25,
  distanceExponent: 1,
  thickness: 1,
  scale: 1,
  samples: 16,
  distanceFallOff: 1,
  screenSpaceRadius: true,
});

aoPass.updatePdMaterial({
  lumaPhi: 10,
  depthPhi: 2,
  normalPhi: 3,
  radius: 4,
  radiusExponent: 1,
  rings: 2,
  samples: 16,
});

// FRAGMENTS
const fragments = components.get(OBC.FragmentsManager);
fragments.init("/node_modules/@thatopen/fragments/dist/Worker/worker.mjs");

fragments.core.models.materials.list.onItemSet.add(({ value: material }) => {
  const isLod =
    "isLodMaterial" in material && (material as any).isLodMaterial;

  if (isLod) {
    world.renderer!.postproduction.basePass.isolatedMaterials.push(material);
  }
});

// UPDATE CAMERA IN ALL MODELS
world.camera.projection.onChanged.add(() => {
  for (const [_, model] of fragments.list) {
    model.useCamera(world.camera.three);
  }
});

world.camera.controls.addEventListener("rest", () => {
  fragments.core.update(true);
});

// IFC Loader
const ifcLoader = components.get(OBC.IfcLoader);
await ifcLoader.setup({
  autoSetWasm: false,
  wasm: { absolute: true, path: "https://unpkg.com/web-ifc@0.0.71/" },
});

// Highlighter
const highlighter = components.get(OBF.Highlighter);
highlighter.setup({
  world,
  selectMaterialDefinition: {
    color: new THREE.Color("#bcf124"),
    renderedFaces: 1,
    opacity: 1,
    transparent: false,
  },
});

const [propertiesTable, updatePropertiesTable] = BUIC.tables.itemsData({
  components,
  modelIdMap: {},
});

propertiesTable.preserveStructureOnFilter = true;
propertiesTable.indentationInText = false;

highlighter.events.select.onHighlight.add((modelIdMap) => {
  updatePropertiesTable({ modelIdMap });
});

highlighter.events.select.onClear.add(() =>
  updatePropertiesTable({ modelIdMap: {} }),
);

// Clipper
const clipper = components.get(OBC.Clipper);
viewport.ondblclick = () => {
  if (clipper.enabled) clipper.create(world);
};
window.addEventListener("keydown", (event) => {
  if (event.code === "Delete" || event.code === "Backspace") {
    clipper.delete(world);
  }
});

// Length Measurement
const lengthMeasurer = components.get(OBF.LengthMeasurement);
lengthMeasurer.world = world;
lengthMeasurer.color = new THREE.Color("#6528d7");

lengthMeasurer.list.onItemAdded.add((line) => {
  const center = new THREE.Vector3();
  line.getCenter(center);

  const radius = line.distance() / 3;
  const sphere = new THREE.Sphere(center, radius);
  world.camera.controls.fitToSphere(sphere, true);
});

viewport.addEventListener("dblclick", () => lengthMeasurer.create());

window.addEventListener("keydown", (event) => {
  if (event.code === "Delete" || event.code === "Backspace") {
    lengthMeasurer.delete();
  }
});

// Area Measurement
const areaMeasurer = components.get(OBF.AreaMeasurement);
areaMeasurer.world = world;
areaMeasurer.color = new THREE.Color("#6528d7");

areaMeasurer.list.onItemAdded.add((area) => {
  if (!area.boundingBox) return;
  const sphere = new THREE.Sphere();
  area.boundingBox.getBoundingSphere(sphere);
  world.camera.controls.fitToSphere(sphere, true);
});

viewport.addEventListener("dblclick", () => {
  areaMeasurer.create();
});

window.addEventListener("keydown", (event) => {
  if (event.code === "Enter" || event.code === "NumpadEnter") {
    areaMeasurer.endCreation();
  }
});

// EVENTS ON MODEL LOAD
fragments.list.onItemSet.add(async ({ value: model }) => {
  model.useCamera(world.camera.three);

  model.getClippingPlanesEvent = () =>
    Array.from(world.renderer!.three.clippingPlanes) || [];

  // 🔥 LOS MODELOS INICIAN APAGADOS 🔥
  model.object.visible = false;

  world.scene.three.add(model.object);
  await fragments.core.update(true);
});

// -------------------------
//   MULTI-LOAD IFC MODELS
// -------------------------
async function loadModels() {
  const basePath =
    "https://alcabama-commits.github.io/bim/visorIFC/Models/";

  const models = ["02_GI_BLU_Estructura_CBombas.ifc", "19_ZI_ALL_Estructura_Torre_ModuloA_T1-T2.ifc", "19_ZI_ALL_Estructura_Torre_ModuloA_T3-T4.ifc"];

  for (const file of models) {
    const url = basePath + file;
    console.log("Cargando IFC:", url);
    await fragments.load(url);
  }
}

loadModels();

// -------------------------
//   BCF TOPICS (Temas)
// -------------------------
const bcfTopics = components.get(OBC.BCFTopics);
bcfTopics.setup({
  author: "usuario@visor.com",
  types: new Set([...bcfTopics.config.types, "Information", "Coordination"]),
  statuses: new Set(["Active", "In Progress", "Done", "In Review", "Closed"]),
  users: new Set(["usuario@visor.com"]),
  version: "3",
});

const viewpoints = components.get(OBC.Viewpoints);

// Crear viewpoint automáticamente al crear un tema
bcfTopics.list.onItemSet.add(async ({ value: topic }) => {
  const viewpoint = viewpoints.create(world);
  topic.viewpoints.add(viewpoint.guid);

  topic.comments.onItemSet.add(({ value: comment }) => {
    comment.viewpoint = viewpoint.guid;
  });
});

const exportBCF = async () => {
  const bcf = await bcfTopics.export();
  const bcfFile = new File([bcf], "temas.bcf");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(bcfFile);
  a.download = bcfFile.name;
  a.click();
  URL.revokeObjectURL(a.href);
};

const loadBCF = () => {
  const input = document.createElement("input");
  input.multiple = false;
  input.accept = ".bcf";
  input.type = "file";

  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    const { topics, viewpoints } = await bcfTopics.load(new Uint8Array(buffer));
    console.log("BCF Cargado:", topics, viewpoints);
  });

  input.click();
};

// VIEWPORT LAYOUT
const [viewportSettings] = BUI.Component.create(
  viewportSettingsTemplate,
  { components, world }
);

viewport.append(viewportSettings);

const [viewportGrid] = BUI.Component.create(
  TEMPLATES.viewportGridTemplate,
  { components, world }
);

viewport.append(viewportGrid);

// CONTENT GRID
const viewportCardTemplate = () => BUI.html`
  <div class="dashboard-card" style="padding: 0px;">
    ${viewport}
  </div>
`;

const [contentGrid] = BUI.Component.create(
  TEMPLATES.contentGridTemplate,
  { components, id: CONTENT_GRID_ID, viewportTemplate: viewportCardTemplate }
);

// INITIAL LAYOUT
const setInitialLayout = () => {
  if (window.location.hash) {
    const hash = window.location.hash.slice(1);

    if (Object.keys(contentGrid.layouts).includes(hash)) {
      contentGrid.layout = hash;
    } else {
      contentGrid.layout = "Viewer";
      window.location.hash = "Viewer";
    }
  } else {
    window.location.hash = "Viewer";
    contentGrid.layout = "Viewer";
  }
};
setInitialLayout();

contentGrid.addEventListener("layoutchange", () =>
  (window.location.hash = contentGrid.layout)
);

const contentGridIcons = {
  Viewer: appIcons.MODEL,
};

// ------------------------------
//  ⭐ ADD MODELS PANEL TO SIDEBAR
// ------------------------------

// ← creación del panel
const modelsPanel = BUI.Component.create(
  OBF.ModelsList,
  {
    fragments,
    title: "Models"
  }
);

// Panel de Propiedades
const propertiesPanel = BUI.Component.create(() => {
  const onTextInput = (e: Event) => {
    const input = e.target as BUI.TextInput;
    propertiesTable.queryString = input.value !== "" ? input.value : null;
  };

  const expandTable = (e: Event) => {
    const button = e.target as BUI.Button;
    propertiesTable.expanded = !propertiesTable.expanded;
    button.label = propertiesTable.expanded ? "Colapsar" : "Expandir";
  };

  const copyAsTSV = async () => {
    await navigator.clipboard.writeText(propertiesTable.tsv);
  };

  return BUI.html`
    <bim-panel label="Propiedades">
      <bim-panel-section label="Datos del Elemento">
        <div style="display: flex; gap: 0.5rem;">
          <bim-button @click=${expandTable} label=${propertiesTable.expanded ? "Colapsar" : "Expandir"}></bim-button> 
          <bim-button @click=${copyAsTSV} label="Copiar TSV"></bim-button> 
        </div> 
        <bim-text-input @input=${onTextInput} placeholder="Buscar Propiedad" debounce="250"></bim-text-input>
        ${propertiesTable}
      </bim-panel-section>
    </bim-panel>
  `;
});

// Panel de BCF
const bcfPanel = BUI.Component.create(() => {
  return BUI.html`
    <bim-panel label="Temas BCF">
      <bim-panel-section label="Acciones">
        <bim-button @click=${exportBCF} label="Exportar BCF" icon="ph:export-bold"></bim-button> 
        <bim-button @click=${loadBCF} label="Cargar BCF" icon="ph:folder-open-bold"></bim-button>
      </bim-panel-section>
    </bim-panel>
  `;
});

// APP GRID (SIDEBAR + VIEWPORT)
const app = document.getElementById("app");

// ← Insertamos “Models” como PRIMER elemento del Sidebar
app.elements = {
  sidebar: {
    template: TEMPLATES.gridSidebarTemplate,
    initialState: {
      grid: contentGrid,
      compact: true,
      layoutIcons: contentGridIcons,
      extraItems: [
        {
          id: "models",
          icon: appIcons.MODEL,
          label: "Models",
          component: modelsPanel,
        },
        {
          id: "properties",
          icon: "fluent:info-16-filled",
          label: "Propiedades",
          component: propertiesPanel,
        },
        {
          id: "bcf",
          icon: "ph:chat-teardrop-text-fill",
          label: "BCF",
          component: bcfPanel,
        }
      ],
    },
  },
  contentGrid,
};

contentGrid.addEventListener("layoutchange", () =>
  app.updateComponent.sidebar()
);

// MAIN LAYOUT
app.layouts = {
  App: {
    template: `
      "sidebar contentGrid" 1fr
      /auto 1fr
    `,
  },
};

app.layout = "App";
