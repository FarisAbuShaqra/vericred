// A simple flat "registry seal" mark — a bordered roundel with a monogram.
// No gradients, no emoji; pure accent + neutrals.
export default function Seal({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-accent-700 text-accent-700 ${className}`}
    >
      <span className="font-serif text-lg font-bold leading-none tracking-tight">
        VC
      </span>
    </span>
  );
}
