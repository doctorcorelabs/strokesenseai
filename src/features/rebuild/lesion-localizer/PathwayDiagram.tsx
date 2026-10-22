// Schematic diagram of the corticobulbar pathway for the Face Lesion
// Localizer. Deliberately stylised and vertical: face motor cortex at the
// top, then the genu of the internal capsule, the facial nucleus in the
// pons, the facial nerve, and the face muscles at the bottom. A dashed side
// branch shows that the forehead part of the facial nucleus receives input
// from both hemispheres, the anatomical key that separates a central (UMN)
// pattern from a peripheral (LMN) pattern. It teaches pathway reasoning; it
// is not an anatomical atlas. Styling follows TerritoryMap.tsx: inline SVG
// attributes with project hex tokens, no separate stylesheet.

export type PathwayLevel = 'cortex' | 'internal-capsule' | 'pons' | 'peripheral';

const GREEN = '#126454';
const DEEP = '#153e34';
const INK = '#243b36';
const MUTED = '#4e5b56';
const MINT = '#eaf3ed';
const NODE_STROKE = '#7d8b83';
const SKETCH_FILL = '#f4faf8';

const ACTIVE_NAMES: Record<PathwayLevel, string> = {
  cortex: 'face motor cortex',
  'internal-capsule': 'internal capsule (genu)',
  pons: 'pons (facial nucleus)',
  peripheral: 'facial nerve and face muscles',
};

interface NodeSpec {
  level: PathwayLevel | 'nerve';
  y: number;
  title: string;
  sub: string;
}

// Main column: nodes span x 30..270, arrows run down the centre at x 150.
const NODES: NodeSpec[] = [
  { level: 'cortex', y: 112, title: 'Face motor cortex', sub: '(precentral gyrus)' },
  { level: 'internal-capsule', y: 192, title: 'Internal capsule', sub: '(genu)' },
  { level: 'pons', y: 272, title: 'Pons', sub: '(facial nucleus)' },
  { level: 'nerve', y: 352, title: 'Facial nerve', sub: '(CN VII)' },
];

function isNodeActive(level: NodeSpec['level'], activeLevel?: PathwayLevel | null): boolean {
  if (!activeLevel) return false;
  if (level === 'nerve') return activeLevel === 'peripheral';
  return level === activeLevel;
}

