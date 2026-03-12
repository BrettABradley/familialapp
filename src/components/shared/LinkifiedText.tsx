import React from "react";
import { Link } from "react-router-dom";

const URL_REGEX = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;

interface MentionMember {
  user_id: string;
  display_name: string | null;
}

interface LinkifiedTextProps {
  text: string;
  className?: string;
  members?: MentionMember[];
}

/**
 * Given a plain-text segment (no URLs), split it by @mentions and return
 * React nodes where recognised names become profile links.
 */
const renderMentions = (
  text: string,
  members: MentionMember[],
  keyPrefix: string
): React.ReactNode[] => {
  if (!members.length) return [text];

  // Sort members by display_name length descending so longer names match first
  const sorted = [...members]
    .filter((m) => m.display_name)
    .sort((a, b) => (b.display_name!.length) - (a.display_name!.length));

  if (!sorted.length) return [text];

  // Build a regex that matches @DisplayName for any known member
  const escaped = sorted.map((m) =>
    m.display_name!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  const mentionRegex = new RegExp(`(@(?:${escaped.join("|")}))(?=[\\s,.:;!?]|$)`, "g");

  const parts = text.split(mentionRegex);
  if (parts.length === 1) return [text];

  return parts.map((part, i) => {
    // Check if this part is a mention
    if (part.startsWith("@")) {
      const name = part.slice(1);
      const member = sorted.find(
        (m) => m.display_name?.toLowerCase() === name.toLowerCase()
      );
      if (member) {
        return (
          <Link
            key={`${keyPrefix}-m${i}`}
            to={`/profile/${member.user_id}`}
            className="text-primary font-medium hover:underline"
          >
            {part}
          </Link>
        );
      }
    }
    return <React.Fragment key={`${keyPrefix}-m${i}`}>{part}</React.Fragment>;
  });
};

export const LinkifiedText: React.FC<LinkifiedTextProps> = ({
  text,
  className,
  members = [],
}) => {
  const parts = text.split(URL_REGEX);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (URL_REGEX.test(part)) {
          URL_REGEX.lastIndex = 0;
          const href = part.startsWith("www.") ? `https://${part}` : part;
          return (
            <a
              key={i}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:text-primary/80 break-all"
            >
              {part}
            </a>
          );
        }
        URL_REGEX.lastIndex = 0;

        // For non-URL segments, process @mentions
        if (members.length > 0) {
          const mentionNodes = renderMentions(part, members, `p${i}`);
          return <React.Fragment key={i}>{mentionNodes}</React.Fragment>;
        }

        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </span>
  );
};
