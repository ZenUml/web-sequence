import { SubscriptionAction } from './SubscriptionAction';
import { ContactUsLink } from './ContactUsLink';
import featureToggle from '../../services/feature_toggle';
import React from 'preact';

export function SubscriptionItem(props) {
  return (
    <div
      class={`${props.isMostSelect && 'bg-blue-500 bg-opacity-25 relative'} border border-gray-600 shadow-sm divide-y divide-gray-600`}
    >
      {props.isMostSelect && (
        <span class="absolute top-0 right-0 text-xs rounded-bl-md py-1 px-2 text-center bg-blue-200 text-blue-500">
          Most selected
        </span>
      )}
      <div class="p-3">
        <h2 class="text-xs font-semibold leading-6">{props.planName}</h2>
        <p class="mt-1">
          {props.priceDesc && (
            <span class="text-2xl font-semibold">{props.priceDesc}</span>
          )}
          {props.priceTerm && <span class="text-base">{props.priceTerm}</span>}
        </p>
        {props.planName != 'Enterprice' && featureToggle.isPaymentEnabled && (
          <SubscriptionAction
            planType={props.planType}
            upgradeBtnName={props.upgradeBtnName}
            preActionCallback={props.preActionCallback}
            loginCallback={props.loginCallback}
            postActionCallback={props.postActionCallback}
          />
        )}
        {props.planName == 'Enterprice' && (
          <ContactUsLink upgradeBtnName={props.upgradeBtnName} />
        )}
        {props.includeDesc && (
          <div>
            <p class="mt-3 text-xs">Include:</p>
            <p class="mt-3 text-xs font-semibold">{props.includeDesc}</p>
          </div>
        )}
        <ul role="list" class="mt-6 space-y-4">
          {props.features &&
            props.features.map((feature, index) => (
              <li class="flex space-x-3">
                <svg
                  class={`flex-shrink-0 h-5 w-5  ${props.planType != 'free' ? 'text-blue-600' : 'text-gray-200'}`}
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fill-rule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clip-rule="evenodd"
                  />
                </svg>
                <span class="text-xs">{feature}</span>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}
