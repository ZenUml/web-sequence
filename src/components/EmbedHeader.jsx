export default function EmbedHeader(props) {
	return (
		<div className="embed-header">
			<div className="embed-header__left">
				<div className="header-logo">
					<img src="assets/zenuml-icon.png" alt="zenuml logo" />
				</div>
				<div className="tit">{this.props.title || 'Untitled'}</div>
			</div>
			<div className="embed-header__right">
				<a
					className="embed-header__external"
					title="Edit on app.zenuml.com"
					target="_blank"
					href={this.props.link}
				>
					<img src="assets/external-link.svg" alt="link logo" />
				</a>
			</div>
		</div>
	);
}
