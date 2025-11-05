import { useEffect, useRef, useState } from 'react';

/**
 * Optimistic Progress Bar Hook
 *
 * Provides a smooth, time-based progress that blends with actual event-based progress.
 * Uses logarithmic slowdown to create the perception of continuous movement while
 * never completing until the actual work is done.
 *
 * Pattern:
 * - 0-70%: Progresses relatively quickly (4-8 seconds)
 * - 70-90%: Slows down significantly (8-15 seconds)
 * - 90-99%: Progresses very slowly (can stay here indefinitely)
 * - 99-100%: Only jumps to complete when isComplete is true
 *
 * @param actualProgress - The real progress from events (0-100)
 * @param isComplete - Whether the work is actually done
 * @param isRunning - Whether work is in progress
 * @returns Current optimistic progress value (0-100)
 */
export function useOptimisticProgress(
  actualProgress: number,
  isComplete: boolean,
  isRunning: boolean
): number {
  const [optimisticProgress, setOptimisticProgress] = useState(0);
  const startTimeRef = useRef<number>(Date.now());
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    // Reset when starting new work
    if (isRunning && optimisticProgress === 0) {
      startTimeRef.current = Date.now();
    }

    // If complete, jump to 100%
    if (isComplete) {
      setOptimisticProgress(100);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    // If not running, don't animate
    if (!isRunning) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const animate = () => {
      const elapsedSeconds = (Date.now() - startTimeRef.current) / 1000;

      // Time-based progress with logarithmic slowdown
      // This creates the illusion of continuous movement that naturally slows as it approaches 99%
      let timeBasedProgress: number;

      if (elapsedSeconds < 8) {
        // 0-70% in first 8 seconds (relatively fast)
        timeBasedProgress = (elapsedSeconds / 8) * 70;
      } else if (elapsedSeconds < 20) {
        // 70-90% in next 12 seconds (slower)
        const progressInPhase = (elapsedSeconds - 8) / 12;
        timeBasedProgress = 70 + progressInPhase * 20;
      } else {
        // 90-99% - asymptotic approach (very slow, never reaches 99%)
        // Using logarithmic function: 90 + 9 * (1 - e^(-t/20))
        const timeInPhase = elapsedSeconds - 20;
        const asymptotic = 1 - Math.exp(-timeInPhase / 30);
        timeBasedProgress = 90 + asymptotic * 9; // Approaches but never reaches 99
      }

      // Blend time-based with actual progress
      // Use the maximum to ensure we never go backwards
      const blendedProgress = Math.max(timeBasedProgress, actualProgress);

      // Cap at 99% until actually complete
      const cappedProgress = Math.min(blendedProgress, 99);

      setOptimisticProgress(Math.round(cappedProgress * 10) / 10); // Round to 1 decimal

      // Continue animation
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    // Start animation loop
    animationFrameRef.current = requestAnimationFrame(animate);

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [actualProgress, isComplete, isRunning]);

  // Reset when not running and not complete
  useEffect(() => {
    if (!isRunning && !isComplete) {
      setOptimisticProgress(0);
      startTimeRef.current = Date.now();
    }
  }, [isRunning, isComplete]);

  return Math.round(optimisticProgress);
}
