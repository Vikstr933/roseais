import { useEffect, useRef, useState } from 'react';

/**
 * Custom hook that animates a number smoothly from its current value to a target value
 * @param targetValue - The target number to animate towards
 * @param duration - Animation duration in milliseconds (default: 500)
 * @returns The currently animated value
 */
export function useAnimatedNumber(targetValue: number, duration: number = 500): number {
  const [displayValue, setDisplayValue] = useState(targetValue);
  const animationFrameRef = useRef<number>();
  const startTimeRef = useRef<number>();
  const startValueRef = useRef<number>(targetValue);

  useEffect(() => {
    // If target hasn't changed or animation is disabled, set immediately
    if (displayValue === targetValue || duration <= 0) {
      setDisplayValue(targetValue);
      return;
    }

    // Store the starting value for this animation
    startValueRef.current = displayValue;
    startTimeRef.current = undefined;

    const animate = (currentTime: number) => {
      // Initialize start time on first frame
      if (!startTimeRef.current) {
        startTimeRef.current = currentTime;
      }

      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function: easeOutCubic for smooth deceleration
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      // Calculate current value
      const difference = targetValue - startValueRef.current;
      const currentValue = startValueRef.current + difference * easeProgress;

      setDisplayValue(Math.round(currentValue));

      // Continue animation if not complete
      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    // Start animation
    animationFrameRef.current = requestAnimationFrame(animate);

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [targetValue, duration, displayValue]);

  return displayValue;
}
