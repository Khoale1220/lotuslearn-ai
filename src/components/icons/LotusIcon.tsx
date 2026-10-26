import React from 'react';

interface LotusIconProps {
  className?: string;
  size?: number;
}

/**
 * Geometric single-color mark suggesting a lotus petal geometry and an open book.
 * Operates crisply at 16px to 32px, on light and dark surfaces.
 */
export const LotusIcon: React.FC<LotusIconProps> = ({ className = 'text-current', size = 20 }) => {
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
      {/* Central ascending petal */}
      <path
        d="M12 3C12 3 9.5 8.5 9.5 13C9.5 15.5 10.6 17.5 12 18.5C13.4 17.5 14.5 15.5 14.5 13C14.5 8.5 12 3 12 3Z"
        fill="currentColor"
      />
      {/* Left wing petal */}
      <path
        d="M12 18.5C10.2 17 5 14 5 9.5C5 6.5 6.8 4.8 6.8 4.8C6.8 4.8 8.8 9.5 10 13C10.8 15.2 11.5 17.3 12 18.5Z"
        fill="currentColor"
        opacity="0.8"
      />
      {/* Right wing petal */}
      <path
        d="M12 18.5C13.8 17 19 14 19 9.5C19 6.5 17.2 4.8 17.2 4.8C17.2 4.8 15.2 9.5 14 13C13.2 15.2 12.5 17.3 12 18.5Z"
        fill="currentColor"
        opacity="0.8"
      />
      {/* Foundation arc */}
      <path
        d="M4 19.5C8.5 21 15.5 21 20 19.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
};
