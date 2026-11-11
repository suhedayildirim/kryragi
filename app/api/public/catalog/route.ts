import {json, loadCatalog} from '../../../../lib/server';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const catalog = await loadCatalog();
    return json({programs: catalog.map((p: any) => ({id: p.id, name: p.name, areas: p.areas.map((a: any) => ({id: a.id, name: a.name}))}))});
  } catch {
    return json({error: 'Program listesi yüklenemedi.'}, 503);
  }
}
