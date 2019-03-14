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
		let codeLinesArray = !isEmpty(code) ? code.split('\n') : [];

		if (newCode === NEW_PARTICIPANT) {
			const leadingCommentLines = until(codeLinesArray, line => (line.trim().length > 0 && !line.trim().startsWith('//')));
			const remainingLines = codeLinesArray.slice(leadingCommentLines.length);
			codeLinesArray = leadingCommentLines.concat([NEW_PARTICIPANT]).concat(remainingLines);
		} else if (!isEmpty(newCode)) codeLinesArray.push(newCode);

		return codeLinesArray.join('\n');
	}
};
