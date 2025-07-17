import React from "react";

export default function PrivacyPolicyPage() {
  return (
    <main className="max-w-2xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>
      <p className="mb-4">
        At SNA, your privacy and trust are our top priorities. As this is a DEMO
        version of our application, we want to be fully transparent about how we
        handle your information and flight plans.
      </p>
      <ul className="list-disc ml-6 mb-4">
        <li className="mb-2">
          <strong>Purpose of Data Collection:</strong> We only collect and store
          the information you provide (including flight plans) to deliver and
          improve your experience with our UPPS. Your data is never used for
          advertising or sold to third parties.
        </li>
        <li className="mb-2">
          <strong>Data Security:</strong> All data is securely stored in our
          database. Access to your information is restricted to you, and we
          employ industry-standard security measures to protect your data.
        </li>
        <li className="mb-2">
          <strong>Password Protection:</strong> Your passwords are encrypted
          using robust encryption methods. All connections to our service are
          secured to safeguard your information.
        </li>
        <li className="mb-2">
          <strong>No Third-Party Sharing:</strong> We do not share, sell, or
          disclose your personal information or flight plans to any third
          parties.
        </li>
        <li className="mb-2">
          <strong>Your Feedback Matters:</strong> As a DEMO user, your feedback
          is invaluable in helping us improve our application. Please reach out
          via the{" "}
          <a
            href="/contact-us"
            className="text-blue-400 hover:underline hover:text-blue-300"
          >
            Contact page
          </a>{" "}
          with any questions, suggestions, or concerns.
        </li>
      </ul>
      <p>
        By using the SNA UPPS, you acknowledge and accept this privacy policy.
        If you have any questions or would like more information about how we
        handle your data, please contact us. Thank you for helping us build a
        better platform.
      </p>
    </main>
  );
}
