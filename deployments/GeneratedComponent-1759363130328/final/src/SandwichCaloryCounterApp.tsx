```tsx
interface Ingredient {
  id: string;
  name: string;
  calories: number;
}

interface SelectedIngredient extends Ingredient {
  quantity: number;
}

const SandwichCaloryCounterApp = () => {
  const [loading, setLoading] = React.useState(false);
  const [selectedIngredients, setSelectedIngredients] = React.useState<SelectedIngredient[]>([]);

  const availableIngredients: Ingredient[] = [
    { id: '1', name: 'Bread (1 slice)', calories: 80 },
    { id: '2', name: 'Turkey', calories: 30 },
    { id: '3', name: 'Cheese', calories: 110 },
    { id: '4', name: 'Lettuce', calories: 5 },
    { id: '5', name: 'Tomato', calories: 22 },
    { id: '6', name: 'Mayo', calories: 95 },
    { id: '7', name: 'Mustard', calories: 15 },
  ];

  const addIngredient = (ingredient: Ingredient) => {
    const existing = selectedIngredients.find(i => i.id === ingredient.id);
    
    if (existing) {
      setSelectedIngredients(selectedIngredients.map(i => 
        i.id === ingredient.id 
          ? { ...i, quantity: i.quantity + 1 }
          : i
      ));
    } else {
      setSelectedIngredients([...selectedIngredients, { ...ingredient, quantity: 1 }]);
    }
  };

  const removeIngredient = (id: string) => {
    setSelectedIngredients(selectedIngredients.filter(i => i.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity < 1) return;
    
    setSelectedIngredients(selectedIngredients.map(i =>
      i.id === id ? { ...i, quantity } : i
    ));
  };

  const totalCalories = selectedIngredients.reduce((sum, item) => 
    sum + (item.calories * item.quantity), 0
  );

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Sandwich Calorie Counter</h1>
      
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Available Ingredients</h2>
          <div className="space-y-2">
            {availableIngredients.map(ingredient => (
              <button
                key={ingredient.id}
                onClick={() => addIngredient(ingredient)}
                className="w-full text-left p-2 hover:bg-gray-100 rounded flex justify-between items-center"
              >
                <span>{ingredient.name}</span>
                <span className="text-gray-600">{ingredient.calories} cal</span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Your Sandwich</h2>
          {selectedIngredients.length === 0 ? (
            <p className="text-gray-500">Add ingredients to your sandwich</p>
          ) : (
            <div className="space-y-3">
              {selectedIngredients.map(ingredient => (
                <div key={ingredient.id} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p>{ingredient.name}</p>
                    <p className="text-sm text-gray-600">
                      {ingredient.calories * ingredient.quantity} cal
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min="1"
                      value={ingredient.quantity}
                      onChange={(e) => updateQuantity(ingredient.id, parseInt(e.target.value))}
                      className="w-16 p-1 border rounded"
                    />
                    <button
                      onClick={() => removeIngredient(ingredient.id)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              <div className="pt-4 mt-4 border-t">
                <p className="text-xl font-semibold">
                  Total Calories: {totalCalories}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SandwichCaloryCounterApp;
```