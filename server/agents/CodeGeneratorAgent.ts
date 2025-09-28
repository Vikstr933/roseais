import { BaseAgent } from './BaseAgent';
import { ToolRegistry } from '../utils/ToolRegistry';

export class CodeGeneratorAgent extends BaseAgent {
  constructor() {
    super('code-generator');
  }

  protected async setup(): Promise<void> {
    this.logger.info('Code Generator Agent initialized');
  }

  async executeTask(task: string): Promise<{
    files: { path: string; content: string }[]
  }> {
    this.logger.info(`Generating code for: ${task}`);

    const files = [];

    // Generate main component file
    const mainComponent = await this.generateMainComponent(task, null);
    files.push({
      path: `src/${this.getComponentName(task)}.tsx`,
      content: mainComponent
    });

    // Generate hooks if needed
    const hooks = await this.generateHooks(task);
    if (hooks) {
      files.push({
        path: `src/hooks/use${this.getComponentName(task)}.ts`,
        content: hooks
      });
    }

    // Generate types
    const types = await this.generateTypes(task);
    if (types) {
      files.push({
        path: 'src/types.ts',
        content: types
      });
    }

    // Generate utilities
    const utils = await this.generateUtils(task);
    if (utils) {
      files.push({
        path: 'src/utils.ts',
        content: utils
      });
    }

    // Generate main entry file
    const mainEntry = await this.generateMainEntry(this.getComponentName(task));
    files.push({
      path: 'src/main.tsx',
      content: mainEntry
    });

    // Generate CSS
    const styles = await this.generateBasicStyles();
    files.push({
      path: 'src/index.css',
      content: styles
    });

    return { files };
  }

  private getComponentName(task: string): string {
    if (task.toLowerCase().includes('todo')) return 'TodoApp';
    if (task.toLowerCase().includes('calculator')) return 'Calculator';
    if (task.toLowerCase().includes('form')) return 'FormApp';
    if (task.toLowerCase().includes('dashboard')) return 'Dashboard';
    if (task.toLowerCase().includes('chat')) return 'ChatApp';
    if (task.toLowerCase().includes('weather')) return 'WeatherApp';
    if (task.toLowerCase().includes('timer')) return 'Timer';
    if (task.toLowerCase().includes('counter')) return 'Counter';
    return 'App';
  }

  private async generateMainComponent(task: string, uiDesign?: any): Promise<string> {
    const componentName = this.getComponentName(task);
    const taskLower = task.toLowerCase();

    if (taskLower.includes('todo')) {
      return this.generateTodoApp(componentName);
    } else if (taskLower.includes('calculator')) {
      return this.generateCalculator(componentName);
    } else if (taskLower.includes('counter')) {
      return this.generateCounter(componentName);
    } else if (taskLower.includes('form')) {
      return this.generateForm(componentName);
    } else {
      return this.generateGenericApp(componentName, task);
    }
  }

  private generateTodoApp(componentName: string): string {
    return `import React, { useState, useCallback } from 'react';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

export default function ${componentName}() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [inputValue, setInputValue] = useState('');

  const addTodo = useCallback(() => {
    if (inputValue.trim()) {
      setTodos(prev => [
        ...prev,
        {
          id: Date.now(),
          text: inputValue.trim(),
          completed: false
        }
      ]);
      setInputValue('');
    }
  }, [inputValue]);

  const toggleTodo = useCallback((id: number) => {
    setTodos(prev =>
      prev.map(todo =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  }, []);

  const deleteTodo = useCallback((id: number) => {
    setTodos(prev => prev.filter(todo => todo.id !== id));
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    addTodo();
  }, [addTodo]);

  return (
    <div className="todo-app">
      <h1>Todo List</h1>

      <form onSubmit={handleSubmit} className="todo-form">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Add a new todo..."
          className="todo-input"
        />
        <button type="submit" className="add-button">
          Add
        </button>
      </form>

      <ul className="todo-list">
        {todos.map(todo => (
          <li key={todo.id} className={\`todo-item \${todo.completed ? 'completed' : ''}\`}>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => toggleTodo(todo.id)}
              className="todo-checkbox"
            />
            <span className="todo-text">{todo.text}</span>
            <button
              onClick={() => deleteTodo(todo.id)}
              className="delete-button"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>

      {todos.length === 0 && (
        <p className="empty-message">No todos yet. Add one above!</p>
      )}

      <div className="stats">
        <p>
          {todos.filter(t => !t.completed).length} of {todos.length} remaining
        </p>
      </div>
    </div>
  );
}`;
  }

  private generateCalculator(componentName: string): string {
    return `import React, { useState, useCallback } from 'react';

export default function ${componentName}() {
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

      setDisplay(\`\${newValue}\`);
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

      setDisplay(\`\${newValue}\`);
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
}`;
  }

