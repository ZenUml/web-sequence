import {trackEvent} from "./analytics";
import {log} from "./utils";

export function writeFile(name, blob, cb) {
	var fileWritten = false;

	function getErrorHandler(type) {
		return function() {
			log(arguments);
			trackEvent('fn', 'error', type);
			// When there are too many write errors, show a message.
			writeFile.errorCount = (writeFile.errorCount || 0) + 1;
			if (writeFile.errorCount === 4) {
				setTimeout(function() {
					alert(
						"Oops! Seems like your preview isn't updating. It's recommended to switch to the web app: https://app.zenuml.com.\n\n If you still want to get the extension working, please try the following steps until it fixes:\n - Refresh ZenUML\n - Restart browser\n - Update browser\n - Reinstall ZenUML (don't forget to export all your creations from saved items pane (click the OPEN button) before reinstalling)\n\nIf nothing works, please tweet out to @ZenUML."
					);
					trackEvent('ui', 'writeFileMessageSeen');
				}, 1000);
			}
		};
	}

	// utils.log('writing file ', name);
	window.webkitRequestFileSystem(
		window.TEMPORARY,
		1024 * 1024 * 5,
		function(fs) {
			fs.root.getFile(
				name,
				{
					create: true
				},
				function(fileEntry) {
					fileEntry.createWriter(fileWriter => {
						function onWriteComplete() {
							if (fileWritten) {
								// utils.log('file written ', name);
								return cb();
							}
							fileWritten = true;
							// Set the write pointer to starting of file
							fileWriter.seek(0);
							fileWriter.write(blob);
							return false;
						}
						fileWriter.onwriteend = onWriteComplete;
						// Empty the file contents
						fileWriter.truncate(0);
						// utils.log('truncating file ', name);
					}, getErrorHandler('createWriterFail'));
				},
				getErrorHandler('getFileFail')
			);
		},
		getErrorHandler('webkitRequestFileSystemFail')
	);
}
