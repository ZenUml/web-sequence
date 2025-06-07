import React from 'react';
import { ItemTile } from './ItemTile';
import templates from '../templateList';
import * as Dialog from '@radix-ui/react-dialog';

export default function CreateNewModal({
  open,
  onClose,
  onBlankTemplateSelect,
  onTemplateSelect,
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-black/50 backdrop-blur-sm data-[state=open]:animate-overlayShow fixed inset-0" />
        <Dialog.Content className="text-gray-400 data-[state=open]:animate-contentShow fixed top-[50%] left-[50%] max-h-[85vh] w-[90vw] overflow-hidden max-w-[980px] translate-x-[-50%] translate-y-[-50%] rounded-[6px] bg-black-500/90 backdrop-blur p-[25px] shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] focus:outline-none">
          <div className="mt-6 w-full">
            <div class="tac">
              <button
                className="text-primary border border-primary px-3 py-2 rounded-lg hover:bg-primary hover:text-gray-100 duration-200"
                onClick={onBlankTemplateSelect}
              >
                Start a blank creation
              </button>
            </div>
            <div className="text-center my-3">Or choose from a template:</div>
            <div class="create-new-pane__container">
              {templates.map((template) => (
                <ItemTile
                  inline
                  item={template}
                  focusable
                  onClick={onTemplateSelect.bind(null, template)}
                />
              ))}
            </div>
            <div className="text-center">
              The development team needs your help. If you are actively using
              ZenUML, please tweet about ZenUML at least once a month!
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
