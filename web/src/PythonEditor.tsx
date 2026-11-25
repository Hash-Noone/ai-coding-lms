import { useEffect, useRef } from "react";
import { editor } from "monaco-editor/editor/editor.api.js";
import "monaco-editor/editor/contrib/toggleTabFocusMode/browser/toggleTabFocusMode.js";
import "monaco-editor/languages/definitions/python/register.js";
import EditorWorker from "monaco-editor/editor/editor.worker.js?worker";

self.MonacoEnvironment = { getWorker: () => new EditorWorker() };

const tabHint = "Press Ctrl+M (Ctrl+Shift+M on Mac) to switch between indenting and moving focus with Tab.";

export default function PythonEditor({
  initialCode,
  onChange,
  onReady,
}: {
  initialCode: string;
  onChange: (code: string) => void;
  onReady: (ready: boolean) => void;
}) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const instance = editor.create(container.current!, {
      value: initialCode,
      language: "python",
      ariaLabel: `Python code. ${tabHint}`,
      automaticLayout: true,
      minimap: { enabled: false },
      padding: { top: 12 },
      scrollBeyondLastLine: false,
      tabSize: 4,
      theme: "vs-dark",
    });
    const subscription = instance.onDidChangeModelContent(() => onChange(instance.getValue()));
    onReady(true);
    return () => {
      subscription.dispose();
      instance.dispose();
      onReady(false);
    };
  }, [initialCode, onChange, onReady]);

  return (
    <>
      <p>{tabHint}</p>
      <div className="python-editor" ref={container} />
    </>
  );
}
