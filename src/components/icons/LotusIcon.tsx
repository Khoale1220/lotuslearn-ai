import React from 'react';

interface LotusIconProps {
  className?: string;
  size?: number;
}

export const LotusIcon: React.FC<LotusIconProps> = ({ className = 'text-rose-600', size = 28 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Central upright petal */}
      <path
        d="M16 3C16 3 12 11 12 18C12 21.5 13.8 24.5 16 26C18.2 24.5 20 21.5 20 18C20 11 16 3 16 3Z"
        fill="currentColor"
        fillOpacity="0.9"
      />
      {/* Left curved petal */}
      <path
        d="M16 26C13.5 24 7 19.5 7 13.5C7 9.5 9 6.5 9 6.5C9 6.5 12 12.5 13.5 17C14.5 20 15.5 23.5 16 26Z"
        fill="currentColor"
        fillOpacity="0.65"
      />
      {/* Right curved petal */}
      <path
        d="M16 26C18.5 24 25 19.5 25 13.5C25 9.5 23 6.5 23 6.5C23 6.5 20 12.5 18.5 17C17.5 20 16.5 23.5 16 26Z"
        fill="currentColor"
        fillOpacity="0.65"
      />
      {/* Base water line / geometric foundation */}
      <path
        d="M4 27C10 29.5 22 29.5 28 27"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fillOpacity="0.4"
      />
    </svg>
  );
};
