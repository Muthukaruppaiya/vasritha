type IconProps = {
  size?: number;
  className?: string;
};

export function CartBagIcon({ size = 22, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Rounded tote body matching the reference bag icon */}
      <path d="M6.8 8.4h10.4a1.1 1.1 0 0 1 1.1 1.2l-.9 9.1A2.2 2.2 0 0 1 15.2 21H8.8a2.2 2.2 0 0 1-2.2-2.3l-.9-9.1a1.1 1.1 0 0 1 1.1-1.2Z" />
      {/* Top opening / handle notch */}
      <path d="M9.6 8.4c0-1.5 1.05-2.7 2.4-2.7s2.4 1.2 2.4 2.7" />
    </svg>
  );
}

export function LoginIcon({ size = 22, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 19.2c.8-3.1 3.2-4.7 6.5-4.7s5.7 1.6 6.5 4.7" />
    </svg>
  );
}
