import { useState } from 'react';
import { CodeEditor } from './CodeEditor';
import { PreviewPane } from './PreviewPane';
import { PromptSidebar } from './PromptSidebar';

export const Playground = () => {
  const [code, setCode] = useState('');
  const [prompt, setPrompt] = useState('');

  return (
    <div className="flex flex-col h-screen">
      {/* Header Bar */}
      <div className="bg-gray-800 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-white text-xl">Component Playground</h1>
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            onClick={() => {
              /* Generate component */
            }}
          >
            Generate Component
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1">
        {/* Editor and Preview */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1">
            <CodeEditor code={code} onChange={setCode} />
          </div>
          <div className="h-1/3 border-t border-gray-200">
            <PreviewPane code={code} />
          </div>
        </div>

        {/* Prompt Sidebar */}
        <div className="w-1/3 border-l border-gray-200">
          <PromptSidebar prompt={prompt} onPromptChange={setPrompt} />
        </div>
      </div>
    </div>
  );
};
