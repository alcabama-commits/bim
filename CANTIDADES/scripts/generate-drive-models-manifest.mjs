import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_FOLDER_ID = '18gr5TvX3pYY5S3ZRfjmWagkTLhhG3B0W';
const folderId =
  process.env.VITE_DRIVE_FOLDER_ID?.trim() ||
  process.env.DRIVE_FOLDER_ID?.trim() ||
  DEFAULT_FOLDER_ID;

const outputPath = path.resolve(process.cwd(), 'public', 'drive-models-manifest.json');
const assetsDir = path.resolve(process.cwd(), 'public', 'drive-models');
const folderUrl = `https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}`;

const readExistingManifest = async () => {
  try {
    const raw = await readFile(outputPath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const decodeHtml = (value) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));

const normalizeBase = (name) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const sanitizeFileName = (name) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');

const downloadDriveFile = async (id) => {
  const urls = [
    `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`,
    `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t`,
  ];

  let lastError;
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        headers: {
          'cache-control': 'no-cache',
          pragma: 'no-cache',
          'user-agent': 'cantidades-build/1.0',
        },
      });
      if (!res.ok) {
        throw new Error(`Descarga fallida (${res.status})`);
      }
      return Buffer.from(await res.arrayBuffer());
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`No se pudo descargar el archivo ${id}`);
};

const extractDriveFiles = (html) => {
  const byName = new Map();
  const regex = /&quot;([^"&]+\.(?:frag|ifc|json))&quot;[\s\S]{0,2500}?\[\[null,&quot;([a-zA-Z0-9_-]{10,})&quot;\],0\]/gi;

  for (const match of html.matchAll(regex)) {
    const name = decodeHtml(match[1] || '').trim();
    const id = String(match[2] || '').trim();
    if (!name || !id || byName.has(name)) continue;
    byName.set(name, { name, id });
  }

  return Array.from(byName.values());
};

const buildManifest = async (files) => {
  const modelFiles = files.filter((file) => {
    const lower = file.name.toLowerCase();
    return lower.endsWith('.frag') || lower.endsWith('.ifc');
  });
  const jsonByBase = new Map(
    files
      .filter((file) => file.name.toLowerCase().endsWith('.json'))
      .map((file) => [normalizeBase(file.name.slice(0, -'.json'.length)), file.id]),
  );

  await mkdir(assetsDir, { recursive: true });
  const existingManifest = await readExistingManifest();
  const existingByName = new Map(
    Array.isArray(existingManifest?.models)
      ? existingManifest.models.filter((item) => item?.name).map((item) => [item.name, item])
      : [],
  );

  const models = [];
  for (const file of modelFiles.sort((a, b) => a.name.localeCompare(b.name, 'es'))) {
    const format = file.name.toLowerCase().endsWith('.ifc') ? 'ifc' : 'frag';
    const extension = `.${format}`;
    const base = normalizeBase(file.name.slice(0, -extension.length));
    const jsonId = jsonByBase.get(base);
    const assetName = `${sanitizeFileName(file.name.slice(0, -extension.length)) || 'modelo'}__${file.id}${extension}`;
    const assetPath = path.join(assetsDir, assetName);
    const previous = existingByName.get(file.name);

    let fileUrl;
    try {
      const fileBytes = await downloadDriveFile(file.id);
      await writeFile(assetPath, fileBytes);
      fileUrl = `./drive-models/${assetName}`;
    } catch (error) {
      const previousUrl = format === 'ifc' ? previous?.ifcUrl : previous?.fragUrl;
      const previousId = format === 'ifc' ? previous?.ifcId : previous?.fragId;
      if (previousId === file.id && previousUrl) {
        fileUrl = previousUrl;
      } else {
        console.warn(`No se pudo descargar ${file.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    let jsonUrl = undefined;
    if (jsonId) {
      const jsonAssetName = `${sanitizeFileName(file.name.slice(0, -extension.length)) || 'modelo'}__${jsonId}.json`;
      const jsonAssetPath = path.join(assetsDir, jsonAssetName);
      try {
        const jsonBytes = await downloadDriveFile(jsonId);
        await writeFile(jsonAssetPath, jsonBytes);
        jsonUrl = `./drive-models/${jsonAssetName}`;
      } catch (error) {
        if (previous?.jsonId === jsonId && previous?.jsonUrl) {
          jsonUrl = previous.jsonUrl;
        } else {
          console.warn(`No se pudo descargar JSON para ${file.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    models.push({
      name: file.name,
      ...(format === 'ifc' ? { ifcId: file.id } : { fragId: file.id }),
      ...(format === 'ifc'
        ? (fileUrl ? { ifcUrl: fileUrl } : {})
        : (fileUrl ? { fragUrl: fileUrl } : {})),
      ...(jsonId ? { jsonId } : {}),
      ...(jsonUrl ? { jsonUrl } : {}),
    });
  }

  return models;
};

const existingManifest = await readExistingManifest();

try {
  const res = await fetch(folderUrl, {
    headers: {
      'cache-control': 'no-cache',
      pragma: 'no-cache',
      'user-agent': 'cantidades-build/1.0',
    },
  });

  if (!res.ok) {
    throw new Error(`No se pudo leer el folder de Drive (${res.status})`);
  }

  const html = await res.text();
  const files = extractDriveFiles(html);
  const models = await buildManifest(files);

  if (models.length === 0) {
    throw new Error(`No se encontraron archivos .frag o .ifc publicos en ${folderUrl}`);
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    JSON.stringify(
      {
        folderId,
        generatedAt: new Date().toISOString(),
        models,
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );

  console.log(`Manifest generado con ${models.length} modelos en ${outputPath}`);
} catch (error) {
  if (!existingManifest) {
    throw error;
  }
  console.warn(`No se pudo regenerar el manifest desde Drive. Se reutiliza la ultima copia local: ${error instanceof Error ? error.message : String(error)}`);
}
