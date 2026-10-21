// Schematic arterial territory map for the Localization Challenge.
// Deliberately stylised: an axial outline with the major territories as
// blocks, frontal at the top and occipital at the bottom, drawn in the
// neurological convention (the patient's left is on the left of the image).
// It teaches territory reasoning; it is not an anatomical atlas.

import type { ReactNode } from 'react';
import type { SideId } from './localizationCases';

const BASE_FILL = '#e9e4d8';
const DEEP_FILL = '#d8d2c2';
const HIGHLIGHT_FILL = '#126454';
const STROKE = '#b9b09a';

interface RegionDef {
  territory: string;
  side: SideId | 'midline';
  label: string;
  labelX: number;
  labelY: number;
  labelSize?: number;
  draw: (fill: string) => ReactNode;
}

function hemisphereRegions(side: SideId): RegionDef[] {
  // Left hemisphere occupies x 25..215, right hemisphere x 185..375.
  // The midline is x 200. Within one hemisphere the medial strip is ACA,
  // the lower band is PCA, and the lateral field splits into MCA divisions.
  const medial = side === 'left' ? 186 : 200;
  const lateralStart = side === 'left' ? 30 : 216;
  const lateralWidth = 154;
  const centerX = side === 'left' ? 107 : 293;
  const deepCx = side === 'left' ? 128 : 272;
  return [
    {
      territory: 'aca',
      side,
      label: 'ACA',
      labelX: side === 'left' ? 193 : 207,
      labelY: 135,
      labelSize: 8,
      draw: (fill) => <rect x={medial} y={30} width={14} height={200} fill={fill} stroke={STROKE} />,
    },
    {
      territory: 'pca',
      side,
      label: 'PCA',
      labelX: centerX,
      labelY: 210,
      draw: (fill) => (
        <rect x={lateralStart} y={182} width={lateralWidth} height={48} fill={fill} stroke={STROKE} />
      ),
    },
    {
      territory: 'mca-superior',
      side,
      label: 'MCA sup',
      labelX: centerX,
      labelY: 72,
      draw: (fill) => (
        <rect x={lateralStart} y={30} width={lateralWidth} height={76} fill={fill} stroke={STROKE} />
      ),
    },
    {
      territory: 'mca-inferior',
      side,
      label: 'MCA inf',
      labelX: centerX,
      labelY: 148,
      draw: (fill) => (
        <rect x={lateralStart} y={106} width={lateralWidth} height={76} fill={fill} stroke={STROKE} />
      ),
    },
    {
      territory: 'mca-deep',
      side,
      label: 'deep',
      labelX: deepCx,
      labelY: 144,
      draw: (fill) => <circle cx={deepCx} cy={140} r={19} fill={fill} stroke={STROKE} />,
    },
  ];
}

const REGIONS: RegionDef[] = [
  ...hemisphereRegions('left'),
  ...hemisphereRegions('right'),
  {
    territory: 'brainstem-perforators',
    side: 'midline',
    label: 'brainstem',
    labelX: 200,
    labelY: 260,
    draw: (fill) => <ellipse cx={200} cy={256} rx={17} ry={13} fill={fill} stroke={STROKE} />,
  },
  {
    territory: 'cerebellar-arteries',
    side: 'left',
    label: 'cerebellum',
    labelX: 128,
    labelY: 292,
    draw: (fill) => <ellipse cx={128} cy={288} rx={58} ry={17} fill={fill} stroke={STROKE} />,
  },
  {
    territory: 'cerebellar-arteries',
    side: 'right',
    label: 'cerebellum',
    labelX: 272,
    labelY: 292,
    draw: (fill) => <ellipse cx={272} cy={288} rx={58} ry={17} fill={fill} stroke={STROKE} />,
  },
];

export default function TerritoryMap({
  highlightTerritory,
  highlightSide,
}: {
  highlightTerritory?: string;
  highlightSide?: SideId;
}) {
  return (
    <figure style={{ margin: 0 }}>
      <svg
        viewBox="0 0 400 316"
        role="img"
        aria-label="Schematic brain map with arterial territories"
        style={{ width: '100%', maxWidth: 460, display: 'block' }}
      >
        <ellipse cx={120} cy={130} rx={97} ry={104} fill="none" stroke="#8a8271" strokeWidth={2} />
        <ellipse cx={280} cy={130} rx={97} ry={104} fill="none" stroke="#8a8271" strokeWidth={2} />
        {REGIONS.map((region) => {
          const active =
            highlightTerritory === region.territory &&
            (region.side === 'midline' || region.side === highlightSide);
          const baseFill = region.territory === 'mca-deep' ? DEEP_FILL : BASE_FILL;
          return (
            <g key={`${region.territory}-${region.side}`}>
              {region.draw(active ? HIGHLIGHT_FILL : baseFill)}
              <text
                x={region.labelX}
                y={region.labelY}
                textAnchor="middle"
                fontSize={region.labelSize ?? 10}
                fill={active ? '#ffffff' : '#5c5546'}
                fontWeight={active ? 700 : 400}
              >
                {region.label}
              </text>
            </g>
          );
        })}
        <text x={200} y={16} textAnchor="middle" fontSize={10} fill="#5c5546">
          frontal (front)
        </text>
        <text x={30} y={16} fontSize={10} fill="#5c5546">
          patient left
        </text>
        <text x={370} y={16} textAnchor="end" fontSize={10} fill="#5c5546">
          patient right
        </text>
      </svg>
      <figcaption className="muted">
        Schematic territory map, not to anatomical scale. The highlighted block is the key
        territory for the case you just answered.
      </figcaption>
    </figure>
  );
}
