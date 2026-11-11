export type BrandMarkProps = {
  className?: string;
  /** Exibe o wordmark ORBEEDITAL ao lado do símbolo. */
  showWordmark?: boolean;
  /** Nome acessível do símbolo quando o wordmark estiver oculto. */
  title?: string;
};

export function BrandMark({
  className = "",
  showWordmark = true,
  title = "OrbeEdital",
}: BrandMarkProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        aria-label={showWordmark ? undefined : title}
        aria-hidden={showWordmark ? true : undefined}
        className="h-10 w-10 shrink-0"
        fill="none"
        role={showWordmark ? undefined : "img"}
        viewBox="0 0 48 48"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M11 5.5h18l9 9V31a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3V8.5a3 3 0 0 1 3-3Z" fill="#102B4E" />
        <path d="M29 5.5v8a2 2 0 0 0 2 2h7" stroke="#42D5E8" strokeWidth="2" />
        <path d="M15 19h13M15 24h10" stroke="white" strokeLinecap="round" strokeWidth="2" />
        <path d="M17 29h8" stroke="#42D5E8" strokeLinecap="round" strokeWidth="2" />
        <circle cx="32.5" cy="31.5" r="7" fill="#42D5E8" stroke="white" strokeWidth="2.5" />
        <path d="m37.5 36.5 4 4" stroke="#102B4E" strokeLinecap="round" strokeWidth="3" />
      </svg>
      {showWordmark && (
        <span className="text-[15px] font-extrabold tracking-[0.13em] text-[#102B4E]">
          ORBE<span className="text-[#1388B8]">EDITAL</span>
        </span>
      )}
    </span>
  );
}

export default BrandMark;
