export default function AuroraBackground() {
  return (
    <>
      {/* Aurora orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div
          className="absolute rounded-full opacity-50 blur-[90px] animate-drift1"
          style={{
            width: 700,
            height: 700,
            background: 'radial-gradient(circle, #5b21b6 0%, transparent 65%)',
            top: -250,
            left: -200,
          }}
        />
        <div
          className="absolute rounded-full opacity-50 blur-[90px] animate-drift2"
          style={{
            width: 600,
            height: 600,
            background: 'radial-gradient(circle, #1d4ed8 0%, transparent 65%)',
            bottom: -200,
            right: -150,
          }}
        />
        <div
          className="absolute rounded-full opacity-45 blur-[90px] animate-drift3"
          style={{
            width: 450,
            height: 450,
            background: 'radial-gradient(circle, #0891b2 0%, transparent 65%)',
            top: '30%',
            right: '10%',
          }}
        />
        <div
          className="absolute rounded-full opacity-40 blur-[100px] animate-drift4"
          style={{
            width: 380,
            height: 380,
            background: 'radial-gradient(circle, #9333ea 0%, transparent 65%)',
            bottom: '10%',
            left: '5%',
          }}
        />
      </div>

      {/* Dot grid */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.055) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />
    </>
  )
}
