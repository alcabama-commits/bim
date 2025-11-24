import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as BUI from "@thatopen/ui";
import * as TEMPLATES from "./ui-templates";
import { appIcons, CONTENT_GRID_ID } from "./globals";
import { viewportSettingsTemplate } from "./ui-templates/buttons/viewport-settings";

BUI.Manager.init();

// ----------------------------------------------------
// Components Setup
// ----------------------------------------------------

const components = new OBC.Components();
const worlds = components.get(OBC.Worlds);

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

// Renderer & Camera
world.renderer = new OBF.PostproductionRenderer(components, viewport);
world.camera = new OBC.OrthoPerspectiveCamera(components);
world.camera.threePersp.near = 0.01;
world.camera.threePersp.updateProjectionMatrix();
world.camera.controls.restThreshold = 0.05;

// Grid
const worldGrid = components.get(OBC.Grids).create(world);
worldGrid.material.uniforms.uColor.value = new THREE.Color(0x494b50);
worldGrid.material.uniforms.uSize1.value = 2;
worldGrid.material.uniforms.uSize2.value = 8;

// Resize logic
const resizeWorld = () => {
  world.renderer?.resize();
  world.camera.updateAspect();
};

viewport.addEventListener("resize", resizeWorld);

// RESIZE FIX PARA PRODUCCIÓN (GitHub Pages)
window.addEventListener("resize", () => {
  world.renderer?.resize();
  world.camera.updateAspect();
});

world.dynamicAnchor = false;

// Init Components
components.init();

// Raycaster
components.get(OBC.Raycasters).get(world);

// Postproduction Setup
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

// ----------------------------------------------------
// Fragments Manager
// ----------------------------------------------------

const fragments = components.get(OBC.FragmentsManager);

// ⚠️ RUTA CORRECTA PARA PRODUCCIÓN (GitHub Pages)
// (la versión local rompe todo porque no existen los node_modules)
fragments.init(
  "https://unpkg.com/@thatopen/fragments/dist/Worker/worker.mjs"
);

// Material isolation
fragments.core.models.materials.list.onItemSet.add(({ value: material }) => {
  const isLod =
    "isLodMaterial" in material && (material as any).isLodMaterial;
  if (isLod) {
    world.renderer!.postproduction.basePass.isolatedMaterials.push(material);
  }
});

// Update models when projection changes
world.camera.projection.onChanged.add(() => {
  for (const [_, model] of fragments.list) {
    model.useCamera(world.camera.three);
  }
});

world.camera.controls.addEventListener("rest", () => {
  fragments.core.update(true);
});

// ----------------------------------------------------
// IFC Loader
// ----------------------------------------------------

const ifcLoader = components.get(OBC.IfcLoader);

await ifcLoader.setup({
  autoSetWasm: false,
  wasm: {
    absolute: true,
    path: "https://unpkg.com/web-ifc@0.0.71/",
  },
});

// ----------------------------------------------------
// Highlighter
// ----------------------------------------------------

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

// ----------------------------------------------------
// Clipper
// ----------------------------------------------------

const clipper = components.get(OBC.Clipper);

viewport.ondblclick = () => {
  if (clipper.enabled) clipper.create(world);
};

window.addEventListener("keydown", (event) => {
  if (event.code === "Delete" || event.code === "Backspace") {
    clipper.delete(world);
  }
});

// ----------------------------------------------------
// Length Measurement
// ----------------------------------------------------

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

// ----------------------------------------------------
// Area Measurement
// ----------------------------------------------------

const areaMeasurer = components.get(OBF.AreaMeasurement);

areaMeasurer.world = world;
areaMeasurer.color = new THREE.Color("#6528d7");

areaMeasurer.list.onItemAdded.add((area) => {
  if (!area.boundingBox) return;
  const sphere = new THREE.Sphere();
  area.boundingBox.getBoundingSphere(sphere);
  world.camera.controls.fitToSphere(sphere, true);
});

viewport.addEventListener("dblclick", () => areaMeasurer.create());

window.addEventListener("keydown", (event) => {
  if (event.code === "Enter" || event.code === "NumpadEnter") {
    areaMeasurer.endCreation();
  }
});

// ----------------------------------------------------
// When a fragments model finishes loading
// ----------------------------------------------------

fragments.list.onItemSet.add(async ({ value: model }) => {
  model.useCamera(world.camera.three);
  model.getClippingPlanesEvent = () =>
    Array.from(world.renderer!.three.clippingPlanes) || [];

  world.scene.three.add(model.object);
  await fragments.core.update(true);
});

// ----------------------------------------------------
// Viewport UI (Settings, Grids, etc.)
// ----------------------------------------------------

const [viewportSettings] = BUI.Component.create(viewportSettingsTemplate, {
  components,
  world,
});
viewport.append(viewportSettings);

const [viewportGrid] = BUI.Component.create(TEMPLATES.viewportGridTemplate, {
  components,
  world,
});
viewport.append(viewportGrid);

// ----------------------------------------------------
// Content Grid
// ----------------------------------------------------

const viewportCardTemplate = () => BUI.html`
  <div class="dashboard-card" style="padding: 0px;">
    ${viewport}
  </div>
`;

const [contentGrid] = BUI.Component.create(
  TEMPLATES.contentGridTemplate,
  {
    components,
    id: CONTENT_GRID_ID,
    viewportTemplate: viewportCardTemplate,
  }
);

const setInitialLayout = () => {
  if (window.location.hash) {
    const hash = window.location.hash.slice(1) as any;
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

contentGrid.addEventListener("layoutchange", () => {
  window.location.hash = contentGrid.layout as string;
});

const contentGridIcons = {
  Viewer: appIcons.MODEL,
};

// ----------------------------------------------------
// App Grid
// ----------------------------------------------------

type AppLayouts = ["App"];

type Sidebar = {
  name: "sidebar";
  state: TEMPLATES.GridSidebarState;
};

type ContentGrid = {
  name: "contentGrid";
  state: TEMPLATES.ContentGridState;
};

type AppGridElements = [Sidebar, ContentGrid];

const app = document.getElementById("app") as BUI.Grid<
  AppLayouts,
  AppGridElements
>;

app.elements = {
  sidebar: {
    template: TEMPLATES.gridSidebarTemplate,
    initialState: {
      grid: contentGrid,
      compact: true,
      layoutIcons: contentGridIcons,
    },
  },
  contentGrid,
};

contentGrid.addEventListener("layoutchange", () =>
  app.updateComponent.sidebar()
);

app.layouts = {
  App: {
    template: `
      "sidebar contentGrid" 1fr
      /auto 1fr
    `,
  },
};

app.layout = "App";
