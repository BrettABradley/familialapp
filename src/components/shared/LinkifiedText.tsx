import React from "react";

const URL_REGEX = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;

interface LinkifiedTextProps {
  text: string;
  className?: string;
}

export const LinkifiedText: React.FC<LinkifiedTextProps> = ({ text, className }) => {
  const parts = text.split(URL_REGEX);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (URL_REGEX.test(part)) {
          // Reset lastIndex since we used the global flag
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
        // Reset lastIndex
        URL_REGEX.lastIndex = 0;
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </span>
  );
};
