import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_FOLDER_ID = '18gr5TvX3pYY5S3ZRfjmWagkTLhhG3B0W';
const folderId =
  process.env.VITE_DRIVE_FOLDER_ID?.trim() ||
  process.env.DRIVE_FOLDER_ID?.trim() ||
  DEFAULT_FOLDER_ID;

const outputPath = path.resolve(process.cwd(), 'public', 'drive-models-manifest.json');
const assetsDir = path.resolve(process.cwd(), 'public', 'drive-models');
const folderUrl = `https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}`;

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
  const regex = /&quot;([^"&]+\.(?:frag|json))&quot;[\s\S]{0,2500}?\[\[null,&quot;([a-zA-Z0-9_-]{10,})&quot;\],0\]/gi;

  for (const match of html.matchAll(regex)) {
    const name = decodeHtml(match[1] || '').trim();
    const id = String(match[2] || '').trim();
    if (!name || !id || byName.has(name)) continue;
    byName.set(name, { name, id });
  }

  return Array.from(byName.values());
};

const buildManifest = async (files) => {
  const fragFiles = files.filter((file) => file.name.toLowerCase().endsWith('.frag'));
  const jsonByBase = new Map(
    files
      .filter((file) => file.name.toLowerCase().endsWith('.json'))
      .map((file) => [normalizeBase(file.name.slice(0, -'.json'.length)), file.id]),
  );

  await rm(assetsDir, { recursive: true, force: true });
  await mkdir(assetsDir, { recursive: true });

  const models = [];
  for (const file of fragFiles.sort((a, b) => a.name.localeCompare(b.name, 'es'))) {
    const base = normalizeBase(file.name.slice(0, -'.frag'.length));
    const jsonId = jsonByBase.get(base);
    const fragAssetName = `${sanitizeFileName(file.name.slice(0, -'.frag'.length)) || 'modelo'}__${file.id}.frag`;
    const fragAssetPath = path.join(assetsDir, fragAssetName);
    const fragBytes = await downloadDriveFile(file.id);
    await writeFile(fragAssetPath, fragBytes);

    let jsonUrl;
    if (jsonId) {
      const jsonAssetName = `${sanitizeFileName(file.name.slice(0, -'.frag'.length)) || 'modelo'}__${jsonId}.json`;
      const jsonAssetPath = path.join(assetsDir, jsonAssetName);
      const jsonBytes = await downloadDriveFile(jsonId);
      await writeFile(jsonAssetPath, jsonBytes);
      jsonUrl = `./drive-models/${jsonAssetName}`;
    }

    models.push({
      name: file.name,
      fragId: file.id,
      fragUrl: `./drive-models/${fragAssetName}`,
      ...(jsonId ? { jsonId } : {}),
      ...(jsonUrl ? { jsonUrl } : {}),
    });
  }

  return models;
};

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
  throw new Error(`No se encontraron archivos .frag publicos en ${folderUrl}`);
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
