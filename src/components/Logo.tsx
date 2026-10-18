export function Logo({ big }: { big?: boolean }) {
  return (
    <div className={`logo ${big ? 'logo-big' : ''}`}>
      <svg className="logo-seal" viewBox="0 0 40 40" aria-hidden>
        <rect x="2" y="2" width="36" height="36" rx="9" />
        <path d="M11 14h18M14 20h12M11 26h18M20 10v20" />
      </svg>
      <span className="logo-text">
        Kakeibo<small>carnet de budget</small>
      </span>
    </div>
  );
}
