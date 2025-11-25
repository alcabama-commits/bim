import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as BUI from "@thatopen/ui";
import * as TEMPLATES from "./ui-templates";
import { appIcons, CONTENT_GRID_ID } from "./globals";
import { viewportSettingsTemplate } from "./ui-templates/buttons/viewport-settings";

BUI.Manager.init();

// Components Setup

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

world.renderer = new OBF.PostproductionRenderer(components, viewport);
world.camera = new OBC.OrthoPerspectiveCamera(components);
world.camera.threePersp.near = 0.01;
world.camera.threePersp.updateProjectionMatrix();
world.camera.controls.restThreshold = 0.05;

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

const aoParameters = {
  radius: 0.25,
  distanceExponent: 1,
  thickness: 1,
  scale: 1,
  samples: 16,
  distanceFallOff: 1,
  screenSpaceRadius: true,
};

const pdParameters = {
  lumaPhi: 10,
  depthPhi: 2,
  normalPhi: 3,
  radius: 4,
  radiusExponent: 1,
  rings: 2,
  samples: 16,
};

aoPass.updateGtaoMaterial(aoParameters);
aoPass.updatePdMaterial(pdParameters);

const fragments = components.get(OBC.FragmentsManager);

// Try sensible default for worker path; we'll attempt several fallbacks when initializing.
// IMPORTANT: in production on GitHub Pages you should copy worker.mjs to /Worker/worker.mjs or use a CDN.
const FRAGMENTS_WORKER_FALLBACKS = [
  "/Worker/worker.mjs",
  "/worker.mjs",
  "/node_modules/@thatopen/fragments/dist/Worker/worker.mjs",
];

// We'll try to init fragments with first available path (best-effort).
async function initFragmentsWorker() {
  for (const candidate of FRAGMENTS_WORKER_FALLBACKS) {
    try {
      // Attempt setup by calling fragments.init and then a lightweight check: fragments.list size (no throw)
      fragments.init(candidate);
      console.log("fragments.init called with:", candidate);
      // give a microtick for worker to initialize; this function won't throw synchronously most times
      return candidate;
    } catch (err) {
      console.warn("fragments.init failed for", candidate, err);
      // try next
    }
  }
  // last resort: call with original node_modules path (may work in dev)
  try {
    fragments.init("/node_modules/@thatopen/fragments/dist/Worker/worker.mjs");
    return "/node_modules/@thatopen/fragments/dist/Worker/worker.mjs";
  } catch (err) {
    console.error("All fragments.init attempts failed. Please ensure worker.mjs is available in public/Worker or use CDN.", err);
    return null;
  }
}

await initFragmentsWorker();

fragments.core.models.materials.list.onItemSet.add(({ value: material }) => {
  const isLod = "isLodMaterial" in material && (material as any).isLodMaterial;
  if (isLod) {
    world.renderer!.postproduction.basePass.isolatedMaterials.push(material);
  }
});

world.camera.projection.onChanged.add(() => {
  for (const [_, model] of fragments.list) {
    model.useCamera(world.camera.three);
  }
});

world.camera.controls.addEventListener("rest", () => {
  fragments.core.update(true);
});

const ifcLoader = components.get(OBC.IfcLoader);
await ifcLoader.setup({
  autoSetWasm: false,
  // CDN fallback that works on GitHub Pages — leave as-is
  wasm: { absolute: true, path: "https://unpkg.com/web-ifc@0.0.71/" },
});

// ---------------------------
//  AQUI: Lista de modelos a cargar (apagados)
// ---------------------------
// We use relative path under your project: /models/<filename>.ifc
const modelsToLoad = [
  "/models/19_ZI_ALL_Estructura_Torre_ModuloA_T1-T2.ifc",
  "/models/19_ZI_ALL_Estructura_Torre_ModuloA_T3-T4.ifc",
];

// Map filename -> loaded fragments model object
const loadedModels: Record<string, any> = {};

// Helper: filename from path
const filenameFromPath = (p: string) => {
  const parts = p.split("/");
  return parts[parts.length - 1];
};

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

