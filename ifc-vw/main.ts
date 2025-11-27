import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import Stats from "stats.js";
import * as OBC from "@thatopen/components";
import * as BUI from "@thatopen/ui";
// NOTA: El tutorial usa "../..". Lo cambiamos a la importación correcta desde node_modules
import * as FRAGS from "@thatopen/fragments";
import * as OBF from "@thatopen/components-front";
import * as BUIC from "@thatopen/ui-obc";

const components = new OBC.Components();

const worlds = components.get(OBC.Worlds);
const world = worlds.create<
  OBC.SimpleScene,
  OBC.OrthoPerspectiveCamera,
  OBF.PostproductionRenderer
>();

world.scene = new OBC.SimpleScene(components);
world.scene.setup();
world.scene.three.background = null;

const viewport = document.getElementById("viewport")!;
world.renderer = new OBF.PostproductionRenderer(components, viewport);
world.camera = new OBC.OrthoPerspectiveCamera(components);
await world.camera.controls.setLookAt(65, 19, -27, 12.6, -5, -1.4);

components.init();

const githubUrl =
  "https://thatopen.github.io/engine_fragment/resources/worker.mjs";
const fetchedUrl = await fetch(githubUrl);
const workerBlob = await fetchedUrl.blob();
const workerFile = new File([workerBlob], "worker.mjs", {
  type: "text/javascript",
});
const workerUrl = URL.createObjectURL(workerFile);
const fragments = components.get(OBC.FragmentsManager);
fragments.init(workerUrl);

world.camera.controls.addEventListener("rest", () =>
  fragments.core.update(true),
);

world.onCameraChanged.add((camera) => {
  for (const [, model] of fragments.list) {
    model.useCamera(camera.three);
  }
  fragments.core.update(true);
  world.renderer?.postproduction.updateCamera();
});

fragments.list.onItemSet.add(({ value: model }) => {
  model.useCamera(world.camera.three);
  world.scene.three.add(model.object);
  fragments.core.update(true);
});

components.get(OBC.Grids).create(world);

// -- 1. SETUP DE HERRAMIENTAS --
// Vamos a instanciar todos los componentes que necesitamos.

// Componente para cargar IFC
const ifcLoader = components.get(OBC.IfcLoader);
await ifcLoader.setup({
  autoSetWasm: false,
  wasm: {
    path: "https://unpkg.com/web-ifc@0.0.72/",
    absolute: true,
  },
});
ifcLoader.onIfcImporterInitialized.add((importer) => {
  console.log("IFC Importer Classes:", importer.classes);
});

// Componentes para Medición
const measurer = components.get(OBF.LengthMeasurement);
measurer.world = world;
measurer.color = new THREE.Color("#494cb6");
measurer.snappings = [FRAGS.SnappingClass.POINT];

// Componentes para Planos de Corte Estilizados (ClipStyler)
const clipStyler = components.get(OBF.ClipStyler);
clipStyler.world = world;

const clipper = components.get(OBC.Clipper);

const finder = components.get(OBC.ItemsFinder);
const classifier = components.get(OBC.Classifier);
const views = components.get(OBC.Views);

// -- 2. CONFIGURACIÓN DEL CLIPSTYLER --
// Recreamos los estilos y clasificaciones que teníamos.

clipStyler.styles.set("Blue", {
  linesMaterial: new LineMaterial({ color: "black", linewidth: 2 }),
  fillsMaterial: new THREE.MeshBasicMaterial({ color: "lightblue", side: 2 }),
});

clipStyler.styles.set("Red", {
  linesMaterial: new LineMaterial({ color: "black", linewidth: 3 }),
  fillsMaterial: new THREE.MeshBasicMaterial({ color: "salmon", side: 2 }),
});

clipStyler.styles.set("Green", {
  linesMaterial: new LineMaterial({ color: "black", linewidth: 2 }),
  fillsMaterial: new THREE.MeshBasicMaterial({ color: "lightgreen", side: 2 }),
});

clipStyler.styles.set("Black", {
  linesMaterial: new LineMaterial({ color: "black", linewidth: 2 }),
  fillsMaterial: new THREE.MeshBasicMaterial({ color: "black", side: 2 }),
});

clipStyler.styles.set("BlackFill", {
  fillsMaterial: new THREE.MeshBasicMaterial({ color: "black", side: 2 }),
});

