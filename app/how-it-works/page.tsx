import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { defaultLanguage, getTranslation } from "@/app/i18n/translations";

export const metadata: Metadata = { title: getTranslation(defaultLanguage).titles.howItWorks };

export default function HowItWorksPage() {
  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-6 text-brand-text">How It Works</h1>
      <nav aria-label="On this page" className="mb-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <a href="#plan-definition-help" className="text-brand-text underline hover:no-underline">Plan Definition help</a>
        <a href="#plan-authorization-help" className="text-brand-text underline hover:no-underline">Plan Authorization help</a>
        <a href="#plan-activation-help" className="text-brand-text underline hover:no-underline">Plan Activation help</a>
      </nav>
      <section className="mb-10 bg-surface border border-line rounded-lg shadow p-6 text-fg">
        <h2 className="text-2xl font-bold mb-2 text-brand-text">Getting Started</h2>
        <ol className="list-decimal ml-6 space-y-2 text-lg">
          <li>
            <span className="font-semibold text-brand-text">Log in or sign up:</span> You must be logged in to use all features.
          </li>
          <li>
            <span className="font-semibold text-brand-text">Create a Flight Plan with Plan Definition:</span>
            <ul className="list-disc ml-6 text-base mt-1">
              <li>Go to <span className="font-semibold">Plan Definition</span> and click on the map to add waypoints for your mission.</li>
              <li>Fill in flight details, UAS information, and give your plan a name.</li>
              <li>Drag and drop waypoints to reorder them. The first is always <span className="italic">Takeoff</span>, the last can be <span className="italic">Landing</span>.</li>
              <li>When ready, click <span className="font-semibold">Upload to Plan Authorization</span>. Your plan will be saved and available in the Plan Authorization.</li>
            </ul>
          </li>
          <li>
            <span className="font-semibold text-brand-text">Process and Visualize Trajectories with Plan Authorization:</span>
            <ul className="list-disc ml-6 text-base mt-1">
              <li>Go to <span className="font-semibold">Plan Authorization</span> to see your uploaded plans, organized in folders.</li>
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
              <li>Statuses are color-coded: <span className="text-[var(--processing-idle-text)]">Unprocessed</span>, <span className="text-[var(--processing-queued-text)]">Queued</span>, <span className="text-[var(--processing-active-text)]">Processing</span>, <span className="text-[var(--processing-completed-text)]">Processed</span>, <span className="text-[var(--processing-error-text)]">Error</span>.</li>
              <li>Use drag-and-drop or file selection to upload new plans directly into folders.</li>
            </ul>
          </li>
          <li>
            <span className="font-semibold text-brand-text">Activate your flight with Plan Activation:</span>
            <ul className="list-disc ml-6 text-base mt-1">
              <li>Go to <span className="font-semibold">Plan Activation</span> once a plan is approved and its scheduled time is near.</li>
              <li>Inside the activation window (1 minute before or after the scheduled time) the plan is listed under <span className="font-semibold">Ready now</span> and can be activated.</li>
              <li>Later flights wait under <span className="font-semibold">Upcoming</span> and past ones are kept in the <span className="font-semibold">history</span>.</li>
            </ul>
          </li>
          <li>
            <span className="font-semibold text-brand-text">Organize and Manage:</span>
            <ul className="list-disc ml-6 text-base mt-1">
              <li>Organize your plans in folders for easy access.</li>
              <li>Filter, search, and paginate through your plans.</li>
            </ul>
          </li>
          <li>
            <span className="font-semibold text-brand-text">Explore More:</span>
            <ul className="list-disc ml-6 text-base mt-1">
              <li>Open <Link href="/plan-activation" className="font-semibold text-brand-text underline hover:no-underline">Plan Activation</Link> to activate your authorized flights when their scheduled time arrives.</li>
              <li>Visit our <span className="font-semibold">Social Media</span> to know more about us.</li>
              <li>Visit <span className="font-semibold">Contact Us</span> for more info or help.</li>
            </ul>
          </li>
        </ol>
      </section>
      {/* Plan Definition Help Section */}
      <section id="plan-definition-help" className="mb-10 bg-surface border border-line rounded-lg shadow p-6 text-fg scroll-mt-24">
        <h3 className="text-xl font-bold mb-2 text-brand-text flex items-center gap-2">
          Plan Definition Help
        </h3>
        <ul className="list-disc ml-6 text-base space-y-1">
          <li>Go to <span className="font-semibold">Plan Definition</span> and click on the map to add waypoints for your mission.</li>
          <li>Fill in flight details, UAS information, and give your plan a name.</li>
          <li>Drag and drop waypoints to reorder them. The first is always <span className="italic">Takeoff</span>, the last can be <span className="italic">Landing</span>.</li>
          <li>When ready, click <span className="font-semibold">Upload to Plan Authorization</span>. Your plan will be saved and available in the Plan Authorization.</li>
        </ul>
        <div className="mt-4 bg-info-soft border-l-4 border-info p-4 rounded">
          <span className="font-semibold text-info-text">Note:</span> U-Plan data is <span className="font-semibold">not required</span>. If you leave these fields empty, the system will randomize them so you can try the Flight Authorization Service (FAS) anyway.
        </div>
      </section>
      {/* Plan Authorization Help Section */}
      <section id="plan-authorization-help" className="mb-10 bg-surface border border-line rounded-lg shadow p-6 text-fg scroll-mt-24">
        <h3 className="text-xl font-bold mb-2 text-brand-text flex items-center gap-2">
          Plan Authorization Help
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
          <li>Statuses are color-coded: <span className="text-[var(--processing-idle-text)]">Unprocessed</span>, <span className="text-[var(--processing-queued-text)]">Queued</span>, <span className="text-[var(--processing-active-text)]">Processing</span>, <span className="text-[var(--processing-completed-text)]">Processed</span>, <span className="text-[var(--processing-error-text)]">Error</span>.</li>
          <li>Use drag-and-drop or file selection to upload new plans directly into folders.</li>
        </ul>
      </section>
      {/* Plan Activation Help Section */}
      <section id="plan-activation-help" className="mb-10 bg-surface border border-line rounded-lg shadow p-6 text-fg scroll-mt-24">
        <h3 className="text-xl font-bold mb-2 text-brand-text flex items-center gap-2">
          Plan Activation Help
        </h3>
        <ul className="list-disc ml-6 text-base space-y-1">
          <li>Approved plans appear here when their scheduled time is close. The page is split in three groups.</li>
          <li><span className="font-semibold">Ready now:</span> the activation window is open, from 1 minute before to 1 minute after the scheduled time. Press <span className="font-semibold">Activate flight</span>, read the FAS terms and conditions, accept them and confirm. If the FAS clears the flight, a <span className="font-semibold">CAN TAKE OFF</span> panel shows the time left to take off.</li>
          <li><span className="font-semibold">Upcoming:</span> authorized flights scheduled in the next 24 hours, with a countdown to the moment their window opens.</li>
          <li><span className="font-semibold">Flight history:</span> expand it to review past flights, their authorization and activation status and when each was activated.</li>
          <li>If the FAS denies the activation, the reason is shown on the plan and you can retry once the waiting time ends.</li>
        </ul>
      </section>
      {/* Backend Trajectory Generation Explanation */}
      <section className="mb-10 bg-surface border border-line rounded-lg shadow p-6 text-fg">
        <h2 className="text-2xl font-bold mb-2 text-brand-text">How does trajectory generation work?</h2>
        <p className="mb-4">
          Our backend generates realistic UAS trajectories using the PX4 autopilot software-in-the-loop (SITL) environment with Gazebo as the simulation platform. This approach allows us to replicate real-world flight behaviors, including wind effects, data link disruptions, sensor/system failures, RC link loss, and battery dynamics. The simulated trajectories are compared with real flight data from research projects like BUBBLES, ensuring high fidelity and operational realism. The system is aligned with Eurocontrol&apos;s BADA model for UAS and supports advanced airspace management, conflict detection, and safety metrics within U-space.
        </p>
        <p className="mb-4">
          For strategic conflict detection and flight authorization, we use a centralized service that leverages an octree data structure to efficiently manage airspace and support multi-USSP environments. This enables the detection and resolution of potential conflicts between UAS 4D operational intents, as required by U-space regulations.
        </p>
        <div className="mb-2">
          <span className="font-semibold text-brand-text">Read more in our published papers:</span>
          <ul className="list-disc ml-6 mt-2 text-base">
            <li>
              <a href="https://ieeexplore.ieee.org/document/10976773" target="_blank" rel="noopener noreferrer" className="underline text-brand-text hover:no-underline">Realistic Trajectory Generation in Simulated Environments for U-space Systems Assessment</a> (ICNS 2025, Brussels)
            </li>
            <li>
              <a href="https://ieeexplore.ieee.org/document/10976940" target="_blank" rel="noopener noreferrer" className="underline text-brand-text hover:no-underline">Proposal of UAS Strategic Conflict Detection concept with a centralised service in multi-USSP environment using an octree data structure</a> (ICNS 2025, Brussels)
            </li>
          </ul>
        </div>
        <p className="mt-2 text-fg-2 text-sm">You can read the full papers by clicking the links above.</p>
      </section>
    </div>
  );
}
