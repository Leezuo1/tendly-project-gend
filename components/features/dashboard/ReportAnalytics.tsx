import React from 'react';
import { TOP_PRODUCTS, WEEKLY_CHAT_STATS } from '@/lib/data/dashboard';

export function ReportAnalytics() {
  return (
    <div className="tab-panel" id="tab-report">
      {/* 4 KPI cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="label">Tỷ lệ phản hồi sau email cá nhân hoá</div>
          <div className="value">8,4%</div>
          <div className="trend up">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17 17 7"></path>
              <path d="M7 7h10v10"></path>
            </svg>
            +2,1% <span className="trend-note">so với tuần trước</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="label">Thời gian phản hồi trung bình</div>
          <div className="value">2p40s</div>
          <div className="trend down-good">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 7 17 17"></path>
              <path d="M17 7v10H7"></path>
            </svg>
            18% nhanh hơn <span className="trend-note">tuần trước</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="label">Số hội thoại cảm xúc âm đã xử lý</div>
          <div className="value">34</div>
          <div className="trend up">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17 17 7"></path>
              <path d="M7 7h10v10"></path>
            </svg>
            +12% <span className="trend-note">so với tuần trước</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="label">Tỷ lệ mở email</div>
          <div className="value">61%</div>
          <div className="trend down-bad">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 7 17 17"></path>
              <path d="M17 7v10H7"></path>
            </svg>
            -3% <span className="trend-note">so với tuần trước</span>
          </div>
        </div>
      </div>

      <div className="grid-2">
        {/* Line Chart 1 */}
        <div className="card">
          <div className="card-head">
            <h2>Tỷ lệ phản hồi sau email theo ngày</h2>
            <span className="hint">%</span>
          </div>
          <svg viewBox="0 0 600 170" width="100%" height="170" role="img" aria-label="Biểu đồ tỷ lệ phản hồi sau email theo ngày trong tuần">
            <line x1="20" y1="20" x2="580" y2="20" stroke="#E7DED7" strokeWidth="1"></line>
            <line x1="20" y1="70" x2="580" y2="70" stroke="#E7DED7" strokeWidth="1"></line>
            <line x1="20" y1="120" x2="580" y2="120" stroke="#E7DED7" strokeWidth="1"></line>
            <defs>
              <linearGradient id="convGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F06A6A" stopOpacity="0.18"></stop>
                <stop offset="100%" stopColor="#F06A6A" stopOpacity="0"></stop>
              </linearGradient>
            </defs>
            <path d="M20,115 L113,95 L207,100 L300,72 L393,48 L487,30 L580,60 L580,130 L20,130 Z" fill="url(#convGrad)"></path>
            <polyline points="20,115 113,95 207,100 300,72 393,48 487,30 580,60" fill="none" stroke="#F06A6A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"></polyline>
            <circle cx="20" cy="115" r="3.5" fill="white" stroke="#F06A6A" strokeWidth="2"></circle>
            <circle cx="113" cy="95" r="3.5" fill="white" stroke="#F06A6A" strokeWidth="2"></circle>
            <circle cx="207" cy="100" r="3.5" fill="white" stroke="#F06A6A" strokeWidth="2"></circle>
            <circle cx="300" cy="72" r="3.5" fill="white" stroke="#F06A6A" strokeWidth="2"></circle>
            <circle cx="393" cy="48" r="3.5" fill="white" stroke="#F06A6A" strokeWidth="2"></circle>
            <circle cx="487" cy="30" r="3.5" fill="white" stroke="#F06A6A" strokeWidth="2"></circle>
            <circle cx="580" cy="60" r="5" fill="#F06A6A" stroke="white" strokeWidth="2"></circle>
            <text x="578" y="45" textAnchor="end" fontSize="12" fontWeight="700" fill="#D8514F" fontFamily="Inter, sans-serif">8,4%</text>
            <text x="20" y="150" fontSize="11" fill="#6B5F5A" fontFamily="Inter, sans-serif">T2</text>
            <text x="113" y="150" textAnchor="middle" fontSize="11" fill="#6B5F5A" fontFamily="Inter, sans-serif">T3</text>
            <text x="207" y="150" textAnchor="middle" fontSize="11" fill="#6B5F5A" fontFamily="Inter, sans-serif">T4</text>
            <text x="300" y="150" textAnchor="middle" fontSize="11" fill="#6B5F5A" fontFamily="Inter, sans-serif">T5</text>
            <text x="393" y="150" textAnchor="middle" fontSize="11" fill="#6B5F5A" fontFamily="Inter, sans-serif">T6</text>
            <text x="487" y="150" textAnchor="middle" fontSize="11" fill="#6B5F5A" fontFamily="Inter, sans-serif">T7</text>
            <text x="578" y="150" textAnchor="end" fontSize="11" fill="#6B5F5A" fontFamily="Inter, sans-serif">CN</text>
          </svg>
        </div>

        {/* Line Chart 2 */}
        <div className="card">
          <div className="card-head">
            <h2>Thời gian phản hồi theo ngày</h2>
            <span className="hint">phút</span>
          </div>
          <svg viewBox="0 0 600 170" width="100%" height="170" role="img" aria-label="Biểu đồ thời gian phản hồi trung bình theo ngày trong tuần">
            <line x1="20" y1="20" x2="580" y2="20" stroke="#E7DED7" strokeWidth="1"></line>
            <line x1="20" y1="70" x2="580" y2="70" stroke="#E7DED7" strokeWidth="1"></line>
            <line x1="20" y1="120" x2="580" y2="120" stroke="#E7DED7" strokeWidth="1"></line>
            <defs>
              <linearGradient id="respGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4B6358" stopOpacity="0.18"></stop>
                <stop offset="100%" stopColor="#4B6358" stopOpacity="0"></stop>
              </linearGradient>
            </defs>
            <path d="M20,20 L113,50 L207,30 L300,70 L393,90 L487,120 L580,103 L580,130 L20,130 Z" fill="url(#respGrad)"></path>
            <polyline points="20,20 113,50 207,30 300,70 393,90 487,120 580,103" fill="none" stroke="#4B6358" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"></polyline>
            <circle cx="20" cy="20" r="3.5" fill="white" stroke="#4B6358" strokeWidth="2"></circle>
            <circle cx="113" cy="50" r="3.5" fill="white" stroke="#4B6358" strokeWidth="2"></circle>
            <circle cx="207" cy="30" r="3.5" fill="white" stroke="#4B6358" strokeWidth="2"></circle>
            <circle cx="300" cy="70" r="3.5" fill="white" stroke="#4B6358" strokeWidth="2"></circle>
            <circle cx="393" cy="90" r="3.5" fill="white" stroke="#4B6358" strokeWidth="2"></circle>
            <circle cx="487" cy="120" r="3.5" fill="white" stroke="#4B6358" strokeWidth="2"></circle>
            <circle cx="580" cy="103" r="5" fill="#4B6358" stroke="white" strokeWidth="2"></circle>
            <text x="578" y="88" textAnchor="end" fontSize="12" fontWeight="700" fill="#4B6358" fontFamily="Inter, sans-serif">2p40s</text>
            <text x="20" y="150" fontSize="11" fill="#6B5F5A" fontFamily="Inter, sans-serif">T2</text>
            <text x="113" y="150" textAnchor="middle" fontSize="11" fill="#6B5F5A" fontFamily="Inter, sans-serif">T3</text>
            <text x="207" y="150" textAnchor="middle" fontSize="11" fill="#6B5F5A" fontFamily="Inter, sans-serif">T4</text>
            <text x="300" y="150" textAnchor="middle" fontSize="11" fill="#6B5F5A" fontFamily="Inter, sans-serif">T5</text>
            <text x="393" y="150" textAnchor="middle" fontSize="11" fill="#6B5F5A" fontFamily="Inter, sans-serif">T6</text>
            <text x="487" y="150" textAnchor="middle" fontSize="11" fill="#6B5F5A" fontFamily="Inter, sans-serif">T7</text>
            <text x="578" y="150" textAnchor="end" fontSize="11" fill="#6B5F5A" fontFamily="Inter, sans-serif">CN</text>
          </svg>
        </div>
      </div>

      {/* Table of Top Products */}
      <div className="card">
        <div className="card-head">
          <h2>Sản phẩm được hỏi nhiều nhất</h2>
          <span className="hint">7 ngày gần nhất • *ước tính từ tín hiệu hội thoại</span>
        </div>
        <div className="table-wrap">
          <table className="report-table">
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th style={{ textAlign: 'right' }}>Hỏi trong chat</th>
                <th style={{ textAlign: 'right' }}>Có dấu hiệu chốt đơn</th>
                <th style={{ textAlign: 'right' }}>Tỷ lệ có dấu hiệu chốt</th>
              </tr>
            </thead>
            <tbody>
              {TOP_PRODUCTS.map((prod, i) => (
                <tr key={i}>
                  <td>
                    <div className="table-prod-name">
                      <div className="table-prod-icon">{prod.icon}</div>
                      <div>
                        <div>{prod.name}</div>
                        <div className="table-prod-sku">{prod.sku}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{prod.chatCount}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{prod.orderSignalCount}</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="rate-badge">{prod.rate}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="card">
        <div className="card-head">
          <h2>Hội thoại theo ngày trong tuần</h2>
          <span className="hint">7 ngày gần nhất</span>
        </div>
        <div className="bar-chart">
          {WEEKLY_CHAT_STATS.map((item, i) => (
            <div key={i} className={`bar-col${item.isPeak ? ' peak' : ''}`}>
              <span className="bar-val">{item.count}</span>
              <div
                className="bar"
                style={{ height: item.height }}
                title={`${item.day}: ${item.count} hội thoại${item.isPeak ? ' (Cao điểm)' : ''}`}
              ></div>
              <span className="bar-day">{item.day}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
