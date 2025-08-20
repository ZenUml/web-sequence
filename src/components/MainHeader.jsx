import { h } from 'preact';
import { useCallback, useState } from 'preact/hooks';
import { Button } from './common';
import { ProductVersionLabel } from '../zenuml/components/MainHeader/ProductVersionLabel/ProductVersionLabel';
import featureToggle from '../services/feature_toggle';
import { Popover } from './PopOver';
import { SharePanel } from './SharePanel';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import userService from '../services/user_service';
import mixpanel from '../services/mixpanel';
import aiTitleService from '../services/aiTitleService';

export function MainHeader(props) {
  const [isEditing, setEditing] = useState(false);
  const [isSharePanelVisible, setIsSharePanelVisible] = useState(false);
  const [imageBase64] = useState();
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);

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

  const handleTrack = () => {
    mixpanel.track({ event: 'toLanguageGuide', category: 'ui' });
  };

  const handleGenerateTitle = async () => {
    if (!props.user) {
      props.loginBtnHandler();
      return;
    }

    if (isGeneratingTitle) return;

    const currentPageContent = props.currentItem?.pages?.find(
      page => page.id === props.currentItem.currentPageId
    )?.js;

    if (!currentPageContent) {
      console.warn('No diagram content found for title generation');
      return;
    }

    setIsGeneratingTitle(true);

    try {
      const generatedTitle = await aiTitleService.generateTitle(currentPageContent);
      
      // Update the title using the existing handler
      const event = {
        target: { value: generatedTitle }
      };
      props.titleInputBlurHandler(event);
      
      mixpanel.track({ event: 'ai_title_generated', category: 'ai' });
    } catch (error) {
      console.error('Failed to generate title:', error);
      // You could show a toast notification here
    } finally {
      setIsGeneratingTitle(false);
    }
  };

  const isSubscribed = userService.isSubscribed();

  return (
    <div className="main-header text-gray-400 py-2 px-8 flex justify-between border-b border-black-700 bg-black-500">
      <div className="flex items-center gap-4">
         <button
          className="py-1.5 duration-200 font-semibold flex items-center gap-2 rounded-lg"
          aria-label="Toggle editor pane"
          title={props.isEditorCollapsed ? "Expand editor pane" : "Collapse editor pane"}
          onClick={props.onToggleEditorCollapse}
        >
          <svg 
            className={`h-8 w-8 transition-transform duration-200 ${
              props.currentLayoutMode === 2 ? 'rotate-90' : 
              props.currentLayoutMode === 3 ? 'rotate-180' : 
              'rotate-0'
            }`}
          >
            <use xlinkHref={props.isEditorCollapsed ? "#icon-expand" : "#icon-collapse"} />
          </svg>
        </button>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <div className="flex items-center p-1 hover:bg-gray-700 data-[state=open]:bg-[#454856] rounded-lg cursor-pointer duration-200">
              <svg className="h-9 w-9">
                <use xlinkHref="#outline-zenuml" />
              </svg>
              <svg className="h-6 w-6">
                <use xlinkHref="#icon-arrow-down" />
              </svg>
            </div>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="w-[200px] bg-black-400 rounded-md overflow-hidden shadow-[0px_10px_38px_-10px_rgba(0,_0,_0,_0.6),_0px_10px_20px_-15px_rgba(0,_0,_0,_0.5)] will-change-[opacity,transform] data-[side=top]:animate-slideDownAndFade data-[side=right]:animate-slideLeftAndFade data-[side=bottom]:animate-slideUpAndFade data-[side=left]:animate-slideRightAndFade duration-200"
              sideOffset={5}
              align="start"
            >
              <DropdownMenu.Item
                onClick={() => props.openCheatSheet()}
                className="cursor-pointer hover:bg-black-600 text-sm leading-none flex items-center h-14 px-6 relative select-none outline-none gap-2 duration-200"
              >
                <svg className="h-5 w-5">
                  <use xlinkHref="#icon-cheatsheet" />
                </svg>
                Cheatsheet
              </DropdownMenu.Item>
              <DropdownMenu.Item className="cursor-pointer hover:bg-black-600 text-sm leading-none relative select-none outline-none duration-200">
                <a
                  onClick={handleTrack}
                  className="flex items-center h-14 px-6 gap-2 !no-underline"
                  target="_blank"
                  href="https://zenuml.com/docs/category/language-guide"
                >
                  <svg className="h-5 w-5">
                    <use xlinkHref="#icon-guide" />
                  </svg>
                  Language guide
                </a>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onClick={props.settingsBtnClickHandler}
                className="text-primary-100 border-black-700 border-t cursor-pointer hover:bg-black-600 text-sm leading-none text-gray-200 flex items-center h-14 px-6 relative select-none outline-none gap-2 duration-200"
              >
                <span class="material-symbols-outlined text-lg font-light text-gray-500">
                  settings
                </span>
                Settings
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <button
          className="px-4 py-1.5 bg-black-600 hover:opacity-80 duration-200 font-semibold flex items-center gap-2 rounded-lg"
          aria-label="Start a new creation"
          onClick={props.newBtnHandler}
        >
          <svg className="h-5 w-5">
            <use xlinkHref="#icon-plus" />
          </svg>
          <span>New</span>
        </button>
        <button
          id="openItemsBtn"
          className={`px-4 py-1.5 bg-black-600 hover:opacity-80 duration-200 font-semibold flex items-center gap-2 rounded-lg ${
            props.isFetchingItems ? 'is-loading' : ''
          }`}
          aria-label="Open a saved creation (Ctrl/⌘ + O)"
          onClick={props.openBtnHandler}
        >
          <svg className="h-5 w-5">
            <use xlinkHref="#icon-gallery" />
          </svg>
          <span>My library</span>
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
          <div className="flex items-center gap-2 font-semibold">
            <div
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => entryEditing()}
            >
              <span>{props.title || 'Untitled'} </span>
              <svg className="h-5 w-5">
                <use xlinkHref="#icon-pen" />
              </svg>
            </div>
            {props.user && (
              <button
                onClick={handleGenerateTitle}
                disabled={isGeneratingTitle}
                className="ml-2 px-3 py-1 bg-primary hover:opacity-80 disabled:opacity-50 text-white text-sm rounded-md font-medium duration-200 flex items-center gap-2"
                title="Generate title using AI"
              >
                {isGeneratingTitle ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                    Generate Title
                  </>
                )}
              </button>
            )}
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
            className="h-10 px-4 bg-primary rounded-lg text-gray-100 font-semibold hover:opacity-80 duration-200"
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
                className="h-10 px-4 bg-primary rounded-lg text-white font-semibold hover:opacity-80 duration-200"
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
          <ProductVersionLabel
            user={props.user}
            clickHandler={props.proBtnHandler}
          />
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
