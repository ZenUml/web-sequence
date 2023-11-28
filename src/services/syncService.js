import firebase from 'firebase/app';

async function syncDiagram(currentItem) {
	if(location.host === 'localhost:8080') {
		console.log('!! Skipping sync-diagram call in local environment');
		return;
	}

	const { id, title, js, imageBase64 } = currentItem;
	if (!js || !title || !imageBase64) {
		console.log('!! Cannot sync diagram because of missing data', currentItem);
		throw Error('Cannot sync diagram because of missing data');
	}

	const token = await firebase.auth().currentUser.getIdToken(true);

	const data = {
		token,
		id,
		imageBase64,
		name: title,
		content: js,
		description: 'Shared diagram from https://app.zenuml.com',
	};
	console.log('calling /sync-diagram with data:', data)
	try {
		const response = await fetch('/sync-diagram', {
			method: 'POST',
			body: JSON.stringify(data),
			headers: { 'Content-Type': 'application/json' },
		});
		const result = await response.json();
		console.log('save to php app result: ', result)
		return result;
	} catch (error) {
		console.warn('Error when calling /sync-diagram', error);
		throw Error('Error when calling /sync-diagram');
	}
}

function getShareLink(syncResult) {
	return `${syncResult.page_share}?v=${syncResult.md5}`;
}

export { syncDiagram, getShareLink };
