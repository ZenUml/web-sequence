window.addEventListener("load", function (event) {
	console.log("window loaded");
	window.app = new window.zenuml.default('#mounting-point');
});
window.addEventListener('message', (e) => {
	const code = e.data && e.data.code;
	const cursor = e.data && e.data.cursor;

	if (code && app) {
		app.render(code, { enableMultiTheme: false });
	}

	if (app && (cursor !== null || cursor !== undefined)) {
		app.store.state.cursor = cursor;
	}
}, false);
