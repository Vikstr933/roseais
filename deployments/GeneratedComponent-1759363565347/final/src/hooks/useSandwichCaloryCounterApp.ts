```typescript
import { useState, useEffect, useCallback, RefObject } from 'react';

export interface Ingredient {
  id: string;
  name: string;
  calories: number;
  quantity: number;
}

export const useIngredientCalculator = (ingredients: Ingredient[]) => {
  const [totalCalories, setTotalCalories] = useState<number>(0);

  useEffect(() => {
    const calculatedTotal = ingredients.reduce((sum, ingredient) => {
      return sum + (ingredient.calories * ingredient.quantity);
    }, 0);
    setTotalCalories(calculatedTotal);
  }, [ingredients]);

  return { totalCalories };
};

export const useIngredientManager = () => {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);

  const addIngredient = useCallback((ingredient: Ingredient) => {
    setIngredients(prev => [...prev, ingredient]);
  }, []);

  const removeIngredient = useCallback((id: string) => {
    setIngredients(prev => prev.filter(ing => ing.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    setIngredients(prev => 
      prev.map(ing => ing.id === id ? { ...ing, quantity } : ing)
    );
  }, []);

  return { ingredients, addIngredient, removeIngredient, updateQuantity };
};

export const useViewportSize = () => {
  const [viewport, setViewport] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
    isMobile: window.innerWidth < 768
  });

  useEffect(() => {
    const handleResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
        isMobile: window.innerWidth < 768
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return viewport;
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
      console.error(error);
    }
  };

  return [storedValue, setValue] as const;
};

export const useClickOutside = (ref: RefObject<HTMLElement>, handler: () => void) => {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }
      handler();
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
};
```