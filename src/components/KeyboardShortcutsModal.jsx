import * as Dialog from '@radix-ui/react-dialog';
import React from 'preact';

const KeyboardShortcutsModal = ({ open, onClose }) => {
  return (
    <Dialog.Root open={open} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-black/50 backdrop-blur-sm data-[state=open]:animate-overlayShow fixed inset-0" />
        <Dialog.Content className="text-gray-400 data-[state=open]:animate-contentShow fixed top-[50%] left-[50%] max-h-[85vh] w-[90vw] overflow-hidden max-w-[850px] translate-x-[-50%] translate-y-[-50%] rounded-[6px] bg-black-400 p-[25px] shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] focus:outline-none">
          <Dialog.Title className="font-medium text-lg text-gray-100">
            Keyboard Shortcuts
          </Dialog.Title>
          <div className="mt-6 w-full">
            <div className="flex mt-6 text-sm">
              <div>
                <h3 className="text-lg mb-4">Global</h3>
                <div className="flex flex-col gap-3">
                  <p>
                    <span className="kbd-shortcut__keys">
                      Ctrl/⌘ + Shift + ?
                    </span>
                    <span className="kbd-shortcut__details">
                      See keyboard shortcuts
                    </span>
                  </p>
                  <p>
                    <span className="kbd-shortcut__keys">
                      Ctrl/⌘ + Shift + 5
                    </span>
                    <span className="kbd-shortcut__details">
                      Refresh preview
                    </span>
                  </p>
                  <p>
                    <span className="kbd-shortcut__keys">Ctrl/⌘ + S</span>
                    <span className="kbd-shortcut__details">
                      Save current creations
                    </span>
                  </p>
                  <p>
                    <span className="kbd-shortcut__keys">Ctrl/⌘ + O</span>
                    <span className="kbd-shortcut__details">
                      Open list of saved creations
                    </span>
                  </p>
                  <p>
                    <span className="kbd-shortcut__keys">Ctrl + L</span>
                    <span className="kbd-shortcut__details">
                      Clear console (works when console input is focused)
                    </span>
                  </p>
                  <p>
                    <span className="kbd-shortcut__keys">Esc</span>
                    <span className="kbd-shortcut__details">
                      Close saved creations panel & modals
                    </span>
                  </p>
                </div>
              </div>
              <div className="ml-6">
                <h3 className="text-lg mb-4">Editor</h3>
                <div className="flex flex-col gap-3">
                  <p>
                    <span className="kbd-shortcut__keys">Ctrl/⌘ + F</span>
                    <span className="kbd-shortcut__details">Find</span>
                  </p>
                  <p>
                    <span className="kbd-shortcut__keys">Ctrl/⌘ + G</span>
                    <span className="kbd-shortcut__details">
                      Select next match
                    </span>
                  </p>
                  <p>
                    <span className="kbd-shortcut__keys">
                      Ctrl/⌘ + Shift + G
                    </span>
                    <span className="kbd-shortcut__details">
                      Select previous match
                    </span>
                  </p>
                  <p>
                    <span className="kbd-shortcut__keys">
                      Ctrl/⌘ + Opt/Alt + F
                    </span>
                    <span className="kbd-shortcut__details">
                      Find & replace
                    </span>
                  </p>
                  <p>
                    <span className="kbd-shortcut__keys">Shift + Tab</span>
                    <span className="kbd-shortcut__details">Realign code</span>
                  </p>
                  <p>
                    <span className="kbd-shortcut__keys">Ctrl/⌘ + ]</span>
                    <span className="kbd-shortcut__details">
                      Indent code right
                    </span>
                  </p>
                  <p>
                    <span className="kbd-shortcut__keys">Ctrl/⌘ + [</span>
                    <span className="kbd-shortcut__details">
                      Indent code left
                    </span>
                  </p>
                  <p>
                    <span className="kbd-shortcut__keys">Tab</span>
                    <span className="kbd-shortcut__details">
                      Emmet code completion{' '}
                      <a
                        href="https://emmet.io/"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Read more
                      </a>
                    </span>
                  </p>
                  <p>
                    <span className="kbd-shortcut__keys">Ctrl/⌘ + /</span>
                    <span className="kbd-shortcut__details">
                      Single line comment
                    </span>
                  </p>
                  <p>
                    <span className="kbd-shortcut__keys">Ctrl + Shift + F</span>
                    <span className="kbd-shortcut__details">Run Prettier</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
          <Dialog.Close asChild>
            <button
              className="text-gray-100 hover:bg-black-600/30 absolute top-7 right-6 inline-flex h-8 w-8 p-1.5 hover:bg-gray-600 appearance-none items-center justify-center rounded-md outline-none"
              aria-label="Close"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default KeyboardShortcutsModal;
