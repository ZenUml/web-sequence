export function AppRoot() {
  return (
    <div className="flex h-full w-full">
      <section data-testid="editor-region" className="w-1/2 border-r border-gray-200" aria-label="Editor">
        {/* Milestone 01: CodeMirror editors */}
      </section>
      <section data-testid="preview-region" className="w-1/2" aria-label="Preview">
        {/* Milestone 01: iframe preview */}
      </section>
    </div>
  );
}
