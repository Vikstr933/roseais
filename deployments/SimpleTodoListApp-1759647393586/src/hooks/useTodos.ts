import { useContext } from 'react';
import { TodoContext } from '../components/TodoProvider';

export const useTodos = () => {
  const context = useContext(TodoContext);
  if (!context) {
    throw new Error('useTodos must be used within a TodoProvider');
  }

  const { state: { todos, isLoading, error } } = context;
  return { todos, isLoading, error };
}