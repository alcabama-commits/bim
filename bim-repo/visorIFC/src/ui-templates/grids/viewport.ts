import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as BUI from "@thatopen/ui";
import * as THREE from "three";
import { ViewerToolbarState, viewerToolbarTemplate } from "..";
import { appIcons } from "../../globals";

type BottomToolbar = { name: "bottomToolbar"; state: ViewerToolbarState };
type LeftToolbar = { name: "leftToolbar"; state: {} };

type ViewportGridElements = [BottomToolbar, LeftToolbar];

type ViewportGridLayouts = ["main"];

interface ViewportGridState {
  components: OBC.Components;
  world: OBC.World;
}

export const viewportGridTemplate: BUI.StatefullComponent<ViewportGridState> = (
  state,
) => {
  const { components, world } = state;

  const leftToolbarTemplate: BUI.StatefullComponent = (_: {}, update) => {
    const highlighter = components.get(OBF.Highlighter);
    const lengthMeasurer = components.get(OBF.LengthMeasurement);
    const areaMeasurer = components.get(OBF.AreaMeasurement);
    const clipper = components.get(OBC.Clipper);

    const areMeasurementsEnabled =
      lengthMeasurer.enabled || areaMeasurer.enabled;

    const disableAll = (exceptions?: ("clipper" | "length" | "area")[]) => {
      BUI.ContextMenu.removeMenus();
      highlighter.clear("select");
      highlighter.enabled = false;
      if (!exceptions?.includes("length")) lengthMeasurer.enabled = false;
      if (!exceptions?.includes("area")) areaMeasurer.enabled = false;
      if (!exceptions?.includes("clipper")) clipper.enabled = false;
    };

    const onLengthMeasurement = () => {
      disableAll(["length"]);
      lengthMeasurer.enabled = !lengthMeasurer.enabled;
      highlighter.enabled = !lengthMeasurer.enabled;
      update();
    };

    const onAreaMeasurement = () => {
      disableAll(["area"]);
      areaMeasurer.enabled = !areaMeasurer.enabled;
      highlighter.enabled = !areaMeasurer.enabled;
      update();
    };

    const onModelSection = () => {
      disableAll(["clipper"]);
      clipper.enabled = !clipper.enabled;
      highlighter.enabled = !clipper.enabled;
      update();
    };

    const onClipperDeleteAll = () => {
      clipper.deleteAll();
    };

    const createPlane = (axis: 'x' | 'y' | 'z') => {
       if (!clipper.enabled) {
          disableAll(["clipper"]);
          clipper.enabled = true;
          highlighter.enabled = false;
          update();
       }
       const fragments = components.get(OBC.FragmentsManager);
       const bbox = new THREE.Box3();
       for (const model of fragments.list.values()) {
            if(model.object) bbox.expandByObject(model.object);
       }
       const center = new THREE.Vector3();
       if(!bbox.isEmpty()) bbox.getCenter(center);
       
       const normal = new THREE.Vector3();
       if (axis === 'x') normal.set(-1, 0, 0);
       if (axis === 'y') normal.set(0, -1, 0);
       if (axis === 'z') normal.set(0, 0, -1);
       
       clipper.createFromNormalAndCoplanarPoint(world, normal, center);
    };

    const onMeasurementsClick = () => {
      lengthMeasurer.enabled = false;
      areaMeasurer.enabled = false;
      update();
    };

    return BUI.html`
      <bim-toolbar style="align-self: start;" vertical>
        <bim-toolbar-section>
          <bim-button @click=${onMeasurementsClick} ?active=${areMeasurementsEnabled} label="Measurements" tooltip-title="Measurements" icon=${appIcons.RULER}>
            <bim-context-menu>
              <bim-button ?active=${lengthMeasurer.enabled} label="Length" @click=${onLengthMeasurement}></bim-button>
              <bim-button ?active=${areaMeasurer.enabled} label="Area" @click=${onAreaMeasurement}></bim-button>
            </bim-context-menu>
          </bim-button>
          <bim-button ?active=${clipper.enabled} label="Section" tooltip-title="Model Section" icon=${appIcons.CLIPPING}>
             <bim-context-menu>
                <bim-button label="On/Off" @click=${onModelSection} ?active=${clipper.enabled} icon=${appIcons.CLIPPING}></bim-button>
                <bim-button label="Delete All" @click=${onClipperDeleteAll} icon=${appIcons.DELETE}></bim-button>
                <bim-label>Create Plane:</bim-label>
                <div style="display: flex; gap: 0.5rem;">
                    <bim-button label="X" @click=${() => createPlane('x')}></bim-button>
                    <bim-button label="Y" @click=${() => createPlane('y')}></bim-button>
                    <bim-button label="Z" @click=${() => createPlane('z')}></bim-button>
                </div>
             </bim-context-menu>
          </bim-button> 
        </bim-toolbar-section>
      </bim-toolbar>
    `;
  };

  const elements: BUI.GridComponents<ViewportGridElements> = {
    leftToolbar: { template: leftToolbarTemplate, initialState: {} },
    bottomToolbar: {
      template: viewerToolbarTemplate,
      initialState: { components, world },
    },
  };

  const onCreated = (e?: Element) => {
    if (!e) return;
    const grid = e as BUI.Grid<ViewportGridLayouts, ViewportGridElements>;
    grid.elements = elements;

    grid.layouts = {
      main: {
        template: `
          "leftToolbar messages rightToolbar" auto
          "leftToolbar empty rightToolbar" 1fr
          "bottomToolbar bottomToolbar bottomToolbar" auto
          /auto 1fr auto
        `,
      },
    };
  };

  return BUI.html`<bim-grid ${BUI.ref(onCreated)} layout="main" floating></bim-grid>`;
};
