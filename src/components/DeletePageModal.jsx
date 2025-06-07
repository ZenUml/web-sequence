import * as Dialog from '@radix-ui/react-dialog';

export default function DeletePageModal({ open, onClose, onConfirm }) {
  return (
    <Dialog.Root open={open} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-black/50 backdrop-blur-sm data-[state=open]:animate-overlayShow fixed inset-0" />
        <Dialog.Content className="text-gray-400 data-[state=open]:animate-contentShow fixed top-[50%] left-[50%] max-h-[85vh] w-[90vw] overflow-hidden max-w-[450px] translate-x-[-50%] translate-y-[-50%] rounded-[6px] bg-black-500/90 backdrop-blur p-[25px] shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] focus:outline-none">
          <Dialog.Title className="text-white m-0 text-[17px] font-medium">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-red-500 inline-block mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            Confirm to Delete
          </Dialog.Title>
          <Dialog.Description className="text-gray-400 mt-[10px] mb-5 text-[15px] leading-normal">
            Are you sure you want to delete this page? The data on this page will be lost forever.
          </Dialog.Description>
          <div className="flex justify-end gap-[25px]">
            <button
              className="text-gray-400 bg-transparent border border-gray-400 px-3 py-2 rounded-lg hover:bg-gray-800 hover:text-gray-100 duration-200"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="flex items-center text-white bg-red-600 border border-red-600 px-3 py-2 rounded-lg hover:bg-red-700 duration-200 gap-1"
              onClick={onConfirm}
            >
              <span>Delete</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