finder.create("Walls", [{ categories: [/WALL/] }]);
finder.create("Slabs", [{ categories: [/SLAB/] }]);
finder.create("Columns", [{ categories: [/COLUMN/] }]);
finder.create("Doors", [{ categories: [/DOOR/] }]);
finder.create("Curtains", [{ categories: [/PLATE/, /MEMBER/] }]);
finder.create("Windows", [{ categories: [/WINDOW/] }]);

const classificationName = "ClipperGroups";
classifier.setGroupQuery(classificationName, "Walls", { name: "Walls" });
classifier.setGroupQuery(classificationName, "Slabs", { name: "Slabs" });
classifier.setGroupQuery(classificationName, "Columns", { name: "Columns" });
classifier.setGroupQuery(classificationName, "Doors", { name: "Doors" });
classifier.setGroupQuery(classificationName, "Curtains", { name: "Curtains" });
classifier.setGroupQuery(classificationName, "Windows", { name: "Windows" });

const casters = components.get(OBC.Raycasters);
casters.get(world);

clipper.list.onItemSet.add(({ key }) => {
  clipStyler.createFromClipping(key, {
    items: { All: { style: "BlackFill" } },
  });
});

// Componente para seleccionar y resaltar elementos
const highlighter = components.get(OBF.Highlighter);
highlighter.setup({ world });

// Componente para gestionar la visibilidad
const hider = components.get(OBC.Hider);

// -- 3. GESTIÓN DE HERRAMIENTA ACTIVA --
// Esta es la parte clave para resolver los conflictos.

type Tool = "Loader" | "Clipper" | "Measurer" | "Properties" | "Visibility";
let activeTool: Tool = "Loader";

// Desactivamos ambas herramientas al inicio. Se activarán desde la UI.
clipper.enabled = false;
measurer.enabled = false;

const switchTool = (tool: Tool) => {
  activeTool = tool;
  clipper.enabled = tool === "Clipper";
  measurer.enabled = tool === "Measurer";
  highlighter.enabled = tool === "Properties";
  hider.enabled = tool === "Visibility";
  // Ocultamos las vistas de sección si no estamos en modo Clipper
};

// El doble clic ahora depende de la herramienta activa
viewport.ondblclick = () => {
  if (activeTool === "Clipper") {
    clipper.create(world);
  } else if (activeTool === "Measurer") {
    measurer.create();
  }
};

// La tecla Suprimir ahora depende de la herramienta activa
window.onkeydown = (event) => {
  if (event.code === "Delete" || event.code === "Backspace") {
    if (activeTool === "Clipper") {
      clipper.delete(world);
    } else if (activeTool === "Measurer") {
      measurer.delete();
    }
  }
};

// -- 4. FUNCIONES AUXILIARES (la mayoría ya las teníamos) --

// Funciones para el medidor
measurer.list.onItemAdded.add((line) => {
  const center = new THREE.Vector3();
  line.getCenter(center);
  const radius = line.distance() / 3;
  const sphere = new THREE.Sphere(center, radius);
  world.camera.controls.fitToSphere(sphere, true);
});

const displayRectangleDimensions = () => {
  for (const dimension of measurer.lines) {
    dimension.displayRectangularDimensions();
  }
};

const invertRectangleDimensions = () => {
  for (const dimension of measurer.lines) {
    dimension.invertRectangularDimensions();
  }
};

const displayProjectionDimensions = () => {
  for (const dimension of measurer.lines) {
    dimension.displayProjectionDimensions();
  }
};

const removeComplementaryDimensions = () => {
  for (const dimension of measurer.lines) {
    dimension.rectangleDimensions.clear();
    dimension.projectionDimensions.clear();
  }
};

const deleteDimensions = () => {
  measurer.list.clear();
};

const getAllValues = () => {
  const lengths: number[] = [];
  for (const line of measurer.list) {
    lengths.push(line.value);
  }
  return lengths;
};

const loadIfc = async (path: string) => {
  const file = await fetch(path);
  const data = await file.arrayBuffer();
  const buffer = new Uint8Array(data);
  await ifcLoader.load(buffer, false, "example", {
    processData: {
      progressCallback: (progress) => console.log(progress),
    },
  });
};

