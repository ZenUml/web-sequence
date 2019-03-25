/* eslint-disable sort-imports */
import Vue from 'vue'
import Vuex from 'vuex'
import { trackEvent } from './src/analytics';


import { Version, SeqDiagram, Store } from 'vue-sequence'
import 'vue-sequence/dist/vue-sequence.css'

import domtoimage from 'dom-to-image'
import saveAs from 'file-saver'

Vue.use(Vuex)
Vue.component('seq-diagram', SeqDiagram)

const store = new Vuex.Store({
  modules: {
    Store
  }
})

/* eslint-disable */
window.app = new Vue({
  el: '#demo',
  store
})

window.domtoimage = domtoimage
window.saveAs = saveAs.saveAs

function downloadPng() {
	var node = document.getElementById('diagram')
	domtoimage.toBlob(document.getElementById('diagram'), { bgcolor: 'white' })
		.then(function (blob) {
			window.saveAs(blob, 'zenuml.png');
			trackEvent('ui', 'downloadPng');
		});
}
function downloadJpeg() {
	var node = document.getElementById('diagram')
	domtoimage.toJpeg(node, { bgcolor: 'white' })
		.then(function (dataUrl) {
			var link = document.createElement('a');
			link.download = 'zenuml.jpeg';
			link.href = dataUrl;
			link.click();
			trackEvent('ui', 'downloadjpeg');
		});
}
window.downloadPng = downloadPng
window.downloadJpeg = downloadJpeg
console.log('Using vue-sequence', Version)

document.addEventListener('DOMContentLoaded', function () {
	const exportPngButton = document.getElementById('btnDownloadPng');
	const exportJpegButton = document.getElementById('btnDownloadJpeg');
	
	if(exportPngButton) {
		exportPngButton.addEventListener('click', downloadPng);
	}
	if(exportJpegButton) {
		exportJpegButton.addEventListener('click', downloadJpeg);
	}
});
