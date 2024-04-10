import { SubscriptionAction } from './SubscriptionAction';
import featureToggle from '../../services/feature_toggle';
import * as Dialog from '@radix-ui/react-dialog';
import React from 'preact';

export function ProFeatureListModal({ open, onClose, loginHandler, onSubscriptionChange }) {
	console.log(open)
	return (
		<Dialog.Root open={open} onOpenChange={onClose}>
			<Dialog.Portal>
				<Dialog.Overlay className='bg-black/50 backdrop-blur-sm data-[state=open]:animate-overlayShow fixed inset-0' />
				<Dialog.Content
					className='text-gray-500 data-[state=open]:animate-contentShow fixed top-[50%] left-[50%] max-h-[85vh] w-[90vw] overflow-hidden max-w-[350px] translate-x-[-50%] translate-y-[-50%] rounded-[6px] bg-white text-black-400 shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] focus:outline-none'>
					<div className='w-full'>
						<section className='bg-primary py-10 text-gray-100'>
							<h2 className='text-center text-lg mb-1'>Pro</h2>
							<h1 className='font-semibold text-3xl flex items-center justify-center'>$4.99<span
								className='text-sm font-light'>/month</span></h1>
						</section>
						<section className='p-6 leading-8'>
							<ul>
								<li>(Free) Real-time sequence diagram converter</li>
								<li>(Free) Export to PNG and JPEG</li>
								<li>(Free) Hand-tuned themes</li>
								<li>(Free) Limit of 3 diagrams</li>
								<li>(Pro) Custom CSS</li>
								<li>(Pro) Unlimited storage</li>
							</ul>
						</section>
						<section className={'call-for-action hide'}>
							<button>Back</button>
						</section>
						{featureToggle.isPaymentEnabled ? (
							<div className='mb-0 mx-5 text-center'>
								<SubscriptionAction
									preActionCallback={onClose}
									loginCallback={loginHandler}
									postActionCallback={onSubscriptionChange}
								/>
							</div>
						) : null}
						<p className='px-6 py-2 text-center text-xs'>
							Unsubscribe at any time, no questions asked.
						</p>
					</div>
					<Dialog.Close asChild>
						<button
							className='text-gray-100 hover:bg-white/10 absolute top-4 right-4 inline-flex h-8 w-8 p-1.5 hover:bg-gray-600 appearance-none items-center justify-center rounded-lg outline-none'
							aria-label='Close'
						>
							<span className='material-symbols-outlined'>cancel</span>
						</button>
					</Dialog.Close>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
