import LoadingSpinner from "@/app/components/LoadingSpinner/LoadingSpinner";

export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-950 px-6 text-white">
      <div role="status" className="flex items-center gap-3 text-gray-300">
        <LoadingSpinner />
        <p>Loading RedFunds...</p>
      </div>
    </main>
  );
}
