window.addEventListener("load", function (event) {
	console.log("window loaded");
	Vue.use(Vuex);
	let {VueSequence} = window['vue-sequence'];
	let storeConfig = VueSequence.Store();
	storeConfig.state.code = "A.method";
	Vue.component("frame", VueSequence.DiagramFrame);
	Vue.component("seq-diagram", VueSequence.SeqDiagram);
	window.app = new Vue({
		el: document.getElementById('mounting-point'),
		store: new Vuex.Store(storeConfig),
		render: (h) => h('frame')
	});
});
window.addEventListener('message', (e) => {
	const code = e.data && e.data.code;
	const cursor = e.data && e.data.cursor;

	if (code && app) {
		app.$store.commit('code', code);
	}

	if (app && (cursor !== null || cursor !== undefined)) {
		app.$store.state.cursor = cursor;
	}
}, false);
