import React from 'react';

type Role = 'group' | 'column' | 'site' | 'security' | 'supply';

interface RoleBadgeIconProps {
  role: Role;
  className?: string;
}

const RoleBadgeIcon: React.FC<RoleBadgeIconProps> = ({ role, className = '' }) => {
  const [error, setError] = React.useState(false);
  const iconBase = import.meta.env.BASE_URL || '/';

  const getIconPath = (r: Role) => {
    const base = iconBase.endsWith('/') ? iconBase : `${iconBase}/`;
    switch (r) {
      case 'group': return `${base}icons/group.png`;
      case 'column': return `${base}icons/column.png`;
      case 'site': return `${base}icons/site.png`;
      case 'security': return `${base}icons/Officier_securite.png`;
      case 'supply': return `${base}icons/Officier_alimentation.png`;
      default: return '';
    }
  };

  const renderFallback = () => {
    if (role === 'supply') {
      return (
        <svg viewBox="0 0 24 24" className="w-full h-full text-white" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 4h8" />
          <path d="M7 7a5 5 0 0 1 10 0v2H7V7Z" />
          <rect x="7" y="9" width="10" height="8" rx="2" />
          <circle cx="12" cy="13" r="2.5" />
          <path d="M4 13h3M17 13h3" />
          <path d="M6 19h12v2H6z" />
        </svg>
      );
    }
    // Generic fallback for others
    return (
      <div className="w-full h-full bg-gray-800 flex items-center justify-center rounded text-xs text-gray-400 font-medium">
        {role.charAt(0).toUpperCase()}
      </div>
    );
  };

  if (error) {
    return <div className={`${className} p-1`}>{renderFallback()}</div>;
  }

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <img
        src={getIconPath(role)}
        alt={role}
        className="w-full h-full object-contain drop-shadow-lg"
        onError={() => setError(true)}
        draggable={false}
      />
    </div>
  );
};

export default RoleBadgeIcon;

