import { auth } from '../auth';
import * as Dialog from '@radix-ui/react-dialog';
import { useEffect } from 'preact-compat';
import mixpanel from '../services/mixpanel';

export default function LoginModal({ open, onClose }) {
  const login = (e) => {
    const provider = e.target.dataset.authProvider;
    mixpanel.track({
      event: 'loginProviderClick',
      category: 'ui',
      label: provider,
    });
    auth.login(provider);
  };

  useEffect(() => {
    window.db.local.get(
      {
        lastAuthProvider: '',
      },
      (result) => {
        if (result.lastAuthProvider) {
          document.body.classList.add(`last-login-${result.lastAuthProvider}`);
        }
      },
    );
  }, []);

  return (
    <Dialog.Root open={open} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-black/50 backdrop-blur data-[state=open]:animate-overlayShow fixed inset-0" />
        <Dialog.Content className="text-white data-[state=open]:animate-contentShow fixed top-[50%] left-[50%] max-h-[85vh] w-[90vw] overflow-hidden max-w-[466px] translate-x-[-50%] translate-y-[-50%] rounded-[6px] bg-black-400 p-[25px] shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] focus:outline-none">
          <Dialog.Title className="mt-10 mb-10 font-medium text-lg text-gray-100">
            <svg className="h-10 w-10 -mx-1">
              <use xlinkHref="#outline-zenuml" />
            </svg>
            <p className="mt-3">Welcome to ZenUML.com</p>
          </Dialog.Title>
          <div className="mt-6 w-full">
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={login}
                className="flex items-center p-3 gap-2 justify-center w-full rounded-lg border border-neutral-400  hover:bg-black-500/90"
                data-auth-provider="github"
                data-hint="You logged in with Github last time"
              >
                <span className="block w-5 h-5">
                  <svg className="w-full h-full fill-current">
                    <use xlinkHref="#github-icon" />
                  </svg>
                </span>
                Login with Github
              </button>
              <button
                type="button"
                onClick={login}
                className="flex items-center p-3 gap-2 justify-center w-full rounded-lg border border-neutral-400  hover:bg-black-500/90"
                data-auth-provider="google"
                data-hint="You logged in with Google last time"
              >
                <span className="block w-5 h-5">
                  <svg className="w-full h-full fill-current">
                    <use xlinkHref="#google-icon" />
                  </svg>
                </span>
                Login with Google
              </button>
              <button
                type="button"
                onClick={login}
                class="flex items-center p-3 gap-2 justify-center w-full rounded-lg border border-neutral-400  hover:bg-black-500/90"
                data-auth-provider="facebook"
                data-hint="You logged in with Facebook last time"
              >
                <span className="block w-5 h-5">
                  <svg className="w-full h-full">
                    <use xlinkHref="#fb-icon" />
                  </svg>
                </span>
                Login with Facebook
              </button>
              <p className="text-center mt-4">
                Join a community of 50,000+ Developers
              </p>
            </div>
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
}
