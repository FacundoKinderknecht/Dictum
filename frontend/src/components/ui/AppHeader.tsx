import { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export default function AppHeader({ title, subtitle, actions }: Props) {
  return (
    <header className="bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-2">
          {/* Logo */}
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="w-1 h-7 sm:h-8 bg-idm rounded-full" />
              <span className="text-idm font-black text-xl sm:text-2xl tracking-tighter leading-none select-none">idm</span>
            </div>
            <div className="w-px h-6 bg-gray-200 hidden sm:block flex-shrink-0" />
            <div className="hidden sm:block min-w-0">
              <h1 className="text-base font-semibold text-gray-800 leading-tight truncate">{title}</h1>
              {subtitle && (
                <p className="text-xs text-gray-500 leading-tight mt-0.5 truncate">{subtitle}</p>
              )}
            </div>
          </div>

          {actions && (
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              {actions}
            </div>
          )}
        </div>

        {/* Título en mobile (debajo del logo) */}
        <div className="sm:hidden mt-1.5">
          <h1 className="text-sm font-semibold text-gray-800 leading-tight">{title}</h1>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5 truncate">{subtitle}</p>}
        </div>
      </div>
    </header>
  );
}
