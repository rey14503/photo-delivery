import React from 'react';

interface LogoProps {
  className?: string;
  variant?: 'navbar' | 'badge' | 'icon';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Logo: React.FC<LogoProps> = ({ 
  className = '', 
  variant = 'navbar',
  size = 'md'
}) => {
  // Size classes
  const sizeMap = {
    sm: { icon: 'h-6 w-6', text: 'text-xs', subText: 'text-[7px]' },
    md: { icon: 'h-9 w-9', text: 'text-sm', subText: 'text-[8px]' },
    lg: { icon: 'h-14 w-14', text: 'text-xl', subText: 'text-[10px]' },
    xl: { icon: 'h-24 w-24', text: 'text-3xl', subText: 'text-sm' },
  };

  const badgeSizeMap = {
    sm: 'h-24 w-24',
    md: 'h-40 w-40',
    lg: 'h-56 w-56',
    xl: 'h-72 w-72',
  };

  const currentSize = sizeMap[size];

  // Load logo icon directly from file
  const LogoIcon = () => (
    <img
      src="/logo.svg"
      className={`${currentSize.icon} transition-transform duration-500 group-hover/logo:rotate-3 shrink-0`}
      alt="BK Media Logo"
      referrerPolicy="no-referrer"
    />
  );

  if (variant === 'icon') {
    return (
      <div className={`relative group/logo ${className}`}>
        <LogoIcon />
      </div>
    );
  }

  if (variant === 'badge') {
    return (
      <div className={`flex flex-col items-center justify-center mx-auto select-none ${className}`}>
        {/* Load circular badge directly from file */}
        <div className="relative group/logo transition-transform duration-500 hover:scale-105">
          <img
            src="/logo_badge.svg"
            className={`${badgeSizeMap[size]} object-contain`}
            alt="BK Media Badge"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>
    );
  }

  // Default: Linear 'navbar' layout
  return (
    <div className={`flex items-center space-x-3 select-none ${className}`}>
      <div className="relative group/logo">
        <LogoIcon />
        {/* Subtle camera flash dot */}
        <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-brand-orange rounded-full animate-ping opacity-75" />
      </div>

      <div className="flex flex-col text-left">
        <div className={`font-display font-black tracking-tight uppercase leading-none ${currentSize.text} text-gray-900 dark:text-white`}>
          BK <span className="text-brand-orange">Media Box</span>
        </div>
        <div className={`font-mono tracking-widest text-gray-400 dark:text-gray-500 font-bold uppercase mt-0.5 leading-none ${currentSize.subText}`}>
          practice makes perfect
        </div>
      </div>
    </div>
  );
};
