-- Migration: Fix NaN Timer Issues in Generated Code
-- Created: 2025-12-05
-- Purpose: Prevent AI from generating code with uninitialized values
--          that cause NaN or undefined to display in the UI

DO $$
DECLARE
  initialization_rules TEXT;
BEGIN
  
  initialization_rules := '

===================================================================
🔢 VALUE INITIALIZATION RULES (CRITICAL - Prevents NaN/undefined)
===================================================================

When generating timer, counter, or numeric display code:

❌ FORBIDDEN PATTERNS (cause NaN to display):

   // Bad - accessing undefined properties
   const time = props.initialTime;        // undefined if not passed
   const minutes = time / 60;             // NaN if time is undefined
   
   // Bad - no default values
   const [seconds, setSeconds] = useState();  // undefined initial state
   
   // Bad - formatting undefined
   function formatTime(s) { return `${Math.floor(s/60)}:${s%60}`; }  // NaN if s undefined

✅ CORRECT PATTERNS (safe initialization):

   // Good - always provide defaults
   const [seconds, setSeconds] = useState(0);
   const [minutes, setMinutes] = useState(0);
   const [hours, setHours] = useState(0);
   
   // Good - guard against undefined
   const initialSeconds = props.initialTime ?? 0;
   
   // Good - safe formatting with guards
   function formatTime(totalSeconds: number): string {
     const s = totalSeconds ?? 0;
     const mins = Math.floor(s / 60);
     const secs = s % 60;
     return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
   }
   
   // Good - always validate before display
   const displayValue = isNaN(value) ? "00:00" : formattedValue;

📋 TIMER/STOPWATCH CHECKLIST:

1. useState hooks MUST have initial values:
   ✅ useState(0)
   ✅ useState(25 * 60)  // For pomodoro default
   ❌ useState()
   ❌ useState(undefined)

2. Time calculations MUST guard against NaN:
   ✅ const mins = Math.floor((seconds ?? 0) / 60);
   ❌ const mins = Math.floor(seconds / 60);

3. Display values MUST be formatted safely:
   ✅ `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
   ❌ `${mins}:${secs}`  // May show "NaN:NaN"

4. Props MUST have defaults:
   ✅ interface TimerProps { initialSeconds?: number }
   ✅ const { initialSeconds = 0 } = props;

5. useEffect dependencies MUST be safe:
   ✅ useEffect(() => { if (isRunning && seconds > 0) ... }, [isRunning, seconds]);

===================================================================
';

  -- Update code_generator agent
  UPDATE agents
  SET system_prompt = CASE
    WHEN system_prompt NOT LIKE '%VALUE INITIALIZATION RULES%'
    THEN system_prompt || E'\n\n' || initialization_rules
    ELSE system_prompt
  END
  WHERE name = 'code_generator' AND is_active = true;

  -- Update component-developer agent  
  UPDATE agents
  SET system_prompt = CASE
    WHEN system_prompt NOT LIKE '%VALUE INITIALIZATION RULES%'
    THEN system_prompt || E'\n\n' || initialization_rules
    ELSE system_prompt
  END
  WHERE name = 'component-developer' AND is_active = true;

  RAISE NOTICE 'Updated agents with value initialization rules';

END $$;

