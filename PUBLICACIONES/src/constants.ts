
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

export const ESPECIALIDADES = [
  "ARQUITECTURA",
  "AIRE ACONDICIONADO",
  "CCTV",
  "COMBOS",
  "DESAGÜES",
  "ELÉCTRICO",
  "ELEMENTOS NO ESTRUCTURALES",
  "ESTRUCTURA",
  "ACÚSTICO",
  "ESTUDIO BIOCLIMÁTICO",
  "ESTUDIO TRÁFICO VERTICAL",
  "ESTUDIO SEGURIDAD HUMANA",
  "ESTUDIO DE SUELOS",
  "DETECCIÓN DE INCENDIOS",
  "GAS",
  "PH",
  "TOPOGRAFÍA",
  "VIAS Y ANDENES",
  "SALA DE VENTAS",
  "SUMINISTRO",
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

export interface ProjectConfig {
  id: string;
  name: string;
  logo: string;
  company: 'Artis' | 'Alcabama';
  unidades?: string[];
}

export const BRANDING = {
  Artis: {
    name: 'Artis Urbano',
    logo: 'https://i.postimg.cc/vmKVZndP/artis-urbano2.png',
    colors: {
      primary: '#003E52',
      secondary: '#024959',
      accent: '#F28705',
    }
  },
  Alcabama: {
    name: 'Alcabama S.A.',
    logo: 'https://i.postimg.cc/GmWLmfZZ/Logo-transparente_negro.png',
    colors: {
      primary: '#D3045C',
      secondary: '#B0034B',
      accent: '#605E62',
    }
  }
};

export const PROJECTS: ProjectConfig[] = [
  {
    id: 'trevoly',
    name: "Trevoly",
    logo: "https://i.postimg.cc/Hsrt7fXx/LOGO-TREVOLY.jpg",
    company: 'Artis'
  },
  {
    id: 'ventura',
    name: "Ventura",
    logo: "https://i.postimg.cc/LqtYmz4b/ventura-hd2.png",
    company: 'Alcabama'
  },
  {
    id: 'magnolias',
    name: "Magnolias",
    logo: "https://i.postimg.cc/Ny69Q1GS/LOGO-MAGNOLIAS-WEB-01.jpg",
    company: 'Alcabama'
  },
  {
    id: 'blue',
    name: "Blue",
    logo: "https://i.postimg.cc/FfydhjFW/LOGO-BLUE.jpg",
    company: 'Alcabama'
  },
  {
    id: 'iris',
    name: "Iris",
    logo: "https://i.postimg.cc/8FRJThky/LOGO-(1)-(1).jpg",
    company: 'Alcabama'
  },
  {
    id: 'madero',
    name: "Madero",
    logo: "https://i.postimg.cc/v1rgGW80/LOGO.jpg",
    company: 'Alcabama'
  },
  {
    id: 'orion',
    name: "Orión",
    logo: "https://i.postimg.cc/3wv2JGqD/LOGO.jpg",
    company: 'Alcabama'
  }
];

export const COLORS = {
  primary: '#003E52', 
  secondary: '#024959',
  accent: '#F28705', 
  highlight: '#FFA400', 
  black: '#0D0D0D',
  white: '#FFFFFF',
  lightGrey: '#F5F5F7',
  grey: '#A49FA6',
  darkGrey: '#827E84',
  deepGrey: '#605E62',
};