  private generateCounter(componentName: string): string {
    return `import React, { useState, useCallback } from 'react';

export default function ${componentName}() {
  const [count, setCount] = useState(0);

  const increment = useCallback(() => {
    setCount(prev => prev + 1);
  }, []);

  const decrement = useCallback(() => {
    setCount(prev => prev - 1);
  }, []);

  const reset = useCallback(() => {
    setCount(0);
  }, []);

  return (
    <div className="counter">
      <h1>Counter</h1>

      <div className="count-display">
        <span className="count-value">{count}</span>
      </div>

      <div className="counter-buttons">
        <button onClick={decrement} className="button secondary">
          -
        </button>
        <button onClick={reset} className="button">
          Reset
        </button>
        <button onClick={increment} className="button primary">
          +
        </button>
      </div>
    </div>
  );
}`;
  }

  private generateForm(componentName: string): string {
    return `import React, { useState, useCallback } from 'react';

interface FormData {
  name: string;
  email: string;
  message: string;
}

export default function ${componentName}() {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('Form submitted:', formData);
    setIsSubmitted(true);
    setIsSubmitting(false);
  }, [formData]);

  const resetForm = useCallback(() => {
    setFormData({ name: '', email: '', message: '' });
    setIsSubmitted(false);
  }, []);

  if (isSubmitted) {
    return (
      <div className="form-container">
        <div className="success-message">
          <h2>Thank you!</h2>
          <p>Your message has been sent successfully.</p>
          <button onClick={resetForm} className="button">
            Send Another Message
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="form-container">
      <h1>Contact Form</h1>

      <form onSubmit={handleSubmit} className="contact-form">
        <div className="form-group">
          <label htmlFor="name">Name *</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label htmlFor="email">Email *</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            required
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label htmlFor="message">Message *</label>
          <textarea
            id="message"
            name="message"
            value={formData.message}
            onChange={handleInputChange}
            required
            rows={5}
            className="form-textarea"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="button primary"
        >
          {isSubmitting ? 'Sending...' : 'Send Message'}
        </button>
      </form>
    </div>
  );
}`;
  }

  private generateGenericApp(componentName: string, task: string): string {
    return `import React, { useState } from 'react';

export default function ${componentName}() {
  const [message, setMessage] = useState('Hello from your generated app!');

  return (
    <div className="app">
      <header className="app-header">
        <h1>${componentName}</h1>
        <p>Generated from: "{task}"</p>
      </header>

      <main className="app-main">
        <div className="message-display">
          <p>{message}</p>
        </div>

        <div className="controls">
          <button
            onClick={() => setMessage('Button clicked!')}
            className="button primary"
          >
            Click me
          </button>
          <button
            onClick={() => setMessage('Hello from your generated app!')}
            className="button secondary"
          >
            Reset
          </button>
        </div>
      </main>
    </div>
  );
}`;
  }

  private async generateHooks(task: string): Promise<string | null> {
    const taskLower = task.toLowerCase();

    if (taskLower.includes('todo')) {
      return `import { useState, useCallback, useEffect } from 'react';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

export const useTodos = () => {
  const [todos, setTodos] = useState<Todo[]>([]);

  // Load todos from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('todos');
    if (saved) {
      try {
        setTodos(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved todos');
      }
    }
  }, []);

  // Save todos to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('todos', JSON.stringify(todos));
  }, [todos]);

  const addTodo = useCallback((text: string) => {
    if (text.trim()) {
      const newTodo: Todo = {
        id: Date.now(),
        text: text.trim(),
        completed: false
      };
      setTodos(prev => [...prev, newTodo]);
    }
  }, []);

  const toggleTodo = useCallback((id: number) => {
    setTodos(prev =>
      prev.map(todo =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  }, []);

  const deleteTodo = useCallback((id: number) => {
    setTodos(prev => prev.filter(todo => todo.id !== id));
  }, []);

  const clearCompleted = useCallback(() => {
    setTodos(prev => prev.filter(todo => !todo.completed));
  }, []);

  return {
    todos,
    addTodo,
    toggleTodo,
    deleteTodo,
    clearCompleted
  };
};`;
    }

    return null;
  }

  private async generateTypes(task: string): Promise<string | null> {
    const taskLower = task.toLowerCase();

    if (taskLower.includes('todo')) {
      return `export interface Todo {
  id: number;
  text: string;
  completed: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TodoFilters {
  all: Todo[];
  active: Todo[];
  completed: Todo[];
}

export type TodoAction = 'add' | 'toggle' | 'delete' | 'clear-completed';`;
    }

    return null;
  }

  private async generateUtils(task: string): Promise<string | null> {
    return `export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
};

export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

export const generateId = (): number => {
  return Date.now() + Math.random();
};`;
  }

  private async generateMainEntry(componentName: string): Promise<string> {
    return `import React from 'react';
import ReactDOM from 'react-dom/client';
import ${componentName} from './${componentName}';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <${componentName} />
  </React.StrictMode>
);`;
  }

