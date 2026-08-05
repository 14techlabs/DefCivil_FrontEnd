"use client";

/**
 * Ícone da Cúpula — a IA do Gardian.
 * Uma cidade protegida por uma redoma: arco externo sólido (o escudo),
 * arco interno tracejado (a varredura contínua) e a silhueta urbana embaixo.
 */
export function CupulaIcon({
  className = "",
  size = 24,
  active = false,
}: {
  className?: string;
  size?: number;
  active?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* redoma externa */}
      <path
        d="M2.6 19.4v-6.1a9.4 9.4 0 0 1 18.8 0v6.1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />

      {/* varredura interna */}
      <path
        d="M5.9 19.4v-6.1a6.1 6.1 0 0 1 12.2 0v6.1"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeDasharray="1.6 2.2"
        opacity="0.45"
      />

      {/* nós de sensor na redoma */}
      <circle cx="12" cy="3.9" r="1.05" fill="currentColor" />
      <circle cx="3.5" cy="15.4" r="0.75" fill="currentColor" opacity="0.65" />
      <circle cx="20.5" cy="15.4" r="0.75" fill="currentColor" opacity="0.65" />

      {/* silhueta urbana */}
      {active ? (
        <>
          <path d="M6.6 19.4v-4.2h2.9v4.2z" fill="currentColor" />
          <path d="M9.9 19.4v-6.3h4.2v6.3z" fill="currentColor" />
          <path d="M14.5 19.4v-3.5h2.9v3.5z" fill="currentColor" />
        </>
      ) : (
        <>
          <path
            d="M6.6 19.4v-4.2h2.9v4.2M9.9 19.4v-6.3h4.2v6.3M14.5 19.4v-3.5h2.9v3.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path d="M11.4 16.1h1.2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.6" />
        </>
      )}

      {/* base / solo */}
      <path
        d="M1.6 19.4h20.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
