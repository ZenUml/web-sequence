import PropTypes from "prop-types";

export function PreviewCard({ title, description, image }) {
	return (
		<div className="preview-card">
			<div className="preview-card__content">
				<div className="preview-card__title">
					<img src="https://zenuml.cn/favicon.ico" />
					<span>{title}</span>
				</div>
				<div className="preview-card__description">
					<span>{description}</span>
				</div>
			</div>
			<div className="preview-card__image">
				<img src={image} />
			</div>
		</div>
	);
}

PreviewCard.propTypes = {
	title: PropTypes.string.isRequired,
	description: PropTypes.string.isRequired,
	image: PropTypes.string.isRequired,
};
