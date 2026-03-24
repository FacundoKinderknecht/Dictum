interface Props {
  text?: string;
}

export default function LoadingSpinner({ text = "Cargando..." }: Props) {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-gray-500 text-sm">
      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      {text}
    </div>
  );
}
