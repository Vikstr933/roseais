```typescript
type Bread = 'white' | 'wheat' | 'rye' | 'sourdough' | 'gluten-free';

type Protein = 'turkey' | 'ham' | 'chicken' | 'tuna' | 'tofu';

type Cheese = 'american' | 'swiss' | 'cheddar' | 'provolone' | 'none';

type Vegetables = 'lettuce' | 'tomato' | 'onion' | 'cucumber' | 'peppers';

type Condiment = 'mayo' | 'mustard' | 'ranch' | 'oil' | 'vinegar';

interface CalorieInfo {
  bread: Record<Bread, number>;
  protein: Record<Protein, number>;
  cheese: Record<Cheese, number>;
  vegetables: Record<Vegetables, number>;
  condiments: Record<Condiment, number>;
}

interface SandwichSelection {
  bread: Bread;
  protein: Protein;
  cheese: Cheese;
  vegetables: Vegetables[];
  condiments: Condiment[];
}

interface SandwichState extends SandwichSelection {
  totalCalories: number;
  isCustomizing: boolean;
}

interface SandwichCaloryCounterProps {
  defaultSelection?: Partial<SandwichSelection>;
  maxCalories?: number;
  onSave?: (sandwich: SandwichSelection) => void;
  onCalorieExceeded?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

interface ResponsiveConfig {
  breakpoints: {
    sm: number;
    md: number;
    lg: number;
  };
  layouts: {
    mobile: string;
    tablet: string;
    desktop: string;
  };
}

interface SandwichIngredientProps {
  type: keyof SandwichSelection;
  selected: string | string[];
  calories: number;
  onChange: (value: string | string[]) => void;
  disabled?: boolean;
}

interface CaloryCounterState {
  currentSandwich: SandwichState;
  savedSandwiches: SandwichSelection[];
  isEditing: boolean;
  activeBreakpoint: keyof ResponsiveConfig['breakpoints'];
  error?: string;
}

type SandwichActionType = 
  | { type: 'UPDATE_INGREDIENT'; payload: Partial<SandwichSelection> }
  | { type: 'RESET_SANDWICH' }
  | { type: 'SAVE_SANDWICH' }
  | { type: 'SET_EDITING'; payload: boolean }
  | { type: 'UPDATE_CALORIES'; payload: number };

type IngredientChangeHandler = (
  type: keyof SandwichSelection,
  value: string | string[]
) => void;

type CaloryCalculator = (selection: Partial<SandwichSelection>) => number;
```