export default function LoadingScreen() {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0C0C0F',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0,
      }}
    >
      <style>{`
        @keyframes letterWave {
          0%, 100% {
            color: #2a2a32;
            text-shadow: none;
            transform: translateY(0);
          }
          40% {
            color: #FF5533;
            text-shadow:
              0 0 12px rgba(255, 85, 51, 0.9),
              0 0 30px rgba(255, 85, 51, 0.55),
              0 0 60px rgba(255, 85, 51, 0.25);
            transform: translateY(-6px);
          }
          60% {
            color: #ff7755;
            text-shadow:
              0 0 8px rgba(255, 85, 51, 0.7),
              0 0 20px rgba(255, 85, 51, 0.35);
            transform: translateY(-3px);
          }
        }

        .h4l-letter {
          display: inline-block;
          font-size: 5.5rem;
          font-weight: 900;
          color: #2a2a32;
          font-family: 'Inter', system-ui, sans-serif;
          letter-spacing: -0.02em;
          animation: letterWave 1.8s ease-in-out infinite;
          line-height: 1;
        }

        .h4l-letter-h { animation-delay: 0s; }
        .h4l-letter-4 { animation-delay: 0.22s; }
        .h4l-letter-l { animation-delay: 0.44s; }

        @keyframes subtitleFadeIn {
          from { opacity: 0; letter-spacing: 0.5em; }
          to   { opacity: 1; letter-spacing: 0.32em; }
        }

        .h4l-subtitle {
          font-family: 'Inter', system-ui, sans-serif;
          font-size: 0.72rem;
          font-weight: 500;
          color: #5a5a6a;
          text-transform: uppercase;
          letter-spacing: 0.32em;
          margin-top: 18px;
          animation: subtitleFadeIn 1s ease forwards;
          animation-delay: 0.3s;
          opacity: 0;
        }

        @keyframes trackFill {
          0%   { width: 0%; opacity: 0.6; }
          50%  { width: 100%; opacity: 1; }
          100% { width: 0%; opacity: 0.6; }
        }

        .h4l-track {
          width: 72px;
          height: 2px;
          background: #1e1e26;
          border-radius: 99px;
          margin-top: 28px;
          overflow: hidden;
          position: relative;
        }

        .h4l-track-fill {
          position: absolute;
          left: 0;
          top: 0;
          height: 100%;
          background: linear-gradient(90deg, #FF5533, #ff8866);
          border-radius: 99px;
          animation: trackFill 1.8s ease-in-out infinite;
        }

        @keyframes orbitSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }

        .h4l-orbit-wrap {
          width: 90px;
          height: 90px;
          position: relative;
          margin-bottom: -8px;
        }

        .h4l-orbit-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 1.5px solid transparent;
          border-top-color: rgba(255, 85, 51, 0.35);
          border-right-color: rgba(255, 85, 51, 0.1);
          animation: orbitSpin 2.2s linear infinite;
        }

        .h4l-orbit-ring-2 {
          inset: 10px;
          border-top-color: rgba(255, 85, 51, 0.2);
          border-right-color: rgba(255, 85, 51, 0.07);
          animation-duration: 3.1s;
          animation-direction: reverse;
        }
      `}</style>

      {/* Orbit rings behind the text */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="h4l-orbit-wrap" style={{ position: 'absolute' }}>
          <div className="h4l-orbit-ring" />
          <div className="h4l-orbit-ring h4l-orbit-ring-2" />
        </div>

        {/* H4L letters */}
        <div style={{ display: 'flex', gap: '0.08em', position: 'relative', zIndex: 1 }}>
          <span className="h4l-letter h4l-letter-h">H</span>
          <span className="h4l-letter h4l-letter-4">4</span>
          <span className="h4l-letter h4l-letter-l">L</span>
        </div>
      </div>

      <div className="h4l-subtitle">Hub4Learners</div>

      {/* Progress track */}
      <div className="h4l-track">
        <div className="h4l-track-fill" />
      </div>
    </div>
  )
}
