import React, { createContext, useReducer, ReactNode } from 'react';
import { Todo, TodoState, TodoAction } from '../types';
import { todoReducer } from '../utils/todoReducer';

export const TodoContext = createContext<{
  state: TodoState;
  dispatch: React.Dispatch<TodoAction>;
} | null>(null);

const initialState: TodoState = {
  todos: [],
  isLoading: false,
  error: null
};

export const TodoProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(todoReducer, initialState);

  return (
    <TodoContext.Provider value={{ state, dispatch }}>
      {children}
    </TodoContext.Provider>
  );
}