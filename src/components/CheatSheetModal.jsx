import * as Dialog from '@radix-ui/react-dialog';
import React from 'preact';

const CheatSheetModal = ({ open, onClose }) => {
  return (
    <Dialog.Root open={open} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-black/50 backdrop-blur-sm data-[state=open]:animate-overlayShow fixed inset-0" />
        <Dialog.Content className="text-gray-400 data-[state=open]:animate-contentShow fixed top-[50%] left-[50%] max-h-[85vh] w-[90vw] overflow-hidden max-w-[550px] translate-x-[-50%] translate-y-[-50%] rounded-[6px] bg-black-400 p-[25px] shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] focus:outline-none">
          <Dialog.Title className="font-medium text-lg text-gray-100">
            Cheat sheet
          </Dialog.Title>
          <div className="mt-6 w-full">
            <table className="w-full">
              <tr className="">
                <th className="text-left font-normal text-base p-3 font-semibold">
                  Feature
                </th>
                <th className="text-left font-normal text-base p-3 font-semibold">
                  Sample
                </th>
              </tr>
              <tr className="">
                <td className="text-sm px-3 py-2">Participant</td>
                <td className="text-sm px-3 py-2">
                  <pre
                    lang="javascript"
                    className="bg-black-600/30  p-2 rounded"
                  >
                    <code className="font-mono">
                      ParticipantA
                      <br />
                      ParticipantB
                    </code>
                  </pre>
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2">Message</td>
                <td className="px-3 py-2">
                  <pre className="bg-black-600/30 p-2 rounded-lg">
                    <code className="font-mono">A.messageA()</code>
                  </pre>
                </td>
              </tr>
              <tr className="">
                <td className="px-3 py-2">Asyc message</td>
                <td className="px-3 py-2">
                  <pre className="bg-black-600/30 p-2 rounded-lg">
                    <code className="font-mono">
                      Alice-&gt;Bob: How are you?
                    </code>
                  </pre>
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2">Nested message</td>
                <td className="px-3 py-2">
                  <pre
                    lang="javascript"
                    className="bg-black-600/30  p-2 rounded"
                  >
                    <code className="font-mono">
                      {`A.messageA() {
	B.messageB()
}`}
                    </code>
                  </pre>
                </td>
              </tr>
              <tr className="">
                <td className="px-3 py-2">Self-message</td>
                <td className="px-3 py-2">
                  <pre className="bg-black-600/30 p-2 rounded-lg">
                    <code className="font-mono">internalMessage()</code>
                  </pre>
                </td>
              </tr>
              <tr className="">
                <td className="px-3 py-2">Alt</td>
                <td className="px-3 py-2">
                  <pre className="bg-black-600/30  p-2 rounded-lg">
                    <code className="font-mono">
                      {`if (condition1) {
  A.methodA()
} else if (condition2) {
  B.methodB()
} else {
  C.methodC()
}`}
                    </code>
                  </pre>
                </td>
              </tr>
              <tr className="">
                <td className="px-3 py-2">Loop</td>
                <td className="px-3 py-2">
                  <pre className="bg-black-600/30 p-2 rounded-lg">
                    <code className="font-mono">
                      {`while (condition) {
  A.methodA()
}`}
                    </code>
                  </pre>
                </td>
              </tr>
            </table>
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

export default CheatSheetModal;
