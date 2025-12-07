import React from 'react';
import { Shield, Flame } from 'lucide-react';

const ShieldFlameIcon: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`relative ${className}`} aria-hidden>
      <Shield className="text-white w-full h-full" />
      <Flame className="text-white absolute inset-0 m-auto w-[55%] h-[55%]" />
    </div>
  );
};

export default ShieldFlameIcon;


