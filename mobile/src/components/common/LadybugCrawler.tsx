import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import Ladybug from './Ladybug';

type Props = {
  variant: 'red' | 'green';
  areaWidth: number;
  areaHeight: number;
  size?: number;
};

const AnimatedLadybug = ({ variant, areaWidth, areaHeight, size = 70 }: Props) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const rotation = useRef(new Animated.Value(0)).current;
  const currentPos = useRef({ x: 0, y: 0 });
  const headingRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const [legPhase, setLegPhase] = useState(0);

  const padding = size * 0.2;

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
    let frameId: number;
    const animateLegs = () => {
      setLegPhase((prev) => (prev + 0.02) % 1);
      frameId = requestAnimationFrame(animateLegs);
    };
    frameId = requestAnimationFrame(animateLegs);
    return () => cancelAnimationFrame(frameId);
  }, []);

  const getRandomTarget = useCallback(() => {
    const width = Math.max(areaWidth - size - padding * 2, 1);
    const height = Math.max(areaHeight - size - padding * 2, 1);
    const x = padding + Math.random() * width;
    const y = padding + Math.random() * height;
    return { x, y };
  }, [areaWidth, areaHeight, padding, size]);

  const initializePosition = useCallback(() => {
    if (!areaWidth || !areaHeight) {
      return;
    }
    const initial = getRandomTarget();
    translateX.setValue(initial.x);
    translateY.setValue(initial.y);
    currentPos.current = initial;
    headingRef.current = 0;
    rotation.setValue(0);
  }, [areaHeight, areaWidth, getRandomTarget, rotation, translateX, translateY]);

  const normalizeHeading = (angle: number) => {
    let normalized = ((angle % 360) + 360) % 360;
    if (normalized > 180) normalized -= 360;
    return normalized;
  };

  const rotationOffset = 90; // default SVG faces upward, offset clockwise to align with travel direction

  const moveToNextSpot = useCallback(() => {
    if (!areaWidth || !areaHeight) {
      return;
    }

    const next = getRandomTarget();
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
      useNativeDriver: true,
    }).start();

    const duration = Math.min(16000, Math.max(4500, distance * 45));

    Animated.parallel([
      Animated.timing(translateX, {
        toValue: next.x,
        duration,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: next.y,
        duration,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      currentPos.current = next;
      if (mountedRef.current) {
        clearTimer();
        timeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            moveToNextSpot();
          }
        }, 600 + Math.random() * 1600);
      }
    });
  }, [areaHeight, areaWidth, clearTimer, getRandomTarget, rotation, translateX, translateY]);

  useEffect(() => {
    if (!areaWidth || !areaHeight) {
      return;
    }
    clearTimer();
    initializePosition();
    moveToNextSpot();
  }, [areaWidth, areaHeight, initializePosition, moveToNextSpot]);

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