const loadFragments = async () => {
  const fragPaths = [
    "https://thatopen.github.io/engine_components/resources/frags/school_arq.frag",
    "https://thatopen.github.io/engine_components/resources/frags/school_str.frag",
  ];
  await Promise.all(
    fragPaths.map(async (path) => {
      const modelId = path.split("/").pop()?.split(".").shift();
      if (!modelId) return null;
      const file = await fetch(path);
      const buffer = await file.arrayBuffer();
      return fragments.core.load(buffer, { modelId });
    }),
  );
};

const downloadFragments = async () => {
  for (const [, model] of fragments.list) {
    const fragsBuffer = await model.getBuffer(false);
    const file = new File([fragsBuffer], `${model.modelId}.frag`);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(file);
    link.download = file.name;
    link.click();
    URL.revokeObjectURL(link.href);
  }
};

const deleteAllModels = () => {
  fragments.list.clear();
};

const isolateByCategory = async (categories: string[]) => {
  const modelIdMap: OBC.ModelIdMap = {};
  const categoriesRegex = categories.map((cat) => new RegExp(`^${cat}$`));
  for (const [, model] of fragments.list) {
    const items = await model.getItemsOfCategories(categoriesRegex);
    const localIds = Object.values(items).flat();
    modelIdMap[model.modelId] = new Set(localIds);
  }
  await hider.isolate(modelIdMap);
};

const hideByCategory = async (categories: string[]) => {
  const modelIdMap: OBC.ModelIdMap = {};
  const categoriesRegex = categories.map((cat) => new RegExp(`^${cat}$`));
  for (const [, model] of fragments.list) {
    const items = await model.getItemsOfCategories(categoriesRegex);
    const localIds = Object.values(items).flat();
    modelIdMap[model.modelId] = new Set(localIds);
  }
  await hider.set(false, modelIdMap);
};

const resetVisibility = async () => {
  await hider.set(true);
};


// -- 5. INTERFAZ DE USUARIO UNIFICADA --

BUI.Manager.init();

// UI para la tabla de Estilos del ClipStyler
type StylesTableData = { Name: string; LineWidth: number; LineColor: string; FillColor: string; };
const stylesTable = BUI.Component.create(() => {
  const onCreated = (_table?: Element) => {
    if (!(_table instanceof BUI.Table)) return;
    const table = _table as BUI.Table<StylesTableData>;
    table.dataTransform = {
      LineWidth: (value, rowData) => {
        const name = rowData.Name!;
        const style = clipStyler.styles.get(name);
        if (!style?.linesMaterial) return value;
        return BUI.html`<bim-number-input .value=${value} min=0.5 max=10 slider step=0.05 @change=${({ target }: { target: BUI.NumberInput }) => { style.linesMaterial!.linewidth = target.value; }}></bim-number-input>`;
      },
      LineColor: (value, rowData) => {
        const name = rowData.Name!;
        const style = clipStyler.styles.get(name);
        if (!style?.linesMaterial) return value;
        return BUI.html`<bim-color-input .color=${value} @input=${({ target }: { target: BUI.ColorInput }) => { style.linesMaterial!.color = new THREE.Color(target.color); }}></bim-color-input>`;
      },
      FillColor: (value, rowData) => {
        const name = rowData.Name!;
        const style = clipStyler.styles.get(name);
        if (!style?.fillsMaterial) return value;
        return BUI.html`<bim-color-input .color=${value} @input=${({ target }: { target: BUI.ColorInput }) => { (style.fillsMaterial as THREE.MeshBasicMaterial).color = new THREE.Color(target.color); }}></bim-color-input>`;
      },
    };
    table.data = Array.from(clipStyler.styles.entries()).map(([name, style]) => {
      const row: BUI.TableGroupData<StylesTableData> = { data: { Name: name } };
      if (style.linesMaterial) {
        row.data.LineWidth = style.linesMaterial.linewidth;
        row.data.LineColor = `#${style.linesMaterial.color.getHexString()}`;
      }
      if (style.fillsMaterial) {
        row.data.FillColor = `#${(style.fillsMaterial as THREE.MeshBasicMaterial).color.getHexString()}`;
      }
      return row;
    });
  };
  return BUI.html`<bim-table no-indentation ${BUI.ref(onCreated)}></bim-table>`;
});

