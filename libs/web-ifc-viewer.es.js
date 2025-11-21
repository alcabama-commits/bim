import { Vector3, Box3, Mesh, Object3D, Color, MOUSE as MOUSE$1, FrontSide, BackSide, DoubleSide, ShaderMaterial, Plane, Vector2, Raycaster, Scene, WebGLRenderer, PerspectiveCamera, AmbientLight, DirectionalLight, PCFSoftShadowMap, Group, MeshBasicMaterial, BufferGeometry, BufferAttribute, LineBasicMaterial, Line, AxesHelper, GridHelper, Ray, Sphere, Matrix4, Quaternion } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { IFCWALL, IFCWALLSTANDARDCASE, IFCSLAB, IFCWINDOW, IFCSPACE, IFCOPENINGELEMENT, IFCPLATE, IFCMEMBER, IFCROOF, IFCBUILDINGSTOREY, IFCSTAIR, IFCSTAIRFLIGHT, IFCRAILING, IFCFURNISHINGELEMENT, IFCCURTAINWALL, IFCDOOR } from "web-ifc";
import { WebIFC } from "web-ifc/web-ifc-api";
class IFCjs {
  constructor() {
    this.wasm = {};
    this.propertiesPromise = null;
    this.wasmPath = "";
    this.isWasmLoaded = false;
    this.ifcAPI = new WebIFC();
    this.fs = null;
    this.path = null;
    this.modelSchema = "";
    this.projects = {};
    this.properties = {};
    this.types = {};
    this.map = {};
    this.materials = {};
    this.globalHeight = 0;
    this.expressID = "expressID";
    this.selectedAnything = false;
    this.preselected = {
      id: -1,
      material: null,
      mesh: null
    };
    this.selected = {
      id: -1,
      material: null,
      mesh: null
    };
    this.subsetConfig = {
      scene: null,
      materials: [],
      meshes: [],
      map: {},
      onSubsetGenerated: () => {
      }
    };
    this.optionalCategories = {
      [IFCSPACE]: false,
      [IFCOPENINGELEMENT]: false
    };
    this.categories = {
      IFCWALL,
      IFCWALLSTANDARDCASE,
      IFCSLAB,
      IFCWINDOW,
      IFCPLATE,
      IFCMEMBER,
      IFCROOF,
      IFCBUILDINGSTOREY,
      IFCSTAIR,
      IFCSTAIRFLIGHT,
      IFCRAILING,
      IFCFURNISHINGELEMENT,
      IFCCURTAINWALL,
      IFCDOOR
    };
    this_isWasmPathInitialized = () => {
      if (this.wasmPath === "")
        throw new Error("wasmPath is not initialized. Please call viewer.IFC.setWasmPath() before calling any other IFC method.");
    };
    this.setWasmPath = async (path) => {
      this.wasmPath = path;
    };
    this.loadIfc = async (buffer, onprogress) => {
      const modelID = await this.readIfcFile(buffer);
      this.loadAllGeometry(modelID, onprogress);
      return modelID;
    };
    this.loadIfcUrl = async (url, onprogress) => {
      const buffer = await this.readIfcUrl(url);
      return this.loadIfc(buffer, onprogress);
    };
    this.getSpatialStructure = (modelID, includeProperties) => {
      const lines = this.ifcAPI.GetLineIDsWithType(modelID, IFCBUILDINGSTOREY);
      const tree = this.getSpatialTree(lines, modelID, includeProperties);
      this.globalHeight = this.getGlobalHeight(tree);
      return tree;
    };
    this.getProperties = (modelID, elementID, recursive = false) => {
      if (this.properties[modelID] === void 0)
        return null;
      const props = this.properties[modelID][elementID];
      if (props === void 0)
        return null;
      if (recursive) {
        const allProps = [];
        allProps.push(props);
        this.recursivelyGetProperties(props, allProps);
        return allProps;
      }
      return props;
    };
    this.getIfcType = (modelID, elementID) => {
      if (this.types[modelID] === void 0)
        return null;
      const typeID = this.types[modelID][elementID];
      if (typeID === void 0)
        return null;
      return this.ifcAPI.GetLine(modelID, typeID).type;
    };
    this.getSubset = (modelID, material, customID) => {
      const subset = this.getSubsetOfModel(modelID, material, customID);
      this.subsetConfig.onSubsetGenerated(subset);
      return subset;
    };
    this.removeSubset = (modelID, material, customID) => {
      const subsetID = customID ? customID : modelID;
      const subset = this.subsetConfig.map[subsetID];
      if (subset) {
        if (material) {
          this.removeFromSubset(subset, material);
        } else {
          this.clearSubset(subset);
        }
      }
    };
    this.getExpressId = (geometry, faceIndex) => {
      if (!geometry.index)
        return;
      const face = this.getFace(geometry, faceIndex);
      if (face) {
        const id = this.ifcAPI.GetExpressIdFromTriangle(face.a, face.b, face.c);
        if (id > 0)
          return id;
      }
      return null;
    };
    this.pickIfcItem = (preselect = true) => {
      const found = this.castRayIfc();
      if (found) {
        const expressID = this.getExpressId(found.object.geometry, found.faceIndex);
        if (expressID) {
          if (preselect) {
            this.preselect(expressID, found.object.material);
          } else {
            this.select(expressID, found.object.material);
          }
          return {
            modelID: 0,
            id: expressID
          };
        }
      } else {
        this.unpick();
      }
      return null;
    };
    this.prepickIfcItem = () => {
      const found = this.castRayIfc();
      if (found) {
        const expressID = this.getExpressId(found.object.geometry, found.faceIndex);
        if (expressID) {
          this.preselect(expressID, found.object.material);
        } else {
          this.unPreselect();
        }
      } else {
        this.unPreselect();
      }
    };
    this.unpick = () => {
      this.unselect();
      this.unPreselect();
    };
    this.unselect = () => {
      if (this.selected.id === -1)
        return;
      this.selected.material.color.set(this.originalColor);
      this.selected.id = -1;
      this.selected.material = null;
      this.selectedAnything = false;
    };
    this.unPreselect = () => {
      if (this.preselected.id === -1)
        return;
      this.preselected.material.color.set(this.originalColor);
      this.preselected.id = -1;
      this.preselected.material = null;
    };
    this.dispose = () => {
      this.wasm = null;
      this.propertiesPromise = null;
      this.ifcAPI = null;
      this.fs = null;
      this.path = null;
      this.projects = null;
      this.properties = null;
      this.types = null;
      this.map = null;
      this.materials = null;
      this.preselected = null;
      this.selected = null;
      this.subsetConfig = null;
      this.optionalCategories = null;
      this.categories = null;
    };
  }
}
class IfcViewerAPI {
  constructor({ container, backgroundColor, preselectColor, selectColor }) {
    this.container = container;
    this.context = new IfcContext(this.container);
    this.IFC = new IFCjs(this.context);
    this.clipper = new Clipper(this.context);
    this.dimensions = new Dimensions(this.context);
    this.shadows = new ShadowDropper(this.context);
    this.axes = new Axes(this.context);
    this.grid = new Grid(this.context);
    this.IFC.context.ifcCamera.preselectColor = preselectColor;
    this.IFC.context.ifcCamera.selectColor = selectColor;
    if (backgroundColor) {
      this.context.renderer.setClearColor(backgroundColor);
    }
    this.IFC.context.renderer.update();
  }
  /**
   * @deprecated Use `IFC.loadIfc()` instead.
   */
  async loadIfc(buffer, onprogress) {
    return this.IFC.loadIfc(buffer, onprogress);
  }
  /**
   * @deprecated Use `IFC.loadIfcUrl()` instead.
*/
// ... (y así sucesivamente hasta el final del archivo)