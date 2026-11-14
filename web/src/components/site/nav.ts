export type NavLink = { href: string; label: string };
export type NavItem = NavLink | { label: string; children: NavLink[] };

/** Links under "More" in the header. */
export const MORE_NAV: NavLink[] = [
  { href: "/events", label: "Events" },
  { href: "/reviews", label: "Reviews" },
  { href: "/faq", label: "FAQ" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/manage", label: "Manage a booking" },
];

/** Header navigation: experiences in a dropdown, the rest of the site under "More". */
export function mainNav(experiences: { slug: string; name: string }[]): NavItem[] {
  return [
    { href: "/", label: "Home" },
    {
      label: "Experiences",
      children: [...experiences.map((e) => ({ href: `/experiences/${e.slug}`, label: e.name })), { href: "/experiences", label: "All experiences" }],
    },
    { href: "/groups", label: "Private sessions" },
    { href: "/gift-cards", label: "Gift cards" },
    { label: "More", children: MORE_NAV },
  ];
}
