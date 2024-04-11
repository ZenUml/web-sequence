const CancellationLink = (props) => {
	return <a href={props.cancelUrl} target='_blank' className='px-3 py-2 border-gray-400 border w-full rounded-lg block !no-underline decoration-0 hover:bg-gray-500/20'>Cancel subscription</a>;
};

export { CancellationLink };
