import React from 'react';
import { Button } from './common';

function NotificationItem({ type, children }) {
  var strongTag;
  if (type === 'bug') {
    strongTag = <strong>🔧 Bugfix</strong>;
  } else if (type === 'a11y') {
    strongTag = <strong>♿️ Accessibility</strong>;
  } else if (type === 'ui') {
    strongTag = <strong>🖥 Interface</strong>;
  }
  return (
    <li>
      {strongTag}: {children}
    </li>
  );
}

function ThanksTo({ name, url }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {' '}
      {name}
    </a>
  );
}

function Notification({ version, isLatest, ...props }) {
  return (
    <div class="notification">
      <span class="notification__version">{version}</span>
      <ul>{props.children}</ul>
      {isLatest ? (
        <div class="mt-2">
          <p>
            <a
              href="https://github.com/ZenUml/web-sequence/issues"
              target="_blank"
              rel="noopener noreferrer"
            >
              Suggest features or report bugs.
            </a>
          </p>
          <p>
            ZenUML now has more than 50K active users! Thank you for being a
            part of this community of awesome developers. If you find ZenUML
            helpful,{' '}
            <a
              href="https://chrome.google.com/webstore/detail/web-sequence/kcpganeflmhffnlofpdmcjklmdpbbmef/reviews"
              target="_blank"
              rel="noopener noreferrer"
              class="btn"
            >
              Please rate ZenUML <span class="star" />
            </a>
            &nbsp;
            <a
              href="http://twitter.com/share?url=https://zenuml.com/&text=ZenUML - A real-time sequence diagram generator! via @ZenUML&related=ZenUML&hashtags=web,developer,chrome,extension"
              target="_blank"
              rel="noopener noreferrer"
              class="btn"
            >
              Share it
            </a>
            &nbsp;
            <Button
              aria-label="Support the developer"
              onClick={props.onSupportBtnClick}
              data-event-action="supportDeveloperChangelogBtnClick"
              data-event-category="ui"
              class="btn btn-icon"
            >
              Support the developer
            </Button>
          </p>
        </div>
      ) : null}
    </div>
  );
}
export function Notifications(props) {
  return (
    <div>
      <h1>Whats new?</h1>

      <Notification version="3.6.1" {...props} isLatest={true}>
        <NotificationItem type="bug">
          Failing to import local creations when logging in.
        </NotificationItem>
      </Notification>

      <Notification version="3.6.0" {...props}>
        <li>
          <strong>New Setting</strong>: Configure if you want to auto-close the
          tags in HTML. (#347)
        </li>
        <li>
          <strong>Prettier</strong>: Prettier now works on HTML also! Also the
          keyboard shortcut has been changed to <kbd>Ctrl</kbd> +{' '}
          <kbd>Shift</kbd> + <kbd>F</kbd>.
        </li>

        <li>
          No more anonying alert on opening ZenUML in multiple tabs. Thanks team
          Firebase :) (#340)
        </li>

        <li>
          <strong>🔥 ZenUML 4.0 is coming!</strong> Follow{' '}
          <a href="https://twitter.com/ZenUML" target="_blank" rel="noopener">
            ZenUML on Twitter
          </a>{' '}
          to keep up with all the exciting updates.
        </li>
      </Notification>
    </div>
  );
}
