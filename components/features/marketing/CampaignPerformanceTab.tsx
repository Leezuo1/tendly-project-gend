import React from 'react';

export function CampaignPerformanceTab() {
  return (
    <div className="tab-panel active" id="tab-performance">
      {/* 3 KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="label">Chuyển đổi — cá nhân hóa theo hội thoại</div>
          <div className="value">21,3%</div>
          <div className="trend up">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7 17 17 7"></path>
              <path d="M7 7h10v10"></path>
            </svg>
            +12,9đ <span className="trend-note">so với remarketing cohort</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="label">Chuyển đổi — remarketing cohort (RFM)</div>
          <div className="value">8,4%</div>
          <div className="trend-note" style={{ marginTop: 8 }}>
            Cách làm kiểu Klaviyo/Omnisend
          </div>
        </div>

        <div className="kpi-card">
          <div className="label">Khách được giữ chân bằng voucher</div>
          <div className="value">34</div>
          <div className="trend up">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7 17 17 7"></path>
              <path d="M7 7h10v10"></path>
            </svg>
            +12% <span className="trend-note">so với tuần trước</span>
          </div>
        </div>
      </div>

      {/* Comparison card */}
      <div className="card">
        <div className="card-head">
          <h2>So sánh tỉ lệ chuyển đổi theo cách remarketing</h2>
        </div>
        <div className="card-desc">
          Remarketing cá nhân hóa theo đúng nội dung hội thoại đang cho tỉ lệ chuyển đổi cao hơn hẳn so với gửi theo cohort hành vi chung chung.
        </div>
        <div className="compare-bars">
          <div className="compare-row">
            <div className="compare-label">Cá nhân hóa theo hội thoại</div>
            <div className="compare-track">
              <div className="compare-fill new" style={{ width: '85%' }}></div>
            </div>
            <div className="compare-val">21,3%</div>
          </div>
          <div className="compare-row">
            <div className="compare-label">Remarketing cohort (RFM)</div>
            <div className="compare-track">
              <div className="compare-fill old" style={{ width: '34%' }}></div>
            </div>
            <div className="compare-val">8,4%</div>
          </div>
        </div>
      </div>
    </div>
  );
}
