import * as BUI from "@thatopen/ui";
import * as CUI from "@thatopen/ui-obc";
import * as OBC from "@thatopen/components";
import { appIcons } from "../../globals";

export interface ModelsPanelState {
  components: OBC.Components;
}

export const modelsPanelTemplate: BUI.StatefullComponent<ModelsPanelState> = (
  state,
) => {
  const { components } = state;

  const ifcLoader = components.get(OBC.IfcLoader);
  const fragments = components.get(OBC.FragmentsManager);
  const classifier = components.get(OBC.Classifier);
  const hider = components.get(OBC.Hider);

  const [modelsList] = CUI.tables.modelsList({
    components,
    actions: { download: false },
  });

  const onAddIfcModel = async ({ target }: { target: BUI.Button }) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = false;
    input.accept = ".ifc";

    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      target.loading = true;
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      await ifcLoader.load(bytes, true, file.name.replace(".ifc", ""));
      target.loading = false;
      BUI.ContextMenu.removeMenus();
    });

    input.addEventListener("cancel", () => (target.loading = false));

    input.click();
  };

  const onAddFragmentsModel = async ({ target }: { target: BUI.Button }) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = false;
    input.accept = ".frag";

    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      target.loading = true;
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      await fragments.core.load(bytes, {
        modelId: file.name.replace(".frag", ""),
      });
      target.loading = false;
      BUI.ContextMenu.removeMenus();
    });

    input.addEventListener("cancel", () => (target.loading = false));

    input.click();
  };

  const onSearch = (e: Event) => {
    const input = e.target as BUI.TextInput;
    modelsList.queryString = input.value;
  };

  // --- Classification Logic ---
  const classificationList = document.createElement("div");
  classificationList.style.display = "flex";
  classificationList.style.flexDirection = "column";
  classificationList.style.gap = "0.25rem";
  classificationList.style.marginTop = "0.5rem";

  const updateClassificationUI = () => {
    classificationList.innerHTML = "";
    const systems = classifier.list;
    if (!systems.entities) {
      classificationList.innerHTML = "<bim-label>No classification data available</bim-label>";
      return;
    }
    
    const entities = systems.entities;

    for (const [type, fragmentsMap] of Object.entries(entities)) {
      let count = 0;
      for (const id in fragmentsMap) {
          count += fragmentsMap[id].size;
      }
      
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.justifyContent = "space-between";
      row.style.padding = "0.25rem 0.5rem";
      row.style.borderRadius = "0.25rem";
      
      const label = document.createElement("span");
      label.textContent = `${type} (${count})`;
      label.style.fontSize = "0.8rem";
      label.style.color = "var(--bim-ui_text-main)";
      
      const checkbox = document.createElement("bim-checkbox");
      checkbox.checked = true;
      // @ts-ignore
      checkbox.addEventListener("change", (e: any) => {
           const visible = e.target.checked;
           hider.set(visible, fragmentsMap);
      });

      row.appendChild(label);
      row.appendChild(checkbox);
      classificationList.appendChild(row);
    }
  };

  fragments.list.onItemSet.add(async ({ value: model }) => {
      await classifier.byEntity(model);
      updateClassificationUI();
  });

  // --- Tabs Logic ---
  const onTabChange = (tab: string) => {
    const modelsBtn = document.getElementById("btn-tab-models");
    const classBtn = document.getElementById("btn-tab-classification");
    const modelsDiv = document.getElementById("content-models");
    const classDiv = document.getElementById("content-classification");

    if(modelsBtn && classBtn && modelsDiv && classDiv) {
        if (tab === "models") {
            modelsBtn.setAttribute("active", "");
            classBtn.removeAttribute("active");
            modelsDiv.style.display = "flex";
            classDiv.style.display = "none";
        } else {
            modelsBtn.removeAttribute("active");
            classBtn.setAttribute("active", "");
            modelsDiv.style.display = "none";
            classDiv.style.display = "flex";
        }
    }
  };

  return BUI.html`
    <bim-panel-section fixed icon=${appIcons.LAYOUT} label="Project Explorer">
      
      <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem; justify-content: center;">
        <bim-button id="btn-tab-models" label="Models" icon=${appIcons.MODEL} @click=${() => onTabChange('models')} active style="flex: 1;"></bim-button>
        <bim-button id="btn-tab-classification" label="Classes" icon=${appIcons.TAG} @click=${() => onTabChange('classification')} style="flex: 1;"></bim-button>
      </div>

      <div id="content-models" style="display: flex; flex-direction: column; gap: 0.5rem;">
          <div style="display: flex; gap: 0.5rem;">
            <bim-text-input @input=${onSearch} vertical placeholder="Search..." debounce="200"></bim-text-input>
            <bim-button style="flex: 0;" icon=${appIcons.ADD}>
              <bim-context-menu style="gap: 0.25rem;">
                <bim-button label="IFC" @click=${onAddIfcModel}></bim-button>
                <bim-button label="Fragments" @click=${onAddFragmentsModel}></bim-button>
              </bim-context-menu> 
            </bim-button>
          </div>
          ${modelsList}
      </div>

      <div id="content-classification" style="display: none; flex-direction: column; gap: 0.5rem;">
        <bim-label>Classification by Entity</bim-label>
        ${classificationList}
      </div>

    </bim-panel-section> 
  `;
};
