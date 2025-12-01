import { h } from 'preact';
import { useCallback, useState } from 'preact/hooks';
import { Button } from './common';
import { ProductVersionLabel } from '../zenuml/components/MainHeader/ProductVersionLabel/ProductVersionLabel';
import featureToggle from '../services/feature_toggle';
import { Popover } from './PopOver';
import { SharePanel } from './SharePanel';
import userService from '../services/user_service';
import mixpanel from '../services/mixpanel';

export function MainHeader(props) {
  const [isEditing, setEditing] = useState(false);
  const [isSharePanelVisible, setIsSharePanelVisible] = useState(false);
  const [imageBase64] = useState();

  const entryEditing = () => {
    setEditing(true);
  };

  const exitEditing = () => {
    setEditing(false);
  };

  const getPngBlob = async () => {
    const iframe = document.getElementById('demo-frame');
    // Use the getPng method exposed by the iframe
    const pngDataUrl = await iframe.contentWindow.getPng();
    if (!pngDataUrl) {
      throw new Error('Failed to get PNG from diagram');
    }
    
    // Convert data URL to Blob
    const response = await fetch(pngDataUrl);
    return await response.blob();
  };

  const shareClickHandler = async () => {
    const image = await getPngBlob();

    await props.onUpdateImage(image);
    setIsSharePanelVisible(true);
    mixpanel.track({ event: 'shareLink', category: 'ui' });
  };

  const handleProfileClick = useCallback(() => {
    if (props.user) {
      props.profileBtnHandler();
    } else {
      props.loginBtnHandler();
    }
  }, [props.user]);

  const onBlur = (e) => {
    exitEditing();
    props.titleInputBlurHandler(e);
  };

  const isSubscribed = userService.isSubscribed();

  return (
    <div className="main-header text-gray-400 py-2 px-8 flex justify-between border-b border-black-700 bg-black-500">
      <div className="flex items-center gap-4">
        <div className="flex items-center p-1">
          <svg className="h-9 w-9">
            <use xlinkHref="#outline-zenuml" />
          </svg>
        </div>

        <button
          className="px-4 py-1.5 bg-black-600 hover:opacity-80 duration-200 font-semibold flex items-center gap-2 rounded-lg"
          aria-label="Start a new creation"
          onClick={props.newBtnHandler}
        >
          <svg className="h-5 w-5">
            <use xlinkHref="#icon-plus" />
          </svg>
          <span className="hidden lg:inline">New</span>
        </button>
      </div>
      <div>
        {isEditing ? (
          <input
            autoFocus
            type="text"
            id="titleInput"
            title="Click to edit"
            className="font-semibold appearance-none w-60 text-center bg-transparent px-3 py-1.5 outline-primary border-none w-auto max-w-60"
            value={props.title}
            onBlur={onBlur}
          />
        ) : (
          <div
            className="flex items-center gap-2 font-semibold"
            onClick={() => entryEditing()}
          >
            <span>{props.title || 'Untitled'} </span>
            <svg className="h-5 w-5">
              <use xlinkHref="#icon-pen" />
            </svg>
          </div>
        )}
      </div>
      <div className="flex gap-4 items-center">
        <button
          id="runBtn"
          className="hide btn--dark flex flex-v-center hint--rounded hint--bottom-left"
          aria-label="Support ZenUML as an Open source project on Github"
          onClick={props.runBtnClickHandler}
        >
          {/*<iframe src="https://github.com/sponsors/ZenUml/button" title="Sponsor ZenUml" height="35" width="107" style="border: 0;" />*/}
        </button>


        {!window.user ? (
          <button
            className="hidden lg:inline h-10 px-4 bg-primary rounded-lg text-gray-100 font-semibold hover:opacity-80 duration-200"
            aria-label="Share diagram link"
            onClick={props.onLogin.bind(this)}
          >
            <span>Share Link</span>
          </button>
        ) : (
          <Popover
            closeOnBlur={true}
            hasArrow={true}
            placement={'bottom'}
            isVisible={isSharePanelVisible}
            onVisibilityChange={setIsSharePanelVisible}
            trigger={
              <button
                className="hidden lg:inline h-10 px-4 bg-primary rounded-lg text-white font-semibold hover:opacity-80 duration-200"
                aria-label="Share diagram link"
                onClick={shareClickHandler}
              >
                <span>Share Link</span>
              </button>
            }
            content={
              <SharePanel
                author={window.user ? window.user.displayName : 'author'}
                currentItem={props.currentItem}
                imageBase64={imageBase64}
              />
            }
          />
        )}
        {featureToggle.isPaymentEnabled ? (
          <div className="hidden lg:block">
            <ProductVersionLabel
              user={props.user}
              clickHandler={props.proBtnHandler}
            />
          </div>
        ) : null}

        {props.user ? (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="relative w-10 h-10 outline-0">
                <div className="h-full w-full border-2 border-gray-200 rounded-full overflow-hidden">
                  <img
                    id="headerAvatarImg"
                    className="h-full w-full appearance-none"
                    crossOrigin="anonymous"
                    src={props.user.photoURL}
                  />
                </div>
                {isSubscribed && (
                  <svg className="w-4 h-4 fill-current absolute bottom-0 right-0">
                    <use xlinkHref="#icon-pro" />
                  </svg>
                )}
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="min-w-[150px] bg-black-400 rounded-md overflow-hidden shadow-[0px_10px_38px_-10px_rgba(0,_0,_0,_0.6),_0px_10px_20px_-15px_rgba(0,_0,_0,_0.5)] will-change-[opacity,transform] data-[side=top]:animate-slideDownAndFade data-[side=right]:animate-slideLeftAndFade data-[side=bottom]:animate-slideUpAndFade data-[side=left]:animate-slideRightAndFade duration-200"
                sideOffset={5}
                align="end"
              >
                <div className="px-6 py-3">
                  <p className="font-semibold text-base text-primary-100">
                    {props.user.displayName}
                  </p>
                  <p className="text-sm text-gray-600">{props.user.email}</p>
                </div>
                {isSubscribed && (
                  <DropdownMenu.Item
                    onClick={props.proBtnHandler}
                    className="text-primary-100 cursor-pointer hover:bg-black-600 text-[13px] leading-none text-gray-200 flex items-center h-14 px-6 relative select-none outline-none gap-2 duration-200"
                  >
                    <svg className="w-4 h-4 fill-current">
                      <use xlinkHref="#icon-pro" />
                    </svg>
                    My Plan ({userService.getPlanType()})
                  </DropdownMenu.Item>
                )}
                <DropdownMenu.Item
                  onClick={props.logoutBtnHandler}
                  className="text-primary-100 cursor-pointer hover:bg-black-600 text-sm leading-none text-gray-200 flex items-center h-14 px-6 relative select-none outline-none gap-2 duration-200"
                >
                  <span className="material-symbols-outlined text-lg font-bold text-gray-500">
                    logout
                  </span>
                  Log Out
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        ) : (
          <Button
            onClick={handleProfileClick}
            data-event-category="ui"
            data-event-action="headerAvatarClick"
            aria-label="See profile or Logout"
            className="border-2 border-gray-200 w-10 h-10 rounded-full overflow-hidden"
          >
            <svg className="w-6 h-6 fill-current mx-auto">
              <use xlinkHref="#icon-user" />
            </svg>
          </Button>
        )}
      </div>
    </div>
  );
}
