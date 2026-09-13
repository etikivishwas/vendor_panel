function SummaryCard({
  title,
  value,
  suffix,
  icon: Icon,
  helper,
}) {
  return (
    <article className="summary-card">
      <div className="summary-card-heading">
        <span>{title}</span>
        <span className="summary-icon">
          <Icon size={18} />
        </span>
      </div>

      <div className="summary-value">
        {value}
        {suffix && <small>{suffix}</small>}
      </div>

      <div className="summary-helper">{helper}</div>
    </article>
  );
}

export default SummaryCard;