export function PathwayDiagram({ activeLevel }: { activeLevel?: PathwayLevel | null }) {
  const cortexActive = activeLevel === 'cortex';
  const peripheralActive = activeLevel === 'peripheral';

  const ariaLabel =
    'Schematic diagram of the corticobulbar pathway: face motor cortex, then the genu of the ' +
    'internal capsule, then the facial nucleus in the pons, then the facial nerve, ending at the ' +
    'face muscles. A side branch shows that the forehead receives input from both sides of the brain.' +
    (activeLevel ? ` Highlighted level: ${ACTIVE_NAMES[activeLevel]}.` : '');

  return (
    <figure style={{ margin: 0 }}>
      <svg
        viewBox="0 0 420 640"
        role="img"
        aria-label={ariaLabel}
        style={{ width: '100%', maxWidth: 440, display: 'block' }}
      >
        <defs>
          <marker
            id="ll-pathway-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0 0L10 5L0 10z" fill={GREEN} />
          </marker>
        </defs>

        {/* Brain sketch above the cortex node */}
        <ellipse
          cx={150}
          cy={56}
          rx={92}
          ry={42}
          fill={cortexActive ? MINT : SKETCH_FILL}
          stroke={cortexActive ? GREEN : DEEP}
          strokeWidth={cortexActive ? 2.5 : 2}
        />
        <path
          d="M92 44 q 30 -16 58 0 q 26 12 52 2"
          fill="none"
          stroke={GREEN}
          strokeWidth={1.5}
          opacity={0.55}
        />
        <circle cx={112} cy={72} r={6} fill={GREEN} stroke="#ffffff" strokeWidth={1.5} />
        <line x1={150} y1={98} x2={150} y2={112} stroke={GREEN} strokeWidth={2} />

        {/* Opposite cortex sketch feeding the forehead branch */}
        <circle
          cx={356}
          cy={56}
          r={26}
          fill={SKETCH_FILL}
          stroke={DEEP}
          strokeWidth={1.5}
        />
        <path d="M338 50 q 18 -10 36 0" fill="none" stroke={GREEN} strokeWidth={1.2} opacity={0.55} />
        <text x={356} y={100} textAnchor="middle" fontSize={11} fill={MUTED}>
          opposite cortex
        </text>

        {/* Forehead branch: dashed lines from both cortices into the pons node */}
        <path
          d="M270 139 H316 V299 H272"
          fill="none"
          stroke={GREEN}
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
        <path
          d="M330 56 H316 V139"
          fill="none"
          stroke={GREEN}
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
        <text x={324} y={196} fontSize={12} fontWeight={600} fill={DEEP}>
          Forehead: input
        </text>
        <text x={324} y={212} fontSize={12} fontWeight={600} fill={DEEP}>
          from both sides
        </text>

        {/* Pathway nodes */}
        {NODES.map((node) => {
          const active = isNodeActive(node.level, activeLevel);
          return (
            <g key={node.level}>
              <rect
                x={30}
                y={node.y}
                width={240}
                height={54}
                rx={14}
                fill={active ? MINT : '#ffffff'}
                stroke={active ? GREEN : NODE_STROKE}
                strokeWidth={active ? 2.5 : 1.5}
              />
              <text
                x={150}
                y={node.y + 24}
                textAnchor="middle"
                fontSize={15}
                fontWeight={active ? 700 : 600}
                fill={active ? DEEP : INK}
              >
                {node.title}
              </text>
              <text
                x={150}
                y={node.y + 44}
                textAnchor="middle"
                fontSize={12}
                fill={MUTED}
              >
                {node.sub}
              </text>
            </g>
          );
        })}

        {/* Arrows between nodes, with the tract named once */}
        {[166, 246, 326, 406].map((y) => (
          <line
            key={y}
            x1={150}
            y1={y}
            x2={150}
            y2={y + 22}
            stroke={GREEN}
            strokeWidth={2}
            markerEnd="url(#ll-pathway-arrow)"
          />
        ))}
        <text x={162} y={182} fontSize={11} fill={MUTED}>
          corticobulbar tract
        </text>

        {/* Face sketch as the pathway endpoint (face muscles) */}
        <ellipse
          cx={150}
          cy={496}
          rx={64}
          ry={68}
          fill={peripheralActive ? MINT : '#ffffff'}
          stroke={peripheralActive ? GREEN : DEEP}
          strokeWidth={peripheralActive ? 2.5 : 2}
        />
        <line x1={116} y1={464} x2={136} y2={464} stroke={DEEP} strokeWidth={2.5} strokeLinecap="round" />
        <line x1={164} y1={464} x2={184} y2={464} stroke={DEEP} strokeWidth={2.5} strokeLinecap="round" />
        <ellipse cx={126} cy={478} rx={7} ry={4.5} fill={DEEP} />
        <ellipse cx={174} cy={478} rx={7} ry={4.5} fill={DEEP} />
        <path
          d="M150 486 v14 q -4 6 -10 6"
          fill="none"
          stroke={DEEP}
          strokeWidth={2}
          strokeLinecap="round"
        />
        <line
          x1={112}
          y1={526}
          x2={188}
          y2={526}
          stroke={NODE_STROKE}
          strokeWidth={1}
          strokeDasharray="3 4"
        />
        <path
          d="M120 526 Q 150 538 180 534"
          fill="none"
          stroke={DEEP}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <text
          x={150}
          y={592}
          textAnchor="middle"
          fontSize={15}
          fontWeight={peripheralActive ? 700 : 600}
          fill={peripheralActive ? DEEP : INK}
        >
          Face muscles
        </text>
        <text x={150} y={612} textAnchor="middle" fontSize={12} fill={MUTED}>
          one side of the mouth sits a little lower
        </text>
      </svg>
      <figcaption className="muted">
        Schematic pathway diagram, not to anatomical scale. The forehead receives input from both
        sides of the brain, which is why it can stay strong in a central pattern.
      </figcaption>
    </figure>
  );
}
