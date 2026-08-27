"use client";

import {
  IconInstagram,
  IconX,
  IconRym,
  socialHref,
} from "@/components/icons/SocialIcons";

export default function ProfileSocialLinks({ profile }) {
  if (!profile) return null;

  const items = [
    profile.instagram && {
      key: "instagram",
      href: socialHref("instagram", profile.instagram),
      label: "Instagram",
      Icon: IconInstagram,
    },
    profile.twitter && {
      key: "twitter",
      href: socialHref("twitter", profile.twitter),
      label: "X",
      Icon: IconX,
    },
    profile.rym && {
      key: "rym",
      href: socialHref("rym", profile.rym),
      label: "Rate Your Music",
      Icon: IconRym,
    },
  ].filter(Boolean);

  if (!items.length) return null;

  return (
    <div className="flex items-center justify-center gap-3 mt-2.5">
      {items.map(({ key, href, label, Icon }) => (
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title={label}
          aria-label={label}
          className="text-stone-500 hover:text-[#7cc7e8] transition-colors p-1"
        >
          <Icon className="w-3.5 h-3.5" />
        </a>
      ))}
    </div>
  );
}
