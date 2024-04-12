function log() {
  if (window.DEBUG) {
    console.log(Date.now(), ...arguments);
  }
}

/* global ga */

// eslint-disable-next-line max-params
export function trackEvent(category, action, label, value) {
  if (window.DEBUG) {
    log('trackevent', category, action, label, value);
    return;
  }
  sendTrackMessage('event', category, action, label, value);
}

async function sendTrackMessage(type, category, action, label, value) {
  if (location.href.indexOf('chrome-extension://') !== -1) {
    await postAnalyticsDataByApi(type, category, action, label);
  } else {
    if (window.ga) {
      ga('send', type, category, action, label, value);
    } else {
      setTimeout(
        () => sendTrackMessage(type, category, action, label, value),
        100,
      );
    }
  }
}

function getCustomerId() {
  let cid = localStorage.getItem('cid');
  if (cid) {
    return cid;
  }
  cid =
    Math.floor(Math.random() * 0x7fffffff) +
    '.' +
    Math.floor(Date.now() / 1000);
  localStorage.setItem('cid', cid);
  return cid;
}

async function postAnalyticsDataByApi(type, category, action, label) {
  const url = 'https://www.google-analytics.com/collect';
  const gaParams = new URLSearchParams();
  gaParams.append('v', 1);
  gaParams.append('tid', 'UA-1211588-20');
  gaParams.append('cid', getCustomerId());
  gaParams.append('dl', window.location.host);
  gaParams.append('ul', navigator.language);
  gaParams.append('de', document.characterSet);
  gaParams.append('dt', document.title);
  gaParams.append('el', label ? label : null);
  gaParams.append('t', type);
  gaParams.append('ec', category);
  gaParams.append('ea', action);

  await fetch(url, {
    method: 'POST',
    mode: 'no-cors',
    cache: 'no-cache',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    redirect: 'follow',
    referrerPolicy: 'no-referrer',
    body: gaParams,
  });
}

export function trackPageView(pageName = null) {
  if (window.DEBUG) {
    log('trackPageView', pageName);
    return;
  }
  sendTrackMessage('pageview', pageName);
}

export function trackGaSetField(fieldName, fieldValue) {
  if (window.DEBUG) {
    log('trackGaSetField', fieldName, fieldValue);
    return;
  }
  if (window.ga) {
    ga('set', fieldName, fieldValue);
  } else {
    setTimeout(() => trackGaSetField(fieldName, fieldValue), 100);
  }
}

// if online, load after sometime
if (
  navigator.onLine &&
  !window.DEBUG &&
  location.href.indexOf('chrome-extension://') === -1
) {
  /* eslint-disable */

  // prettier-ignore
  setTimeout(function () {
		(function (i, s, o, g, r, a, m) {
			i['GoogleAnalyticsObject'] = r;
			i[r] = i[r] || function () {
				(i[r].q = i[r].q || []).push(arguments);
			}, i[r].l = 1 * new Date();
			a = s.createElement(o),
				m = s.getElementsByTagName(o)[0];
			a.async = 1;
			a.src = g;
			m.parentNode.insertBefore(a, m);
		})(window, document, 'script', 'https://www.google-analytics.com/analytics.js', 'ga');

		if (location.href.indexOf('chrome-extension://') === -1) {
			ga('create', 'UA-1211588-20');
		} else {
			ga('create', 'UA-1211588-20', {
				'cookieDomain': 'none'
			});
			// required for chrome extension protocol
			ga('set', 'checkProtocolTask', function () { /* nothing */
			});
		}
	}, 100);

  /* eslint-enable */
}
