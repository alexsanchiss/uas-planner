export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-1 items-center justify-center py-20"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-line border-t-brand motion-reduce:animate-none" />
      <span className="sr-only">Cargando...</span>
    </div>
  );
}
