
import { Component } from 'preact';
import PropTypes from 'prop-types';
import { PreviewCard } from './PreviewCard';


export class SharePanel extends Component {
	constructor(props) {
		super(props);
		this.state = {
			isLoading: true,
			link: '',
		}
	}

	componentDidMount() {
		// TODO: API call to get the link
		setTimeout(() => {
			this.setState({
				isLoading: false,
				link: 'https://sequencediagram.zenuml.com/preview/1234',
			})
		}, 3000);
	}

	handleCopyLink = () => {
		const { link } = this.state;
		navigator.clipboard.writeText(link);
	}

	render() {
		const { link, isLoading } = this.state;


		return (
			<div className="share-panel">
				<h3 style={{ marginTop: '4px' }}>Share the Diagram on Confluence<sup>*</sup></h3>
				<>
					<div>
						<p>Paste the link on Confluence and select "Display as a Card"</p>
						<img width={200} height={100} style="background: #acacac" />
					</div>
					<br />
					<div>
						<h4 style="margin-bottom: 8px;">Preview</h4>
						<div className="preview" >
							<PreviewCard
								title="ZenUML Sequence"
								description="ZenUML Sequence"
								image="https://zenuml.cn/storage/diagrams/3/79.png"
							/>
							<button
								aria-label="Copy link"
								className="button icon-button copy-button" title={link}
								onClick={this.handleCopyLink}
							>
								{isLoading ? <div className="loader" /> :
									<span className="material-symbols-outlined">
										link
									</span>}
								<span>Copy link</span>
							</button>
						</div>
					</div>
					<span className="footnote">* Anyone with the link can view the diagram. The view is optimised for Confluence.</span>
				</>
			</div>
		);
	}
}

SharePanel.propTypes = {
	id: PropTypes.string,
	dsl: PropTypes.string,
	email: PropTypes.string,
	image: PropTypes.string,
};
