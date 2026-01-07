import { Link } from 'react-router-dom';

export default function PrivacyPage() {
  return (
    <div className="legalPage">
      <div className="legalContainer">
        <Link className="backLink" to="/">
          ← Back
        </Link>

        <h1>Privacy Policy</h1>
        <p className="muted">Last updated: {new Date().toLocaleDateString()}</p>

        <h2>Summary</h2>
        <p>
          Bump Ping is a location-assisted dating experience. We use curated public-place visits to help surface
          potential matches while protecting your privacy.
        </p>

        <h2>Information we collect</h2>
        <ul>
          <li>
            <strong>Account info</strong> (e.g., email address, name)
          </li>
          <li>
            <strong>Profile content</strong> (photos, bio, interests)
          </li>
          <li>
            <strong>Approximate place visits</strong> to curated public venues (not your precise live location shared with others)
          </li>
          <li>
            <strong>Messages</strong> you send in chats
          </li>
          <li>
            <strong>Device identifiers</strong> needed for push notifications (Expo push token)
          </li>
        </ul>

        <h2>How we use information</h2>
        <ul>
          <li>To create and maintain your account</li>
          <li>To surface bumps and matches and enable chat</li>
          <li>To keep the community safe (blocks/reports)</li>
          <li>To send important notifications (if you opt in)</li>
        </ul>

        <h2>Sharing</h2>
        <p>
          We don’t sell your personal data. We may share data with service providers that power the app (e.g., hosting and
          notifications) and only as needed to operate Bump Ping.
        </p>

        <h2>Contact</h2>
        <p>
          Questions? Email us at <a href="mailto:support@bump-ping.com">support@bump-ping.com</a>.
        </p>
      </div>
    </div>
  );
}


