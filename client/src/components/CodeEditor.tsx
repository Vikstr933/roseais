import { ChangeEvent } from 'react';

interface CodeEditorProps {
  code: string;
  onChange: (code: string) => void;
}

export const CodeEditor = ({ code, onChange }: CodeEditorProps) => {
  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  return (
    <textarea
      className="w-full h-full p-4 font-mono text-sm bg-gray-900 text-white"
      value={code}
      onChange={handleChange}
      placeholder="Write your component code here..."
    />
  );
};
