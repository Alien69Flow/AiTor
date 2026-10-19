interface NeuralChatIconProps {
  className?: string;
  /** Accent for the spark; defaults to the bubble's own colour. */
  sparkClassName?: string;
}

/**
 * Assistant launcher mark: the industry-standard speech bubble with the
 * ΔlieπFlΦw spark inside. Drawn as a single bubble path so the tail stays
 * crisp from 16px up to hero sizes.
 */
export function NeuralChatIcon({ className = "h-5 w-5", sparkClassName }: NeuralChatIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6.8 2.8h10.4a3 3 0 0 1 3 3v7.8a3 3 0 0 1-3 3h-4.3l-2.4 2.9a.7.7 0 0 1-1.2-.35V16.6H6.8a3 3 0 0 1-3-3V5.8a3 3 0 0 1 3-3Z" />
      <path
        d="M12 5.1c.5 2.4 1.7 3.6 4.1 4.1-2.4.5-3.6 1.7-4.1 4.1-.5-2.4-1.7-3.6-4.1-4.1 2.4-.5 3.6-1.7 4.1-4.1Z"
        fill="currentColor"
        stroke="none"
        className={sparkClassName}
      />
    </svg>
  );
}
