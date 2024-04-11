import * as Dialog from '@radix-ui/react-dialog';

export function AskToImportModal({
																	 open,
																	 onClose,
																	 oldSavedCreationsCount,
																	 dontAskBtnClickHandler,
																	 importBtnClickHandler
																 }) {
	return (
		<Dialog.Root open={open} onOpenChange={onClose}>
			<Dialog.Portal>
				<Dialog.Overlay className='bg-black/50 backdrop-blur-sm data-[state=open]:animate-overlayShow fixed inset-0' />
				<Dialog.Content
					className='text-gray-400 data-[state=open]:animate-contentShow fixed top-[50%] left-[50%] max-h-[85vh] w-[90vw] overflow-hidden max-w-[460px] translate-x-[-50%] translate-y-[-50%] rounded-[6px] bg-black-400 p-[25px] shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] focus:outline-none'>
					<Dialog.Title className='font-medium text-lg text-gray-100'>
						Import your creations
					</Dialog.Title>
					<div className='mt-6 w-full'>
						<p>
							You have <span>{oldSavedCreationsCount}</span> creations saved in your
							local machine. Do you want to import those creations in your account
							so they are more secure and accessible anywhere?
						</p>
						<p className='mt-6'>
							It's okay if you don't want to. You can simply logout and access them
							anytime on this browser.
						</p>
					</div>
					<div className='grid grid-cols-2 gap-3 mt-6'>
						<button onClick={dontAskBtnClickHandler}
										className='px-3 py-2 border border-gray-500 text-gray-500 rounded-lg outline-0 hover:bg-black-500 duration-200'>
							Don't ask me again
						</button>
						<button onClick={importBtnClickHandler}
										className='px-3 py-2 bg-primary text-gray-100 rounded-lg outline-0 hover:bg-opacity-80 duration-200'>
							Yes, please import
						</button>
					</div>
					<Dialog.Close asChild>
						<button
							className='text-gray-100 hover:bg-black-600/30 absolute top-6 right-6 inline-flex h-8 w-8 p-1.5 hover:bg-gray-600 appearance-none items-center justify-center rounded-md outline-none'
							aria-label='Close'
						>
							<span className='material-symbols-outlined'>close</span>
						</button>
					</Dialog.Close>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
