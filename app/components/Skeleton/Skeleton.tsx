export default function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`rounded bg-gray-800 motion-safe:animate-pulse ${className}`}
    />
  );
}
