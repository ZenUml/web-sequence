export default {
    addCode: (code, newCode) => {
        if (newCode === 'NewParticipant') {
			const lines = code.split('\n');
            let buffer = '',
                added = false;
			lines.forEach(line => {
				if (!added && (line.trim().length > 0 && !line.trim().startsWith('//'))) {
					buffer = buffer === '' ? newCode : `${buffer}\n${newCode}`;
					added = true;
				}
				buffer = buffer === '' ? line : `${buffer}\n${line}`;
			});
			if (!added) {
				buffer = code === '' ? newCode : `${code}\n${newCode}`;
			}
			return buffer;
        }
        
        return code === '' ? newCode : `${code}\n${newCode}`;
    }
};