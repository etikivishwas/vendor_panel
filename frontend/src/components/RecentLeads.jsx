function getInitials(name) {
  const safeName = String(name || "").trim();

  if (!safeName) {
    return "NA";
  }

  return safeName
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  const today = new Date();
  const difference = Math.floor(
    (new Date(today).setHours(0, 0, 0, 0) -
      new Date(date).setHours(0, 0, 0, 0)) /
      86400000
  );

  if (difference === 0) {
    return `Today, ${date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }

  if (difference === 1) {
    return "Yesterday";
  }

  return date.toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function RecentLeads({
  leads = [],
  title = "Recent Leads",
  selectedMonthLabel = "this month",
  emptyMessage = "",
}) {
  const safeLeads = Array.isArray(leads) ? leads : [];
  const hasLeads = safeLeads.length > 0;

  return (
    <article className="panel recent-leads">
      <div className="panel-heading">
        <h2>{title}</h2>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Service Requested</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>

          <tbody>
            {!hasLeads ? (
              <tr className="recent-leads-empty-row">
                <td colSpan={4}>
                  <div className="recent-leads-empty">
                    <strong>No leads found</strong>
                    <span>
                      {emptyMessage ||
                        `There are no recent leads in ${selectedMonthLabel}.`}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              safeLeads.map((lead) => {
                const normalizedStatus = String(lead.status || "new")
                  .trim()
                  .toLowerCase()
                  .replace(/\s+/g, "_");

                return (
                  <tr key={lead.id}>
                    <td>
                      <div className="customer-cell">
                        <span className="customer-avatar">
                          {getInitials(lead.customerName)}
                        </span>
                        <strong>{lead.customerName || "Customer"}</strong>
                      </div>
                    </td>
                    <td>{lead.serviceRequested || "Not specified"}</td>
                    <td>
                      <span
                        className={`status-badge status-${normalizedStatus}`}
                      >
                        {normalizedStatus.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td>{formatDate(lead.createdAt)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}

export default RecentLeads;
