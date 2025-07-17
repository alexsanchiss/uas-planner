import React from "react";

export default function HowItWorksPage() {
  return (
    <main className="max-w-3xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-6 text-blue-400">How It Works</h1>
      <section className="mb-10 bg-gray-800 rounded-lg shadow p-6 text-white">
        <h2 className="text-2xl font-bold mb-2 text-blue-300">Getting Started</h2>
        <ol className="list-decimal ml-6 space-y-2 text-lg">
          <li>
            <span className="font-semibold text-blue-200">Log in or sign up:</span> You must be logged in to use all features.
          </li>
          <li>
            <span className="font-semibold text-blue-200">Create a Flight Plan with Plan Generator:</span>
            <ul className="list-disc ml-6 text-base mt-1">
              <li>Go to <span className="font-semibold">Plan Generator</span> and click on the map to add waypoints for your mission.</li>
              <li>Fill in flight details, UAS information, and give your plan a name.</li>
              <li>Drag and drop waypoints to reorder them. The first is always <span className="italic">Takeoff</span>, the last can be <span className="italic">Landing</span>.</li>
              <li>When ready, click <span className="font-semibold">Upload to Trajectory Generator</span>. Your plan will be saved and available in the Trajectory Generator.</li>
            </ul>
          </li>
          <li>
            <span className="font-semibold text-blue-200">Process and Visualize Trajectories with Trajectory Generator:</span>
            <ul className="list-disc ml-6 text-base mt-1">
              <li>Go to <span className="font-semibold">Trajectory Generator</span> to see your uploaded plans, organized in folders.</li>
              <li>For each plan, you can:
                <ul className="list-disc ml-6 mt-1">
                  <li><span className="font-semibold">Process</span> a plan to generate its trajectory. The status will update as it is queued, processed, or if there is an error.</li>
                  <li>Once processed, <span className="font-semibold">download</span> the trajectory as a CSV file, or <span className="font-semibold">view</span> it on an interactive map.</li>
                  <li>You can <span className="font-semibold">select multiple plans</span> to process, view, download, or delete in bulk.</li>
                  <li>Organize your plans in folders, filter and search by name, and paginate through large collections.</li>
                  <li>Set or randomize scheduled times for your plans, and request authorization for processed plans.</li>
                  <li>Download authorized U-Plan files or denial messages for your records.</li>
                </ul>
              </li>
              <li>Statuses are color-coded: <span className="text-gray-300">Unprocessed</span>, <span className="text-yellow-300">Queued</span>, <span className="text-blue-300">Processing</span>, <span className="text-green-300">Processed</span>, <span className="text-red-300">Error</span>.</li>
              <li>Use drag-and-drop or file selection to upload new plans directly into folders.</li>
            </ul>
          </li>
          <li>
            <span className="font-semibold text-blue-200">Organize and Manage:</span>
            <ul className="list-disc ml-6 text-base mt-1">
              <li>Organize your plans in folders for easy access.</li>
              <li>Filter, search, and paginate through your plans.</li>
            </ul>
          </li>
          <li>
            <span className="font-semibold text-blue-200">Explore More:</span>
            <ul className="list-disc ml-6 text-base mt-1">
              <li>Try the <span className="font-semibold">Plan Activation</span> (coming soon) to create datasets of plans.</li>
              <li>Visit our <span className="font-semibold">Social Media</span> to know more about us.</li>
              <li>Visit <span className="font-semibold">Contact Us</span> for more info or help.</li>
            </ul>
          </li>
        </ol>
      </section>
      {/* Plan Generator Help Section */}
      <section id="plan-generator-help" className="mb-10 bg-gray-800 rounded-lg shadow p-6 text-white scroll-mt-24">
        <h3 className="text-xl font-bold mb-2 text-blue-300 flex items-center gap-2">
          Plan Generator Help
        </h3>
        <ul className="list-disc ml-6 text-base space-y-1">
          <li>Go to <span className="font-semibold">Plan Generator</span> and click on the map to add waypoints for your mission.</li>
          <li>Fill in flight details, UAS information, and give your plan a name.</li>
          <li>Drag and drop waypoints to reorder them. The first is always <span className="italic">Takeoff</span>, the last can be <span className="italic">Landing</span>.</li>
          <li>When ready, click <span className="font-semibold">Upload to Trajectory Generator</span>. Your plan will be saved and available in the Trajectory Generator.</li>
        </ul>
        <div className="mt-4 bg-blue-900/60 border-l-4 border-blue-400 p-4 rounded">
          <span className="font-semibold text-blue-200">Note:</span> U-Plan data is <span className="font-semibold">not required</span>. If you leave these fields empty, the system will randomize them so you can try the Flight Authorization Service (FAS) anyway.
        </div>
      </section>
      {/* Trajectory Generator Help Section */}
      <section id="trajectory-generator-help" className="mb-10 bg-gray-800 rounded-lg shadow p-6 text-white scroll-mt-24">
        <h3 className="text-xl font-bold mb-2 text-blue-300 flex items-center gap-2">
          Trajectory Generator Help
        </h3>
        <ul className="list-disc ml-6 text-base space-y-1">
          <li>See your uploaded plans, organized in folders.</li>
          <li>Process a plan to generate its trajectory. The status will update as it is queued, processed, or if there is an error.</li>
          <li>Once processed, download the trajectory as a CSV file, or view it on an interactive map.</li>
          <li>Select multiple plans to process, view, download, or delete in bulk.</li>
          <li>Organize your plans in folders, filter and search by name, and paginate through large collections.</li>
          <li>Set or randomize scheduled times for your plans, and request authorization to the FAS for processed plans.</li>
          <li>After requesting authorization:
            <ul className="list-disc ml-6 mt-1">
              <li>If <span className="font-semibold">approved</span>, you can <span className="font-semibold">download the U-Plan</span> or <span className="font-semibold">view it on an interactive map</span> (with all 4D Volumes), individually or in bulk.</li>
              <li>If <span className="font-semibold">denied</span>, the authorization message will be <span className="font-semibold">shown on the page, or can be downloaded in bulk</span></li>
            </ul>
          </li>
          <li>Statuses are color-coded: <span className="text-gray-300">Unprocessed</span>, <span className="text-yellow-300">Queued</span>, <span className="text-blue-300">Processing</span>, <span className="text-green-300">Processed</span>, <span className="text-red-300">Error</span>.</li>
          <li>Use drag-and-drop or file selection to upload new plans directly into folders.</li>
        </ul>
      </section>
      {/* Backend Trajectory Generation Explanation */}
      <section className="mb-10 bg-gray-800 rounded-lg shadow p-6 text-white">
        <h2 className="text-2xl font-bold mb-2 text-blue-400">How does trajectory generation work?</h2>
        <p className="mb-4">
          Our backend generates realistic UAS trajectories using the PX4 autopilot software-in-the-loop (SITL) environment with Gazebo as the simulation platform. This approach allows us to replicate real-world flight behaviors, including wind effects, data link disruptions, sensor/system failures, RC link loss, and battery dynamics. The simulated trajectories are compared with real flight data from research projects like BUBBLES, ensuring high fidelity and operational realism. The system is aligned with Eurocontrol's BADA model for UAS and supports advanced airspace management, conflict detection, and safety metrics within U-space.
        </p>
        <p className="mb-4">
          For strategic conflict detection and flight authorization, we use a centralized service that leverages an octree data structure to efficiently manage airspace and support multi-USSP environments. This enables the detection and resolution of potential conflicts between UAS 4D operational intents, as required by U-space regulations.
        </p>
        <div className="mb-2">
          <span className="font-semibold text-blue-200">Read more in our published papers:</span>
          <ul className="list-disc ml-6 mt-2 text-base">
            <li>
              <a href="/docs/A. Sanchis - Realistic Trajectory Generation in Simulated Environments for U-space Systems Assessment - IEEE.pdf" target="_blank" className="underline text-blue-300 hover:text-blue-200">Realistic Trajectory Generation in Simulated Environments for U-space Systems Assessment</a> (ICNS 2025, Brussels)
            </li>
            <li>
              <a href="/docs/S. Amarillo - Proposal of UAS Strategic Conflict Detection concept with a centralised service in multi-USSP environment using an octree data structure.pdf" target="_blank" className="underline text-blue-300 hover:text-blue-200">Proposal of UAS Strategic Conflict Detection concept with a centralised service in multi-USSP environment using an octree data structure</a> (ICNS 2025, Brussels)
            </li>
          </ul>
        </div>
        <p className="mt-2 text-blue-100 text-sm">You can read the full papers by clicking the links above.</p>
      </section>
    </main>
  );
}
