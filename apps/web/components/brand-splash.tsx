type BrandSplashProps = {
  logoSrc?: string;
  label?: string;
  compact?: boolean;
};

export function BrandSplash({
  logoSrc = "/vasritha-logo-header.png",
  label = "Loading",
  compact = false
}: BrandSplashProps) {
  return (
    <div
      className={`brand-splash${compact ? " brand-splash--compact" : ""}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <img className="brand-splash-logo" src={logoSrc} alt="Vasritha" />
      <div className="brand-splash-track" aria-hidden="true">
        <span className="brand-splash-bar" />
      </div>
    </div>
  );
}
