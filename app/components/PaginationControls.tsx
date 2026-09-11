"use client";

import { Icon, MetaTag } from "@/app/components/Primitives";

export interface PaginationInfo {
  pagina: number;
  total_paginas: number;
  quantidade_por_pagina: number;
  total_objetos: number;
}

interface Props {
  pagination: PaginationInfo;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: 10 | 25 | 50) => void;
  disabled?: boolean;
  showPageSize?: boolean;
}

export function PaginationControls({ pagination, onPageChange, onPageSizeChange, disabled, showPageSize = true }: Props) {
  const firstItem = pagination.total_objetos === 0
    ? 0
    : (pagination.pagina - 1) * pagination.quantidade_por_pagina + 1;
  const lastItem = Math.min(
    pagination.pagina * pagination.quantidade_por_pagina,
    pagination.total_objetos,
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-container-low px-4 py-3">
      <p className="text-[11px] font-medium text-on-surface-variant">
        Exibindo <strong className="text-primary">{firstItem}–{lastItem}</strong> de{" "}
        <strong className="text-primary">{pagination.total_objetos}</strong>
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {showPageSize && <label className="flex items-center gap-2">
          <MetaTag>POR PÁGINA</MetaTag>
          <select
            value={pagination.quantidade_por_pagina}
            onChange={(event) => onPageSizeChange(Number(event.target.value) as 10 | 25 | 50)}
            disabled={disabled}
            className="rounded-lg border-none bg-white px-3 py-2 text-[11px] font-bold text-primary focus:ring-2 focus:ring-secondary disabled:opacity-50"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </label>}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(pagination.pagina - 1)}
            disabled={disabled || pagination.pagina <= 1}
            className="rounded-lg bg-white p-2 text-primary transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Página anterior"
          >
            <Icon name="chevron_left" className="text-[18px]" />
          </button>
          <span className="min-w-24 text-center text-[11px] font-bold text-primary">
            {pagination.pagina} de {Math.max(1, pagination.total_paginas)}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(pagination.pagina + 1)}
            disabled={disabled || pagination.pagina >= pagination.total_paginas}
            className="rounded-lg bg-white p-2 text-primary transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Próxima página"
          >
            <Icon name="chevron_right" className="text-[18px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
