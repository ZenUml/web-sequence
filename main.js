/* eslint-disable sort-imports */
import { trackEvent } from './src/analytics';

import domtoimage from 'dom-to-image'
import saveAs from 'file-saver'

window.domtoimage = domtoimage;
window.saveAs = saveAs.saveAs;

function downloadPng() {
	var node = document.getElementsByClassName('sequence-diagram')[0];
	domtoimage.toBlob(node, { bgcolor: 'white' })
		.then(function (blob) {
			window.saveAs(blob, 'zenuml.png');
			trackEvent('ui', 'downloadPng');
		});
}
function downloadJpeg() {
	var node = document.getElementsByClassName('sequence-diagram')[0];
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
