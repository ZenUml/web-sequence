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
			hasError: false,
		};
	}

	async componentDidUpdate(prevProps) {
		if (
			prevProps.currentItem.imageBase64 !== this.props.currentItem.imageBase64
		) {
			await this.syncDiagram(this.props.currentItem);
		}
	}

	async syncDiagram(currentItem) {
		this.setState({ isLoading: true });
		try {
			const result = await syncDiagram(currentItem);

			this.setState({
				link: getShareLink(result),
				hasError: false,
			});
		} catch (err) {
			this.setState({ link: '', hasError: true });
		} finally {
			this.setState({ isLoading: false });
		}
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
		const { link, isLoading, isTooltipVisible, hasError } = this.state;

		return (
			<div className="share-panel">
				<Popover
					isVisible={isTooltipVisible}
					placement={'top'}
					hasShadow={true}
					trigger={
						<Button
							aria-label="Copy link*"
							className="button icon-button copy-button text-sm"
							title={link}
							onClick={this.handleCopyLink.bind(this)}
							disabled={isLoading}
						>
							{isLoading ? (
								<div className="loader" />
							) : (
								<span className="material-symbols-outlined">link</span>
							)}
							<span>
								Copy link<sup>*</sup>
							</span>
						</Button>
					}
					content={
						hasError ? (
							<div className="tooltip">
								<span class="material-symbols-outlined error">error</span>
								<span>
									Unable to create the share link. Save it and try again later.
								</span>
							</div>
						) : (
							<div className="tooltip">
								<span class="material-symbols-outlined success">
									check_circle
								</span>
								<span>Link copied to clipboard</span>
							</div>
						)
					}
				/>
				<hr />
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
