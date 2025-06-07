import { h, Component } from 'preact';
import * as Dialog from '@radix-ui/react-dialog';

export default function ClosePageModal({ open, onClose, onConfirm }) {
  return (
    <Dialog.Root open={open} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-black/50 backdrop-blur-sm data-[state=open]:animate-overlayShow fixed inset-0" />
        <Dialog.Content className="text-gray-400 data-[state=open]:animate-contentShow fixed top-[50%] left-[50%] max-h-[85vh] w-[90vw] overflow-hidden max-w-[450px] translate-x-[-50%] translate-y-[-50%] rounded-[6px] bg-black-500/90 backdrop-blur p-[25px] shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] focus:outline-none">
          <Dialog.Title className="text-white m-0 text-[17px] font-medium">
            Confirm to close
          </Dialog.Title>
          <Dialog.Description className="text-gray-400 mt-[10px] mb-5 text-[15px] leading-normal">
            Are you sure you want to close this page? The data on this page will be lost forever.
          </Dialog.Description>
          <div className="flex justify-end gap-[25px]">
            <button
              className="text-gray-400 bg-transparent border border-gray-400 px-3 py-2 rounded-lg hover:bg-gray-800 hover:text-gray-100 duration-200"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="text-white bg-red-600 border border-red-600 px-3 py-2 rounded-lg hover:bg-red-700 duration-200"
              onClick={onConfirm}
            >
              Confirm
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
