import { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export default function AppHeader({ title, subtitle, actions }: Props) {
  return (
    <header className="bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Logo IDM */}
          <div className="flex items-center gap-1.5">
            <div className="w-1 h-8 bg-idm rounded-full" />
            <span className="text-idm font-black text-2xl tracking-tighter leading-none select-none">idm</span>
          </div>
          <div className="w-px h-6 bg-gray-200" />
          <div>
            <h1 className="text-base font-semibold text-gray-800 leading-tight">{title}</h1>
            {subtitle && (
              <p className="text-xs text-gray-500 leading-tight mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>

        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