// Clipper Setup
const clipper = components.get(OBC.Clipper);
viewport.ondblclick = () => {
  if (clipper.enabled) clipper.create(world);
};

window.addEventListener("keydown", (event) => {
  if (event.code === "Delete" || event.code === "Backspace") {
    clipper.delete(world);
  }
});

// Length Measurement Setup
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

// Area Measurement Setup
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

// Define what happens when a fragments model has been loaded
// ---- MODIFICADO: ahora los modelos arrancan apagados (visible = false)
fragments.list.onItemSet.add(async ({ value: model }) => {
  model.useCamera(world.camera.three);

  model.getClippingPlanesEvent = () => {
    return Array.from(world.renderer!.three.clippingPlanes) || [];
  };

  // Iniciar los modelos apagados
  try {
    if (model.object) {
      model.object.visible = false;
    }
  } catch (e) {
    console.warn("No se pudo setear visibilidad inicial del modelo:", e);
  }

  world.scene.three.add(model.object);
  await fragments.core.update(true);

  // Keep track by filename when available
  try {
    const meta = model.sourceUrl || model.url || (model as any).fileName || null;
    const fname = meta ? filenameFromPath(meta.toString()) : `model_${model.modelID}`;
    loadedModels[fname] = model;
  } catch (e) {
    // ignore
  }
});

// ----------------------
//  ★ CARGA MULTIMODELO (función)
// ----------------------
async function loadModels() {
  const basePath = "/models/";
  for (const filePath of modelsToLoad) {
    const filename = filenameFromPath(filePath);
    // if user passed absolute-like path, use it; otherwise use basePath
    const url = filePath.startsWith("/") ? filePath : basePath + filename;
    console.log("Intentando cargar IFC:", url);

    // HEAD check para visualizar problemas de ruta/404/CORS en la consola
    try {
      const head = await fetch(url, { method: "HEAD" });
      if (!head.ok) {
        console.error(`Archivo no accesible (${head.status}):`, url);
        continue;
      }
    } catch (err) {
      console.error("Error en fetch HEAD:", url, err);
      continue;
    }

    try {
      await fragments.load(url);
      console.log("fragments.load OK:", url);
    } catch (err) {
      console.error("fragments.load ERROR para", url, err);
    }
  }
}

// Viewport Layouts
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

// Content Grid Setup
const viewportCardTemplate = () => BUI.html`
  <div class="dashboard-card" style="padding: 0px;">
    ${viewport}
  </div>
`;

const [contentGrid] = BUI.Component.create<
  BUI.Grid<TEMPLATES.ContentGridLayouts, TEMPLATES.ContentGridElements>,
  TEMPLATES.ContentGridState
>(TEMPLATES.contentGridTemplate, {
  components,
  id: CONTENT_GRID_ID,
  viewportTemplate: viewportCardTemplate,
});

