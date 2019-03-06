export default {
    addCode: (code, newCode) => {
        function until(arr, fn) {
			const l = arr.length;
			let i = 0;
			while (i < l && !fn(arr[i])) {
				i++;
			}
			return arr.slice(0, i);
		}

		if (!newCode || newCode.trim() === '') return code;
		if (!code || code.trim() === '') return newCode;

        if (newCode === 'NewParticipant') {
			const lines = code.split('\n');
            const leadingCommentLines = until(lines, line => (line.trim().length > 0 && !line.trim().startsWith('//')));
            const remainingLines = lines.slice(leadingCommentLines.length)
			const all = leadingCommentLines.concat(['NewParticipant']).concat(remainingLines);
            return all.join('\n');
        }

        return `${code}\n${newCode}`;
    }
};
