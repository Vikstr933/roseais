```typescript
import { useState, useEffect, useCallback } from 'react';

interface Ingredient {
  id: string;
  name: string;
  calories: number;
  selected: boolean;
}

export const useIngredientsList = (initialIngredients: Ingredient[]) => {
  const [ingredients, setIngredients] = useState<Ingredient[]>(initialIngredients);
  const [totalCalories, setTotalCalories] = useState(0);

  const toggleIngredient = useCallback((id: string) => {
    setIngredients(prev => 
      prev.map(ing => 
        ing.id === id ? {...ing, selected: !ing.selected} : ing
      )
    );
  }, []);

  useEffect(() => {
    const newTotal = ingredients
      .filter(ing => ing.selected)
      .reduce((sum, ing) => sum + ing.calories, 0);
    setTotalCalories(newTotal);
  }, [ingredients]);

  return { ingredients, totalCalories, toggleIngredient };
};

export const useViewportSize = () => {
  const [width, setWidth] = useState(window.innerWidth);
  const [height, setHeight] = useState(window.innerHeight);

  useEffect(() => {
    const handleResize = () => {
      setWidth(window.innerWidth);
      setHeight(window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return { width, height };
};

export const useLocalStorage = <T>(key: string, initialValue: T) => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.log(error);
    }
  };

  return [storedValue, setValue] as const;
};

export const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

export const useSandwichHistory = () => {
  const [history, setHistory] = useState<{
    timestamp: Date;
    calories: number;
    ingredients: string[];
  }[]>([]);

  const addToHistory = useCallback((calories: number, ingredients: string[]) => {
    setHistory(prev => [...prev, {
      timestamp: new Date(),
      calories,
      ingredients
    }]);
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  return { history, addToHistory, clearHistory };
};
```