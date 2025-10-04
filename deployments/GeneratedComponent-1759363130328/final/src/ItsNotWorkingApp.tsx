import React, { useState } from 'react';

interface ErrorState {
  title: string;
  description: string;
  tried: string[];
}

export const ItsNotWorkingApp: React.FC = () => {
  const [loading, setLoading] = React.useState(false);
  const [errors, setErrors] = useState<ErrorState[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tried, setTried] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title && description) {
      setErrors([...errors, { title, description, tried: tried.split('\n').filter(t => t.trim()) }]);
      setTitle('');
      setDescription('');
      setTried('');
    }
  };

  const handleDelete = (index: number) => {
    setErrors(errors.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">It's Not Working!</h1>
        
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="mb-4">
            <label htmlFor="title" className="block text-gray-700 font-medium mb-2">
              What's not working?
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter the issue title"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="description" className="block text-gray-700 font-medium mb-2">
              Describe the problem
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
              placeholder="Describe what's happening"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="tried" className="block text-gray-700 font-medium mb-2">
              What have you tried? (one per line)
            </label>
            <textarea
              id="tried"
              value={tried}
              onChange={(e) => setTried(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
              placeholder="List what you've already tried"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            disabled={!title || !description}
          >
            Add Issue
          </button>
        </form>

        <div className="space-y-4">
          {errors.map((error, index) => (
            <div key={index} className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-semibold text-gray-800">{error.title}</h2>
                <button
                  onClick={() => handleDelete(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-gray-600 mb-4">{error.description}</p>
              {error.tried.length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-700 mb-2">Attempted Solutions:</h3>
                  <ul className="list-disc list-inside text-gray-600">
                    {error.tried.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};