import React from 'preact';
import * as Dialog from '@radix-ui/react-dialog';

export function SavedItemLimitModal({ description, open, onConfirm, onClose }) {
  return (
    <Dialog.Root open={open} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-black/50 backdrop-blur-sm data-[state=open]:animate-overlayShow fixed inset-0" />
        <Dialog.Content className="text-gray-400 data-[state=open]:animate-contentShow fixed top-[50%] left-[50%] max-h-[85vh] overflow-hidden max-w-[980px] translate-x-[-50%] translate-y-[-50%] rounded-[6px] bg-black-500/90 backdrop-blur py-[25px] px-[32px] shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] focus:outline-none flex flex-col items-center">
          <Dialog.Title className="font-semibold text-gray-100 text-xl">
            Saved Items Limit Reached
          </Dialog.Title>
          <Dialog.Description className="mt-4">
            {description}
          </Dialog.Description>
          <div className="flex justify-center mt-6 mb-2 gap-8">
            <button
              className="text-white border border-primary px-4 py-1 rounded-lg hover:bg-primary hover:text-gray-100 duration-200 font-semibold"
              onClick={onConfirm}
            >
              Upgrade
            </button>
            <button
              className="text-gray-400 px-4 py-1 rounded-lg bg-black-600 hover:text-gray-100 duration-200 font-semibold"
              onClick={onClose}
            >
              Dismiss
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
