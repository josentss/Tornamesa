import Link from 'next/link';
import { Header, Footer } from '@/components/shared';

export const metadata = {
  title: 'Privacy Policy · Tornamesa',
  description: 'How Tornamesa collects, uses, and protects your data.',
};

export default function PrivacyPage() {
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
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          Last updated: August 18, 2026
        </p>

        <div className="mt-8 space-y-8 text-sm text-stone-300 leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-[#f0f9ff] mb-2">
              1. Who we are
            </h2>
            <p>
              Tornamesa is a personal music logging service. You can record
              albums you listen to, rate and review them, keep a diary, build
              lists, and optionally share activity with other users.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#f0f9ff] mb-2">
              2. Data we collect
            </h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <span className="text-stone-200">Account:</span> email, password
                (handled by our auth provider), username, and optional profile
                fields (display name, bio, avatar URL, pronouns, website,
                country, favorite albums).
              </li>
              <li>
                <span className="text-stone-200">Activity:</span> listens,
                ratings, reviews, lists, follows, and monthly listening
                summaries you generate through the product.
              </li>
              <li>
                <span className="text-stone-200">Technical:</span> basic
                request metadata needed to run the service (e.g. approximate IP
                for rate limiting and abuse prevention).
              </li>
              <li>
                <span className="text-stone-200">Optional integrations:</span>{' '}
                if you connect Last.fm, we store the link needed to show “now
                playing” on your profile.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#f0f9ff] mb-2">
              3. How we use data
            </h2>
            <p>
              We use your data to operate Tornamesa: authentication, profiles,
              diaries, social features you choose to use, spam and abuse
              protection, and service reliability. We do not sell your personal
              data.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#f0f9ff] mb-2">
              4. Visibility and privacy controls
            </h2>
            <p>
              You can mark your profile as private, hide your diary, or hide
              recent activity from your public profile. Private content is not
              shown to other users through normal product views. Do not post
              sensitive personal information in bios or reviews.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#f0f9ff] mb-2">
              5. Third parties
            </h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <span className="text-stone-200">Hosting / auth / database:</span>{' '}
                infrastructure providers (e.g. Vercel, Supabase) process data
                to run the app.
              </li>
              <li>
                <span className="text-stone-200">Music metadata:</span> album
                titles, artists, and cover art may come from Spotify and related
                catalog sources. Tornamesa is not affiliated with Spotify.
              </li>
              <li>
                <span className="text-stone-200">Bot protection:</span> signup
                may use Cloudflare Turnstile.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#f0f9ff] mb-2">
              6. Retention and deletion
            </h2>
            <p>
              We keep your data while your account is active. You can delete
              your account from Settings; that removes your profile, listens,
              reviews, lists, and related social data from our application
              database. Some backups or logs may persist for a limited time for
              security and recovery.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#f0f9ff] mb-2">
              7. Security
            </h2>
            <p>
              We use industry-standard practices (encrypted transport, access
              controls on write APIs, rate limiting). No online service is
              perfectly secure; use a strong unique password.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#f0f9ff] mb-2">
              8. Children
            </h2>
            <p>
              Tornamesa is not directed at children under 13. If you believe a
              child has created an account, contact us so we can remove it.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#f0f9ff] mb-2">
              9. Changes
            </h2>
            <p>
              We may update this policy as the product evolves. Material
              changes will be reflected on this page with a new “Last updated”
              date.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#f0f9ff] mb-2">
              10. Contact
            </h2>
            <p>
              Questions about privacy: use the contact channel listed on the
              site or reach the project maintainer via the public repository /
              community where Tornamesa is shared.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
