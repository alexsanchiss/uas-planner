import React from "react";

export default function ContactUsPage() {
  return (
    <main className="max-w-2xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-4">Contact Us</h1>
      <p className="mb-4">
        We value your feedback! If you have any requirements, suggestions, bug
        reports, or just want to get in touch, please email us at{" "}
        <a
          href="mailto:UPPS@sna-upv.com"
          className="text-blue-400 hover:underline hover:text-blue-300"
        >
          UPPS@sna-upv.com
        </a>
        .
      </p>
      <p>
        This is a DEMO version of UPPS. Your input is crucial to help us
        improve the app. Thank you for testing and sharing your experience!
      </p>
    </main>
  );
}
