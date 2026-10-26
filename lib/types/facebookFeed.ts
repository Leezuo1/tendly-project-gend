export interface FacebookFeedPost {
  id: string;
  message: string;
  createdAt: number;
  url: string;
  imageUrl: string | null;
  reactions: number | null;
  comments: number | null;
  shares: number | null;
}

export interface FacebookPostComment {
  id: string;
  authorName: string;
  message: string;
  createdAt: number;
  likes: number | null;
  replies: FacebookPostComment[];
  hasMoreReplies: boolean;
}

export interface FacebookFeedPage {
  posts: FacebookFeedPost[];
  after: string | null;
}

export interface FacebookPostCommentsPage {
  comments: FacebookPostComment[];
  after: string | null;
}
