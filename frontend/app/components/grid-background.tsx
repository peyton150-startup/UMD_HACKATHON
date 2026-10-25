"use client";

/** Arcade cabinet backdrop: perspective pixel grid + CRT scanlines. */
export function GridBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
      {/* sunset glow: violet with a hint of UMD red at the horizon */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 40% at 50% 100%, rgba(226,24,51,0.18) 0%, transparent 70%), radial-gradient(ellipse 60% 50% at 50% 0%, rgba(155,92,255,0.16) 0%, transparent 70%)",
        }}
      />
      {/* pixel grid floor */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/2 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(155,92,255,0.5) 2px, transparent 2px), linear-gradient(to bottom, rgba(155,92,255,0.5) 2px, transparent 2px)",
          backgroundSize: "48px 48px",
          transform: "perspective(400px) rotateX(55deg)",
          transformOrigin: "bottom",
          maskImage: "linear-gradient(to top, black, transparent)",
          WebkitMaskImage: "linear-gradient(to top, black, transparent)",
        }}
      />
      {/* CRT scanlines */}
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, #000 0px, #000 1px, transparent 2px, transparent 4px)",
        }}
      />
    </div>
  );
}
