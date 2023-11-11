import { Component } from 'preact';
import PropTypes from 'prop-types';
import { PreviewCard } from './PreviewCard';
import { syncDiagram, getShareLink } from '../services/syncService';
import { Popover } from './PopOver';
import { Button } from './common';

export class SharePanel extends Component {
	constructor(props) {
		super(props);
		this.state = {
			isLoading: true,
			link: '',
			isTooltipVisible: false,
		};
	}

	async componentDidMount() {
		const result = await syncDiagram(this.props.currentItem);
		if (!result) {
			return;
		}
		this.setState({
			isLoading: false,
			link: getShareLink(result),
		});
	}

	handleCopyLink = () => {
		const { link } = this.state;
		navigator.clipboard.writeText(link);
		this.setState({
			isTooltipVisible: true,
		});
		setTimeout(() => {
			this.setState({ isTooltipVisible: false });
		}, 3000);
	};

	render() {
		const { author, currentItem } = this.props;
		const { link, isLoading } = this.state;

		return (
			<div className="share-panel">
				<h3 style={{ marginTop: '4px' }}>
					Share the Diagram on Confluence<sup>*</sup>
				</h3>
				<>
					<div>
						<p>Paste the link on Confluence and select "Display as a Card"</p>
						<img style="width: 100%;" src="../assets/tutorial.png" />
					</div>
					<br />
					<div>
						<h4 style="margin-bottom: 8px;">Preview</h4>
						<div className="preview">
							<PreviewCard
								title={currentItem.title}
								author={author}
								description="Click and check the latest diagram. Install our Confluence plugin for an enhanced expperience when viewing in Confluence."
								imageBase64={currentItem.imageBase64}
							/>
							<Popover
								isVisible={this.state.isTooltipVisible}
								placement={'top'}
								hasShadow={true}
								trigger={
									<Button
										aria-label="Copy link"
										className="button icon-button copy-button"
										title={link}
										onClick={this.handleCopyLink}
										disabled={isLoading}
									>
										{isLoading ? (
											<div className="loader" />
										) : (
											<span className="material-symbols-outlined">link</span>
										)}
										<span>Copy link</span>
									</Button>
								}
								content={
									<div className="tooltip">
										<span class="material-symbols-outlined">check_circle</span>
										<span>Link copied to clipboard</span>
									</div>
								}
							/>
						</div>
					</div>
					<span className="footnote">
						* Anyone with the link can view the diagram. The view is optimised
						for Confluence.
					</span>
				</>
			</div>
		);
	}
}

SharePanel.propTypes = {
	author: PropTypes.string,
	currentItem: PropTypes.object,
};
