import Modal from '../Modal';
import {UpgradeLink} from "./UpgradeLink";

export function ProFeatureListModal(props) {
	return (
		<Modal show={props.show} closeHandler={props.closeHandler} extraClasses={'feature-list'}>
			<section className={'header'}>
				<h1 className={'price'}>$2.99<sup>[1,2]</sup>/month</h1>
				<h2>Pro</h2>
			</section>
			<section className={'content'}>
				<ul>
					<li>Real-time sequence diagram converter</li>
					<li>Export to PNG</li>
					<li>Hand-tuned themes (coming soon)</li>
					<li>Interact with the diagram (coming soon)</li>
					<li>Advanced DSL syntax (coming soon)</li>
				</ul>
			</section>
			<section className={'call-for-action hide'}>
				<button>Back</button>
			</section>
			<hr />
			<section className={'notes'}>
				<ol>
					<li>Subscribe now and stay at this low price for 12 months.					</li>
					<li>After the promotion period, price will go back to the standard monthly subscription which is $9.98/month.</li>
					<li>Unsubscribe at any time, no questions asked.</li>
				</ol>
			</section>
		</Modal>
	);
}
