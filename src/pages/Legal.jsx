export default function Legal() {
  return (
    <div className="screen" style={{ padding: 0 }}>
      <div style={{ background: 'var(--section-hero)', color: '#fff', padding: '18px 20px 32px', minHeight: 150, boxSizing: 'border-box', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -8, bottom: -16, fontSize: 90, opacity: .1, lineHeight: 1, pointerEvents: 'none' }}>⚖️</div>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 7 }}>✦ Legal</div>
        <h1 style={{ fontFamily: "'Fraunces',Georgia,serif", fontWeight: 900, fontSize: 26, lineHeight: 1 }}>Privacy & Terms</h1>
        <p style={{ fontSize: 12.5, opacity: .85, marginTop: 6, lineHeight: 1.5 }}>How we handle your data and what you agree to.</p>
      </div>
      <div style={{ background: 'var(--paper)', borderRadius: '26px 26px 0 0', marginTop: -20, position: 'relative', padding: '20px 16px 24px', minHeight: '60vh' }}>

      <div className="card">

        <h2 style={{ fontSize: 17, fontWeight: 700, margin: '14px 0 6px' }}>Privacy</h2>
        <p style={{ fontSize: 14, lineHeight: 1.6 }}>
          MedPeers collects the information you provide, your name, email, exam, country, timezone,
          study preferences, optional registration details, and the messages you send. We use this only
          to match you with study partners and run the service. We do not sell your data or use it for advertising.
          Your password is stored securely (hashed). You can edit or remove your information from your profile,
          or delete your account at any time using the Delete Account button in your profile settings.
        </p>

        <h2 style={{ fontSize: 17, fontWeight: 700, margin: '16px 0 6px' }}>Terms of Use</h2>
        <p style={{ fontSize: 14, lineHeight: 1.6 }}>
          MedPeers is a peer study-networking tool for medical professionals and exam candidates.
          It does not verify medical credentials, registration details are self-reported, and you should
          use your own judgement before sharing personal information with other users. MedPeers is not a
          source of medical advice, and any study material or discussion is for educational support only.
          Be respectful; harassment, impersonation, or misuse may result in removal. The service is provided
          "as is" without guarantees of availability.
        </p>

        <h2 style={{ fontSize: 17, fontWeight: 700, margin: '16px 0 6px' }}>Contact</h2>
        <p style={{ fontSize: 14, lineHeight: 1.6 }}>
          Questions about your data or these terms?
          Email us at <strong>medconnectsupport.io@gmail.com</strong> and we'll help.
        </p>
      </div>
      </div>
    </div>
  );
}
