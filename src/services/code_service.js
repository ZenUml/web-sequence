export default {
    addCode: (code, newCode) => {
        if (newCode === '') {
            return code;
	    }
        if (newCode === 'NewParticipant') {
			const lines = code.split('\n');
            let buffer = '';
            let added = false;
			lines.forEach(line => {
				const hasContent = line.trim().length > 0;
				const isComment = line.trim().startsWith('//');
				if (!hasContent || isComment || added) {
					buffer = buffer === '' ? line : `${buffer}\n${line}`;
					return;
				}
				buffer = buffer === '' ? 'NewParticipant' : `${buffer}\n'NewParticipant'`;
				buffer += `\n${line}`;
				added = true;
			});
			if (!added) {
				buffer = code === '' ? 'NewParticipant' : `${code}\nNewParticipant`;
			}
			return buffer;
        }

        return code === '' ? newCode : `${code}\n${newCode}`;
    }
};
