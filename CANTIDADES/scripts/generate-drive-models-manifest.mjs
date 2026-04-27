import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_FOLDER_ID = '18gr5TvX3pYY5S3ZRfjmWagkTLhhG3B0W';
const folderId =
  process.env.VITE_DRIVE_FOLDER_ID?.trim() ||
  process.env.DRIVE_FOLDER_ID?.trim() ||
  DEFAULT_FOLDER_ID;

const outputPath = path.resolve(process.cwd(), 'public', 'drive-models-manifest.json');
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

const buildManifest = (files) => {
  const fragFiles = files.filter((file) => file.name.toLowerCase().endsWith('.frag'));
  const jsonByBase = new Map(
    files
      .filter((file) => file.name.toLowerCase().endsWith('.json'))
      .map((file) => [normalizeBase(file.name.slice(0, -'.json'.length)), file.id]),
  );

  return fragFiles
    .map((file) => {
      const base = normalizeBase(file.name.slice(0, -'.frag'.length));
      return {
        name: file.name,
        fragId: file.id,
        ...(jsonByBase.get(base) ? { jsonId: jsonByBase.get(base) } : {}),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
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
const models = buildManifest(files);

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
