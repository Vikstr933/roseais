import React, { useState, useCallback } from 'react';

const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [loading, setLoading] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);

  React.useEffect(() => {
    const handleError = () => setHasError(true);
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="error-boundary p-4 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-red-800 font-semibold">Something went wrong</h3>
        <p className="text-red-600">Please refresh the page to try again.</p>
      </div>
    );
  }

  return <>{children}</>;
};

export default function Calculator() {
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForNewValue, setWaitingForNewValue] = useState(false);

  const inputNumber = useCallback((num: string) => {
    if (waitingForNewValue) {
      setDisplay(num);
      setWaitingForNewValue(false);
    } else {
      setDisplay(display === '0' ? num : display + num);
    }
  }, [display, waitingForNewValue]);

  const inputOperation = useCallback((nextOperation: string) => {
    const inputValue = parseFloat(display);

    if (previousValue === null) {
      setPreviousValue(inputValue);
    } else if (operation) {
      const currentValue = previousValue || 0;
      const newValue = calculate(currentValue, inputValue, operation);

      setDisplay(`${newValue}`);
      setPreviousValue(newValue);
    }

    setWaitingForNewValue(true);
    setOperation(nextOperation);
  }, [display, previousValue, operation]);

  const calculate = (firstValue: number, secondValue: number, operation: string): number => {
    switch (operation) {
      case '+': return firstValue + secondValue;
      case '-': return firstValue - secondValue;
      case '×': return firstValue * secondValue;
      case '÷': return firstValue / secondValue;
      case '=': return secondValue;
      default: return secondValue;
    }
  };

  const performCalculation = useCallback(() => {
    if (previousValue !== null && operation) {
      const inputValue = parseFloat(display);
      const newValue = calculate(previousValue, inputValue, operation);

      setDisplay(`${newValue}`);
      setPreviousValue(null);
      setOperation(null);
      setWaitingForNewValue(true);
    }
  }, [display, previousValue, operation]);

  const clear = useCallback(() => {
    setDisplay('0');
    setPreviousValue(null);
    setOperation(null);
    setWaitingForNewValue(false);
  }, []);

  const clearEntry = useCallback(() => {
    setDisplay('0');
  }, []);

  return (
    <div className="calculator">
      <div className="display">{display}</div>

      <div className="buttons">
        <button onClick={clear} className="button function">AC</button>
        <button onClick={clearEntry} className="button function">CE</button>
        <button onClick={() => inputOperation('÷')} className="button operation">÷</button>
        <button onClick={() => inputOperation('×')} className="button operation">×</button>

        <button onClick={() => inputNumber('7')} className="button number">7</button>
        <button onClick={() => inputNumber('8')} className="button number">8</button>
        <button onClick={() => inputNumber('9')} className="button number">9</button>
        <button onClick={() => inputOperation('-')} className="button operation">-</button>

        <button onClick={() => inputNumber('4')} className="button number">4</button>
        <button onClick={() => inputNumber('5')} className="button number">5</button>
        <button onClick={() => inputNumber('6')} className="button number">6</button>
        <button onClick={() => inputOperation('+')} className="button operation">+</button>

        <button onClick={() => inputNumber('1')} className="button number">1</button>
        <button onClick={() => inputNumber('2')} className="button number">2</button>
        <button onClick={() => inputNumber('3')} className="button number">3</button>
        <button onClick={performCalculation} className="button equals" rowSpan={2}>=</button>

        <button onClick={() => inputNumber('0')} className="button number zero">0</button>
        <button onClick={() => inputNumber('.')} className="button number">.</button>
      </div>
    </div>
  );
}