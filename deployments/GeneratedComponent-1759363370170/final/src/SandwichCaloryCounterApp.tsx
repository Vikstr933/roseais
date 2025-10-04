```tsx
interface Ingredient {
  id: string;
  name: string;
  calories: number;
  selected: boolean;
}

interface SandwichCaloryCounterAppProps {
  className?: string;
}

const SandwichCaloryCounterApp: React.FC<SandwichCaloryCounterAppProps> = ({ className }) => {
  const [loading, setLoading] = React.useState(false);
  const [ingredients, setIngredients] = React.useState<Ingredient[]>([
    { id: '1', name: 'Bread (2 slices)', calories: 140, selected: false },
    { id: '2', name: 'Turkey', calories: 50, selected: false },
    { id: '3', name: 'Ham', calories: 70, selected: false }, 
    { id: '4', name: 'Cheese', calories: 110, selected: false },
    { id: '5', name: 'Lettuce', calories: 5, selected: false },
    { id: '6', name: 'Tomato', calories: 22, selected: false },
    { id: '7', name: 'Mayo', calories: 95, selected: false },
    { id: '8', name: 'Mustard', calories: 15, selected: false },
    { id: '9', name: 'Avocado', calories: 120, selected: false },
    { id: '10', name: 'Bacon', calories: 43, selected: false }
  ]);

  const toggleIngredient = (id: string) => {
    setIngredients(ingredients.map(ing => 
      ing.id === id ? { ...ing, selected: !ing.selected } : ing
    ));
  };

  const totalCalories = ingredients
    .filter(ing => ing.selected)
    .reduce((sum, ing) => sum + ing.calories, 0);

  const resetSelections = () => {
    setIngredients(ingredients.map(ing => ({ ...ing, selected: false })));
  };

  return (
    <div className={`max-w-md mx-auto p-6 bg-white rounded-lg shadow-md ${className}`}>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        Sandwich Calorie Counter
      </h1>

      <div className="space-y-4 mb-6">
        {ingredients.map(ingredient => (
          <div 
            key={ingredient.id}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <label className="flex items-center cursor-pointer w-full">
              <input
                type="checkbox"
                checked={ingredient.selected}
                onChange={() => toggleIngredient(ingredient.id)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="ml-3 text-gray-700">{ingredient.name}</span>
              <span className="ml-auto text-gray-500">{ingredient.calories} cal</span>
            </label>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t">
        <div className="text-lg font-semibold">
          Total Calories: <span className="text-blue-600">{totalCalories}</span>
        </div>
        <button
          onClick={resetSelections}
          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50"
        >
          Reset
        </button>
      </div>
    </div>
  );
};

export default SandwichCaloryCounterApp;
```