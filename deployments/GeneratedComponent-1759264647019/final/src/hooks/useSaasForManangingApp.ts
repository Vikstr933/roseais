```typescript
// useForm.ts
import { useState, ChangeEvent } from 'react';

interface FormErrors {
  [key: string]: string;
}

export const useForm = <T extends Record<string, any>>(initialState: T) => {
  const [formData, setFormData] = useState<T>(initialState);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const resetForm = () => {
    setFormData(initialState);
    setErrors({});
    setIsSubmitting(false);
  };

  return {
    formData,
    errors,
    isSubmitting,
    setFormData,
    setErrors,
    setIsSubmitting,
    handleChange,
    resetForm
  };
};

// useValidation.ts
import { useState, useCallback } from 'react';

interface ValidationRules {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean;
}

interface FieldRules {
  [key: string]: ValidationRules;
}

export const useValidation = (rules: FieldRules) => {
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  const validateField = useCallback((name: string, value: any) => {
    const fieldRules = rules[name];
    if (!fieldRules) return '';

    if (fieldRules.required && !value) {
      return 'This field is required';
    }

    if (fieldRules.minLength && value.length < fieldRules.minLength) {
      return `Minimum length is ${fieldRules.minLength}`;
    }

    if (fieldRules.maxLength && value.length > fieldRules.maxLength) {
      return `Maximum length is ${fieldRules.maxLength}`;
    }

    if (fieldRules.pattern && !fieldRules.pattern.test(value)) {
      return 'Invalid format';
    }

    if (fieldRules.custom && !fieldRules.custom(value)) {
      return 'Invalid value';
    }

    return '';
  }, [rules]);

  const validateForm = useCallback((data: {[key: string]: any}) => {
    const newErrors: {[key: string]: string} = {};
    let isValid = true;

    Object.keys(rules).forEach(field => {
      const error = validateField(field, data[field]);
      if (error) {
        newErrors[field] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  }, [rules, validateField]);

  return {
    errors,
    validateField,
    validateForm,
    setErrors
  };
};

// useDebounce.ts
import { useState, useEffect } from 'react';

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

// useAsyncValidation.ts
import { useState, useCallback } from 'react';

export const useAsyncValidation = () => {
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const validateAsync = useCallback(async (
    value: string, 
    validationFn: (value: string) => Promise<boolean>
  ) => {
    try {
      setIsValidating(true);
      setValidationError(null);
      const isValid = await validationFn(value);
      if (!isValid) {
        setValidationError('Validation failed');
      }
      return isValid;
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Validation error');
      return false;
    } finally {
      setIsValidating(false);
    }
  }, []);

  return {
    isValidating,
    validationError,
    validateAsync,
    setValidationError
  };
};
```