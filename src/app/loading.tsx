// src/app/loading.tsx

export default function GlobalLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
      <div className="relative flex items-center justify-center">
        {/* Outer glowing ring */}
        <div className="absolute w-16 h-16 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
        {/* Inner reverse spinner */}
        <div className="w-10 h-10 rounded-full border-4 border-indigo-500/10 border-t-indigo-500 animate-spin [animation-duration:0.8s] [animation-direction:reverse]" />
      </div>
      <p className="text-sm font-medium text-slate-500 animate-pulse">Loading, please wait...</p>
    </div>
  );
}
