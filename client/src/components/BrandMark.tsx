export type BrandMarkProps = { className?: string; showWordmark?: boolean; title?: string; };
export function BrandMark({ className = "", showWordmark = true, title = "Orbe Edital" }: BrandMarkProps) {
  return <span className={`inline-flex min-w-0 items-center gap-2.5 ${className}`}>
    <svg aria-label={showWordmark ? undefined : title} aria-hidden={showWordmark ? true : undefined} className="h-10 w-10 shrink-0" fill="none" role={showWordmark ? undefined : "img"} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 10.5h19.5L39 22v15.5A3.5 3.5 0 0 1 35.5 41H11.5A3.5 3.5 0 0 1 8 37.5v-27Z" fill="#102B4E"/>
      <path d="M27.5 10.5V20a2 2 0 0 0 2 2H39" stroke="#42D5E8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M13.5 17.5h8.5M13.5 22h7" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
      <circle cx="27" cy="29" r="9" stroke="#42D5E8" strokeWidth="2.8"/><circle cx="27" cy="29" r="4.2" fill="#42D5E8"/>
      <path d="m33.5 35.5 5 5" stroke="white" strokeWidth="2.8" strokeLinecap="round"/>
    </svg>
    {showWordmark && <span className="whitespace-nowrap text-[15px] font-extrabold tracking-[0.13em] text-[#102B4E]">ORBE<span className="text-[#1388B8]">EDITAL</span></span>}
  </span>;
}
export default BrandMark;
