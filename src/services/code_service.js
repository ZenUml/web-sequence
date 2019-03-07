function until(arr, fn) {
	const l = arr.length;
	let i = 0;
	while (i < l && !fn(arr[i])) {
		i++;
	}
	return arr.slice(0, i);
}

const isEmpty = str => !str || str.trim() === '';

const NEW_PARTICIPANT = 'NewParticipant';
export default {
	addCode: (code, newCode) => {
		let codeLinesArray = new Array(0);

		codeLinesArray = !isEmpty(code) ? codeLinesArray.concat(code.split('\n')) : codeLinesArray;
		codeLinesArray = !isEmpty(newCode) ? codeLinesArray.concat([newCode]) : codeLinesArray;

		if (newCode === NEW_PARTICIPANT) {
			codeLinesArray.pop();
			const leadingCommentLines = until(codeLinesArray, line => (line.trim().length > 0 && !line.trim().startsWith('//')));
			const remainingLines = codeLinesArray.slice(leadingCommentLines.length);
			codeLinesArray = leadingCommentLines.concat([NEW_PARTICIPANT]).concat(remainingLines);
		}

		return codeLinesArray.join('\n');
	}
};
