import React from 'react';

interface LogoProps {
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ className = '' }) => {
  return (
    <img 
      src="/logo.png" 
      alt="A.T.L.A.S Logo"
      className={`w-auto h-full max-w-[200px] ${className}`}
      width="200"
      height="200"
      loading="eager"
    />
  );
};

export default Logo;