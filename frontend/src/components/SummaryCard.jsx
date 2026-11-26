function SummaryCard({
  title,
  value,
  suffix,
  icon: Icon,
  helper,
  onClick,
  ariaLabel,
}) {
  const clickable =
    typeof onClick === "function";

  const content = (
    <>
      <div className="summary-card-heading">
        <span>{title}</span>

        <span className="summary-icon">
          <Icon size={17} />
        </span>
      </div>

      <div className="summary-value">
        {value}

        {suffix && (
          <small>{suffix}</small>
        )}
      </div>

      <div className="summary-helper">
        {helper}
      </div>
    </>
  );

  if (clickable) {
    return (
      <button
        type="button"
        className="summary-card summary-card-button"
        onClick={onClick}
        aria-label={
          ariaLabel ||
          `Open ${title}`
        }
      >
        {content}
      </button>
    );
  }

  return (
    <article className="summary-card">
      {content}
    </article>
  );
}

export default SummaryCard;