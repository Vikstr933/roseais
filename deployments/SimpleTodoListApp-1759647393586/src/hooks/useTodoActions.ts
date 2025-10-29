import { useContext } from 'react';
import { TodoContext } from '../components/TodoProvider';

export const useTodoActions = () => {
  const context = useContext(TodoContext);
  if (!context) {
    throw new Error('useTodoActions must be used within a TodoProvider');
  }

  const { dispatch } = context;

  const addTodo = (text: string) => {
    dispatch({ type: 'ADD_TODO', payload: text });
  };

  const toggleTodo = (id: number) => {
    dispatch({ type: 'TOGGLE_TODO', payload: id });
  };

  const deleteTodo = (id: number) => {
    dispatch({ type: 'DELETE_TODO', payload: id });
  };

  return { addTodo, toggleTodo, deleteTodo };
}