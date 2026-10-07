import { Link } from 'react-router-dom';

export default function PlaceholderPage({ title, desc }: { title: string; desc: string }) {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          <p>{desc}</p>
        </div>
      </div>
      <div className="card placeholder-card">
        <div className="emoji">🚧</div>
        <h2>Trang đang được phát triển</h2>
        <p>
          Trong lúc chờ, bạn có thể vào <Link className="link-btn" to="/cau-hinh-ai">Cấu hình AI</Link> hoặc{' '}
          <Link className="link-btn" to="/cai-dat">Cài đặt</Link>.
        </p>
      </div>
    </>
  );
}
