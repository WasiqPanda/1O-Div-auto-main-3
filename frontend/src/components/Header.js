import React from 'react';

export const Header = ({ title, subtitle, hqLogo }) => {
  return (
    <div className="bg-tactical-panel border-b border-tactical-border py-2 px-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {hqLogo && (
            <img src={hqLogo} alt="HQ Logo" className="h-10 w-10 object-contain rounded" />
          )}
          <div>
            <h1 className="text-base font-heading font-bold uppercase tracking-widest text-white">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs text-gray-400 font-mono">{subtitle}</p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 font-mono">Powered by</p>
          <p className="text-sm font-heading font-bold text-primary">BA-8993 Major Wahid</p>
        </div>
      </div>
    </div>
  );
};