  private async generateBasicStyles(): Promise<string> {
    return `:root {
  --primary-color: #3b82f6;
  --primary-hover: #2563eb;
  --secondary-color: #6b7280;
  --secondary-hover: #4b5563;
  --success-color: #10b981;
  --danger-color: #ef4444;
  --warning-color: #f59e0b;
  --background-color: #ffffff;
  --surface-color: #f8fafc;
  --text-color: #1e293b;
  --text-muted: #64748b;
  --border-color: #e2e8f0;
  --border-radius: 8px;
  --shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  --font-size-sm: 14px;
  --font-size-base: 16px;
  --font-size-lg: 18px;
  --font-size-xl: 20px;
  --font-size-2xl: 24px;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: var(--font-family);
  font-size: var(--font-size-base);
  color: var(--text-color);
  background-color: var(--background-color);
  line-height: 1.6;
}

#root {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-lg);
}

.app {
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
}

.app-header {
  text-align: center;
  margin-bottom: var(--spacing-xl);
}

.app-header h1 {
  font-size: var(--font-size-2xl);
  margin-bottom: var(--spacing-sm);
}

.app-header p {
  color: var(--text-muted);
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid transparent;
  border-radius: var(--border-radius);
  font-family: inherit;
  font-size: var(--font-size-base);
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 40px;
}

.button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.button.primary {
  background-color: var(--primary-color);
  color: white;
}

.button.primary:hover:not(:disabled) {
  background-color: var(--primary-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow);
}

.button.secondary {
  background-color: var(--surface-color);
  color: var(--text-color);
  border-color: var(--border-color);
}

.button.secondary:hover:not(:disabled) {
  background-color: var(--secondary-color);
  color: white;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  font-family: inherit;
  font-size: var(--font-size-base);
  transition: border-color 0.2s ease;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-group {
  margin-bottom: var(--spacing-md);
}

.form-group label {
  display: block;
  margin-bottom: var(--spacing-xs);
  font-weight: 500;
  color: var(--text-color);
}

/* Todo App Specific Styles */
.todo-app {
  max-width: 500px;
  margin: 0 auto;
}

.todo-form {
  display: flex;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-lg);
}

.todo-input {
  flex: 1;
}

.todo-list {
  list-style: none;
  margin-bottom: var(--spacing-lg);
}

.todo-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  margin-bottom: var(--spacing-xs);
  background: var(--surface-color);
}

.todo-item.completed .todo-text {
  text-decoration: line-through;
  color: var(--text-muted);
}

.todo-text {
  flex: 1;
}

.delete-button {
  background: var(--danger-color);
  color: white;
  border: none;
  border-radius: var(--border-radius);
  padding: var(--spacing-xs) var(--spacing-sm);
  cursor: pointer;
  font-size: var(--font-size-sm);
}

.empty-message {
  text-align: center;
  color: var(--text-muted);
  margin: var(--spacing-xl) 0;
}

.stats {
  text-align: center;
  color: var(--text-muted);
  font-size: var(--font-size-sm);
}

/* Calculator Specific Styles */
.calculator {
  max-width: 300px;
  margin: 0 auto;
  background: var(--surface-color);
  padding: var(--spacing-lg);
  border-radius: var(--border-radius);
  box-shadow: var(--shadow);
}

.display {
  background: var(--text-color);
  color: white;
  padding: var(--spacing-lg);
  border-radius: var(--border-radius);
  margin-bottom: var(--spacing-md);
  text-align: right;
  font-size: var(--font-size-xl);
  font-weight: 600;
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.buttons {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--spacing-sm);
}

.calculator .button {
  height: 50px;
  border: none;
  border-radius: var(--border-radius);
  font-size: var(--font-size-base);
  font-weight: 600;
}

.calculator .button.number {
  background: white;
  color: var(--text-color);
  border: 1px solid var(--border-color);
}

.calculator .button.operation {
  background: var(--warning-color);
  color: white;
}

.calculator .button.function {
  background: var(--secondary-color);
  color: white;
}

.calculator .button.equals {
  background: var(--primary-color);
  color: white;
  grid-row: span 2;
}

.calculator .button.zero {
  grid-column: span 2;
}

/* Counter Specific Styles */
.counter {
  text-align: center;
  max-width: 400px;
  margin: 0 auto;
}

.count-display {
  margin: var(--spacing-xl) 0;
}

.count-value {
  font-size: 4rem;
  font-weight: bold;
  color: var(--primary-color);
  display: block;
}

.counter-buttons {
  display: flex;
  gap: var(--spacing-md);
  justify-content: center;
}

.counter .button {
  min-width: 80px;
  font-size: var(--font-size-lg);
}

/* Form Specific Styles */
.form-container {
  max-width: 500px;
  margin: 0 auto;
}

.contact-form {
  background: var(--surface-color);
  padding: var(--spacing-xl);
  border-radius: var(--border-radius);
  box-shadow: var(--shadow);
}

.success-message {
  text-align: center;
  background: var(--surface-color);
  padding: var(--spacing-xl);
  border-radius: var(--border-radius);
  box-shadow: var(--shadow);
}

.success-message h2 {
  color: var(--success-color);
  margin-bottom: var(--spacing-md);
}

/* Responsive Design */
@media (max-width: 768px) {
  #root {
    padding: var(--spacing-md);
  }

  .app {
    width: 100%;
  }

  .todo-form {
    flex-direction: column;
  }

  .counter-buttons {
    flex-direction: column;
    align-items: center;
  }

  .calculator {
    max-width: 280px;
  }
}`;
  }
}