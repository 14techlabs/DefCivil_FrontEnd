import { api } from "@/app/services/Api";

/** Só entrega o conjunto quando todas as páginas foram recebidas. */
export async function fetchAllPages<T extends { id: number }>(
  url: string,
  key: string,
  params: Record<string, string | number> = {},
): Promise<T[]> {
  const items: T[] = [];
  const ids = new Set<number>();
  let pages = 1;
  let total: number | undefined;
  for (let page = 1; page <= pages; page++) {
    const { data } = await api.get<Record<string, unknown> | T[]>(url, {
      params: { ...params, pagina: page, quantidade_por_pagina: 50 },
    });
    const batch = Array.isArray(data) ? data : data[key];
    if (!Array.isArray(batch)) throw new Error("Lista inválida");
    const pagination = Array.isArray(data) ? undefined : data.paginacao as {
      pagina: number; total_paginas: number; total_objetos: number;
    } | undefined;
    if (pagination) {
      if (!Number.isInteger(pagination.total_paginas) || pagination.total_paginas < 1
        || pagination.pagina !== page || !Number.isInteger(pagination.total_objetos)
        || pagination.total_objetos < 0
        || (page > 1 && (pagination.total_paginas !== pages || pagination.total_objetos !== total))) {
        throw new Error("A paginação mudou durante a consulta. Tente novamente.");
      }
      pages = pagination.total_paginas;
      total = pagination.total_objetos;
    } else if (page > 1) {
      throw new Error("Paginação ausente");
    }
    for (const item of batch as T[]) {
      if (ids.has(item.id)) throw new Error("Registros duplicados entre páginas");
      ids.add(item.id);
      items.push(item);
    }
  }
  if (total !== undefined && items.length !== total) throw new Error("Lista incompleta");
  return items;
}
