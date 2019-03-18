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
	domtoimage.toBlob(document.getElementById('diagram'), {bgcolor: 'white'})
		.then(function (blob) {
			window.saveAs(blob, 'zenuml.png');
			trackEvent('ui', 'downloadPng');
		});
}
function downloadJPEG() {
	var node = document.getElementById('diagram')
	domtoimage.toJpeg(document.getElementById('diagram'), { quality: 0.95 })
	    .then(function (dataUrl) {
                var link = document.createElement('a');
                link.download = 'my-image-name.jpeg';
                link.href = dataUrl;
                link.click();
            });
		.then(function (blob) {
			window.saveAs(blob, 'zenuml.jpeg');
			trackEvent('ui', 'downloadjpeg');
		});
}
window.downloadPng = downloadPng
window.downloadJPEG = downloadJPEG
console.log('Using vue-sequence', Version)

document.addEventListener('DOMContentLoaded', function () {
	const exportButton = document.getElementById('btnDownloadPng');
	const exportButtonSecond = document.getElementById('btnDownloadJPEG');
	
	if(exportButton) {
		exportButton.addEventListener('click', downloadPng);
	}
	if(exportButtonSecond) {
		exportButtonSecond.addEventListener('click', downloadJPEG);
	}
});
