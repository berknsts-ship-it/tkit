export default function StudentLoading() {
  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* Hero skeleton */}
      <div className="px-5 pt-8 pb-6 animate-pulse"
        style={{ background: "linear-gradient(135deg, #5c3d20 0%, #a07040 100%)" }}>
        <div className="h-3 w-16 rounded-full mb-2" style={{ background: "rgba(255,255,255,0.2)" }} />
        <div className="h-8 w-40 rounded-xl mb-4" style={{ background: "rgba(255,255,255,0.2)" }} />
        <div className="flex gap-2">
          <div className="h-7 w-28 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
          <div className="h-7 w-24 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
        </div>
      </div>

      {/* Tabs skeleton */}
      <div className="flex border-b" style={{ borderColor: "var(--brown-pale)", background: "white" }}>
        {[80, 72, 64, 80, 88, 80, 88].map((w, i) => (
          <div key={i} className="px-4 py-3 animate-pulse">
            <div className="h-4 rounded" style={{ width: w, background: "var(--brown-pale)" }} />
          </div>
        ))}
      </div>

      {/* Cards skeleton */}
      <div className="max-w-2xl mx-auto px-4 py-5 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-xl border p-4 animate-pulse"
            style={{ borderColor: "var(--brown-pale)", background: "white" }}>
            <div className="flex gap-4">
              <div className="w-12 h-14 rounded-lg" style={{ background: "var(--brown-pale)" }} />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-4 rounded w-3/4" style={{ background: "var(--brown-pale)" }} />
                <div className="h-3 rounded w-1/2" style={{ background: "var(--brown-pale)" }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
