"use client";

export default function Sidebar({ onItemClick, activeTab = "Profile" }) {
  return (
    <aside className="ig-sidebar">
      {/* Top Instagram Brand Icon */}
      <div className="ig-sidebar-top">
        <a className="ig-brand-icon" onClick={onItemClick} title="Instagram">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
          </svg>
        </a>
      </div>

      {/* Main Nav Items */}
      <nav className="ig-navigation">
        <a className={`ig-nav-item ${activeTab === "Home" ? "active" : ""}`} onClick={onItemClick}>
          <span className="ig-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.5z" />
            </svg>
          </span>
          <span className="ig-nav-label">Home</span>
        </a>

        <a className={`ig-nav-item ${activeTab === "Reels" ? "active" : ""}`} onClick={onItemClick}>
          <span className="ig-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
              <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" />
            </svg>
          </span>
          <span className="ig-nav-label">Reels</span>
        </a>

        <a className={`ig-nav-item ${activeTab === "Messages" ? "active" : ""}`} onClick={onItemClick}>
          <span className="ig-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </span>
          <span className="ig-nav-label">Messages</span>
        </a>

        <a className={`ig-nav-item ${activeTab === "Search" ? "active" : ""}`} onClick={onItemClick}>
          <span className="ig-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <span className="ig-nav-label">Search</span>
        </a>

        <a className={`ig-nav-item ${activeTab === "Notifications" ? "active" : ""}`} onClick={onItemClick}>
          <span className="ig-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </span>
          <span className="ig-nav-label">Notifications</span>
        </a>

        <a className={`ig-nav-item ${activeTab === "Create" ? "active" : ""}`} onClick={onItemClick}>
          <span className="ig-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </span>
          <span className="ig-nav-label">Create</span>
        </a>

        <a className={`ig-nav-item ${activeTab === "Dashboard" ? "active" : ""}`} onClick={onItemClick}>
          <span className="ig-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="4" />
              <line x1="8" y1="17" x2="8" y2="13" />
              <line x1="12" y1="17" x2="12" y2="9" />
              <line x1="16" y1="17" x2="16" y2="15" />
            </svg>
          </span>
          <span className="ig-nav-label">Dashboard</span>
        </a>

        <a className={`ig-nav-item ${activeTab === "Profile" ? "active" : ""}`} onClick={onItemClick}>
          <span className="ig-icon ig-nav-profile-avatar">
            <img src="https://static.vecteezy.com/system/resources/previews/024/983/914/non_2x/simple-user-default-icon-free-png.png" alt="Profile" />
          </span>
          <span className="ig-nav-label" style={{ fontWeight: 700 }}>Profile</span>
        </a>
      </nav>

      {/* Bottom Nav Items */}
      <div className="ig-sidebar-bottom">
        <a className="ig-nav-item" onClick={onItemClick}>
          <span className="ig-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </span>
          <span className="ig-nav-label">More</span>
        </a>

        <a className="ig-nav-item" onClick={onItemClick}>
          <span className="ig-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="13" width="8" height="8" rx="2" />
              <rect x="13" y="13" width="8" height="8" rx="2" />
              <rect x="8" y="3" width="8" height="8" rx="2" />
            </svg>
          </span>
          <span className="ig-nav-label">Also from Meta</span>
        </a>
      </div>
    </aside>
  );
}
