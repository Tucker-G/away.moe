import React, { CSSProperties, useState } from "react";
import { theme } from "../theme";
import FeedbackModal from "./FeedbackModal";

type NavLink = {
  label: string;
  href: string;
  external?: boolean;
};

const links: NavLink[] = [
  { label: "About", href: "#" },
  { label: "Github", href: "#", external: true },
];

const Nav = () => {
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <>
      <nav style={styles.nav}>
        {links.map((link, i) => (
          <React.Fragment key={link.label}>
            {i > 0 && <span style={styles.separator}>|</span>}
            <a
              href={link.href}
              target={link.external ? "_blank" : undefined}
              rel={link.external ? "noopener noreferrer" : undefined}
              style={styles.link}
            >
              {link.label}
            </a>
          </React.Fragment>
        ))}
        <span style={styles.separator}>|</span>
        <button
          type="button"
          style={styles.linkButton}
          onClick={() => setFeedbackOpen(true)}
        >
          Feedback
        </button>
      </nav>
      {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}
    </>
  );
};

const styles: Record<string, CSSProperties> = {
  nav: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    padding: "16px",
    fontSize: "0.9em",
    pointerEvents: "none",
  },
  link: {
    color: theme.color.muted,
    textDecoration: "none",
    fontWeight: 500,
    padding: "4px 8px",
    borderRadius: theme.radius.sm,
    pointerEvents: "auto",
  },
  linkButton: {
    color: theme.color.muted,
    background: "none",
    border: "none",
    fontFamily: "inherit",
    fontSize: "inherit",
    fontWeight: 500,
    padding: "4px 8px",
    borderRadius: theme.radius.sm,
    cursor: "pointer",
    pointerEvents: "auto",
  },
  separator: {
    color: "#c9c6c0",
    fontWeight: 300,
  },
};

export default Nav;
