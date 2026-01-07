import { Link } from 'react-router-dom';

export default function TermsPage() {
  return (
    <div className="legalPage">
      <div className="legalContainer">
        <Link className="backLink" to="/">
          ← Back
        </Link>

        <h1>Terms of Service</h1>
        <p className="muted">Last updated: {new Date().toLocaleDateString()}</p>

        <h2>Eligibility</h2>
        <p>You must be at least 18 years old to use Bump Ping.</p>

        <h2>Community guidelines</h2>
        <ul>
          <li>Be respectful. Harassment is not tolerated.</li>
          <li>Don’t impersonate others or create fake profiles.</li>
          <li>Don’t use the app for illegal activity.</li>
        </ul>

        <h2>Safety</h2>
        <p>
          Use common sense when meeting people in real life. You can block or report users at any time.
        </p>

        <h2>Termination</h2>
        <p>
          We may suspend or terminate accounts that violate these terms or harm the community.
        </p>

        <h2>Contact</h2>
        <p>
          Questions? Email us at <a href="mailto:support@bump-ping.com">support@bump-ping.com</a>.
        </p>
      </div>
    </div>
  );
}


