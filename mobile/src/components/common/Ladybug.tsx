import Svg, { Circle, Path } from 'react-native-svg';

type LadybugVariant = 'red' | 'green';

type Props = {
  variant?: LadybugVariant;
  size?: number;
  legPhase?: number;
};

const shellColors: Record<LadybugVariant, string> = {
  red: '#F04D45',
  green: '#1FB86A',
};

const highlightColors: Record<LadybugVariant, string> = {
  red: '#FF7F7A',
  green: '#64E39C',
};

const strokeColor = '#101820';

const degToRad = (deg: number) => (deg * Math.PI) / 180;

const Ladybug = ({ variant = 'red', size = 72, legPhase = 0 }: Props) => {
  const swing = (offset: number, amplitude = 14) =>
    Math.sin(legPhase * Math.PI * 2 + offset) * amplitude;

  const legConfigs = [
    { id: 'leftFront', base: { x: 42, y: 70 }, angle: 205, length: 28, offset: 0 },
    { id: 'leftBack', base: { x: 42, y: 96 }, angle: 150, length: 28, offset: Math.PI },
    { id: 'rightFront', base: { x: 102, y: 70 }, angle: -25, length: 28, offset: Math.PI },
    { id: 'rightBack', base: { x: 102, y: 96 }, angle: 30, length: 28, offset: 0 },
  ];

  const legs = legConfigs.map((leg) => {
    const dynamicAngle = leg.angle + swing(leg.offset);
    const rad = degToRad(dynamicAngle);
    const tipX = leg.base.x + Math.cos(rad) * leg.length;
    const tipY = leg.base.y + Math.sin(rad) * leg.length;
    return { ...leg, tipX, tipY };
  });

  return (
    <Svg width={size} height={size} viewBox="0 0 144 160">
      {/* legs */}
      {legs.map((leg) => (
        <Path
          key={leg.id}
          d={`M${leg.base.x} ${leg.base.y} L${leg.tipX} ${leg.tipY}`}
          stroke={strokeColor}
          strokeWidth={6}
          strokeLinecap="round"
          fill="none"
        />
      ))}

      {/* shell shadow */}
      <Circle cx="72" cy="94" r="44" fill={highlightColors[variant]} opacity={0.4} />

      {/* shell */}
      <Circle cx="72" cy="88" r="44" fill={shellColors[variant]} stroke={strokeColor} strokeWidth={5} />

      {/* head */}
      <Path d="M48 44 q10 -20 48 -20 16 0 24 12 8 10 8 20 0 12-10 18-10 8-30 8-20 0-30-8-10-6-10-16 0-8 0-4" fill={strokeColor} />
      {/* antennae */}
      <Path d="M60 30 q-8 -14 -18 -6" stroke={strokeColor} strokeWidth={5} strokeLinecap="round" fill="none" />
      <Path d="M108 30 q8 -14 18 -6" stroke={strokeColor} strokeWidth={5} strokeLinecap="round" fill="none" />
      <Circle cx="40" cy="26" r="4" fill={strokeColor} />
      <Circle cx="128" cy="26" r="4" fill={strokeColor} />
      <Circle cx="80" cy="44" r="4" fill="#fff" opacity={0.9} />
      <Circle cx="96" cy="44" r="3.5" fill="#fff" opacity={0.9} />

      {/* shell divider */}
      <Path d="M28 88 h88" stroke={strokeColor} strokeWidth={3} strokeLinecap="round" opacity={0.08} />

      {/* spots */}
      {[-1, 1].map((direction) => (
        <Circle
          key={direction}
          cx={72 + direction * 18}
          cy={88}
          r={11}
          fill={strokeColor}
        />
      ))}

      {/* seam */}
      <Path d="M72 32 L72 136" stroke={strokeColor} strokeWidth={6} strokeLinecap="round" />
    </Svg>
  );
};

export default Ladybug;


