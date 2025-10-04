```typescript
type BreadType = 'white' | 'wheat' | 'rye' | 'sourdough' | 'gluten-free';

type Protein = 'turkey' | 'ham' | 'chicken' | 'tuna' | 'tofu';

type Cheese = 'american' | 'swiss' | 'cheddar' | 'provolone' | 'none';

type Toppings = 'lettuce' | 'tomato' | 'onion' | 'pickles' | 'cucumber' | 'avocado';

type Condiment = 'mayo' | 'mustard' | 'ranch' | 'oil-vinegar' | 'none';

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
  bread: BreadType;
  protein: Protein;
  cheese: Cheese;
  toppings: Toppings[];
  condiments: Condiment[];
}

interface SandwichState {
  currentSelection: SandwichSelection;
  totalCalories: CalorieInfo;
  isCalculating: boolean;
}

interface ResponsiveConfig {
  isMobile: boolean;
  breakpoint: number;
  orientation: 'portrait' | 'landscape';
}

interface SandwichCaloryCounterProps {
  defaultSelection?: Partial<SandwichSelection>;
  maxToppings?: number;
  maxCondiments?: number;
  allowCustomizations?: boolean;
  theme?: 'light' | 'dark';
  responsive?: ResponsiveConfig;
  onSelectionChange?: (selection: SandwichSelection) => void;
  onCalorieCalculated?: (calories: CalorieInfo) => void;
}

interface ValidationError {
  field: keyof SandwichSelection;
  message: string;
}

type CalculationStatus = 'idle' | 'calculating' | 'complete' | 'error';

interface SandwichContextType {
  state: SandwichState;
  dispatch: React.Dispatch<SandwichAction>;
  validation: ValidationError[];
  status: CalculationStatus;
}

type SandwichAction = 
  | { type: 'SET_BREAD'; payload: BreadType }
  | { type: 'SET_PROTEIN'; payload: Protein }
  | { type: 'SET_CHEESE'; payload: Cheese }
  | { type: 'ADD_TOPPING'; payload: Toppings }
  | { type: 'REMOVE_TOPPING'; payload: Toppings }
  | { type: 'ADD_CONDIMENT'; payload: Condiment }
  | { type: 'REMOVE_CONDIMENT'; payload: Condiment }
  | { type: 'RESET_SELECTION' }
  | { type: 'SET_CALCULATING'; payload: boolean }
  | { type: 'UPDATE_CALORIES'; payload: CalorieInfo };
```