// UI para la tabla de Vistas del ClipStyler
type ViewsTableData = { Name: string; Actions: string; };
const viewsList = BUI.Component.create(() => {
  const onCreated = (e?: Element) => {
    if (!e) return;
    const table = e as BUI.Table<ViewsTableData>;
    table.data = [...views.list.keys()].map((key) => ({ data: { Name: key, Actions: "" } }));
  };
  return BUI.html`<bim-table ${BUI.ref(onCreated)}></bim-table>`;
});
viewsList.headersHidden = true;
viewsList.noIndentation = true;
viewsList.columns = ["Name", { name: "Actions", width: "auto" }];
viewsList.dataTransform = {
  Actions: (_, rowData) => {
    const { Name } = rowData;
    if (!Name) return _;
    return BUI.html`
      <bim-button label-hidden icon="solar:cursor-bold" label="Open" @click=${() => views.open(Name)}></bim-button>
      <bim-button label-hidden icon="material-symbols:close" label="Close" @click=${() => views.close(Name)}></bim-button>
    `;
  },
};

const measurerPanel = BUI.Component.create(() => {
  const onLogValues = () => console.log(getAllValues());
  return BUI.html`
    <bim-panel-section label="Measurer">
      <bim-checkbox checked label="Enabled" @change="${({ target }: { target: BUI.Checkbox }) => { measurer.enabled = target.value; }}"></bim-checkbox>
      <bim-checkbox checked label="Measurements Visible" @change="${({ target }: { target: BUI.Checkbox }) => { measurer.visible = target.value; }}"></bim-checkbox>
      <bim-color-input label="Color" color=#${measurer.linesMaterial.color.getHexString()} @input="${({ target }: { target: BUI.ColorInput }) => { measurer.color = new THREE.Color(target.color); }}"></bim-color-input>
      <bim-dropdown label="Measure Mode" required @change="${({ target }: { target: BUI.Dropdown }) => {
          const [mode] = target.value;
          measurer.mode = mode;
          measurer.snappings = mode === "edge" ? [FRAGS.SnappingClass.LINE] : [FRAGS.SnappingClass.POINT];
        }}">
        ${measurer.modes.map((mode) => BUI.html`<bim-option label=${mode} value=${mode} ?checked=${mode === measurer.mode}></bim-option>`)}
      </bim-dropdown>
      <bim-dropdown label="Units" required @change="${({ target }: { target: BUI.Dropdown }) => { measurer.units = target.value[0]; }}">
        ${measurer.unitsList.map((unit) => BUI.html`<bim-option label=${unit} value=${unit} ?checked=${unit === measurer.units}></bim-option>`)}
      </bim-dropdown>
      <bim-dropdown label="Precision" required @change="${({ target }: { target: BUI.Dropdown }) => { measurer.rounding = target.value[0]; }}">
        <bim-option label="0" value=0></bim-option>
        <bim-option label="1" value=1></bim-option>
        <bim-option label="2" value=2 checked></bim-option>
        <bim-option label="3" value=3></bim-option>
        <bim-option label="4" value=4></bim-option>
        <bim-option label="5" value=5></bim-option>
      </bim-dropdown>
      <bim-button label="Display Rectangle Dimensions" @click=${displayRectangleDimensions}></bim-button>
      <bim-button label="Invert Rectangle Dimensions" @click=${invertRectangleDimensions}></bim-button>
      <bim-button label="Display Projection Dimensions" @click=${displayProjectionDimensions}></bim-button>
      <bim-button label="Remove Complementary Dimensions" @click=${removeComplementaryDimensions}></bim-button>
      <bim-button label="Delete all" @click=${() => deleteDimensions()}></bim-button>
      <bim-button label="Log Values" @click=${onLogValues}></bim-button>
    </bim-panel-section>
  `;
});

const clipperPanel = BUI.Component.create(() => {
  return BUI.html`
    <bim-panel-section label="Styles">
      <bim-label style="white-space: normal;">Manage clipping styles. Changes are applied in real-time to open views.</bim-label>
      ${stylesTable}
    </bim-panel-section>
    <bim-panel-section label="Views">
      <bim-label style="white-space: normal;">Manage section and plan views.</bim-label>
      ${viewsList}
    </bim-panel-section>
  `;
});

