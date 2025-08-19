import React from 'react';

type Role = 'group' | 'column' | 'site' | 'security' | 'supply';

interface RoleBadgeIconProps {
  role: Role;
  className?: string;
}

// Displays an SVG icon from /public/icons if available, otherwise falls back to PNG with @2x/@3x variants
// Expected files (preferred):
//   /public/icons/group.svg, column.svg, site.svg
// Or fallback raster:
//   /public/icons/group.png (+ @2x/@3x), column.png, site.png
const RoleBadgeIcon: React.FC<RoleBadgeIconProps> = ({ role, className = '' }) => {
  const ROLE_TO_BASENAME: Record<Role, string> = {
    group: 'group',
    column: 'column',
    site: 'site',
    security: 'Officier_securite',
    supply: 'Officier_alimentation'
  };
  const baseName = ROLE_TO_BASENAME[role] || role;
  const nameVariants = [
    baseName,
    baseName.toLowerCase(),
    role,
    role.toLowerCase()
  ];

  const [variantIndex, setVariantIndex] = React.useState(0);
  const [usePng, setUsePng] = React.useState(false);
  const [broken, setBroken] = React.useState(false);

  const currentName = nameVariants[Math.min(variantIndex, nameVariants.length - 1)];
  const bust = import.meta.env && (import.meta as any).env?.DEV ? `?v=${Date.now()}` : '';
  const svg = `/icons/${currentName}.svg${bust}`;
  const png = `/icons/${currentName}.png${bust}`;
  const srcSet = `${png} 1x, ${png.replace('.png', '@2x.png')} 2x, ${png.replace('.png', '@3x.png')} 3x`;

  return (
    <div className={`flex items-center justify-center ${className}`}>
      {!broken ? (
        <img
          src={usePng ? png : svg}
          {...(usePng ? { srcSet } : {})}
          alt={role}
          className="max-w-full max-h-full object-contain"
          onError={() => {
            if (!usePng) {
              setUsePng(true);
              return;
            }
            if (variantIndex < nameVariants.length - 1) {
              setVariantIndex(variantIndex + 1);
              setUsePng(false);
              return;
            }
            setBroken(true);
          }}
          draggable={false}
        />
      ) : (
        <div className="w-full h-full bg-gray-700 text-white text-xs flex items-center justify-center rounded">
          {role}
        </div>
      )}
    </div>
  );
};

export default RoleBadgeIcon;


