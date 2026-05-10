import * as Dialog from '@radix-ui/react-dialog';

export function OnboardingModal({ show, closeHandler }) {
  if (!show) return null;

  return (
    <Dialog.Root open={show} onOpenChange={closeHandler}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-black/60 backdrop-blur data-[state=open]:animate-overlayShow fixed inset-0 z-50" />
        <Dialog.Content className="text-white data-[state=open]:animate-contentShow fixed top-[50%] left-[50%] max-h-[90vh] w-[90vw] max-w-[560px] translate-x-[-50%] translate-y-[-50%] rounded-xl bg-black-400 p-8 shadow-2xl focus:outline-none z-50 overflow-y-auto">
          <Dialog.Title className="text-2xl font-semibold text-white mb-1">
            Welcome to ZenUML
          </Dialog.Title>
          <Dialog.Description className="text-gray-400 text-sm mb-6">
            Turn text into sequence diagrams in seconds.
          </Dialog.Description>

          <div className="space-y-4 mb-6">
            <div className="flex gap-3 items-start">
              <span className="material-symbols-outlined text-blue-400 text-xl flex-shrink-0 mt-0.5">edit</span>
              <div>
                <p className="text-sm font-medium text-white">Type in the editor on the left</p>
                <p className="text-xs text-gray-400">Your diagram updates live as you type. Try: <code className="bg-black-600 px-1 rounded">A-&gt;B: hello()</code></p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <span className="material-symbols-outlined text-blue-400 text-xl flex-shrink-0 mt-0.5">quick_reference</span>
              <div>
                <p className="text-sm font-medium text-white">Open the Syntax Cheat Sheet</p>
                <p className="text-xs text-gray-400">Click the book icon in the left sidebar to see available commands.</p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <span className="material-symbols-outlined text-blue-400 text-xl flex-shrink-0 mt-0.5">save</span>
              <div>
                <p className="text-sm font-medium text-white">Save your work with Cmd+S</p>
                <p className="text-xs text-gray-400">Diagrams are saved locally. Sign in to access them from any device.</p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <span className="material-symbols-outlined text-blue-400 text-xl flex-shrink-0 mt-0.5">download</span>
              <div>
                <p className="text-sm font-medium text-white">Export as PNG when ready</p>
                <p className="text-xs text-gray-400">Use the PNG button in the tab bar. Sign in to unlock exports.</p>
              </div>
            </div>
          </div>

          <button
            className="w-full py-2.5 bg-primary rounded-lg text-white font-medium hover:opacity-90 transition-opacity"
            onClick={closeHandler}
          >
            Get started
          </button>

          <Dialog.Close asChild>
            <button
              className="text-gray-400 hover:bg-black-600/40 absolute top-4 right-4 inline-flex h-8 w-8 p-1.5 appearance-none items-center justify-center rounded-md"
              aria-label="Close"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
