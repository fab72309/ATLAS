import React from 'react';

// Hydrant icon inspired by open-source icon sets (clean, balanced, rounded)
const SupplyHydrantIcon: React.FC<{ className?: string }>= ({ className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden
  >
    <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 4h8" />
      <path d="M7 7a5 5 0 0 1 10 0v2H7V7Z" />
      <rect x="7" y="9" width="10" height="8" rx="2" />
      <circle cx="12" cy="13" r="2.5" />
      <path d="M4 13h3M17 13h3" />
      <path d="M6 19h12v2H6z" />
    </g>
  </svg>
);

export default SupplyHydrantIcon;


