```typescript
import { useState, useEffect, useCallback } from 'react';

interface Ingredient {
  id: string;
  name: string;
  calories: number;
  quantity: number;
}

export const useIngredientCalculator = (initialIngredients: Ingredient[]) => {
  const [ingredients, setIngredients] = useState<Ingredient[]>(initialIngredients);
  const [totalCalories, setTotalCalories] = useState(0);

  const calculateTotalCalories = useCallback(() => {
    const total = ingredients.reduce((sum, item) => {
      return sum + (item.calories * item.quantity);
    }, 0);
    setTotalCalories(total);
  }, [ingredients]);

  useEffect(() => {
    calculateTotalCalories();
  }, [ingredients, calculateTotalCalories]);

  const updateIngredientQuantity = (id: string, quantity: number) => {
    setIngredients(prev => 
      prev.map(ing => 
        ing.id === id ? { ...ing, quantity } : ing
      )
    );
  };

  const addIngredient = (ingredient: Ingredient) => {
    setIngredients(prev => [...prev, ingredient]);
  };

  const removeIngredient = (id: string) => {
    setIngredients(prev => prev.filter(ing => ing.id !== id));
  };

  return {
    ingredients,
    totalCalories,
    updateIngredientQuantity,
    addIngredient,
    removeIngredient
  };
};

export const useViewportSize = () => {
  const [width, setWidth] = useState(window.innerWidth);
  const [height, setHeight] = useState(window.innerHeight);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setWidth(window.innerWidth);
      setHeight(window.innerHeight);
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return { width, height, isMobile };
};

export const useLocalStorage = <T,>(key: string, initialValue: T) => {
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
      console.error(error);
    }
  };

  return [storedValue, setValue] as const;
};

export const useDebounce = <T,>(value: T, delay: number): T => {
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
```