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
		await this.syncDiagram(this.props.currentItem);
	}

	async componentDidUpdate(prevProps) {
		if (prevProps.currentItem !== this.props.currentItem) {
			await this.syncDiagram(this.props.currentItem);
		}
	}

	async syncDiagram(currentItem) {
		const result = await syncDiagram(currentItem);
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
				<Popover
						isVisible={this.state.isTooltipVisible}
						placement={'top'}
						hasShadow={true}
						trigger={
							<Button
									aria-label="Copy link*"
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
								<span>Copy link<sup>*</sup></span>
							</Button>
						}
						content={
							<div className="tooltip">
								<span class="material-symbols-outlined">check_circle</span>
								<span>Link copied to clipboard</span>
							</div>
						}
				/>
				<hr/>
				<h3 style={{ marginTop: '4px' }}>
					Want to share the diagram on Confluence?
				</h3>
				<>
					<div>
						<p>Paste the link on Confluence and select "Display as a Card"</p>
						<img style="width: 100%;" src="../assets/tutorial.png" />
					</div>
					<div>
						<div className="preview">
							<PreviewCard
								title={currentItem.title}
								author={author}
								description="Click and check the latest diagram. Install our Confluence plugin for an enhanced expperience when viewing in Confluence."
								imageBase64={currentItem.imageBase64}
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
