
async function track(event) {
	return await fetch('/track', {
		method: 'POST',
		body: JSON.stringify(Object.assign({}, event, {userId: window.user && window.user.uid})),
		headers: { 'Content-Type': 'application/json' }
	});
}

export default { track };