// Panel de Modelos usando componentes pre-construidos de BUIC
const modelsPanel = BUI.Component.create(() => {
  const [loadFragBtn] = BUIC.buttons.loadFrag({ components });
  const [loadIfcBtn] = BUIC.buttons.loadIfc({ components });

  const [modelsList] = BUIC.tables.modelsList({
    components,
    metaDataTags: ["schema"],
    actions: ["download"],
  });

  return BUI.html`
    <bim-panel-section label="Import">
      ${loadIfcBtn}
      ${loadFragBtn}
    </bim-panel-section>
    <bim-panel-section icon="mage:box-3d-fill" label="Loaded Models">
      ${modelsList}
    </bim-panel-section>
  `;
});

// Panel para las propiedades de los elementos
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

const propertiesPanel = BUI.Component.create(() => {
  const onTextInput = (e: Event) => {
    const input = e.target as BUI.TextInput;
    propertiesTable.queryString = input.value !== "" ? input.value : null;
  };
  const expandTable = (e: Event) => {
    const button = e.target as BUI.Button;
    propertiesTable.expanded = !propertiesTable.expanded;
    button.label = propertiesTable.expanded ? "Collapse" : "Expand";
  };
  const copyAsTSV = async () => {
    await navigator.clipboard.writeText(propertiesTable.tsv);
  };
  return BUI.html`
    <bim-panel-section label="Element Properties">
      <div style="display: flex; gap: 0.5rem;">
        <bim-button @click=${expandTable} label=${propertiesTable.expanded ? "Collapse" : "Expand"}></bim-button> 
        <bim-button @click=${copyAsTSV} label="Copy as TSV"></bim-button> 
      </div> 
      <bim-text-input @input=${onTextInput} placeholder="Search Property" debounce="250"></bim-text-input>
      ${propertiesTable}
    </bim-panel-section>
  `;
});

const visibilityPanel = BUI.Component.create(() => {
  const categoriesDropdownTemplate = () => {
    const onCreated = async (e?: Element) => {
      if (!e) return;
      const dropdown = e as BUI.Dropdown;
      const modelCategories = new Set<string>();
      for (const [, model] of fragments.list) {
        const categories = await model.getItemsWithGeometryCategories();
        for (const category of categories) {
          if (!category) continue;
          modelCategories.add(category);
        }
      }
      for (const category of modelCategories) {
        const option = BUI.Component.create(() => BUI.html`<bim-option label=${category}></bim-option>`);
        dropdown.append(option);
      }
    };
    return BUI.html`<bim-dropdown multiple ${BUI.ref(onCreated)}></bim-dropdown>`;
  };

  const categoriesDropdownA = BUI.Component.create<BUI.Dropdown>(categoriesDropdownTemplate);
  const categoriesDropdownB = BUI.Component.create<BUI.Dropdown>(categoriesDropdownTemplate);

  const onIsolateCategory = async ({ target }: { target: BUI.Button }) => {
    if (!categoriesDropdownA) return;
    const categories = categoriesDropdownA.value;
    if (categories.length === 0) return;
    target.loading = true;
    await isolateByCategory(categories);
    target.loading = false;
  };

  const onHideCategory = async ({ target }: { target: BUI.Button }) => {
    if (!categoriesDropdownB) return;
    const categories = categoriesDropdownB.value;
    if (categories.length === 0) return;
    target.loading = true;
    await hideByCategory(categories);
    target.loading = false;
  };

  return BUI.html`
    <bim-panel-section label="Visibility">
      <bim-button label="Reset Visibility" @click=${resetVisibility}></bim-button>
      <bim-label>Isolate by Category</bim-label>
      ${categoriesDropdownA}
      <bim-button label="Isolate" @click=${onIsolateCategory}></bim-button>
      <bim-label>Hide by Category</bim-label>
      ${categoriesDropdownB}
      <bim-button label="Hide" @click=${onHideCategory}></bim-button>
    </bim-panel-section>
  `;
});

const [mainPanel, updateMainPanel] = BUI.Component.create<BUI.Panel, { activeTool: Tool }>(
  (state) => {
    let panel: BUI.TemplateResult;
    if (state.activeTool === "Clipper") panel = clipperPanel;
    else if (state.activeTool === "Measurer") panel = measurerPanel;
    else if (state.activeTool === "Properties") panel = propertiesPanel;
    else if (state.activeTool === "Visibility") panel = visibilityPanel;
    else panel = modelsPanel;
    return BUI.html`<bim-panel label="BIM Viewer">${panel}</bim-panel>`;
  },
  [{ activeTool }],
);

