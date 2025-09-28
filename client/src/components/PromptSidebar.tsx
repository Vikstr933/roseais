import { ChangeEvent } from 'react';

interface PromptSidebarProps {
  prompt: string;
  onPromptChange: (prompt: string) => void;
}

export const PromptSidebar = ({ prompt, onPromptChange }: PromptSidebarProps) => {
  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onPromptChange(e.target.value);
  };

  return (
    <div className="p-4 h-full flex flex-col">
      <h2 className="text-lg font-bold mb-4">AI Prompt</h2>
      <textarea
        className="flex-1 p-2 border rounded-md"
        value={prompt}
        onChange={handleChange}
        placeholder="Enter your AI prompt here..."
      />
      <button
        className="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        onClick={() => {/* Handle prompt submission */}}
      >
        Generate
      </button>
    </div>
  );
};
