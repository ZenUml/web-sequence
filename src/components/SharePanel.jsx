
export function SharePanel(params) {
	return (
		<div className="share-panel">
			<h3 style="margin-top: 4px">Share this diagram</h3>
			<ul>
				<li>
					<h4>Option 1(Recommended): Install ZenUML Confluence Plugin</h4>
					<p>
						You can create and edit sequence diagram on Confluence pages.&nbsp;
						<a>More Info</a>
						<br />
					</p>
				</li>
				<li>
					<h4>Option 2: Use Confluence Iframe plugin</h4>
					<img width={200} height={100} style="background: #acacac" />
					<p>URL: </p>
				</li>
				<li>
					<h4>Option 3: Copy and paste the link to Confluence and select Card style</h4>
					<img width={200} height={100} style="background: #acacac" />
					<p>URL: </p>
				</li>
			</ul>
		</div>
	)
}
