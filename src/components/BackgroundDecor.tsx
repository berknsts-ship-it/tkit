function LetterBlock({ x, y, letter, rotate = 0, size = 64 }: {
  x: number; y: number; letter: string; rotate?: number; size?: number;
}) {
  const r = size * 0.14;
  const fontSize = size * 0.5;
  const d = size * 0.06;
  return (
    <g transform={`translate(${x}, ${y}) rotate(${rotate})`} opacity="0.82">
      <rect x={d} y={d} width={size} height={size} rx={r} fill="#8a6540" opacity="0.18" />
      <path
        d={`M${r},${size} L${size - r},${size} L${size},${size - r} L${size + d},${size - r + d} L${size + d - r + r},${size + d} Z`}
        fill="#a07040" opacity="0.25"
      />
      <defs>
        <linearGradient id={`tg-${letter}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f8e8cc" />
          <stop offset="100%" stopColor="#d4b07a" />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={size} height={size} rx={r}
        fill={`url(#tg-${letter})`} stroke="#b8956a" strokeWidth="1.5" />
      <rect x={3} y={3} width={size - 6} height={size * 0.35} rx={r * 0.7}
        fill="white" opacity="0.22" />
      <text
        x={size / 2} y={size * 0.71}
        fontSize={fontSize}
        textAnchor="middle"
        fill="#5c3d20"
        fontFamily="Georgia, serif"
        fontStyle="italic"
        opacity="0.9"
      >{letter}</text>
      <rect x={4} y={4} width={size - 8} height={size - 8} rx={r * 0.6}
        fill="none" stroke="#c8a060" strokeWidth="1" opacity="0.4" />
    </g>
  );
}

function Book({ x, y, rotate = 0, scale = 1 }: { x: number; y: number; rotate?: number; scale?: number }) {
  return (
    <g transform={`translate(${x}, ${y}) rotate(${rotate}) scale(${scale})`} opacity="0.78">
      <rect x="3" y="3" width="44" height="56" rx="4" fill="#5c3010" opacity="0.12" />
      <rect x="0" y="0" width="8" height="56" rx="3" fill="#8a6030" />
      <defs>
        <linearGradient id="book-cover" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c8984a" />
          <stop offset="100%" stopColor="#8a6030" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="44" height="56" rx="4" fill="url(#book-cover)" />
      <rect x="40" y="2" width="6" height="52" rx="1" fill="#f0e0c0" opacity="0.9" />
      <line x1="40" y1="6"  x2="46" y2="6"  stroke="#d4b880" strokeWidth="0.5" />
      <line x1="40" y1="10" x2="46" y2="10" stroke="#d4b880" strokeWidth="0.5" />
      <line x1="40" y1="14" x2="46" y2="14" stroke="#d4b880" strokeWidth="0.5" />
      <rect x="6" y="0" width="34" height="56" rx="3" fill="#f5e8cc" />
      <line x1="11" y1="13" x2="36" y2="13" stroke="#c8a060" strokeWidth="1.5" opacity="0.7" />
      <line x1="11" y1="21" x2="36" y2="21" stroke="#c8a060" strokeWidth="1.5" opacity="0.7" />
      <line x1="11" y1="29" x2="28" y2="29" stroke="#c8a060" strokeWidth="1.5" opacity="0.7" />
      <line x1="11" y1="37" x2="32" y2="37" stroke="#c8a060" strokeWidth="1.5" opacity="0.7" />
      <rect x="6" y="1" width="16" height="28" rx="2" fill="white" opacity="0.1" />
    </g>
  );
}

function Pencil({ x, y, rotate = 0 }: { x: number; y: number; rotate?: number }) {
  return (
    <g transform={`translate(${x}, ${y}) rotate(${rotate})`} opacity="0.72">
      <rect x="2" y="2" width="13" height="70" rx="3" fill="#3b2010" opacity="0.12" />
      <rect x="0" y="0" width="13" height="10" rx="2" fill="#e8a0a0" />
      <rect x="0" y="10" width="13" height="5" fill="#c0a870" />
      <line x1="0" y1="13" x2="13" y2="13" stroke="#a08840" strokeWidth="0.8" />
      <defs>
        <linearGradient id="pencil-body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#c8a050" />
          <stop offset="40%" stopColor="#e8c070" />
          <stop offset="100%" stopColor="#a07030" />
        </linearGradient>
      </defs>
      <rect x="0" y="15" width="13" height="55" rx="1" fill="url(#pencil-body)" />
      <polygon points="0,70 13,70 6.5,86" fill="#d4a870" />
      <polygon points="4,83 9,83 6.5,90" fill="#6a5030" />
      <rect x="3" y="15" width="3" height="55" rx="1" fill="white" opacity="0.18" />
    </g>
  );
}

export default function BackgroundDecor() {
  return (
    <svg
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0, opacity: 0.28 }}
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <filter id="drop" x="-20%" y="-20%" width="150%" height="150%">
          <feDropShadow dx="2" dy="3" stdDeviation="4" floodColor="#3b2a1a" floodOpacity="0.18" />
        </filter>
      </defs>

      <g filter="url(#drop)"><LetterBlock x={40} y={30} letter="T" rotate={-12} size={72} /></g>
      <g filter="url(#drop)"><LetterBlock x={148} y={18} letter="K" rotate={8} size={60} /></g>

      <g filter="url(#drop)"><LetterBlock x={665} y={16} letter="i" rotate={-6} size={68} /></g>

      <g filter="url(#drop)"><Book x={1260} y={18} rotate={-8} scale={1.6} /></g>
      <g filter="url(#drop)"><Pencil x={1402} y={12} rotate={-35} /></g>

      <g filter="url(#drop)"><LetterBlock x={16} y={460} letter="t" rotate={15} size={66} /></g>
      <g stroke="#d4b880" strokeWidth="1.8" opacity="0.55">
        <line x1="0" y1="565" x2="120" y2="565" />
        <line x1="0" y1="583" x2="90"  y2="583" />
        <line x1="0" y1="601" x2="130" y2="601" />
      </g>

      <g filter="url(#drop)"><LetterBlock x={1360} y={298} letter="K" rotate={-14} size={66} /></g>
      <g stroke="#d4b880" strokeWidth="1.8" opacity="0.55">
        <line x1="1315" y1="545" x2="1440" y2="545" />
        <line x1="1345" y1="563" x2="1440" y2="563" />
        <line x1="1305" y1="581" x2="1440" y2="581" />
      </g>

      <g filter="url(#drop)"><Book x={322} y={678} rotate={-10} scale={2} /></g>
      <g filter="url(#drop)"><LetterBlock x={660} y={792} letter="i" rotate={5} size={64} /></g>

      <g filter="url(#drop)"><Book x={1062} y={688} rotate={12} scale={2} /></g>

      <g filter="url(#drop)"><Pencil x={62} y={718} rotate={22} /></g>
      <g filter="url(#drop)"><LetterBlock x={18} y={822} letter="T" rotate={-8} size={60} /></g>

      <g filter="url(#drop)"><LetterBlock x={1352} y={800} letter="t" rotate={10} size={64} /></g>
      <g filter="url(#drop)"><Pencil x={1222} y={758} rotate={-18} /></g>
    </svg>
  );
}