const [mainToolbar] = BUI.Component.create<BUI.Toolbar, { activeTool: Tool }>(
  (state) => {
    return BUI.html`
      <bim-toolbar>
        <bim-button @click=${() => { switchTool("Loader"); updateMainPanel({ activeTool: "Loader" }); }} label="Models" icon="ph:upload-fill" ?active=${state.activeTool === "Loader"}></bim-button>
        <bim-button @click=${() => { switchTool("Clipper"); updateMainPanel({ activeTool: "Clipper" }); }} label="Clipper" icon="ph:selection-slash-fill" ?active=${state.activeTool === "Clipper"}></bim-button>
        <bim-button @click=${() => { switchTool("Measurer"); updateMainPanel({ activeTool: "Measurer" }); }} label="Measurer" icon="bx:ruler" ?active=${state.activeTool === "Measurer"}></bim-button>
        <bim-button @click=${() => { switchTool("Properties"); updateMainPanel({ activeTool: "Properties" }); }} label="Properties" icon="ph:text-t-bold" ?active=${state.activeTool === "Properties"}></bim-button>
        <bim-button @click=${() => { switchTool("Visibility"); updateMainPanel({ activeTool: "Visibility" }); }} label="Visibility" icon="ph:eye-slash-bold" ?active=${state.activeTool === "Visibility"}></bim-button>
      </bim-toolbar>
    `;
  },
  [{ activeTool }],
);

const sidebar = document.getElementById("sidebar")!;
sidebar.append(mainPanel);

const toolbarsContainer = document.querySelector("bim-toolbars-container")!;
toolbarsContainer.append(mainToolbar);

// Suscribimos la actualización del panel al evento de carga de modelos
const updateModelsPanel = () => updateMainPanel({ activeTool: "Loader" });
fragments.list.onItemSet.add(updateModelsPanel);
fragments.list.onItemRemoved.add(updateModelsPanel);

switchTool("Loader");

const stats = new Stats();
stats.showPanel(2);
viewport.append(stats.dom);
stats.dom.style.left = "0px";
stats.dom.style.zIndex = "unset";
world.renderer.onBeforeUpdate.add(() => stats.begin());
world.renderer.onAfterUpdate.add(() => stats.end());
const [mainPanel, updateMainPanel] = BUI.Component.create<BUI.Panel, { activeTool: Tool }>(
  (state) => {
    let panel: BUI.TemplateResult;
    if (state.activeTool === "Clipper") panel = clipperPanel;
    else if (state.activeTool === "Measurer") panel = measurerPanel;
    else panel = modelsPanel;
    return BUI.html`<bim-panel label="BIM Viewer">${panel}</bim-panel>`;
  },
  [{ activeTool }],
);

const [mainToolbar] = BUI.Component.create<BUI.Toolbar, { activeTool: Tool }>(
  (state) => {
    return BUI.html`
      <bim-toolbar>
        <bim-button @click=${() => { switchTool("Loader"); updateMainPanel({ activeTool: "Loader" }); }} label="Models" icon="ph:upload-fill" ?active=${state.activeTool === "Loader"}></bim-button>
        <bim-button @click=${() => { switchTool("Clipper"); updateMainPanel({ activeTool: "Clipper" }); }} label="Clipper" icon="ph:selection-slash-fill" ?active=${state.activeTool === "Clipper"}></bim-button>
        <bim-button @click=${() => { switchTool("Measurer"); updateMainPanel({ activeTool: "Measurer" }); }} label="Measurer" icon="bx:ruler" ?active=${state.activeTool === "Measurer"}></bim-button>
      </bim-toolbar>
    `;
  },
  [{ activeTool }],
);

const sidebar = document.getElementById("sidebar")!;
sidebar.append(mainPanel);

const toolbarsContainer = document.querySelector("bim-toolbars-container")!;
toolbarsContainer.append(mainToolbar);

// Suscribimos la actualización del panel al evento de carga de modelos
const updateModelsPanel = () => updateMainPanel({ activeTool: "Loader" });
fragments.list.onItemSet.add(updateModelsPanel);
fragments.list.onItemRemoved.add(updateModelsPanel);

switchTool("Loader");

const stats = new Stats();
stats.showPanel(2);
viewport.append(stats.dom);
stats.dom.style.left = "0px";
stats.dom.style.zIndex = "unset";
world.renderer.onBeforeUpdate.add(() => stats.begin());
world.renderer.onAfterUpdate.add(() => stats.end());
