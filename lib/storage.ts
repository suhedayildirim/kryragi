// Yüklenen dosyalar (CV, logo) için yerel dosya deposu.
import fs from 'node:fs/promises';
import path from 'node:path';
import {dataDir} from './db';

const root = () => path.join(dataDir(), 'uploads');

function resolveKey(key: string) {
  if (!/^[a-zA-Z0-9/_.-]+$/.test(key) || key.includes('..')) throw new Error('Geçersiz dosya anahtarı.');
  const full = path.resolve(root(), key);
  if (!full.startsWith(root() + path.sep)) throw new Error('Geçersiz dosya anahtarı.');
  return full;
}

export const storage = {
  async put(key: string, data: ArrayBuffer | Uint8Array) {
    const file = resolveKey(key);
    await fs.mkdir(path.dirname(file), {recursive: true});
    await fs.writeFile(file, data instanceof Uint8Array ? data : new Uint8Array(data));
  },
  async get(key: string): Promise<{body: Uint8Array} | null> {
    try {
      return {body: new Uint8Array(await fs.readFile(resolveKey(key)))};
    } catch {
      return null;
    }
  },
  async delete(key: string) {
    try {
      await fs.unlink(resolveKey(key));
    } catch {
      /* dosya zaten yok */
    }
  },
};
