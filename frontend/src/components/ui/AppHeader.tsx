import { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export default function AppHeader({ title, subtitle, actions }: Props) {
  return (
    <header className="bg-white border-b border-gray-200 px-8 py-0 flex items-stretch">
      {/* Franja roja izquierda */}
      <div className="w-1.5 bg-idm flex-shrink-0 -my-px mr-6" />

      <div className="flex items-center justify-between flex-1 py-5">
        <div>
          <div className="flex items-center gap-4">
            <span className="text-idm font-black text-2xl font-mono tracking-tight">idm</span>
            <span className="text-gray-300 text-lg">|</span>
            <h1 className="text-xl font-semibold text-gray-800">{title}</h1>
          </div>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1 ml-[72px]">{subtitle}</p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-3">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
