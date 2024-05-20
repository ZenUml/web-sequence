import { SubscriptionItem } from './SubscriptionItem';
import * as Dialog from '@radix-ui/react-dialog';
import React from 'preact';
import { useState } from 'preact/hooks';
import userService from '../../services/user_service';

export function PricingModal({
  open,
  onClose,
  loginHandler,
  onSubscriptionChange,
}) {
  const [isMonthlyType, setIsMonthlyType] = useState(false);
  const monthlyBillingClicked = (e) => {
    setIsMonthlyType(true);
  };
  const yearlyBillingClicked = (e) => {
    setIsMonthlyType(false);
  };
  return (
    <Dialog.Root open={open} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-black/50 backdrop-blur data-[state=open]:animate-overlayShow fixed inset-0" />
        <Dialog.Content className="text-white data-[state=open]:animate-contentShow fixed top-[50%] left-[50%] max-h-[90vh] w-[90vw] overflow-hidden max-w-[940px] translate-x-[-50%] translate-y-[-50%] rounded-[6px] bg-black-400 p-[25px] shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] focus:outline-none">
          <div className="w-full">
            <div class="font-poppins ax-w-7xl mx-auto pt-10 px-4 sm:px-6 lg:px-8 text-gray-200">
              <div class="sm:flex sm:flex-col sm:align-center">
                <p class="text-xl leading-27 sm:text-center">
                  Chose the plan that right for you and the team
                </p>
                <div class="relative mt-5 bg-gray-700 rounded-lg p-0.5 flex self-center sm:mt-5">
                  <button
                    type="button"
                    onClick={monthlyBillingClicked}
                    class={`${isMonthlyType ? 'bg-black' : ''} relative  rounded-md shadow-sm py-2 w-1/2 text-xs  whitespace-nowrap focus:outline-none  sm:w-auto sm:px-8`}
                  >
                    Billed Monthly
                  </button>
                  <button
                    type="button"
                    onClick={yearlyBillingClicked}
                    class={`${isMonthlyType ? '' : 'bg-black'} ml-0.5 relative border border-transparent rounded-md py-2 w-1/2 text-xs  whitespace-nowrap focus:outline-none sm:w-auto sm:px-8`}
                  >
                    Billed Yearly{' '}
                    <span
                      className={`${isMonthlyType ? '' : 'text-green-500'}`}
                    >
                      (Save up to 83%)
                    </span>
                  </button>
                </div>
                <p class="mt-3 text-xs sm:text-center">
                  *The price is in $USD, Viewers are always free!
                </p>
              </div>
              <div class="mt-5 space-y-4 sm:mt-5 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-6 lg:max-w-4xl lg:mx-auto xl:max-w-none xl:mx-0 xl:grid-cols-4">
                <SubscriptionItem
                  planName="Starter"
                  planType="free"
                  price="Free"
                  priceDesc="Free for everyone"
                  priceSaveDesc={isMonthlyType ? '' : ' '}
                  upgradeBtnName={
                    userService.getPlanType() == 'free'
                      ? 'Current plan'
                      : 'Included'
                  }
                  preActionCallback={onClose}
                  loginCallback={loginHandler}
                  postActionCallback={onSubscriptionChange}
                  features={[
                    'Real time sequence diagram editor',
                    'Export diagrams to PNG',
                    'Sharable online diagrams',
                    'Up to 3 saved diagram files',
                  ]}
                />
                <SubscriptionItem
                  planName="Basic"
                  price={isMonthlyType ? '$4.99' : '$0.83'}
                  priceTerm="/month"
                  priceDesc={isMonthlyType ? ' ' : 'Billed yearly'}
                  priceSaveDesc={isMonthlyType ? '' : 'Save 49.92 USD'}
                  planType={isMonthlyType ? 'basic-monthly' : 'basic-yearly'}
                  upgradeBtnName="Upgrade to Basic"
                  preActionCallback={onClose}
                  loginCallback={loginHandler}
                  postActionCallback={onSubscriptionChange}
                  includeDesc="All features from Free Tier"
                  features={['Up to 20 saved diagram files']}
                />
                <SubscriptionItem
                  planName="Plus"
                  price={isMonthlyType ? '$7.99' : '$1.25'}
                  priceTerm="/month"
                  planType={isMonthlyType ? 'plus-monthly' : 'plus-yearly'}
                  priceDesc={isMonthlyType ? ' ' : 'Billed yearly'}
                  priceSaveDesc={isMonthlyType ? '' : 'Save 80.88 USD'}
                  upgradeBtnName="Upgrade to Plus"
                  preActionCallback={onClose}
                  loginCallback={loginHandler}
                  postActionCallback={onSubscriptionChange}
                  includeDesc="All features from Basic Tier"
                  features={[
                    'Unlimited diagram files',
                    'Customized CSS',
                    'Premium support for our expert to design your unique diagram style',
                  ]}
                  isMostSelect={true}
                />
                <SubscriptionItem
                  planName="Enterprise"
                  price="Custom"
                  planType="enterprise"
                  priceDesc=" "
                  priceSaveDesc={isMonthlyType ? '' : ' '}
                  upgradeBtnName="Contact us"
                  preActionCallback={onClose}
                  loginCallback={loginHandler}
                  postActionCallback={onSubscriptionChange}
                  includeDesc="All features from Plus Tier"
                  features={[
                    'Host data on your own domains and branding',
                    'More...',
                  ]}
                />
              </div>
            </div>
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
