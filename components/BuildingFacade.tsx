interface BuildingFacadeProps {
  round: number;
}

const WINDOW_POSITIONS = [
  { x: 34, y: 60 },
  { x: 84, y: 60 },
  { x: 134, y: 60 },
  { x: 34, y: 110 },
  { x: 84, y: 110 },
  { x: 134, y: 110 },
  { x: 34, y: 160 },
  { x: 84, y: 160 },
  { x: 134, y: 160 },
];

export function BuildingFacade({ round }: BuildingFacadeProps) {
  const showWindowGrid = round >= 1;
  const showWindowLight = round >= 2;
  const showBrickAndStamp = round >= 3;

  return (
    <svg
      viewBox="0 0 200 220"
      className="w-full max-w-[200px] mx-auto"
      role="img"
      aria-label={`Building facade, round ${round}`}
    >
      {/* Bare silhouette — always visible from round 0 */}
      <path
        d="M20 210 V50 L100 15 L180 50 V210 Z"
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <line x1="10" y1="210" x2="190" y2="210" stroke="var(--color-ink)" strokeWidth="2.5" />

      {/* Brick texture — round 3 */}
      <g
        stroke="var(--color-line)"
        strokeWidth="1"
        opacity={showBrickAndStamp ? 1 : 0}
        style={{ transition: "opacity 500ms ease" }}
      >
        {[70, 90, 110, 130, 150, 170, 190].map((y) => (
          <line key={y} x1="20" y1={y} x2="180" y2={y} />
        ))}
      </g>

      {/* Window grid outlines — round 1+ */}
      <g opacity={showWindowGrid ? 1 : 0} style={{ transition: "opacity 500ms ease" }}>
        {WINDOW_POSITIONS.map(({ x, y }) => (
          <rect
            key={`${x}-${y}`}
            x={x}
            y={y}
            width="22"
            height="30"
            rx="1"
            fill={showWindowLight ? "var(--color-success)" : "none"}
            fillOpacity={showWindowLight ? 0.5 : 1}
            stroke="var(--color-ink)"
            strokeWidth="1.5"
            style={{ transition: "fill-opacity 500ms ease" }}
          />
        ))}
      </g>

      {/* Door */}
      <rect x="88" y="180" width="24" height="30" fill="none" stroke="var(--color-ink)" strokeWidth="2" />

      {/* Address-stamp accent — round 3 */}
      <g
        opacity={showBrickAndStamp ? 1 : 0}
        style={{ transition: "opacity 500ms ease" }}
        transform="translate(150 192) rotate(-7)"
      >
        <rect x="-19" y="-11" width="38" height="22" rx="3" fill="none" stroke="var(--color-ink)" strokeWidth="1.5" />
        <text
          x="0"
          y="4"
          textAnchor="middle"
          fill="var(--color-ink)"
          fontSize="8.5"
          fontFamily="var(--font-mono)"
          letterSpacing="0.5"
        >
          FILED
        </text>
      </g>
    </svg>
  );
}
