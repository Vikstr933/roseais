```typescript
type Bread = 'white' | 'wheat' | 'rye' | 'sourdough' | 'gluten-free';

type Protein = 'turkey' | 'ham' | 'chicken' | 'tuna' | 'tofu';

type Toppings = 'lettuce' | 'tomato' | 'onion' | 'cheese' | 'avocado' | 'bacon';

interface CalorieInfo {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface IngredientCalories {
  [key: string]: CalorieInfo;
}

interface SandwichSelection {
  bread: Bread;
  protein: Protein;
  toppings: Toppings[];
  totalCalories: number;
}

interface ResponsiveConfig {
  isMobile: boolean;
  breakpoint: number;
  orientation: 'portrait' | 'landscape';
}

interface SandwichCaloryCounterState {
  currentSelection: SandwichSelection;
  history: SandwichSelection[];
  isCalculating: boolean;
  error: string | null;
}

interface SandwichCaloryCounterProps {
  defaultBread?: Bread;
  maxToppings?: number;
  showNutritionInfo?: boolean;
  responsive?: ResponsiveConfig;
  onSelectionChange?: (selection: SandwichSelection) => void;
  onCalculationComplete?: (calories: number) => void;
}

interface CalculatorFunctions {
  calculateTotalCalories: (selection: SandwichSelection) => number;
  validateSelection: (selection: SandwichSelection) => boolean;
  resetCalculator: () => void;
  updateSelection: (field: keyof SandwichSelection, value: any) => void;
}

type SandwichTheme = {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  fontSize: {
    small: string;
    medium: string;
    large: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
  };
};

interface AnimationConfig {
  duration: number;
  easing: 'ease' | 'linear' | 'ease-in' | 'ease-out';
  delay?: number;
}

interface SandwichCaloryCounterRef {
  reset: () => void;
  getCurrentSelection: () => SandwichSelection;
  calculateCalories: () => number;
}
```