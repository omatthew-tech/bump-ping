type Props = {
  variant: 'red' | 'green';
  size: number;
  legPhase: number;
};

const shellColors = {
  red: '#F04D45',
  green: '#1FB86A',
} as const;

const highlightColors = {
  red: '#FF7F7A',
  green: '#64E39C',
} as const;

const strokeColor = '#101820';
const degToRad = (deg: number) => (deg * Math.PI) / 180;

export default function LadybugSvg({ variant, size, legPhase }: Props) {
  const swing = (offset: number, amplitude = 14) => Math.sin(legPhase * Math.PI * 2 + offset) * amplitude;

  const legConfigs = [
    { id: 'leftFront', base: { x: 42, y: 70 }, angle: 205, length: 28, offset: 0 },
    { id: 'leftBack', base: { x: 42, y: 96 }, angle: 150, length: 28, offset: Math.PI },
    { id: 'rightFront', base: { x: 102, y: 70 }, angle: -25, length: 28, offset: Math.PI },
    { id: 'rightBack', base: { x: 102, y: 96 }, angle: 30, length: 28, offset: 0 },
  ] as const;

  const legs = legConfigs.map((leg) => {
    const dynamicAngle = leg.angle + swing(leg.offset);
    const rad = degToRad(dynamicAngle);
    const tipX = leg.base.x + Math.cos(rad) * leg.length;
    const tipY = leg.base.y + Math.sin(rad) * leg.length;
    return { ...leg, tipX, tipY };
  });

  return (
    <svg width={size} height={size} viewBox="0 0 144 160" aria-hidden="true">
      {/* legs */}
      {legs.map((leg) => (
        <path
          key={leg.id}
          d={`M${leg.base.x} ${leg.base.y} L${leg.tipX} ${leg.tipY}`}
          stroke={strokeColor}
          strokeWidth={6}
          strokeLinecap="round"
          fill="none"
        />
      ))}

      {/* shell shadow */}
      <circle cx="72" cy="94" r="44" fill={highlightColors[variant]} opacity={0.4} />

      {/* shell */}
      <circle cx="72" cy="88" r="44" fill={shellColors[variant]} stroke={strokeColor} strokeWidth={5} />

      {/* head */}
      <path
        d="M48 44 q10 -20 48 -20 16 0 24 12 8 10 8 20 0 12-10 18-10 8-30 8-20 0-30-8-10-6-10-16 0-8 0-4"
        fill={strokeColor}
      />

      {/* antennae */}
      <path d="M60 30 q-8 -14 -18 -6" stroke={strokeColor} strokeWidth={5} strokeLinecap="round" fill="none" />
      <path d="M108 30 q8 -14 18 -6" stroke={strokeColor} strokeWidth={5} strokeLinecap="round" fill="none" />
      <circle cx="40" cy="26" r="4" fill={strokeColor} />
      <circle cx="128" cy="26" r="4" fill={strokeColor} />
      <circle cx="80" cy="44" r="4" fill="#fff" opacity={0.9} />
      <circle cx="96" cy="44" r="3.5" fill="#fff" opacity={0.9} />

      {/* spots */}
      {([-1, 1] as const).map((direction) => (
        <circle key={direction} cx={72 + direction * 18} cy={88} r={11} fill={strokeColor} />
      ))}

      {/* seam */}
      <path d="M72 32 L72 136" stroke={strokeColor} strokeWidth={6} strokeLinecap="round" />
    </svg>
  );
}


