
export interface BIMFormState {
  tipoRequest: 'PUBLICAR' | 'ELIMINAR';
  responsable: string;
  proposito: 'ENTREGA PROYECTO' | 'ACTUALIZACIÓN O CAMBIO' | '';
  especialidad: string;
  observaciones: string;
  unidades: {
    [key: string]: {
      RVT: boolean;
      DWG: boolean;
      PDF: boolean;
      DOC: boolean;
      IFC: boolean;
      TRB: boolean;
    };
  };
}

export const RESPONSABLES = [
  "Alexis Bernal",
  "David Tovar",
  "Jaime Sanchez",
  "Julian Sanchez",
  "Liliana Reyes",
  "Natalia Duque",
  "Sergio Gonzalez",
  "Valentina Arevalo",
  "Yessid Roa"
].sort();

export const ESPECIALIDADES = [
  "ARQUITECTURA",
  "AIRE ACONDICIONADO",
  "ANCLAJES CERTIFICADOS",
  "ASCENSORES",
  "BIOCLIMÁTICO",
  "CCTV",
  "COMBOS",
  "COMERCIAL",
  "CONTROL DE ACCESOS",
  "DESAGÜES",
  "DUPLICADORES",
  "ELÉCTRICO",
  "ELEMENTOS NO ESTRUCTURALES",
  "ESTRUCTURA",
  "ESTUDIOS",
  "DETECCION DE INCENDIOS",
  "GAS",
  "ILUMINACIÓN EXTERIOR",
  "IMPERMEABILIZACIONES",
  "PH",
  "PLANTA DESFOGUE",
  "PRESUPUESTOS",
  "REPLANTEO",
  "TOPOGRAFÍA",
  "TRÁFICO VERTICAL",
  "VIAS Y ANDENES",
  "SALA DE VENTAS",
  "SAUNA",
  "SERVICIOS PÚBLICOS",
  "SUELOS",
  "SUMINISTRO",
  "PISCINAS",
  "RCI"
].sort();

export const UNIDADES_ESTRUCTURALES = [
  "IMPLANTACIÓN",
  "TORRE MODULO 1",
  "TORRE MODULO 2",
  "TORRE MODULO 3",
  "TORRE MODULO 4",
  "TORRE MODULO 4A",
  "COMUNAL",
  "TANQUE"
];

export const FILE_TYPES = ["RVT", "DWG", "PDF", "DOC", "IFC", "TRB"] as const;

export const PROJECTS = [
  {
    name: "Ventura",
    logo: "https://i.postimg.cc/LqtYmz4b/ventura-hd2.png"
  },
  {
    name: "Magnolias",
    logo: "https://i.postimg.cc/Ny69Q1GS/LOGO-MAGNOLIAS-WEB-01.jpg"
  },
  {
    name: "Blue",
    logo: "https://i.postimg.cc/FfydhjFW/LOGO-BLUE.jpg"
  },
  {
    name: "Iris",
    logo: "https://i.postimg.cc/8FRJThky/LOGO-(1)-(1).jpg"
  },
  {
    name: "Madero",
    logo: "https://i.postimg.cc/v1rgGW80/LOGO.jpg"
  },
  {
    name: "Orión",
    logo: "https://i.postimg.cc/3wv2JGqD/LOGO.jpg"
  }
];
