import Link from 'next/link';
import { Header, Footer } from '@/components/shared';

export const metadata = {
  title: 'Terms of Use · Tornamesa',
  description: 'Terms of use for Tornamesa.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0f16] text-[#f0f9ff]">
      <Header />
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <Link
          href="/"
          className="text-xs text-stone-500 hover:text-[#7cc7e8] transition-colors"
        >
          ← Tornamesa
        </Link>
        <h1 className="mt-4 text-2xl sm:text-3xl font-bold tracking-tight">
          Terms of Use
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          Last updated: August 18, 2026
        </p>

        <div className="mt-8 space-y-8 text-sm text-stone-300 leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-[#f0f9ff] mb-2">
              1. Acceptance
            </h2>
            <p>
              By creating an account or using Tornamesa, you agree to these
              Terms and our{' '}
              <Link href="/privacy" className="text-[#7cc7e8] hover:underline">
                Privacy Policy
              </Link>
              . If you do not agree, do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#f0f9ff] mb-2">
              2. The service
            </h2>
            <p>
              Tornamesa is an early-stage tool for logging albums, ratings,
              reviews, lists, and related social features. Features may change,
              break, or be removed without notice. The service is provided “as
              is” without warranties of uninterrupted availability or perfect
              accuracy of catalog data.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#f0f9ff] mb-2">
              3. Accounts
            </h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>You must provide accurate information and keep your credentials secure.</li>
              <li>You are responsible for activity under your account.</li>
              <li>One person should not create accounts primarily to spam, harass, or evade bans.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#f0f9ff] mb-2">
              4. Acceptable use
            </h2>
            <p className="mb-2">You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Harass, threaten, or abuse other users.</li>
              <li>Post illegal content or content you do not have rights to share.</li>
              <li>Attempt to break into accounts, scrape aggressively, or overload the service.</li>
              <li>Bypass rate limits, privacy controls, or security measures.</li>
              <li>Use automated bots for mass signup or spam without permission.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#f0f9ff] mb-2">
              5. Your content
            </h2>
            <p>
              You keep ownership of the reviews and text you write. You grant
              Tornamesa a non-exclusive license to host, display, and process
              that content as needed to run the product (including public
              profiles when you make content visible). You can delete content or
              your account subject to technical limitations described in the
              Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#f0f9ff] mb-2">
              6. Third-party data
            </h2>
            <p>
              Album metadata and artwork may come from third-party sources such
              as Spotify. Those materials remain subject to their owners’
              rights. Tornamesa is an independent project and is not endorsed by
              Spotify or other music platforms.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#f0f9ff] mb-2">
              7. Suspension
            </h2>
            <p>
              We may suspend or terminate accounts that violate these Terms or
              harm the service or other users.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#f0f9ff] mb-2">
              8. Limitation of liability
            </h2>
            <p>
              To the maximum extent permitted by law, Tornamesa and its
              maintainers are not liable for indirect, incidental, or
              consequential damages, or for loss of data arising from use of the
              service. Use Tornamesa at your own risk, especially during early
              access.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#f0f9ff] mb-2">
              9. Changes
            </h2>
            <p>
              We may update these Terms. Continued use after changes are posted
              on this page constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#f0f9ff] mb-2">
              10. Contact
            </h2>
            <p>
              For questions about these Terms, contact the project maintainer
              through the channels published with the app or repository.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
