function zenUmlNewBtnClickHandler(app) {
	return function(){
		app.fetchItems(true).then(items => {
			app.newBtnClickHandler();
		});
	}
}

export { zenUmlNewBtnClickHandler };
