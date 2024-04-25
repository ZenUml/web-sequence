import { SubscriptionAction } from './SubscriptionAction';
import featureToggle from '../../services/feature_toggle';
import * as Dialog from '@radix-ui/react-dialog';
import React from 'preact';
import { useState } from 'preact/hooks';

export function PricingModal({
  open,
  onClose,
  loginHandler,
  onSubscriptionChange,
}) {
  const monthlyBilling={billingType:"monthly",basicPrice:4.99,plusPrice:7.99};
  const yearlyBilling={billingType:"yearly",basicPrice:0.83,plusPrice:1.25};
  const [paras, setParas] = useState(monthlyBilling);
  const monthlyBillingClicked = (e) => {
    console.log('monthlyBillingClicked');
    setParas(monthlyBilling);
  };
  const yearlyBillingClicked = (e) => {
    console.log('yearlyBillingClicked');
    setParas(yearlyBilling);
  };
  console.log(open);
  return (
    <Dialog.Root open={open} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-black/50 backdrop-blur data-[state=open]:animate-overlayShow fixed inset-0" />
        <Dialog.Content className="text-white data-[state=open]:animate-contentShow fixed top-[50%] left-[50%] max-h-[90vh] w-[90vw] overflow-hidden max-w-[940px] translate-x-[-50%] translate-y-[-50%] rounded-[6px] bg-black-400 p-[25px] shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] focus:outline-none">
          <div className="w-full">
            <div class="font-poppins ax-w-7xl mx-auto pt-10 px-4 sm:px-6 lg:px-8 text-gray-200">
              <div class="sm:flex sm:flex-col sm:align-center">
                <p class="text-xl leading-27 sm:text-center">Chose the plan that right for you and the team</p>
                <div class="relative mt-5 bg-gray-700 rounded-lg p-0.5 flex self-center sm:mt-5">
                  <button type="button" onClick={monthlyBillingClicked} className={paras.billingType=='monthly' ? 'bg-black relative  rounded-md shadow-sm py-2 w-1/2 text-xs  whitespace-nowrap focus:outline-none  sm:w-auto sm:px-8' : ''} class="relative  rounded-md shadow-sm py-2 w-1/2 text-xs  whitespace-nowrap focus:outline-none  sm:w-auto sm:px-8">Monthly billing</button>
                  <button type="button" onClick={yearlyBillingClicked} className={paras.billingType=='yearly' ? 'bg-black ml-0.5 relative border border-transparent rounded-md py-2 w-1/2 text-xs  whitespace-nowrap focus:outline-none sm:w-auto sm:px-8' : ''} class="ml-0.5 relative border border-transparent rounded-md py-2 w-1/2 text-xs  whitespace-nowrap focus:outline-none sm:w-auto sm:px-8">Yearly <span className={paras.billingType=='yearly' ?'text-green-500':''}>(Save up to 83%)</span></button>
                </div>
                <p class="mt-3 text-xs sm:text-center">*The price is in $USD, Viewers are always free!</p>
              </div>
              <div class="mt-5 space-y-4 sm:mt-5 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-6 lg:max-w-4xl lg:mx-auto xl:max-w-none xl:mx-0 xl:grid-cols-4">
                {/* price item 1 */}
                <div class="border border-gray-600 shadow-sm divide-y divide-gray-600 hover:bg-blue-500 hover:bg-opacity-25">
                  <div class="p-3">
                    <h2 class="text-xs font-semibold leading-6">Starter</h2>
                    <p class="mt-1">
                      <span class="text-2xl font-semibold">Free</span>
                    </p>
                    <a href="#" class="no-underline mt-2 block w-full bg-gray-200 text-gray-800 border border-transparent rounded-md py-2 text-sm text-center">Current plan</a>
                    <ul role="list" class="mt-6 space-y-4">
                      <li class="flex space-x-3">
                        <svg class="flex-shrink-0 h-5 w-5 text-gray-200" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                        </svg>
                        <span class="text-xs">Realtime sequence diagram editor</span>
                      </li>

                      <li class="flex space-x-3">
                        <svg class="flex-shrink-0 h-5 w-5 text-gray-200" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                        </svg>
                        <span class="text-xs">Limit to 3 diagram files</span>
                      </li>

                      <li class="flex space-x-3">
                        <svg class="flex-shrink-0 h-5 w-5 text-gray-200" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                        </svg>
                        <span class="text-xs">Sharable diagram file for inspection</span>
                      </li>

                      <li class="flex space-x-3">
                        <svg class="flex-shrink-0 h-5 w-5 text-gray-200" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                        </svg>
                        <span class="text-xs">4 stylish diagram themes</span>
                      </li>

                      <li class="flex space-x-3">
                        <svg class="flex-shrink-0 h-5 w-5 text-gray-200" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                        </svg>
                        <span class="text-xs">Export to PNG and Copy PNG (with branding)</span>
                      </li>
                    </ul>
                  </div>
                  
                </div>
                {/* price item 2 */}
                <div class="border border-gray-600 shadow-sm divide-y divide-gray-600 hover:bg-blue-500 hover:bg-opacity-25">
                  <div class="p-3">
                    <h2 class="text-xs font-semibold leading-6">Basic</h2>
                    <p class="mt-1">
                      <span class="text-2xl font-semibold">${paras.basicPrice}</span>
                      <span class="text-base">/month</span>
                    </p>
                    <a href="#" class="no-underline mt-2 block w-full bg-blue-500 border border-transparent rounded-md py-2 text-sm text-center">Upgrade to Basic</a>
                    <p class="mt-3 text-xs">Include:</p>
                    <p class="mt-3 text-xs font-semibold">Everything in Free Starter and...</p>
                    <ul role="list" class="mt-6 space-y-4">
                      <li class="flex space-x-3">
                        <svg class="flex-shrink-0 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                        </svg>
                        <span class="text-xs">Up to 50 diagram files</span>
                      </li>

                      <li class="flex space-x-3">
                        <svg class="flex-shrink-0 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                        </svg>
                        <span class="text-xs">Customizable theme style with CSS</span>
                      </li>

                      <li class="flex space-x-3">
                        <svg class="flex-shrink-0 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                        </svg>
                        <span class="text-xs">Export to PNG and Copy PNG (without branding)</span>
                      </li>
                    </ul>
                  </div>
                  
                </div>
                {/* price item 3 */}
                <div class="border border-gray-600 shadow-sm divide-y divide-gray-600 hover:bg-blue-500 hover:bg-opacity-25">
                  <div class="p-3">
                    <h2 class="text-xs font-semibold leading-6">Plus</h2>
                    <p class="mt-1">
                      <span class="text-2xl font-semibold">${paras.plusPrice}</span>
                      <span class="text-base">/month</span>
                    </p>
                    <a href="#" class="no-underline mt-2 block w-full bg-blue-500 border border-transparent rounded-md py-2 text-sm text-center">Upgrade to Pro</a>
                    <p class="mt-3 text-xs">Include:</p>
                    <p class="mt-3 text-xs font-semibold">Everything in Basic and...</p>
                    <ul role="list" class="mt-6 space-y-4">
                      <li class="flex space-x-3">
                        <svg class="flex-shrink-0 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                        </svg>
                        <span class="text-xs">Up to 100 diagram files</span>
                      </li>

                      <li class="flex space-x-3">
                        <svg class="flex-shrink-0 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                        </svg>
                        <span class="text-xs">We design a theme for you</span>
                      </li>

                      <li class="flex space-x-3">
                        <svg class="flex-shrink-0 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                        </svg>
                        <span class="text-xs">Export to PNG and Copy PNG (with your branding)</span>
                      </li>
                    </ul>
                  </div>
                  
                </div>
                {/* price item 4 */}
                <div class="border border-gray-600 shadow-sm divide-y divide-gray-600 hover:bg-blue-500 hover:bg-opacity-25">
                  <div class="p-3">
                    <h2 class="text-xs font-semibold leading-6">Enterprice</h2>
                    <p class="mt-1">
                      <span class="text-2xl font-semibold">-</span>
                    </p>
                    <a href="#" class="no-underline mt-2 block w-full bg-blue-500 border border-transparent rounded-md py-2 text-sm text-center">Contact us</a>
                    <p class="mt-3 text-xs">Include:</p>
                    <p class="mt-3 text-xs font-semibold">Everything in Plus and...</p>
                    <ul role="list" class="mt-6 space-y-4">
                      <li class="flex space-x-3">
                        <svg class="flex-shrink-0 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                        </svg>
                        <span class="text-xs">VIP support & Free consultant on technical diagramming</span>
                      </li>

                      <li class="flex space-x-3">
                        <svg class="flex-shrink-0 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                        </svg>
                        <span class="text-xs">Host data on your own domains and branding</span>
                      </li>

                      <li class="flex space-x-3">
                        <svg class="flex-shrink-0 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                        </svg>
                        <span class="text-xs">Single Sign-On</span>
                      </li>

                      <li class="flex space-x-3">
                        <svg class="flex-shrink-0 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                        </svg>
                        <span class="text-xs">Organization-wide Shared files</span>
                      </li>
                    </ul>
                  </div>
                  
                </div>
              </div>
            </div>
            {/* {featureToggle.isPaymentEnabled ? (
              <div className="mb-0 mx-5 text-center">
                <SubscriptionAction
                  preActionCallback={onClose}
                  loginCallback={loginHandler}
                  postActionCallback={onSubscriptionChange}
                />
              </div>
            ) : null} */}
          </div>
          <Dialog.Close asChild>
            <button
              className="text-gray-100 hover:bg-white/10 absolute top-4 right-4 inline-flex h-8 w-8 p-1.5 hover:bg-gray-600 appearance-none items-center justify-center rounded-lg outline-none"
              aria-label="Close"
            >
              <span className="material-symbols-outlined">cancel</span>
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
