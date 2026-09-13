function getInitials(name) {
  return name
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatDate(value) {
  const date = new Date(value);
  const today = new Date();

  const difference = Math.floor(
    (today.setHours(0, 0, 0, 0) -
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

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function RecentLeads({ leads }) {
  return (
    <article className="panel recent-leads">
      <div className="panel-heading">
        <h2>Recent Leads</h2>
        <button type="button">View All</button>
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
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td>
                  <div className="customer-cell">
                    <span className="customer-avatar">
                      {getInitials(lead.customerName)}
                    </span>
                    <strong>{lead.customerName}</strong>
                  </div>
                </td>

                <td>{lead.serviceRequested}</td>

                <td>
                  <span
                    className={`status-badge status-${lead.status}`}
                  >
                    {lead.status.replace("_", " ")}
                  </span>
                </td>

                <td>{formatDate(lead.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

export default RecentLeads;