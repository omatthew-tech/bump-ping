import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import Ladybug from './Ladybug';

type Props = {
  variant: 'red' | 'green';
  areaWidth: number;
  areaHeight: number;
  size?: number;
};

type Point = { x: number; y: number };
type RegistryEntry = {
  id: string;
  x: number;
  y: number;
  size: number;
  lastBumpAt: number;
  stuckUntil: number;
  edgeTurnUntil: number;
  bump: (other: Point) => void;
};

const registry = new Map<string, RegistryEntry>();

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const distSq = (a: Point, b: Point) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};
const normalizeHeading = (angle: number) => {
  let normalized = ((angle % 360) + 360) % 360;
  if (normalized > 180) normalized -= 360;
  return normalized;
};

const AnimatedLadybug = ({ variant, areaWidth, areaHeight, size = 70 }: Props) => {
  const idRef = useRef(`ladybug_${Math.random().toString(36).slice(2)}`);
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const rotation = useRef(new Animated.Value(0)).current;
  const currentPos = useRef({ x: 0, y: 0 });
  const headingRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const [legPhase, setLegPhase] = useState(0);
  const lastCollisionCheckAt = useRef(0);
  const lastEdgeCheckAt = useRef(0);

  const padding = size * 0.2;
  const bounds = useMemo(() => {
    const maxX = Math.max(padding, areaWidth - size - padding);
    const maxY = Math.max(padding, areaHeight - size - padding);
    return { minX: padding, minY: padding, maxX, maxY };
  }, [areaHeight, areaWidth, padding, size]);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      translateX.stopAnimation();
      translateY.stopAnimation();
      rotation.stopAnimation();
      clearTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = idRef.current;
    const entry: RegistryEntry = {
      id,
      x: currentPos.current.x,
      y: currentPos.current.y,
      size,
      lastBumpAt: 0,
      stuckUntil: 0,
      edgeTurnUntil: 0,
      bump: () => {},
    };
    registry.set(id, entry);
    return () => {
      registry.delete(id);
    };
  }, [size]);

  useEffect(() => {
    let frameId: number;
    const animateLegs = () => {
      setLegPhase((prev) => (prev + 0.02) % 1);
      frameId = requestAnimationFrame(animateLegs);
    };
    frameId = requestAnimationFrame(animateLegs);
    return () => cancelAnimationFrame(frameId);
  }, []);

  const getRandomTarget = useCallback(
    (avoid?: Point) => {
      const width = Math.max(areaWidth - size - padding * 2, 1);
      const height = Math.max(areaHeight - size - padding * 2, 1);
      const minAvoidDist = ((size * 0.55) + (avoid ? size * 0.55 : 0)) * 1.15;
      const minAvoidDistSq = minAvoidDist * minAvoidDist;

      // Try a few times to pick a point not too close to `avoid`.
      for (let i = 0; i < 10; i += 1) {
        const x = padding + Math.random() * width;
        const y = padding + Math.random() * height;
        if (!avoid || distSq({ x, y }, avoid) > minAvoidDistSq) {
          return { x, y };
        }
      }

      // Fallback: accept whatever we got.
      return {
        x: padding + Math.random() * width,
        y: padding + Math.random() * height,
      };
    },
    [areaWidth, areaHeight, padding, size],
  );

  const initializePosition = useCallback(() => {
    if (!areaWidth || !areaHeight) {
      return;
    }
    const initial = getRandomTarget();
    translateX.setValue(initial.x);
    translateY.setValue(initial.y);
    currentPos.current = initial;
    headingRef.current = rotationOffset;
    rotation.setValue(rotationOffset);
  }, [areaHeight, areaWidth, getRandomTarget, rotation, translateX, translateY]);

  const rotationOffset = 90; // default SVG faces upward, offset clockwise to align with travel direction
  const maxTurnDeg = 40;
  const minWanderDistance = useMemo(
    () => Math.max(size * 3.2, Math.min(areaWidth, areaHeight) * 0.25),
    [areaHeight, areaWidth, size],
  );

  const pickNextTarget = useCallback(
    (opts?: { avoid?: Point; minDistance?: number }) => {
      const avoid = opts?.avoid;
      const minDistance = opts?.minDistance ?? 0;
      const minDistanceSq = minDistance * minDistance;

      // `headingRef` stores rotation (includes `rotationOffset`). Convert to travel heading.
      const currentTravelHeading = normalizeHeading(headingRef.current - rotationOffset);

      let best: { point: Point; score: number; distanceSq: number } | null = null;
      let farFallback: { point: Point; distanceSq: number } | null = null;

      // Prefer candidates that are "forward-ish" and far, to reduce frequent turning.
      for (let i = 0; i < 40; i += 1) {
        const candidate = getRandomTarget(avoid);
        const dx = candidate.x - currentPos.current.x;
        const dy = candidate.y - currentPos.current.y;
        const distanceSq = dx * dx + dy * dy;
        if (distanceSq < minDistanceSq) continue;

        const candidateHeading = normalizeHeading((Math.atan2(dy, dx) * 180) / Math.PI);
        const delta = normalizeHeading(candidateHeading - currentTravelHeading);
        const absDelta = Math.abs(delta);

        if (!farFallback || distanceSq > farFallback.distanceSq) {
          farFallback = { point: candidate, distanceSq };
        }

        // Strongly prefer smaller turns; use distance as a tie-breaker.
        if (absDelta <= maxTurnDeg) {
          const score = absDelta * 1000 - Math.sqrt(distanceSq); // lower is better
          if (!best || score < best.score) {
            best = { point: candidate, score, distanceSq };
          }
        }
      }

      if (best) return best.point;

      // If we couldn't find a "forward-ish" candidate, still prefer going far to avoid jitter.
      return farFallback?.point ?? getRandomTarget(avoid);
    },
    [getRandomTarget, rotationOffset],
  );

  const scheduleNext = useCallback(() => {
    clearTimer();
    timeoutRef.current = setTimeout(() => {
      if (mountedRef.current) {
        const next = pickNextTarget({ minDistance: minWanderDistance });
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        startMove(next);
      }
    }, 900 + Math.random() * 1800);
  }, [clearTimer, minWanderDistance, pickNextTarget]);

  const startMove = useCallback(
    (next: Point, durationOverride?: number, afterDelayMs?: number) => {
      if (!areaWidth || !areaHeight) {
        return;
      }

    const dx = next.x - currentPos.current.x;
    const dy = next.y - currentPos.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const rawHeading = (Math.atan2(dy, dx) * 180) / Math.PI;
    const normalizedHeading = normalizeHeading(rawHeading);
    let targetHeading = normalizeHeading(normalizedHeading + rotationOffset);
    const delta = targetHeading - headingRef.current;
    if (delta > 180) {
      targetHeading -= 360;
    } else if (delta < -180) {
      targetHeading += 360;
    }
    headingRef.current = targetHeading;

    Animated.timing(rotation, {
      toValue: targetHeading,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    const duration = durationOverride ?? Math.min(16000, Math.max(4500, distance * 45));

    Animated.parallel([
      Animated.timing(translateX, {
        toValue: next.x,
        duration,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(translateY, {
        toValue: next.y,
        duration,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      }),
    ]).start(() => {
      currentPos.current = next;
      if (mountedRef.current) {
        if (typeof afterDelayMs === 'number') {
          clearTimer();
          timeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              scheduleNext();
            }
          }, afterDelayMs);
        } else {
          scheduleNext();
        }
      }
    });
    },
    [areaHeight, areaWidth, clearTimer, rotation, scheduleNext, translateX, translateY],
  );

  const bumpAwayFrom = useCallback(
    (other: Point) => {
      if (!areaWidth || !areaHeight) return;

      clearTimer();
      translateX.stopAnimation();
      translateY.stopAnimation();
      rotation.stopAnimation();

      // "Peaceful bump": don't shove apart. Pause in place, then choose a new direction.
      const pauseMs = 2000 + Math.random() * 1000;
      const id = idRef.current;
      const entry = registry.get(id);
      if (entry) {
        entry.stuckUntil = Date.now() + pauseMs;
      }
      timeoutRef.current = setTimeout(() => {
        if (!mountedRef.current) return;

        // After a bump, pick a farther target so we keep roaming the full screen (and not oscillating).
        const minFarDistance = Math.max(size * 4, Math.min(areaWidth, areaHeight) * 0.35);
        startMove(pickNextTarget({ avoid: other, minDistance: minFarDistance }));
      }, pauseMs);
    },
    [areaHeight, areaWidth, clearTimer, pickNextTarget, rotation, size, startMove, translateX, translateY],
  );

  const maybeTurnFromEdge = useCallback(
    (x: number, y: number) => {
      const now = Date.now();
      if (now - lastEdgeCheckAt.current < 120) return;
      lastEdgeCheckAt.current = now;

      const id = idRef.current;
      const entry = registry.get(id);
      if (!entry) return;
      if (now < entry.stuckUntil) return;
      if (now < entry.edgeTurnUntil) return;

      const margin = padding * 0.9;
      const outLeft = x <= bounds.minX + margin;
      const outRight = x >= bounds.maxX - margin;
      const outTop = y <= bounds.minY + margin;
      const outBottom = y >= bounds.maxY - margin;

      // If we're not near an edge, do nothing.
      if (!outLeft && !outRight && !outTop && !outBottom) return;

      const travelHeading = normalizeHeading(headingRef.current - rotationOffset);
      const rad = (travelHeading * Math.PI) / 180;
      const dirX = Math.cos(rad);
      const dirY = Math.sin(rad);

      // Only "bounce" if we're actually heading toward that edge (or already out of bounds).
      const shouldBounce =
        (outLeft && (dirX < -0.15 || x < bounds.minX)) ||
        (outRight && (dirX > 0.15 || x > bounds.maxX)) ||
        (outTop && (dirY < -0.15 || y < bounds.minY)) ||
        (outBottom && (dirY > 0.15 || y > bounds.maxY));

      if (!shouldBounce) return;

      let nextHeading = travelHeading;
      if (outLeft || outRight) {
        nextHeading = normalizeHeading(180 - nextHeading);
      }
      if (outTop || outBottom) {
        nextHeading = normalizeHeading(-nextHeading);
      }

      const distance = Math.max(size * 3, Math.min(areaWidth, areaHeight) * 0.45);
      const nextRad = (nextHeading * Math.PI) / 180;
      const target = {
        x: clamp(currentPos.current.x + Math.cos(nextRad) * distance, bounds.minX, bounds.maxX),
        y: clamp(currentPos.current.y + Math.sin(nextRad) * distance, bounds.minY, bounds.maxY),
      };

      // Longer cooldown so we don't "thrash" at the boundary and constantly re-target.
      entry.edgeTurnUntil = now + 3200;

      clearTimer();
      translateX.stopAnimation();
      translateY.stopAnimation();
      rotation.stopAnimation();
      startMove(target);
    },
    [
      areaHeight,
      areaWidth,
      bounds.maxX,
      bounds.maxY,
      bounds.minX,
      bounds.minY,
      clearTimer,
      padding,
      rotation,
      rotationOffset,
      size,
      startMove,
      translateX,
      translateY,
    ],
  );

  const maybeCollide = useCallback(() => {
    const now = Date.now();
    if (now - lastCollisionCheckAt.current < 90) return;
    lastCollisionCheckAt.current = now;

    const id = idRef.current;
    const meEntry = registry.get(id);
    if (!meEntry) return;
    if (now < meEntry.stuckUntil) return;
    if (now - meEntry.lastBumpAt < 1800) return;

    const mePos = { x: meEntry.x, y: meEntry.y };

    for (const otherEntry of registry.values()) {
      if (otherEntry.id === id) continue;
      if (now < otherEntry.stuckUntil) continue;
      if (now - otherEntry.lastBumpAt < 1800) continue;

      const minDist = (meEntry.size + otherEntry.size) * 0.36;
      if (distSq(mePos, { x: otherEntry.x, y: otherEntry.y }) <= minDist * minDist) {
        meEntry.lastBumpAt = now;
        otherEntry.lastBumpAt = now;
        bumpAwayFrom({ x: otherEntry.x, y: otherEntry.y });
        otherEntry.bump({ x: meEntry.x, y: meEntry.y });
        break;
      }
    }
  }, [bumpAwayFrom]);

  useEffect(() => {
    if (!areaWidth || !areaHeight) {
      return;
    }
    clearTimer();
    initializePosition();
    const next = pickNextTarget({ minDistance: minWanderDistance });
    startMove(next);
  }, [areaWidth, areaHeight, clearTimer, initializePosition, minWanderDistance, pickNextTarget, startMove]);

  useEffect(() => {
    const id = idRef.current;
    const entry = registry.get(id);
    if (!entry) return;
    entry.bump = bumpAwayFrom;
  }, [bumpAwayFrom]);

  useEffect(() => {
    const id = idRef.current;
    let x = currentPos.current.x;
    let y = currentPos.current.y;

    const updateRegistry = () => {
      currentPos.current = { x, y };
      const entry = registry.get(id);
      if (entry) {
        entry.x = x;
        entry.y = y;
      }
      maybeTurnFromEdge(x, y);
      maybeCollide();
    };

    const subX = translateX.addListener(({ value }) => {
      x = value;
      updateRegistry();
    });
    const subY = translateY.addListener(({ value }) => {
      y = value;
      updateRegistry();
    });

    return () => {
      translateX.removeListener(subX);
      translateY.removeListener(subY);
    };
  }, [maybeCollide, translateX, translateY]);

  const rotate = rotation.interpolate({
    inputRange: [-360, 360],
    outputRange: ['-360deg', '360deg'],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ladybug,
        { width: size, height: size },
        {
          transform: [{ translateX }, { translateY }, { rotate }],
        },
      ]}
    >
      <Ladybug variant={variant} size={size} legPhase={legPhase} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  ladybug: {
    position: 'absolute',
  },
});

export default AnimatedLadybug;


