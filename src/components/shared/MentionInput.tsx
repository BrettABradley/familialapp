import { useState, useRef, useEffect, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface MentionMember {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  members: MentionMember[];
  placeholder?: string;
  className?: string;
  maxLength?: number;
  rows?: number;
  disabled?: boolean;
  /** Called with the set of mentioned user_ids whenever content changes */
  onMentionsChange?: (mentionedIds: Set<string>) => void;
}

export const MentionInput = ({
  value,
  onChange,
  members,
  placeholder,
  className,
  maxLength,
  rows = 3,
  disabled,
  onMentionsChange,
}: MentionInputProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState<number>(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredMembers = mentionQuery
    ? members.filter((m) =>
        (m.display_name || "").toLowerCase().includes(mentionQuery.toLowerCase())
      )
    : members;

  // Track mentioned user IDs
  useEffect(() => {
    if (!onMentionsChange) return;
    const mentioned = new Set<string>();
    for (const member of members) {
      const name = member.display_name;
      if (name && value.includes(`@${name}`)) {
        mentioned.add(member.user_id);
      }
    }
    onMentionsChange(mentioned);
  }, [value, members, onMentionsChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = newValue.slice(0, cursorPos);

    // Find the last @ that isn't preceded by a word character
    const atMatch = textBeforeCursor.match(/(?:^|[^a-zA-Z0-9])@([^\s@]*)$/);

    if (atMatch) {
      const query = atMatch[1];
      const atIndex = textBeforeCursor.lastIndexOf("@" + query);
      setMentionQuery(query);
      setMentionStart(atIndex);
      setShowDropdown(true);
      setSelectedIndex(0);
    } else {
      setShowDropdown(false);
      setMentionQuery("");
      setMentionStart(-1);
    }
  };

  const insertMention = useCallback(
    (member: MentionMember) => {
      const name = member.display_name || "User";
      const before = value.slice(0, mentionStart);
      const afterCursor = textareaRef.current
        ? value.slice(textareaRef.current.selectionStart)
        : value.slice(mentionStart + mentionQuery.length + 1);
      const newValue = `${before}@${name} ${afterCursor}`;
      onChange(newValue);
      setShowDropdown(false);
      setMentionQuery("");
      setMentionStart(-1);

      // Restore focus
      setTimeout(() => {
        const pos = before.length + name.length + 2; // +2 for @ and space
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(pos, pos);
      }, 0);
    },
    [value, mentionStart, mentionQuery, onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showDropdown || filteredMembers.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filteredMembers.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insertMention(filteredMembers[selectedIndex]);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        maxLength={maxLength}
        rows={rows}
        disabled={disabled}
      />
      {showDropdown && filteredMembers.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 bottom-full mb-1 left-0 w-64 max-h-48 overflow-y-auto bg-popover border border-border rounded-lg shadow-lg"
        >
          {filteredMembers.slice(0, 8).map((member, idx) => (
            <button
              key={member.user_id}
              type="button"
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent transition-colors",
                idx === selectedIndex && "bg-accent"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(member);
              }}
              onMouseEnter={() => setSelectedIndex(idx)}
            >
              <Avatar className="h-6 w-6">
                <AvatarImage src={member.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {(member.display_name || "U").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{member.display_name || "Unknown"}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
