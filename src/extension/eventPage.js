function openApp() {
	chrome.tabs.create({
		url: chrome.runtime.getURL('index.html'),
		selected: true
	});
}

chrome.action.onClicked.addListener(function() {
	openApp();
});

// Listen for tabs getting created.
chrome.tabs.onCreated.addListener(function(tab) {
	// If a new tab is opened (without any URL), check user's
	// replace Tab setting and act accordingly. Default is false.
	if (tab.url === 'chrome://newtab/') {
		chrome.storage.sync.get(
			{
				replaceNewTab: false
			},
			function(items) {
				if (items.replaceNewTab) {
					chrome.tabs.update(
						tab.id,
						{
							url: chrome.runtime.getURL('index.html')
						},
						function callback() {
							console.log('ho gaya');
						}
					);
				}
			}
		);
	}
});

chrome.runtime.onInstalled.addListener(function callback(details) {
	if (details.reason === 'install') {
		openApp();
	}
	if (details.reason === 'update') {
		if ((details.previousVersion + '').indexOf('0.') === 0) {
			// openApp();
		}
	}
});

chrome.runtime.setUninstallURL('https://goo.gl/forms/eKJSpdvMjehCBy332');
