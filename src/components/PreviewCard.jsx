import React from 'react';
import PropTypes from 'prop-types';

export function PreviewCard({ title, author, description, imageBase64 }) {
  return (
    <div className="preview-card">
      <div className="preview-card__content">
        <div className="preview-card__title">
          <img src="https://zenuml.cn/favicon.ico" />
          <span className="text-ellipsis">{title}</span>
        </div>
        <div className="preview-card__subtitle">
          <span class="material-symbols-outlined">account_circle</span>
          <span className="text-ellipsis">Created by {author}</span>
        </div>
        <div className="preview-card__description">
          <p>{description}</p>
        </div>
        <div className="preview-card__footer">
          <img src="https://zenuml.cn/favicon.ico" />
          <span>ZenUML</span>
        </div>
      </div>
      <div className="preview-card__image">
        <div className="overlay">
          <img src={imageBase64} />
        </div>
      </div>
    </div>
  );
}

PreviewCard.propTypes = {
  title: PropTypes.string.isRequired,
  author: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  imageBase64: PropTypes.string,
};