const setInitialLayout = () => {
  if (window.location.hash) {
    const hash = window.location.hash.slice(
      1,
    ) as TEMPLATES.ContentGridLayouts[number];
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

const contentGridIcons: Record<TEMPLATES.ContentGridLayouts[number], string> = {
  Viewer: appIcons.MODEL,
};

// ------------------------------
//  ⭐ ADD MODELS PANEL TO SIDEBAR (custom simple panel)
// ------------------------------
// We'll create a lightweight BUI component that lists the models and provides toggles.
// This avoids relying solely on OBF.ModelsList which may require other wiring.
const createModelsToggleComponent = () => {
  return BUI.html`
    <div style="padding:10px;max-width:220px;color:#fff">
      <div style="font-weight:600;margin-bottom:8px">Modelos</div>
      <div id="models-toggles">
        ${modelsToLoad.map(
          (p) => BUI.html`<label style="display:block;margin-bottom:6px">
            <input type="checkbox" data-file="${filenameFromPath(p)}" />
            <span style="margin-left:8px">${filenameFromPath(p)}</span>
          </label>`,
        )}
      </div>
      <div style="margin-top:8px">
        <button id="models-focus" style="padding:6px 8px;border-radius:6px;border:none;cursor:pointer">Focus seleccionado</button>
      </div>
    </div>
  `;
};

const [modelsToggleComponent] = BUI.Component.create(createModelsToggleComponent);

// Wire events after DOM created
modelsToggleComponent.onAttach?.add(() => {
  const root = (modelsToggleComponent as any).element as HTMLElement;
  if (!root) return;
  const toggles = Array.from(root.querySelectorAll<HTMLInputElement>("#models-toggles input[type=checkbox]"));
  toggles.forEach((ch) => {
    ch.addEventListener("change", async (ev) => {
      const input = ev.currentTarget as HTMLInputElement;
      const fname = input.dataset.file!;
      const model = loadedModels[fname];
      if (!model) {
        // If model not yet loaded, attempt to load now (and keep checked)
        if (input.checked) {
          const url = `/models/${fname}`;
          try {
            console.log("Cargando al vuelo:", url);
            await fragments.load(url);
            // after load, ensure model tracked, set visible
            const m = loadedModels[fname];
            if (m && m.object) {
              m.object.visible = true;
              // fit camera to model
              try {
                const sphere = new THREE.Sphere();
                if (m.object && m.object.geometry) {
                  // best-effort: use bounding sphere of mesh
                  (m.object as any).geometry.computeBoundingSphere?.();
                }
                m.getBoundingSphere?.(sphere);
                world.camera.controls.fitToSphere(sphere, true);
              } catch (e) {}
            }
          } catch (err) {
            console.error("Error cargando modelo a vuelo:", err);
            input.checked = false;
          }
        }
        return;
      }
      // Toggle already-loaded model
      try {
        model.object.visible = input.checked;
        if (input.checked) {
          // fit camera
          try {
            const sphere = new THREE.Sphere();
            model.getBoundingSphere?.(sphere);
            world.camera.controls.fitToSphere(sphere, true);
          } catch (e) {}
        }
      } catch (e) {
        console.warn("No se pudo alternar visibilidad para", fname, e);
      }
    });
  });

  // Focus button: fit to first selected
  const focusBtn = root.querySelector<HTMLButtonElement>("#models-focus");
  focusBtn?.addEventListener("click", () => {
    const selected = Array.from(root.querySelectorAll<HTMLInputElement>("#models-toggles input:checked"));
    if (selected.length === 0) return;
    const first = selected[0].dataset.file!;
    const m = loadedModels[first];
    if (!m) return;
    try {
      const sphere = new THREE.Sphere();
      m.getBoundingSphere?.(sphere);
      world.camera.controls.fitToSphere(sphere, true);
    } catch (e) {
      console.warn("No se pudo hacer focus", e);
    }
  });
});

// App Grid Setup
type AppLayouts = ["App"];

type Sidebar = {
  name: "sidebar";
  state: TEMPLATES.GridSidebarState;
};

type ContentGrid = { name: "contentGrid"; state: TEMPLATES.ContentGridState };

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
      extraItems: [
        // Insert the simple toggles component as the "Models" item in the sidebar
        {
          id: "models",
          icon: appIcons.MODEL,
          label: "Models",
          component: modelsToggleComponent,
        },
      ],
    },
  },
  contentGrid,
};

contentGrid.addEventListener("layoutchange", () =>
  app.updateComponent.sidebar(),
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

// ----------------------
//  Llamar carga de modelos apagados UNA VEZ que la app está lista
// ----------------------
// Defer a microtick to ensure UI mounted
setTimeout(() => {
  loadModels().then(() => {
    console.log("LoadModels finished");
    // After models loaded we ensure toggles are present and reflect state
    try {
      const root = (modelsToggleComponent as any).element as HTMLElement;
      if (root) {
        const toggles = Array.from(root.querySelectorAll<HTMLInputElement>("#models-toggles input[type=checkbox]"));
        toggles.forEach((ch) => {
          const fname = ch.dataset.file!;
          ch.checked = !!loadedModels[fname] && !!loadedModels[fname].object && loadedModels[fname].object.visible === true;
        });
      }
    } catch (e) { /* ignore */ }
  });
}, 200);

