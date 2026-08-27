/* eslint-disable */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type Maybe<T> = T | null;
export type InputMaybe<T> = T | null | undefined;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
};

export type ActionResult = {
  __typename?: 'ActionResult';
  error?: Maybe<Scalars['String']['output']>;
  success?: Maybe<Scalars['Boolean']['output']>;
};

export type AuthResult = {
  __typename?: 'AuthResult';
  author?: Maybe<Author>;
  error?: Maybe<Scalars['String']['output']>;
  success?: Maybe<Scalars['Boolean']['output']>;
  token?: Maybe<Scalars['String']['output']>;
};

export type Author = {
  __typename?: 'Author';
  about?: Maybe<Scalars['String']['output']>;
  bio?: Maybe<Scalars['String']['output']>;
  communities?: Maybe<Array<Maybe<Community>>>;
  created_at?: Maybe<Scalars['Int']['output']>;
  deleted_at?: Maybe<Scalars['Int']['output']>;
  email?: Maybe<Scalars['String']['output']>;
  email_verified?: Maybe<Scalars['Boolean']['output']>;
  id: Scalars['Int']['output'];
  last_seen?: Maybe<Scalars['Int']['output']>;
  links?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  name?: Maybe<Scalars['String']['output']>;
  pic?: Maybe<Scalars['String']['output']>;
  roles?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  seo?: Maybe<Scalars['String']['output']>;
  slug: Scalars['String']['output'];
  stat?: Maybe<AuthorStat>;
  updated_at?: Maybe<Scalars['Int']['output']>;
  user: Scalars['String']['output'];
};

export type AuthorFollowsResult = {
  __typename?: 'AuthorFollowsResult';
  authors?: Maybe<Array<Maybe<Author>>>;
  communities?: Maybe<Array<Maybe<Community>>>;
  error?: Maybe<Scalars['String']['output']>;
  topics?: Maybe<Array<Maybe<Topic>>>;
};

export type AuthorInput = {
  id: Scalars['Int']['input'];
  slug?: InputMaybe<Scalars['String']['input']>;
};

export type AuthorStat = {
  __typename?: 'AuthorStat';
  authors?: Maybe<Scalars['Int']['output']>;
  coauthors?: Maybe<Scalars['Int']['output']>;
  comments?: Maybe<Scalars['Int']['output']>;
  followers?: Maybe<Scalars['Int']['output']>;
  rating?: Maybe<Scalars['Int']['output']>;
  rating_comments?: Maybe<Scalars['Int']['output']>;
  rating_shouts?: Maybe<Scalars['Int']['output']>;
  replies_count?: Maybe<Scalars['Int']['output']>;
  shouts?: Maybe<Scalars['Int']['output']>;
  topics?: Maybe<Scalars['Int']['output']>;
  viewed?: Maybe<Scalars['Int']['output']>;
  viewed_shouts?: Maybe<Scalars['Int']['output']>;
};

export type AuthorsBy = {
  after?: InputMaybe<Scalars['Int']['input']>;
  created_at?: InputMaybe<Scalars['Int']['input']>;
  last_seen?: InputMaybe<Scalars['Int']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  order?: InputMaybe<Scalars['String']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
  stat?: InputMaybe<Scalars['String']['input']>;
  topic?: InputMaybe<Scalars['String']['input']>;
};

export type Collection = {
  __typename?: 'Collection';
  amount?: Maybe<Scalars['Int']['output']>;
  created_at: Scalars['Int']['output'];
  created_by: Author;
  desc?: Maybe<Scalars['String']['output']>;
  id: Scalars['Int']['output'];
  published_at?: Maybe<Scalars['Int']['output']>;
  slug: Scalars['String']['output'];
  title: Scalars['String']['output'];
};

export type CommonResult = {
  __typename?: 'CommonResult';
  author?: Maybe<Author>;
  authors?: Maybe<Array<Maybe<Author>>>;
  communities?: Maybe<Array<Maybe<Community>>>;
  community?: Maybe<Community>;
  draft?: Maybe<Draft>;
  drafts?: Maybe<Array<Maybe<Draft>>>;
  error?: Maybe<Scalars['String']['output']>;
  reaction?: Maybe<Reaction>;
  reactions?: Maybe<Array<Maybe<Reaction>>>;
  shout?: Maybe<Shout>;
  shouts?: Maybe<Array<Maybe<Shout>>>;
  slugs?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  topic?: Maybe<Topic>;
  topics?: Maybe<Array<Maybe<Topic>>>;
};

export type Community = {
  __typename?: 'Community';
  created_at: Scalars['Int']['output'];
  created_by: Author;
  desc?: Maybe<Scalars['String']['output']>;
  id: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  pic: Scalars['String']['output'];
  slug: Scalars['String']['output'];
  stat?: Maybe<CommunityStat>;
};

export type CommunityInput = {
  desc?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  pic?: InputMaybe<Scalars['String']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
};

export type CommunityStat = {
  __typename?: 'CommunityStat';
  authors: Scalars['Int']['output'];
  followers: Scalars['Int']['output'];
  shouts: Scalars['Int']['output'];
};

export type Draft = {
  __typename?: 'Draft';
  authors?: Maybe<Array<Maybe<Author>>>;
  body?: Maybe<Scalars['String']['output']>;
  cover?: Maybe<Scalars['String']['output']>;
  cover_caption?: Maybe<Scalars['String']['output']>;
  created_at: Scalars['Int']['output'];
  created_by: Author;
  deleted_at?: Maybe<Scalars['Int']['output']>;
  deleted_by?: Maybe<Author>;
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['Int']['output'];
  lang?: Maybe<Scalars['String']['output']>;
  layout?: Maybe<Scalars['String']['output']>;
  lead?: Maybe<Scalars['String']['output']>;
  media?: Maybe<Array<Maybe<MediaItem>>>;
  seo?: Maybe<Scalars['String']['output']>;
  shout?: Maybe<Shout>;
  slug?: Maybe<Scalars['String']['output']>;
  subtitle?: Maybe<Scalars['String']['output']>;
  title?: Maybe<Scalars['String']['output']>;
  topics?: Maybe<Array<Maybe<Topic>>>;
  updated_at?: Maybe<Scalars['Int']['output']>;
  updated_by?: Maybe<Author>;
};

export type DraftInput = {
  author_ids?: InputMaybe<Array<Scalars['Int']['input']>>;
  body?: InputMaybe<Scalars['String']['input']>;
  cover?: InputMaybe<Scalars['String']['input']>;
  cover_caption?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['Int']['input']>;
  lang?: InputMaybe<Scalars['String']['input']>;
  layout?: InputMaybe<Scalars['String']['input']>;
  lead?: InputMaybe<Scalars['String']['input']>;
  main_topic_id?: InputMaybe<Scalars['Int']['input']>;
  media?: InputMaybe<Array<InputMaybe<MediaItemInput>>>;
  seo?: InputMaybe<Scalars['String']['input']>;
  shout_id?: InputMaybe<Scalars['Int']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
  subtitle?: InputMaybe<Scalars['String']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
  topic_ids?: InputMaybe<Array<Scalars['Int']['input']>>;
};

export enum FollowingEntity {
  Author = 'AUTHOR',
  Community = 'COMMUNITY',
  Shout = 'SHOUT',
  Topic = 'TOPIC'
}

export type Invite = {
  __typename?: 'Invite';
  author_id: Scalars['Int']['output'];
  id: Scalars['Int']['output'];
  inviter_id: Scalars['Int']['output'];
  shout_id: Scalars['Int']['output'];
  status?: Maybe<InviteStatus>;
};

export enum InviteStatus {
  Accepted = 'ACCEPTED',
  Pending = 'PENDING',
  Rejected = 'REJECTED'
}

export type LoadShoutsFilters = {
  after?: InputMaybe<Scalars['Int']['input']>;
  author?: InputMaybe<Scalars['String']['input']>;
  featured?: InputMaybe<Scalars['Boolean']['input']>;
  layouts?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  reacted?: InputMaybe<Scalars['Boolean']['input']>;
  topic?: InputMaybe<Scalars['String']['input']>;
};

export type LoadShoutsOptions = {
  filters?: InputMaybe<LoadShoutsFilters>;
  limit: Scalars['Int']['input'];
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<ShoutsOrderBy>;
  order_by_desc?: InputMaybe<Scalars['Boolean']['input']>;
  random_limit?: InputMaybe<Scalars['Int']['input']>;
};

export type MediaItem = {
  __typename?: 'MediaItem';
  artist?: Maybe<Scalars['String']['output']>;
  body?: Maybe<Scalars['String']['output']>;
  date?: Maybe<Scalars['String']['output']>;
  genre?: Maybe<Scalars['String']['output']>;
  lyrics?: Maybe<Scalars['String']['output']>;
  pic?: Maybe<Scalars['String']['output']>;
  source?: Maybe<Scalars['String']['output']>;
  title?: Maybe<Scalars['String']['output']>;
  url?: Maybe<Scalars['String']['output']>;
};

export type MediaItemInput = {
  artist?: InputMaybe<Scalars['String']['input']>;
  body?: InputMaybe<Scalars['String']['input']>;
  date?: InputMaybe<Scalars['String']['input']>;
  genre?: InputMaybe<Scalars['String']['input']>;
  lyrics?: InputMaybe<Scalars['String']['input']>;
  pic?: InputMaybe<Scalars['String']['input']>;
  source?: InputMaybe<Scalars['String']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
  url?: InputMaybe<Scalars['String']['input']>;
};

export type Mutation = {
  __typename?: 'Mutation';
  accept_invite: CommonResult;
  cancelEmailChange?: Maybe<AuthResult>;
  confirmEmail?: Maybe<AuthResult>;
  confirmEmailChange?: Maybe<AuthResult>;
  create_community: CommonResult;
  create_draft: CommonResult;
  create_draft_from_shout: CommonResult;
  create_invite: CommonResult;
  create_reaction: CommonResult;
  create_topic: CommonResult;
  delete_community: CommonResult;
  delete_draft: CommonResult;
  delete_reaction: CommonResult;
  delete_topic: CommonResult;
  follow: AuthorFollowsResult;
  getSession?: Maybe<AuthResult>;
  join_community: CommonResult;
  leave_community: CommonResult;
  login?: Maybe<AuthResult>;
  logout?: Maybe<ActionResult>;
  notification_mark_seen: CommonResult;
  notifications_seen_after: CommonResult;
  notifications_seen_thread: CommonResult;
  publish_draft: CommonResult;
  publish_shout: CommonResult;
  rate_author: CommonResult;
  refreshToken?: Maybe<AuthResult>;
  registerUser?: Maybe<AuthResult>;
  reject_invite: CommonResult;
  remove_author: CommonResult;
  remove_invite: CommonResult;
  requestPasswordReset?: Maybe<ActionResult>;
  resetPassword?: Maybe<ActionResult>;
  sendLink?: Maybe<SendLinkResult>;
  toggle_bookmark_shout: CommonResult;
  unfollow: AuthorFollowsResult;
  unpublish_draft: CommonResult;
  unpublish_shout: CommonResult;
  updateSecurity?: Maybe<ActionResult>;
  update_author: CommonResult;
  update_community: CommonResult;
  update_draft: CommonResult;
  update_reaction: CommonResult;
  update_topic: CommonResult;
};


export type MutationAccept_InviteArgs = {
  invite_id: Scalars['Int']['input'];
};


export type MutationConfirmEmailArgs = {
  token: Scalars['String']['input'];
};


export type MutationConfirmEmailChangeArgs = {
  token: Scalars['String']['input'];
};


export type MutationCreate_CommunityArgs = {
  community_input: CommunityInput;
};


export type MutationCreate_DraftArgs = {
  draft_input: DraftInput;
};


export type MutationCreate_Draft_From_ShoutArgs = {
  shout_id: Scalars['Int']['input'];
};


export type MutationCreate_InviteArgs = {
  author_id?: InputMaybe<Scalars['Int']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
};


export type MutationCreate_ReactionArgs = {
  reaction: ReactionInput;
};


export type MutationCreate_TopicArgs = {
  topic_input: TopicInput;
};


export type MutationDelete_CommunityArgs = {
  slug: Scalars['String']['input'];
};


export type MutationDelete_DraftArgs = {
  draft_id: Scalars['Int']['input'];
};


export type MutationDelete_ReactionArgs = {
  reaction_id: Scalars['Int']['input'];
};


export type MutationDelete_TopicArgs = {
  slug: Scalars['String']['input'];
};


export type MutationFollowArgs = {
  slug: Scalars['String']['input'];
  what: FollowingEntity;
};


export type MutationJoin_CommunityArgs = {
  slug: Scalars['String']['input'];
};


export type MutationLeave_CommunityArgs = {
  slug: Scalars['String']['input'];
};


export type MutationLoginArgs = {
  email: Scalars['String']['input'];
  password: Scalars['String']['input'];
};


export type MutationNotification_Mark_SeenArgs = {
  notification_id: Scalars['Int']['input'];
  seen?: InputMaybe<Scalars['Boolean']['input']>;
};


export type MutationNotifications_Seen_AfterArgs = {
  after: Scalars['Int']['input'];
  seen?: InputMaybe<Scalars['Boolean']['input']>;
};


export type MutationNotifications_Seen_ThreadArgs = {
  seen?: InputMaybe<Scalars['Boolean']['input']>;
  thread_id: Scalars['String']['input'];
};


export type MutationPublish_DraftArgs = {
  draft_id: Scalars['Int']['input'];
};


export type MutationPublish_ShoutArgs = {
  shout_id: Scalars['Int']['input'];
};


export type MutationRate_AuthorArgs = {
  rated_slug: Scalars['String']['input'];
  value: Scalars['Int']['input'];
};


export type MutationRegisterUserArgs = {
  email: Scalars['String']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  password: Scalars['String']['input'];
};


export type MutationReject_InviteArgs = {
  invite_id: Scalars['Int']['input'];
};


export type MutationRemove_AuthorArgs = {
  author_id?: InputMaybe<Scalars['Int']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
};


export type MutationRemove_InviteArgs = {
  invite_id: Scalars['Int']['input'];
};


export type MutationRequestPasswordResetArgs = {
  email: Scalars['String']['input'];
};


export type MutationResetPasswordArgs = {
  newPassword: Scalars['String']['input'];
  token: Scalars['String']['input'];
};


export type MutationSendLinkArgs = {
  email: Scalars['String']['input'];
  template?: InputMaybe<Scalars['String']['input']>;
};


export type MutationToggle_Bookmark_ShoutArgs = {
  slug: Scalars['String']['input'];
};


export type MutationUnfollowArgs = {
  slug: Scalars['String']['input'];
  what: FollowingEntity;
};


export type MutationUnpublish_DraftArgs = {
  draft_id: Scalars['Int']['input'];
};


export type MutationUnpublish_ShoutArgs = {
  shout_id: Scalars['Int']['input'];
};


export type MutationUpdateSecurityArgs = {
  email?: InputMaybe<Scalars['String']['input']>;
  new_password?: InputMaybe<Scalars['String']['input']>;
  old_password?: InputMaybe<Scalars['String']['input']>;
};


export type MutationUpdate_AuthorArgs = {
  profile: ProfileInput;
};


export type MutationUpdate_CommunityArgs = {
  community_input: CommunityInput;
};


export type MutationUpdate_DraftArgs = {
  draft_id: Scalars['Int']['input'];
  draft_input: DraftInput;
};


export type MutationUpdate_ReactionArgs = {
  reaction: ReactionInput;
};


export type MutationUpdate_TopicArgs = {
  topic_input: TopicInput;
};

export type MyRateComment = {
  __typename?: 'MyRateComment';
  comment_id: Scalars['Int']['output'];
  my_rate?: Maybe<ReactionKind>;
  shout_id?: Maybe<Scalars['Int']['output']>;
};

export type MyRateShout = {
  __typename?: 'MyRateShout';
  my_rate?: Maybe<ReactionKind>;
  shout_id: Scalars['Int']['output'];
};

export type Notification = {
  __typename?: 'Notification';
  action: Scalars['String']['output'];
  created_at: Scalars['Int']['output'];
  entity: Scalars['String']['output'];
  id: Scalars['Int']['output'];
  payload: Scalars['String']['output'];
  seen?: Maybe<Array<Maybe<Author>>>;
};

export type NotificationGroup = {
  __typename?: 'NotificationGroup';
  action: Scalars['String']['output'];
  authors?: Maybe<Array<Maybe<Author>>>;
  entity: Scalars['String']['output'];
  reactions?: Maybe<Array<Maybe<Reaction>>>;
  seen?: Maybe<Scalars['Boolean']['output']>;
  shout?: Maybe<Shout>;
  thread: Scalars['String']['output'];
  updated_at: Scalars['Int']['output'];
};

export type NotificationSeenInput = {
  notifications?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  thread?: InputMaybe<Scalars['Int']['input']>;
};

export type NotificationSeenResult = {
  __typename?: 'NotificationSeenResult';
  error?: Maybe<Scalars['String']['output']>;
};

export type NotificationsResult = {
  __typename?: 'NotificationsResult';
  error?: Maybe<Scalars['String']['output']>;
  notifications: Array<NotificationGroup>;
  total: Scalars['Int']['output'];
  unread: Scalars['Int']['output'];
};

export type ProfileInput = {
  about?: InputMaybe<Scalars['String']['input']>;
  bio?: InputMaybe<Scalars['String']['input']>;
  links?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  name?: InputMaybe<Scalars['String']['input']>;
  pic?: InputMaybe<Scalars['String']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
};

export type Query = {
  __typename?: 'Query';
  get_author?: Maybe<Author>;
  get_author_followers?: Maybe<Array<Maybe<Author>>>;
  get_author_follows: CommonResult;
  get_author_follows_authors?: Maybe<Array<Maybe<Author>>>;
  get_author_follows_topics?: Maybe<Array<Maybe<Topic>>>;
  get_author_id?: Maybe<Author>;
  get_authors_all?: Maybe<Array<Maybe<Author>>>;
  get_communities_all?: Maybe<Array<Maybe<Community>>>;
  get_communities_by_author?: Maybe<Array<Maybe<Community>>>;
  get_community?: Maybe<Community>;
  get_my_rates_comments?: Maybe<Array<Maybe<MyRateComment>>>;
  get_my_rates_shouts?: Maybe<Array<Maybe<MyRateShout>>>;
  get_my_shout: CommonResult;
  get_shout?: Maybe<Shout>;
  get_shout_followers?: Maybe<Array<Maybe<Author>>>;
  get_shouts_drafts: CommonResult;
  get_topic?: Maybe<Topic>;
  get_topic_authors?: Maybe<Array<Maybe<Author>>>;
  get_topic_followers?: Maybe<Array<Maybe<Author>>>;
  get_topics_all?: Maybe<Array<Maybe<Topic>>>;
  get_topics_by_author?: Maybe<Array<Maybe<Topic>>>;
  get_topics_by_community?: Maybe<Array<Maybe<Topic>>>;
  isEmailUsed?: Maybe<Scalars['Boolean']['output']>;
  load_authors_by?: Maybe<Array<Maybe<Author>>>;
  load_authors_search?: Maybe<Array<Maybe<Author>>>;
  load_comment_ratings?: Maybe<Array<Maybe<Reaction>>>;
  load_comments_branch?: Maybe<Array<Maybe<Reaction>>>;
  load_drafts: CommonResult;
  load_notifications: NotificationsResult;
  load_reactions_by?: Maybe<Array<Maybe<Reaction>>>;
  load_shout_comments?: Maybe<Array<Maybe<Reaction>>>;
  load_shout_ratings?: Maybe<Array<Maybe<Reaction>>>;
  load_shouts_authored_by?: Maybe<Array<Maybe<Shout>>>;
  load_shouts_bookmarked?: Maybe<Array<Maybe<Shout>>>;
  load_shouts_by?: Maybe<Array<Maybe<Shout>>>;
  load_shouts_coauthored?: Maybe<Array<Maybe<Shout>>>;
  load_shouts_discussed?: Maybe<Array<Maybe<Shout>>>;
  load_shouts_feed?: Maybe<Array<Maybe<Shout>>>;
  load_shouts_followed_by?: Maybe<Array<Maybe<Shout>>>;
  load_shouts_random_top?: Maybe<Array<Maybe<Shout>>>;
  load_shouts_search?: Maybe<Array<Maybe<SearchResult>>>;
  load_shouts_unrated?: Maybe<Array<Maybe<Shout>>>;
  load_shouts_with_topic?: Maybe<Array<Maybe<Shout>>>;
};


export type QueryGet_AuthorArgs = {
  author_id?: InputMaybe<Scalars['Int']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
};


export type QueryGet_Author_FollowersArgs = {
  author_id?: InputMaybe<Scalars['Int']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
  user?: InputMaybe<Scalars['String']['input']>;
};


export type QueryGet_Author_FollowsArgs = {
  author_id?: InputMaybe<Scalars['Int']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
  user?: InputMaybe<Scalars['String']['input']>;
};


export type QueryGet_Author_Follows_AuthorsArgs = {
  author_id?: InputMaybe<Scalars['Int']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
  user?: InputMaybe<Scalars['String']['input']>;
};


export type QueryGet_Author_Follows_TopicsArgs = {
  author_id?: InputMaybe<Scalars['Int']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
  user?: InputMaybe<Scalars['String']['input']>;
};


export type QueryGet_Author_IdArgs = {
  user: Scalars['String']['input'];
};


export type QueryGet_Communities_By_AuthorArgs = {
  author_id?: InputMaybe<Scalars['Int']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
  user?: InputMaybe<Scalars['String']['input']>;
};


export type QueryGet_My_Rates_CommentsArgs = {
  comments: Array<Scalars['Int']['input']>;
};


export type QueryGet_My_Rates_ShoutsArgs = {
  shouts: Array<Scalars['Int']['input']>;
};


export type QueryGet_My_ShoutArgs = {
  shout_id: Scalars['Int']['input'];
};


export type QueryGet_ShoutArgs = {
  shout_id?: InputMaybe<Scalars['Int']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
};


export type QueryGet_Shout_FollowersArgs = {
  shout_id?: InputMaybe<Scalars['Int']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
};


export type QueryGet_TopicArgs = {
  slug: Scalars['String']['input'];
};


export type QueryGet_Topic_AuthorsArgs = {
  slug?: InputMaybe<Scalars['String']['input']>;
};


export type QueryGet_Topic_FollowersArgs = {
  slug?: InputMaybe<Scalars['String']['input']>;
};


export type QueryGet_Topics_By_AuthorArgs = {
  author_id?: InputMaybe<Scalars['Int']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
  user?: InputMaybe<Scalars['String']['input']>;
};


export type QueryGet_Topics_By_CommunityArgs = {
  community_id: Scalars['Int']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryIsEmailUsedArgs = {
  email: Scalars['String']['input'];
};


export type QueryLoad_Authors_ByArgs = {
  by: AuthorsBy;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryLoad_Authors_SearchArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  text: Scalars['String']['input'];
};


export type QueryLoad_Comment_RatingsArgs = {
  comment: Scalars['Int']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryLoad_Comments_BranchArgs = {
  children_limit?: InputMaybe<Scalars['Int']['input']>;
  children_offset?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  parent_id?: InputMaybe<Scalars['Int']['input']>;
  shout: Scalars['Int']['input'];
  sort?: InputMaybe<ReactionSort>;
};


export type QueryLoad_NotificationsArgs = {
  after: Scalars['Int']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryLoad_Reactions_ByArgs = {
  by: ReactionBy;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryLoad_Shout_CommentsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  shout: Scalars['Int']['input'];
};


export type QueryLoad_Shout_RatingsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  shout: Scalars['Int']['input'];
};


export type QueryLoad_Shouts_Authored_ByArgs = {
  options?: InputMaybe<LoadShoutsOptions>;
  slug?: InputMaybe<Scalars['String']['input']>;
};


export type QueryLoad_Shouts_BookmarkedArgs = {
  options?: InputMaybe<LoadShoutsOptions>;
};


export type QueryLoad_Shouts_ByArgs = {
  options?: InputMaybe<LoadShoutsOptions>;
};


export type QueryLoad_Shouts_CoauthoredArgs = {
  options?: InputMaybe<LoadShoutsOptions>;
};


export type QueryLoad_Shouts_DiscussedArgs = {
  options?: InputMaybe<LoadShoutsOptions>;
};


export type QueryLoad_Shouts_FeedArgs = {
  options?: InputMaybe<LoadShoutsOptions>;
};


export type QueryLoad_Shouts_Followed_ByArgs = {
  options?: InputMaybe<LoadShoutsOptions>;
  slug?: InputMaybe<Scalars['String']['input']>;
};


export type QueryLoad_Shouts_Random_TopArgs = {
  options?: InputMaybe<LoadShoutsOptions>;
};


export type QueryLoad_Shouts_SearchArgs = {
  options?: InputMaybe<LoadShoutsOptions>;
  text: Scalars['String']['input'];
};


export type QueryLoad_Shouts_UnratedArgs = {
  options?: InputMaybe<LoadShoutsOptions>;
};


export type QueryLoad_Shouts_With_TopicArgs = {
  options?: InputMaybe<LoadShoutsOptions>;
  slug?: InputMaybe<Scalars['String']['input']>;
};

export type Rating = {
  __typename?: 'Rating';
  rater: Scalars['String']['output'];
  value: Scalars['Int']['output'];
};

export type Reaction = {
  __typename?: 'Reaction';
  body?: Maybe<Scalars['String']['output']>;
  created_at: Scalars['Int']['output'];
  created_by: Author;
  deleted_at?: Maybe<Scalars['Int']['output']>;
  deleted_by?: Maybe<Author>;
  first_replies?: Maybe<Array<Maybe<Reaction>>>;
  id: Scalars['Int']['output'];
  kind: ReactionKind;
  oid?: Maybe<Scalars['String']['output']>;
  range?: Maybe<Scalars['String']['output']>;
  reply_to?: Maybe<Scalars['Int']['output']>;
  shout: Shout;
  stat?: Maybe<Stat>;
  updated_at?: Maybe<Scalars['Int']['output']>;
};

export type ReactionBy = {
  after?: InputMaybe<Scalars['Int']['input']>;
  author?: InputMaybe<Scalars['String']['input']>;
  created_by?: InputMaybe<Scalars['Int']['input']>;
  kinds?: InputMaybe<Array<InputMaybe<ReactionKind>>>;
  reply_to?: InputMaybe<Scalars['Int']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  shout?: InputMaybe<Scalars['String']['input']>;
  shouts?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  sort?: InputMaybe<ReactionSort>;
  topic?: InputMaybe<Scalars['String']['input']>;
};

export type ReactionInput = {
  body?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['Int']['input']>;
  kind: ReactionKind;
  quote?: InputMaybe<Scalars['String']['input']>;
  reply_to?: InputMaybe<Scalars['Int']['input']>;
  shout: Scalars['Int']['input'];
};

export enum ReactionKind {
  Accept = 'ACCEPT',
  Agree = 'AGREE',
  Ask = 'ASK',
  Comment = 'COMMENT',
  Disagree = 'DISAGREE',
  Dislike = 'DISLIKE',
  Disproof = 'DISPROOF',
  Like = 'LIKE',
  Proof = 'PROOF',
  Propose = 'PROPOSE',
  Quote = 'QUOTE',
  Reject = 'REJECT'
}

export enum ReactionSort {
  Dislike = 'dislike',
  Like = 'like',
  Newest = 'newest',
  Oldest = 'oldest'
}

export enum ReactionStatus {
  Changed = 'CHANGED',
  Deleted = 'DELETED',
  Explained = 'EXPLAINED',
  New = 'NEW',
  Updated = 'UPDATED'
}

export type ReactionUpdating = {
  __typename?: 'ReactionUpdating';
  error?: Maybe<Scalars['String']['output']>;
  reaction?: Maybe<Reaction>;
  status?: Maybe<ReactionStatus>;
};

export type SearchResult = {
  __typename?: 'SearchResult';
  authors?: Maybe<Array<Maybe<Author>>>;
  cover?: Maybe<Scalars['String']['output']>;
  created_at?: Maybe<Scalars['Int']['output']>;
  id?: Maybe<Scalars['Int']['output']>;
  main_topic?: Maybe<Topic>;
  score: Scalars['Float']['output'];
  slug: Scalars['String']['output'];
  title: Scalars['String']['output'];
  topics?: Maybe<Array<Maybe<Topic>>>;
};

export type SendLinkResult = {
  __typename?: 'SendLinkResult';
  id?: Maybe<Scalars['String']['output']>;
};

export type Shout = {
  __typename?: 'Shout';
  authors?: Maybe<Array<Maybe<Author>>>;
  body: Scalars['String']['output'];
  community: Community;
  cover?: Maybe<Scalars['String']['output']>;
  cover_caption?: Maybe<Scalars['String']['output']>;
  created_at: Scalars['Int']['output'];
  created_by: Author;
  deleted_at?: Maybe<Scalars['Int']['output']>;
  deleted_by?: Maybe<Author>;
  description?: Maybe<Scalars['String']['output']>;
  draft?: Maybe<Draft>;
  featured_at?: Maybe<Scalars['Int']['output']>;
  id: Scalars['Int']['output'];
  lang?: Maybe<Scalars['String']['output']>;
  layout: Scalars['String']['output'];
  lead?: Maybe<Scalars['String']['output']>;
  main_topic?: Maybe<Topic>;
  media?: Maybe<Array<Maybe<MediaItem>>>;
  published_at?: Maybe<Scalars['Int']['output']>;
  score?: Maybe<Scalars['Float']['output']>;
  seo?: Maybe<Scalars['String']['output']>;
  slug: Scalars['String']['output'];
  stat?: Maybe<Stat>;
  subtitle?: Maybe<Scalars['String']['output']>;
  title: Scalars['String']['output'];
  topics?: Maybe<Array<Maybe<Topic>>>;
  updated_at?: Maybe<Scalars['Int']['output']>;
  updated_by?: Maybe<Author>;
  version_of?: Maybe<Shout>;
};

export enum ShoutsOrderBy {
  CommentsCount = 'comments_count',
  LastCommentedAt = 'last_commented_at',
  Rating = 'rating',
  ViewsCount = 'views_count'
}

export type Stat = {
  __typename?: 'Stat';
  commented?: Maybe<Scalars['Int']['output']>;
  comments_count?: Maybe<Scalars['Int']['output']>;
  last_commented_at?: Maybe<Scalars['Int']['output']>;
  rating?: Maybe<Scalars['Int']['output']>;
  viewed?: Maybe<Scalars['Int']['output']>;
  views_count?: Maybe<Scalars['Int']['output']>;
};

export type Topic = {
  __typename?: 'Topic';
  body?: Maybe<Scalars['String']['output']>;
  id: Scalars['Int']['output'];
  is_main?: Maybe<Scalars['Boolean']['output']>;
  oid?: Maybe<Scalars['String']['output']>;
  pic?: Maybe<Scalars['String']['output']>;
  slug: Scalars['String']['output'];
  stat?: Maybe<TopicStat>;
  title?: Maybe<Scalars['String']['output']>;
};

export type TopicInput = {
  body?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['Int']['input']>;
  pic?: InputMaybe<Scalars['String']['input']>;
  slug: Scalars['String']['input'];
  title?: InputMaybe<Scalars['String']['input']>;
};

export type TopicStat = {
  __typename?: 'TopicStat';
  authors: Scalars['Int']['output'];
  comments?: Maybe<Scalars['Int']['output']>;
  followers: Scalars['Int']['output'];
  shouts: Scalars['Int']['output'];
};

export type UnpublishShoutMutationMutationVariables = Exact<{
  shout_id: Scalars['Int']['input'];
}>;


export type UnpublishShoutMutationMutation = { __typename?: 'Mutation', unpublish_shout: { __typename?: 'CommonResult', error?: string | null, shout?: { __typename?: 'Shout', id: number, slug: string, title: string, subtitle?: string | null, published_at?: number | null, featured_at?: number | null, updated_at?: number | null, created_at: number } | null } };

export type CancelEmailChangeMutationVariables = Exact<{ [key: string]: never; }>;


export type CancelEmailChangeMutation = { __typename?: 'Mutation', cancelEmailChange?: { __typename?: 'AuthResult', success?: boolean | null, error?: string | null, author?: { __typename?: 'Author', id: number, name?: string | null, slug: string, user: string, email?: string | null, pic?: string | null, bio?: string | null, links?: Array<string | null> | null } | null } | null };

export type ConfirmEmailChangeMutationVariables = Exact<{
  token: Scalars['String']['input'];
}>;


export type ConfirmEmailChangeMutation = { __typename?: 'Mutation', confirmEmailChange?: { __typename?: 'AuthResult', success?: boolean | null, error?: string | null, author?: { __typename?: 'Author', id: number, name?: string | null, slug: string, user: string, email?: string | null, pic?: string | null, bio?: string | null, links?: Array<string | null> | null } | null } | null };

export type ConfirmEmailMutationVariables = Exact<{
  token: Scalars['String']['input'];
}>;


export type ConfirmEmailMutation = { __typename?: 'Mutation', confirmEmail?: { __typename?: 'AuthResult', token?: string | null, success?: boolean | null, error?: string | null, author?: { __typename?: 'Author', id: number, slug: string, user: string, name?: string | null, pic?: string | null, bio?: string | null, links?: Array<string | null> | null } | null } | null };

export type GetSessionMutationVariables = Exact<{ [key: string]: never; }>;


export type GetSessionMutation = { __typename?: 'Mutation', getSession?: { __typename?: 'AuthResult', token?: string | null, author?: { __typename?: 'Author', id: number, slug: string, user: string, name?: string | null, email?: string | null, email_verified?: boolean | null, pic?: string | null, bio?: string | null, links?: Array<string | null> | null, roles?: Array<string | null> | null } | null } | null };

export type LoginMutationVariables = Exact<{
  email: Scalars['String']['input'];
  password: Scalars['String']['input'];
}>;


export type LoginMutation = { __typename?: 'Mutation', login?: { __typename?: 'AuthResult', token?: string | null, success?: boolean | null, error?: string | null, author?: { __typename?: 'Author', id: number, slug: string, user: string, name?: string | null, pic?: string | null, bio?: string | null, links?: Array<string | null> | null, email?: string | null, email_verified?: boolean | null, roles?: Array<string | null> | null } | null } | null };

export type LogoutMutationVariables = Exact<{ [key: string]: never; }>;


export type LogoutMutation = { __typename?: 'Mutation', logout?: { __typename?: 'ActionResult', success?: boolean | null } | null };

export type RefreshTokenMutationVariables = Exact<{ [key: string]: never; }>;


export type RefreshTokenMutation = { __typename?: 'Mutation', refreshToken?: { __typename?: 'AuthResult', token?: string | null, success?: boolean | null, error?: string | null, author?: { __typename?: 'Author', id: number, slug: string, user: string, name?: string | null, email?: string | null, email_verified?: boolean | null, pic?: string | null, bio?: string | null, links?: Array<string | null> | null, roles?: Array<string | null> | null } | null } | null };

export type RequestPasswordResetMutationVariables = Exact<{
  email: Scalars['String']['input'];
}>;


export type RequestPasswordResetMutation = { __typename?: 'Mutation', requestPasswordReset?: { __typename?: 'ActionResult', success?: boolean | null } | null };

export type ResendVerifyEmailMutationVariables = Exact<{
  email: Scalars['String']['input'];
}>;


export type ResendVerifyEmailMutation = { __typename?: 'Mutation', sendLink?: { __typename?: 'SendLinkResult', id?: string | null } | null };

export type ResetPasswordMutationVariables = Exact<{
  newPassword: Scalars['String']['input'];
  token: Scalars['String']['input'];
}>;


export type ResetPasswordMutation = { __typename?: 'Mutation', resetPassword?: { __typename?: 'ActionResult', success?: boolean | null } | null };

export type RegisterUserMutationVariables = Exact<{
  email: Scalars['String']['input'];
  password: Scalars['String']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
}>;


export type RegisterUserMutation = { __typename?: 'Mutation', registerUser?: { __typename?: 'AuthResult', token?: string | null, success?: boolean | null, error?: string | null, author?: { __typename?: 'Author', id: number, slug: string, user: string, name?: string | null, email?: string | null, pic?: string | null, bio?: string | null, links?: Array<string | null> | null } | null } | null };

export type UpdateAuthorMutationVariables = Exact<{
  profile: ProfileInput;
}>;


export type UpdateAuthorMutation = { __typename?: 'Mutation', update_author: { __typename?: 'CommonResult', error?: string | null, author?: { __typename?: 'Author', id: number, name?: string | null, slug: string, bio?: string | null, about?: string | null, pic?: string | null, links?: Array<string | null> | null } | null } };

export type UpdateSecurityMutationVariables = Exact<{
  email?: InputMaybe<Scalars['String']['input']>;
  old_password?: InputMaybe<Scalars['String']['input']>;
  new_password?: InputMaybe<Scalars['String']['input']>;
}>;


export type UpdateSecurityMutation = { __typename?: 'Mutation', updateSecurity?: { __typename?: 'ActionResult', success?: boolean | null, error?: string | null } | null };

export type AuthorRateMutationVariables = Exact<{
  rated_slug: Scalars['String']['input'];
  value: Scalars['Int']['input'];
}>;


export type AuthorRateMutation = { __typename?: 'Mutation', rate_author: { __typename?: 'CommonResult', error?: string | null } };

export type ProfileUpdateMutationMutationVariables = Exact<{
  profile: ProfileInput;
}>;


export type ProfileUpdateMutationMutation = { __typename?: 'Mutation', update_author: { __typename?: 'CommonResult', error?: string | null, author?: { __typename?: 'Author', id: number, name?: string | null, slug: string, bio?: string | null, about?: string | null, pic?: string | null, links?: Array<string | null> | null, created_at?: number | null, stat?: { __typename?: 'AuthorStat', followers?: number | null, comments?: number | null, shouts?: number | null } | null } | null } };

export type ToggleBookmarkMutationVariables = Exact<{
  slug: Scalars['String']['input'];
}>;


export type ToggleBookmarkMutation = { __typename?: 'Mutation', toggle_bookmark_shout: { __typename?: 'CommonResult', error?: string | null } };

export type CollabInviteAcceptMutationMutationVariables = Exact<{
  invite_id: Scalars['Int']['input'];
}>;


export type CollabInviteAcceptMutationMutation = { __typename?: 'Mutation', accept_invite: { __typename?: 'CommonResult', error?: string | null } };

export type CollabInviteCreateMutationMutationVariables = Exact<{
  author_id: Scalars['Int']['input'];
  slug: Scalars['String']['input'];
}>;


export type CollabInviteCreateMutationMutation = { __typename?: 'Mutation', create_invite: { __typename?: 'CommonResult', error?: string | null } };

export type CollabInviteRejectMutationMutationVariables = Exact<{
  invite_id: Scalars['Int']['input'];
}>;


export type CollabInviteRejectMutationMutation = { __typename?: 'Mutation', reject_invite: { __typename?: 'CommonResult', error?: string | null } };

export type CollabRemoveAuthorMutationMutationVariables = Exact<{
  author_id: Scalars['Int']['input'];
  slug: Scalars['String']['input'];
}>;


export type CollabRemoveAuthorMutationMutation = { __typename?: 'Mutation', remove_author: { __typename?: 'CommonResult', error?: string | null } };

export type CollabRemoveInviteMutationMutationVariables = Exact<{
  invite_id: Scalars['Int']['input'];
}>;


export type CollabRemoveInviteMutationMutation = { __typename?: 'Mutation', remove_invite: { __typename?: 'CommonResult', error?: string | null } };

export type CommunityDestroyMutationMutationVariables = Exact<{
  slug: Scalars['String']['input'];
}>;


export type CommunityDestroyMutationMutation = { __typename?: 'Mutation', delete_community: { __typename?: 'CommonResult', error?: string | null } };

export type CommunityUpdateMutationMutationVariables = Exact<{
  community_input: CommunityInput;
}>;


export type CommunityUpdateMutationMutation = { __typename?: 'Mutation', update_community: { __typename?: 'CommonResult', error?: string | null, community?: { __typename?: 'Community', id: number, slug: string, desc?: string | null, name: string, pic: string, created_at: number, created_by: { __typename?: 'Author', id: number, slug: string, name?: string | null, pic?: string | null } } | null } };

export type CreateDraftFromShoutMutationMutationVariables = Exact<{
  shout_id: Scalars['Int']['input'];
}>;


export type CreateDraftFromShoutMutationMutation = { __typename?: 'Mutation', create_draft_from_shout: { __typename?: 'CommonResult', error?: string | null, draft?: { __typename?: 'Draft', id: number, slug?: string | null, title?: string | null, subtitle?: string | null, lead?: string | null, body?: string | null, layout?: string | null, cover?: string | null, cover_caption?: string | null, seo?: string | null, lang?: string | null, created_at: number, media?: Array<{ __typename?: 'MediaItem', url?: string | null, pic?: string | null, source?: string | null, artist?: string | null, title?: string | null, body?: string | null, date?: string | null, genre?: string | null, lyrics?: string | null } | null> | null, topics?: Array<{ __typename?: 'Topic', id: number, title?: string | null, slug: string } | null> | null, authors?: Array<{ __typename?: 'Author', id: number, name?: string | null, slug: string } | null> | null, shout?: { __typename?: 'Shout', id: number, published_at?: number | null } | null } | null } };

export type CreateDraftMutationMutationVariables = Exact<{
  draft_input: DraftInput;
}>;


export type CreateDraftMutationMutation = { __typename?: 'Mutation', create_draft: { __typename?: 'CommonResult', error?: string | null, draft?: { __typename?: 'Draft', id: number, layout?: string | null } | null } };

export type DeleteDraftMutationMutationVariables = Exact<{
  draft_id: Scalars['Int']['input'];
}>;


export type DeleteDraftMutationMutation = { __typename?: 'Mutation', delete_draft: { __typename?: 'CommonResult', error?: string | null } };

export type PublishDraftMutationMutationVariables = Exact<{
  draft_id: Scalars['Int']['input'];
}>;


export type PublishDraftMutationMutation = { __typename?: 'Mutation', publish_draft: { __typename?: 'CommonResult', error?: string | null, draft?: { __typename?: 'Draft', id: number, slug?: string | null, title?: string | null, subtitle?: string | null, lead?: string | null, body?: string | null, created_at: number, updated_at?: number | null, media?: Array<{ __typename?: 'MediaItem', url?: string | null, pic?: string | null, source?: string | null, artist?: string | null, title?: string | null, body?: string | null, date?: string | null, genre?: string | null, lyrics?: string | null } | null> | null, topics?: Array<{ __typename?: 'Topic', id: number, title?: string | null, slug: string } | null> | null, authors?: Array<{ __typename?: 'Author', id: number, name?: string | null, slug: string } | null> | null } | null } };

export type UpdateDraftMutationMutationVariables = Exact<{
  draft_id: Scalars['Int']['input'];
  draft_input: DraftInput;
}>;


export type UpdateDraftMutationMutation = { __typename?: 'Mutation', update_draft: { __typename?: 'CommonResult', error?: string | null, draft?: { __typename?: 'Draft', id: number, slug?: string | null, title?: string | null, subtitle?: string | null, lead?: string | null, body?: string | null, media?: Array<{ __typename?: 'MediaItem', url?: string | null, pic?: string | null, source?: string | null, artist?: string | null, title?: string | null, body?: string | null, date?: string | null, genre?: string | null, lyrics?: string | null } | null> | null, topics?: Array<{ __typename?: 'Topic', id: number, title?: string | null, slug: string } | null> | null, authors?: Array<{ __typename?: 'Author', id: number, name?: string | null, slug: string } | null> | null } | null } };

export type FollowMutationMutationVariables = Exact<{
  what: FollowingEntity;
  slug: Scalars['String']['input'];
}>;


export type FollowMutationMutation = { __typename?: 'Mutation', follow: { __typename?: 'AuthorFollowsResult', error?: string | null, authors?: Array<{ __typename?: 'Author', id: number, name?: string | null, slug: string, pic?: string | null, bio?: string | null, stat?: { __typename?: 'AuthorStat', followers?: number | null, shouts?: number | null, comments?: number | null } | null } | null> | null, topics?: Array<{ __typename?: 'Topic', body?: string | null, slug: string, stat?: { __typename?: 'TopicStat', shouts: number, authors: number, followers: number } | null } | null> | null } };

export type CreateReactionMutationMutationVariables = Exact<{
  reaction: ReactionInput;
}>;


export type CreateReactionMutationMutation = { __typename?: 'Mutation', create_reaction: { __typename?: 'CommonResult', error?: string | null, reaction?: { __typename?: 'Reaction', id: number, body?: string | null, kind: ReactionKind, created_at: number, reply_to?: number | null, stat?: { __typename?: 'Stat', rating?: number | null } | null, shout: { __typename?: 'Shout', id: number, slug: string }, created_by: { __typename?: 'Author', name?: string | null, slug: string, pic?: string | null } } | null } };

export type DeleteReactionMutationMutationVariables = Exact<{
  reaction_id: Scalars['Int']['input'];
}>;


export type DeleteReactionMutationMutation = { __typename?: 'Mutation', delete_reaction: { __typename?: 'CommonResult', error?: string | null, reaction?: { __typename?: 'Reaction', id: number } | null } };

export type UpdateReactionMutationMutationVariables = Exact<{
  reaction: ReactionInput;
}>;


export type UpdateReactionMutationMutation = { __typename?: 'Mutation', update_reaction: { __typename?: 'CommonResult', error?: string | null, reaction?: { __typename?: 'Reaction', id: number, body?: string | null, kind: ReactionKind, created_at: number, updated_at?: number | null } | null } };

export type UnfollowMutationMutationVariables = Exact<{
  what: FollowingEntity;
  slug: Scalars['String']['input'];
}>;


export type UnfollowMutationMutation = { __typename?: 'Mutation', unfollow: { __typename?: 'AuthorFollowsResult', error?: string | null, authors?: Array<{ __typename?: 'Author', id: number, name?: string | null, slug: string, pic?: string | null, bio?: string | null, stat?: { __typename?: 'AuthorStat', followers?: number | null, shouts?: number | null, comments?: number | null } | null } | null> | null, topics?: Array<{ __typename?: 'Topic', body?: string | null, slug: string, stat?: { __typename?: 'TopicStat', shouts: number, authors: number, followers: number } | null } | null> | null } };

export type LoadShoutQueryQueryVariables = Exact<{
  slug?: InputMaybe<Scalars['String']['input']>;
  shout_id?: InputMaybe<Scalars['Int']['input']>;
}>;


export type LoadShoutQueryQuery = { __typename?: 'Query', get_shout?: { __typename?: 'Shout', id: number, title: string, lead?: string | null, subtitle?: string | null, slug: string, layout: string, cover?: string | null, cover_caption?: string | null, body: string, created_at: number, updated_at?: number | null, published_at?: number | null, featured_at?: number | null, media?: Array<{ __typename?: 'MediaItem', url?: string | null, pic?: string | null, source?: string | null, artist?: string | null, title?: string | null, body?: string | null, date?: string | null, genre?: string | null, lyrics?: string | null } | null> | null, updated_by?: { __typename?: 'Author', id: number, name?: string | null, slug: string, pic?: string | null, created_at?: number | null } | null, topics?: Array<{ __typename?: 'Topic', id: number, title?: string | null, body?: string | null, slug: string, stat?: { __typename?: 'TopicStat', shouts: number, authors: number, followers: number } | null } | null> | null, authors?: Array<{ __typename?: 'Author', id: number, name?: string | null, slug: string, pic?: string | null, created_at?: number | null } | null> | null, stat?: { __typename?: 'Stat', views_count?: number | null, rating?: number | null, comments_count?: number | null } | null } | null };

export type GetMyShoutQueryVariables = Exact<{
  shout_id: Scalars['Int']['input'];
}>;


export type GetMyShoutQuery = { __typename?: 'Query', get_my_shout: { __typename?: 'CommonResult', error?: string | null, shout?: { __typename?: 'Shout', id: number, title: string, lead?: string | null, subtitle?: string | null, slug: string, layout: string, cover?: string | null, cover_caption?: string | null, body: string, created_at: number, updated_at?: number | null, published_at?: number | null, featured_at?: number | null, media?: Array<{ __typename?: 'MediaItem', url?: string | null, pic?: string | null, source?: string | null, artist?: string | null, title?: string | null, body?: string | null, date?: string | null, genre?: string | null, lyrics?: string | null } | null> | null, updated_by?: { __typename?: 'Author', id: number, name?: string | null, slug: string, pic?: string | null, created_at?: number | null } | null, topics?: Array<{ __typename?: 'Topic', id: number, title?: string | null, body?: string | null, slug: string, stat?: { __typename?: 'TopicStat', shouts: number, authors: number, followers: number } | null } | null> | null, authors?: Array<{ __typename?: 'Author', id: number, name?: string | null, slug: string, pic?: string | null, created_at?: number | null } | null> | null } | null } };

export type LoadBookmarkedShoutsQueryQueryVariables = Exact<{
  options?: InputMaybe<LoadShoutsOptions>;
}>;


export type LoadBookmarkedShoutsQueryQuery = { __typename?: 'Query', load_shouts_bookmarked?: Array<{ __typename?: 'Shout', id: number, title: string, lead?: string | null, subtitle?: string | null, slug: string, layout: string, cover?: string | null, cover_caption?: string | null, created_at: number, published_at?: number | null, featured_at?: number | null, main_topic?: { __typename?: 'Topic', id: number, slug: string, title?: string | null } | null, created_by: { __typename?: 'Author', id: number, name?: string | null, slug: string, pic?: string | null, created_at?: number | null }, stat?: { __typename?: 'Stat', views_count?: number | null, rating?: number | null, comments_count?: number | null } | null } | null> | null };

export type LoadShoutsQueryQueryVariables = Exact<{
  options?: InputMaybe<LoadShoutsOptions>;
}>;


export type LoadShoutsQueryQuery = { __typename?: 'Query', load_shouts_by?: Array<{ __typename?: 'Shout', id: number, title: string, lead?: string | null, subtitle?: string | null, slug: string, layout: string, cover?: string | null, created_at: number, published_at?: number | null, featured_at?: number | null, main_topic?: { __typename?: 'Topic', id: number, slug: string, title?: string | null } | null, authors?: Array<{ __typename?: 'Author', id: number, name?: string | null, slug: string, pic?: string | null, created_at?: number | null } | null> | null, stat?: { __typename?: 'Stat', views_count?: number | null, last_commented_at?: number | null, rating?: number | null, comments_count?: number | null } | null } | null> | null };

export type LoadCoauthoredShoutsQueryQueryVariables = Exact<{
  options?: InputMaybe<LoadShoutsOptions>;
}>;


export type LoadCoauthoredShoutsQueryQuery = { __typename?: 'Query', load_shouts_coauthored?: Array<{ __typename?: 'Shout', id: number, title: string, lead?: string | null, subtitle?: string | null, slug: string, layout: string, cover?: string | null, cover_caption?: string | null, created_at: number, published_at?: number | null, featured_at?: number | null, main_topic?: { __typename?: 'Topic', id: number, slug: string, title?: string | null } | null, authors?: Array<{ __typename?: 'Author', id: number, name?: string | null, slug: string, pic?: string | null, created_at?: number | null, bio?: string | null } | null> | null, stat?: { __typename?: 'Stat', views_count?: number | null, last_commented_at?: number | null, rating?: number | null, comments_count?: number | null } | null } | null> | null };

export type LoadDiscussedShoutsQueryQueryVariables = Exact<{
  options?: InputMaybe<LoadShoutsOptions>;
}>;


export type LoadDiscussedShoutsQueryQuery = { __typename?: 'Query', load_shouts_discussed?: Array<{ __typename?: 'Shout', id: number, title: string, lead?: string | null, subtitle?: string | null, slug: string, layout: string, cover?: string | null, cover_caption?: string | null, created_at: number, published_at?: number | null, featured_at?: number | null, main_topic?: { __typename?: 'Topic', id: number, slug: string, title?: string | null } | null, authors?: Array<{ __typename?: 'Author', id: number, name?: string | null, slug: string, pic?: string | null, created_at?: number | null, bio?: string | null } | null> | null, stat?: { __typename?: 'Stat', views_count?: number | null, last_commented_at?: number | null, rating?: number | null, comments_count?: number | null } | null } | null> | null };

export type MyFeedQueryQueryVariables = Exact<{
  options?: InputMaybe<LoadShoutsOptions>;
}>;


export type MyFeedQueryQuery = { __typename?: 'Query', load_shouts_feed?: Array<{ __typename?: 'Shout', id: number, title: string, subtitle?: string | null, slug: string, layout: string, cover?: string | null, created_at: number, published_at?: number | null, featured_at?: number | null, main_topic?: { __typename?: 'Topic', id: number, slug: string, title?: string | null } | null, authors?: Array<{ __typename?: 'Author', id: number, name?: string | null, slug: string, pic?: string | null, created_at?: number | null } | null> | null, stat?: { __typename?: 'Stat', views_count?: number | null, last_commented_at?: number | null, comments_count?: number | null, rating?: number | null } | null } | null> | null };

export type ShoutsFollowedByUserQueryQueryVariables = Exact<{
  slug: Scalars['String']['input'];
  options?: InputMaybe<LoadShoutsOptions>;
}>;


export type ShoutsFollowedByUserQueryQuery = { __typename?: 'Query', load_shouts_followed_by?: Array<{ __typename?: 'Shout', title: string, subtitle?: string | null, layout: string, slug: string, cover?: string | null, created_at: number, published_at?: number | null, featured_at?: number | null, main_topic?: { __typename?: 'Topic', id: number, slug: string, title?: string | null } | null, authors?: Array<{ __typename?: 'Author', id: number, name?: string | null, slug: string, pic?: string | null } | null> | null, stat?: { __typename?: 'Stat', views_count?: number | null, last_commented_at?: number | null, comments_count?: number | null, rating?: number | null } | null } | null> | null };

export type LoadRandomTopShoutsQueryQueryVariables = Exact<{
  options?: InputMaybe<LoadShoutsOptions>;
}>;


export type LoadRandomTopShoutsQueryQuery = { __typename?: 'Query', load_shouts_random_top?: Array<{ __typename?: 'Shout', id: number, title: string, lead?: string | null, subtitle?: string | null, slug: string, layout: string, cover?: string | null, cover_caption?: string | null, created_at: number, published_at?: number | null, featured_at?: number | null, main_topic?: { __typename?: 'Topic', id: number, slug: string, title?: string | null } | null, created_by: { __typename?: 'Author', id: number, name?: string | null, slug: string, pic?: string | null, created_at?: number | null }, stat?: { __typename?: 'Stat', views_count?: number | null, last_commented_at?: number | null, rating?: number | null, comments_count?: number | null } | null } | null> | null };

export type LoadShoutsSearchQueryQueryVariables = Exact<{
  text: Scalars['String']['input'];
  options?: InputMaybe<LoadShoutsOptions>;
}>;


export type LoadShoutsSearchQueryQuery = { __typename?: 'Query', load_shouts_search?: Array<{ __typename?: 'SearchResult', id?: number | null, title: string, slug: string, created_at?: number | null, cover?: string | null, main_topic?: { __typename?: 'Topic', id: number, slug: string, title?: string | null } | null, authors?: Array<{ __typename?: 'Author', slug: string, name?: string | null, pic?: string | null, created_at?: number | null, last_seen?: number | null } | null> | null } | null> | null };

export type LoadUnratedShoutsQueryQueryVariables = Exact<{
  options?: InputMaybe<LoadShoutsOptions>;
}>;


export type LoadUnratedShoutsQueryQuery = { __typename?: 'Query', load_shouts_unrated?: Array<{ __typename?: 'Shout', id: number, title: string, subtitle?: string | null, slug: string, layout: string, cover?: string | null, main_topic?: { __typename?: 'Topic', id: number, slug: string, title?: string | null } | null, created_by: { __typename?: 'Author', id: number, name?: string | null, slug: string, pic?: string | null, created_at?: number | null } } | null> | null };

export type ArticlesMyRatesQueryVariables = Exact<{
  shouts: Array<Scalars['Int']['input']> | Scalars['Int']['input'];
}>;


export type ArticlesMyRatesQuery = { __typename?: 'Query', get_my_rates_shouts?: Array<{ __typename?: 'MyRateShout', shout_id: number, my_rate?: ReactionKind | null } | null> | null };

export type IsEmailUsedQueryVariables = Exact<{
  email: Scalars['String']['input'];
}>;


export type IsEmailUsedQuery = { __typename?: 'Query', isEmailUsed?: boolean | null };

export type GetAuthorByQueryVariables = Exact<{
  slug?: InputMaybe<Scalars['String']['input']>;
  author_id?: InputMaybe<Scalars['Int']['input']>;
}>;


export type GetAuthorByQuery = { __typename?: 'Query', get_author?: { __typename?: 'Author', id: number, slug: string, name?: string | null, bio?: string | null, about?: string | null, pic?: string | null, links?: Array<string | null> | null, created_at?: number | null, last_seen?: number | null, stat?: { __typename?: 'AuthorStat', shouts?: number | null, coauthors?: number | null, followers?: number | null, rating_shouts?: number | null, rating_comments?: number | null, comments?: number | null, replies_count?: number | null, viewed_shouts?: number | null, topics?: number | null } | null } | null };

export type UserFollowingCountersQueryQueryVariables = Exact<{
  slug?: InputMaybe<Scalars['String']['input']>;
  author_id?: InputMaybe<Scalars['Int']['input']>;
}>;


export type UserFollowingCountersQueryQuery = { __typename?: 'Query', get_author_followers?: Array<{ __typename?: 'Author', id: number, slug: string, name?: string | null, pic?: string | null, bio?: string | null, created_at?: number | null, stat?: { __typename?: 'AuthorStat', shouts?: number | null, topics?: number | null } | null } | null> | null };

export type GetAuthorFollowsAuthorsQueryVariables = Exact<{
  slug?: InputMaybe<Scalars['String']['input']>;
  user?: InputMaybe<Scalars['String']['input']>;
  author_id?: InputMaybe<Scalars['Int']['input']>;
}>;


export type GetAuthorFollowsAuthorsQuery = { __typename?: 'Query', get_author_follows_authors?: Array<{ __typename?: 'Author', id: number, slug: string, name?: string | null, pic?: string | null, bio?: string | null, created_at?: number | null, stat?: { __typename?: 'AuthorStat', shouts?: number | null, coauthors?: number | null, followers?: number | null, topics?: number | null } | null } | null> | null };

export type GetAuthorFollowsTopicsQueryVariables = Exact<{
  slug?: InputMaybe<Scalars['String']['input']>;
  user?: InputMaybe<Scalars['String']['input']>;
  author_id?: InputMaybe<Scalars['Int']['input']>;
}>;


export type GetAuthorFollowsTopicsQuery = { __typename?: 'Query', get_author_follows_topics?: Array<{ __typename?: 'Topic', id: number, slug: string, title?: string | null, stat?: { __typename?: 'TopicStat', shouts: number, authors: number, followers: number } | null } | null> | null };

export type GetAuthorFollowsQueryVariables = Exact<{
  slug?: InputMaybe<Scalars['String']['input']>;
  user?: InputMaybe<Scalars['String']['input']>;
  author_id?: InputMaybe<Scalars['Int']['input']>;
}>;


export type GetAuthorFollowsQuery = { __typename?: 'Query', get_author_follows: { __typename?: 'CommonResult', error?: string | null, authors?: Array<{ __typename?: 'Author', id: number, slug: string, name?: string | null, pic?: string | null, bio?: string | null, created_at?: number | null, stat?: { __typename?: 'AuthorStat', shouts?: number | null, coauthors?: number | null, followers?: number | null } | null } | null> | null, topics?: Array<{ __typename?: 'Topic', id: number, slug: string, title?: string | null, stat?: { __typename?: 'TopicStat', shouts: number, authors: number, followers: number } | null } | null> | null, shouts?: Array<{ __typename?: 'Shout', id: number, slug: string, title: string } | null> | null } };

export type GetAuthorsAllQueryQueryVariables = Exact<{ [key: string]: never; }>;


export type GetAuthorsAllQueryQuery = { __typename?: 'Query', get_authors_all?: Array<{ __typename?: 'Author', id: number, slug: string, name?: string | null, bio?: string | null, pic?: string | null, created_at?: number | null } | null> | null };

export type LoadAuthorsByQueryVariables = Exact<{
  by: AuthorsBy;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
}>;


export type LoadAuthorsByQuery = { __typename?: 'Query', load_authors_by?: Array<{ __typename?: 'Author', id: number, slug: string, name?: string | null, bio?: string | null, pic?: string | null, created_at?: number | null, stat?: { __typename?: 'AuthorStat', shouts?: number | null, coauthors?: number | null, followers?: number | null, replies_count?: number | null, viewed_shouts?: number | null, comments?: number | null, rating_shouts?: number | null, rating_comments?: number | null, topics?: number | null } | null } | null> | null };

export type LoadAuthorsSearchQueryVariables = Exact<{
  text: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
}>;


export type LoadAuthorsSearchQuery = { __typename?: 'Query', load_authors_search?: Array<{ __typename?: 'Author', id: number, slug: string, name?: string | null, bio?: string | null, pic?: string | null, created_at?: number | null, stat?: { __typename?: 'AuthorStat', shouts?: number | null, coauthors?: number | null, followers?: number | null, rating_shouts?: number | null, rating_comments?: number | null, comments?: number | null, replies_count?: number | null, viewed_shouts?: number | null, topics?: number | null } | null } | null> | null };

export type LoadCommentsBranchQueryVariables = Exact<{
  shout: Scalars['Int']['input'];
  parentId?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  sort?: InputMaybe<ReactionSort>;
  childrenLimit?: InputMaybe<Scalars['Int']['input']>;
  childrenOffset?: InputMaybe<Scalars['Int']['input']>;
}>;


export type LoadCommentsBranchQuery = { __typename?: 'Query', load_comments_branch?: Array<{ __typename?: 'Reaction', id: number, body?: string | null, created_at: number, kind: ReactionKind, reply_to?: number | null, created_by: { __typename?: 'Author', id: number, name?: string | null, slug: string, pic?: string | null }, stat?: { __typename?: 'Stat', rating?: number | null, comments_count?: number | null } | null, shout: { __typename?: 'Shout', id: number, slug: string }, first_replies?: Array<{ __typename?: 'Reaction', id: number, body?: string | null, created_at: number, kind: ReactionKind, reply_to?: number | null, created_by: { __typename?: 'Author', id: number, name?: string | null, slug: string, pic?: string | null }, stat?: { __typename?: 'Stat', rating?: number | null, comments_count?: number | null } | null, shout: { __typename?: 'Shout', id: number, slug: string } } | null> | null } | null> | null };

export type CommentsMyRatesQueryVariables = Exact<{
  comments: Array<Scalars['Int']['input']> | Scalars['Int']['input'];
}>;


export type CommentsMyRatesQuery = { __typename?: 'Query', get_my_rates_comments?: Array<{ __typename?: 'MyRateComment', comment_id: number, my_rate?: ReactionKind | null } | null> | null };

export type LoadCommunitiesFollowedByQueryVariables = Exact<{
  slug?: InputMaybe<Scalars['String']['input']>;
  author_id?: InputMaybe<Scalars['Int']['input']>;
}>;


export type LoadCommunitiesFollowedByQuery = { __typename?: 'Query', get_communities_by_author?: Array<{ __typename?: 'Community', id: number, slug: string, name: string, pic: string, stat?: { __typename?: 'CommunityStat', shouts: number, followers: number, authors: number } | null } | null> | null };

export type LoadDraftsQueryQueryVariables = Exact<{ [key: string]: never; }>;


export type LoadDraftsQueryQuery = { __typename?: 'Query', load_drafts: { __typename?: 'CommonResult', drafts?: Array<{ __typename?: 'Draft', id: number, title?: string | null, lead?: string | null, subtitle?: string | null, slug?: string | null, layout?: string | null, cover?: string | null, cover_caption?: string | null, body?: string | null, created_at: number, updated_at?: number | null, media?: Array<{ __typename?: 'MediaItem', url?: string | null, pic?: string | null, source?: string | null, artist?: string | null, title?: string | null, body?: string | null, date?: string | null, genre?: string | null, lyrics?: string | null } | null> | null, topics?: Array<{ __typename?: 'Topic', id: number, title?: string | null, slug: string } | null> | null, authors?: Array<{ __typename?: 'Author', id: number, name?: string | null, slug: string, pic?: string | null } | null> | null, shout?: { __typename?: 'Shout', id: number, slug: string, published_at?: number | null } | null } | null> | null } };

export type LoadReactionsQueryVariables = Exact<{
  by: ReactionBy;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
}>;


export type LoadReactionsQuery = { __typename?: 'Query', load_reactions_by?: Array<{ __typename?: 'Reaction', id: number, kind: ReactionKind, body?: string | null, reply_to?: number | null, created_at: number, deleted_at?: number | null, updated_at?: number | null, shout: { __typename?: 'Shout', id: number, slug: string, title: string }, created_by: { __typename?: 'Author', name?: string | null, slug: string, pic?: string | null, created_at?: number | null }, stat?: { __typename?: 'Stat', rating?: number | null } | null } | null> | null };

export type TopicAuthorsQueryQueryVariables = Exact<{
  slug: Scalars['String']['input'];
}>;


export type TopicAuthorsQueryQuery = { __typename?: 'Query', get_topic_authors?: Array<{ __typename?: 'Author', id: number, slug: string, name?: string | null, bio?: string | null, about?: string | null, pic?: string | null, links?: Array<string | null> | null, created_at?: number | null, last_seen?: number | null, stat?: { __typename?: 'AuthorStat', shouts?: number | null, coauthors?: number | null, followers?: number | null, rating_shouts?: number | null, rating_comments?: number | null, comments?: number | null } | null } | null> | null };

export type TopicBySlugQueryQueryVariables = Exact<{
  slug: Scalars['String']['input'];
}>;


export type TopicBySlugQueryQuery = { __typename?: 'Query', get_topic?: { __typename?: 'Topic', title?: string | null, body?: string | null, slug: string, pic?: string | null, stat?: { __typename?: 'TopicStat', shouts: number, authors: number, followers: number } | null } | null };

export type TopicFollowersQueryQueryVariables = Exact<{
  slug?: InputMaybe<Scalars['String']['input']>;
}>;


export type TopicFollowersQueryQuery = { __typename?: 'Query', get_topic_followers?: Array<{ __typename?: 'Author', id: number, slug: string, name?: string | null, bio?: string | null, about?: string | null, pic?: string | null, links?: Array<string | null> | null, created_at?: number | null, last_seen?: number | null, stat?: { __typename?: 'AuthorStat', shouts?: number | null, coauthors?: number | null, followers?: number | null, rating_shouts?: number | null, rating_comments?: number | null, comments?: number | null } | null } | null> | null };

export type TopicsAllQueryQueryVariables = Exact<{ [key: string]: never; }>;


export type TopicsAllQueryQuery = { __typename?: 'Query', get_topics_all?: Array<{ __typename?: 'Topic', id: number, title?: string | null, body?: string | null, slug: string, pic?: string | null, stat?: { __typename?: 'TopicStat', shouts: number, authors: number, followers: number, comments?: number | null } | null } | null> | null };

export type TopicsByCommunityQueryQueryVariables = Exact<{
  community_id: Scalars['Int']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
}>;


export type TopicsByCommunityQueryQuery = { __typename?: 'Query', get_topics_by_community?: Array<{ __typename?: 'Topic', id: number, title?: string | null, body?: string | null, slug: string, pic?: string | null, stat?: { __typename?: 'TopicStat', shouts: number, authors: number, followers: number, comments?: number | null } | null } | null> | null };

export type LoadTopicsFollowedByQueryVariables = Exact<{
  slug?: InputMaybe<Scalars['String']['input']>;
  user?: InputMaybe<Scalars['String']['input']>;
  author_id?: InputMaybe<Scalars['Int']['input']>;
}>;


export type LoadTopicsFollowedByQuery = { __typename?: 'Query', get_topics_by_author?: Array<{ __typename?: 'Topic', id: number, slug: string, title?: string | null, body?: string | null, pic?: string | null, stat?: { __typename?: 'TopicStat', shouts: number, followers: number, authors: number } | null } | null> | null };


export const UnpublishShoutMutationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UnpublishShoutMutation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"shout_id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"unpublish_shout"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"shout_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"shout_id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"}},{"kind":"Field","name":{"kind":"Name","value":"shout"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"subtitle"}},{"kind":"Field","name":{"kind":"Name","value":"published_at"}},{"kind":"Field","name":{"kind":"Name","value":"featured_at"}},{"kind":"Field","name":{"kind":"Name","value":"updated_at"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}}]}}]}}]} as unknown as DocumentNode<UnpublishShoutMutationMutation, UnpublishShoutMutationMutationVariables>;
export const CancelEmailChangeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CancelEmailChange"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cancelEmailChange"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"error"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"user"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"bio"}},{"kind":"Field","name":{"kind":"Name","value":"links"}}]}}]}}]}}]} as unknown as DocumentNode<CancelEmailChangeMutation, CancelEmailChangeMutationVariables>;
export const ConfirmEmailChangeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ConfirmEmailChange"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"token"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"confirmEmailChange"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"token"},"value":{"kind":"Variable","name":{"kind":"Name","value":"token"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"error"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"user"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"bio"}},{"kind":"Field","name":{"kind":"Name","value":"links"}}]}}]}}]}}]} as unknown as DocumentNode<ConfirmEmailChangeMutation, ConfirmEmailChangeMutationVariables>;
export const ConfirmEmailDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ConfirmEmail"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"token"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"confirmEmail"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"token"},"value":{"kind":"Variable","name":{"kind":"Name","value":"token"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"token"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"user"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"bio"}},{"kind":"Field","name":{"kind":"Name","value":"links"}}]}},{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"error"}}]}}]}}]} as unknown as DocumentNode<ConfirmEmailMutation, ConfirmEmailMutationVariables>;
export const GetSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"GetSession"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getSession"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"user"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"email_verified"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"bio"}},{"kind":"Field","name":{"kind":"Name","value":"links"}},{"kind":"Field","name":{"kind":"Name","value":"roles"}}]}},{"kind":"Field","name":{"kind":"Name","value":"token"}}]}}]}}]} as unknown as DocumentNode<GetSessionMutation, GetSessionMutationVariables>;
export const LoginDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"Login"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"email"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"password"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"login"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"email"},"value":{"kind":"Variable","name":{"kind":"Name","value":"email"}}},{"kind":"Argument","name":{"kind":"Name","value":"password"},"value":{"kind":"Variable","name":{"kind":"Name","value":"password"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"token"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"user"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"bio"}},{"kind":"Field","name":{"kind":"Name","value":"links"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"email_verified"}},{"kind":"Field","name":{"kind":"Name","value":"roles"}}]}},{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"error"}}]}}]}}]} as unknown as DocumentNode<LoginMutation, LoginMutationVariables>;
export const LogoutDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"Logout"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"logout"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}}]}}]}}]} as unknown as DocumentNode<LogoutMutation, LogoutMutationVariables>;
export const RefreshTokenDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RefreshToken"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"refreshToken"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"token"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"user"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"email_verified"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"bio"}},{"kind":"Field","name":{"kind":"Name","value":"links"}},{"kind":"Field","name":{"kind":"Name","value":"roles"}}]}},{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"error"}}]}}]}}]} as unknown as DocumentNode<RefreshTokenMutation, RefreshTokenMutationVariables>;
export const RequestPasswordResetDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RequestPasswordReset"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"email"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"requestPasswordReset"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"email"},"value":{"kind":"Variable","name":{"kind":"Name","value":"email"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}}]}}]}}]} as unknown as DocumentNode<RequestPasswordResetMutation, RequestPasswordResetMutationVariables>;
export const ResendVerifyEmailDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ResendVerifyEmail"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"email"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sendLink"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"email"},"value":{"kind":"Variable","name":{"kind":"Name","value":"email"}}},{"kind":"Argument","name":{"kind":"Name","value":"template"},"value":{"kind":"StringValue","value":"verification","block":false}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<ResendVerifyEmailMutation, ResendVerifyEmailMutationVariables>;
export const ResetPasswordDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ResetPassword"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"newPassword"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"token"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"resetPassword"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"newPassword"},"value":{"kind":"Variable","name":{"kind":"Name","value":"newPassword"}}},{"kind":"Argument","name":{"kind":"Name","value":"token"},"value":{"kind":"Variable","name":{"kind":"Name","value":"token"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}}]}}]}}]} as unknown as DocumentNode<ResetPasswordMutation, ResetPasswordMutationVariables>;
export const RegisterUserDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RegisterUser"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"email"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"password"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"registerUser"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"email"},"value":{"kind":"Variable","name":{"kind":"Name","value":"email"}}},{"kind":"Argument","name":{"kind":"Name","value":"password"},"value":{"kind":"Variable","name":{"kind":"Name","value":"password"}}},{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"token"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"user"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"bio"}},{"kind":"Field","name":{"kind":"Name","value":"links"}}]}},{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"error"}}]}}]}}]} as unknown as DocumentNode<RegisterUserMutation, RegisterUserMutationVariables>;
export const UpdateAuthorDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateAuthor"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"profile"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ProfileInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"update_author"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"profile"},"value":{"kind":"Variable","name":{"kind":"Name","value":"profile"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"bio"}},{"kind":"Field","name":{"kind":"Name","value":"about"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"links"}}]}}]}}]}}]} as unknown as DocumentNode<UpdateAuthorMutation, UpdateAuthorMutationVariables>;
export const UpdateSecurityDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateSecurity"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"email"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"old_password"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"new_password"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateSecurity"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"email"},"value":{"kind":"Variable","name":{"kind":"Name","value":"email"}}},{"kind":"Argument","name":{"kind":"Name","value":"old_password"},"value":{"kind":"Variable","name":{"kind":"Name","value":"old_password"}}},{"kind":"Argument","name":{"kind":"Name","value":"new_password"},"value":{"kind":"Variable","name":{"kind":"Name","value":"new_password"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"error"}}]}}]}}]} as unknown as DocumentNode<UpdateSecurityMutation, UpdateSecurityMutationVariables>;
export const AuthorRateDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AuthorRate"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"rated_slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"value"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rate_author"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"rated_slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"rated_slug"}}},{"kind":"Argument","name":{"kind":"Name","value":"value"},"value":{"kind":"Variable","name":{"kind":"Name","value":"value"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"}}]}}]}}]} as unknown as DocumentNode<AuthorRateMutation, AuthorRateMutationVariables>;
export const ProfileUpdateMutationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ProfileUpdateMutation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"profile"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ProfileInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"update_author"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"profile"},"value":{"kind":"Variable","name":{"kind":"Name","value":"profile"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"bio"}},{"kind":"Field","name":{"kind":"Name","value":"about"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"links"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"stat"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"followers"}},{"kind":"Field","name":{"kind":"Name","value":"comments"}},{"kind":"Field","name":{"kind":"Name","value":"shouts"}}]}}]}}]}}]}}]} as unknown as DocumentNode<ProfileUpdateMutationMutation, ProfileUpdateMutationMutationVariables>;
export const ToggleBookmarkDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ToggleBookmark"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"toggle_bookmark_shout"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"}}]}}]}}]} as unknown as DocumentNode<ToggleBookmarkMutation, ToggleBookmarkMutationVariables>;
export const CollabInviteAcceptMutationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CollabInviteAcceptMutation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"invite_id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"accept_invite"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"invite_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"invite_id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"}}]}}]}}]} as unknown as DocumentNode<CollabInviteAcceptMutationMutation, CollabInviteAcceptMutationMutationVariables>;
export const CollabInviteCreateMutationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CollabInviteCreateMutation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"author_id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"create_invite"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"author_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"author_id"}}},{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"}}]}}]}}]} as unknown as DocumentNode<CollabInviteCreateMutationMutation, CollabInviteCreateMutationMutationVariables>;
export const CollabInviteRejectMutationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CollabInviteRejectMutation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"invite_id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"reject_invite"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"invite_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"invite_id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"}}]}}]}}]} as unknown as DocumentNode<CollabInviteRejectMutationMutation, CollabInviteRejectMutationMutationVariables>;
export const CollabRemoveAuthorMutationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CollabRemoveAuthorMutation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"author_id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"remove_author"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"author_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"author_id"}}},{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"}}]}}]}}]} as unknown as DocumentNode<CollabRemoveAuthorMutationMutation, CollabRemoveAuthorMutationMutationVariables>;
export const CollabRemoveInviteMutationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CollabRemoveInviteMutation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"invite_id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"remove_invite"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"invite_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"invite_id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"}}]}}]}}]} as unknown as DocumentNode<CollabRemoveInviteMutationMutation, CollabRemoveInviteMutationMutationVariables>;
export const CommunityDestroyMutationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CommunityDestroyMutation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"delete_community"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"}}]}}]}}]} as unknown as DocumentNode<CommunityDestroyMutationMutation, CommunityDestroyMutationMutationVariables>;
export const CommunityUpdateMutationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CommunityUpdateMutation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"community_input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CommunityInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"update_community"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"community_input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"community_input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"}},{"kind":"Field","name":{"kind":"Name","value":"community"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"desc"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"created_by"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}}]}}]}}]}}]}}]} as unknown as DocumentNode<CommunityUpdateMutationMutation, CommunityUpdateMutationMutationVariables>;
export const CreateDraftFromShoutMutationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateDraftFromShoutMutation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"shout_id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"create_draft_from_shout"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"shout_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"shout_id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"}},{"kind":"Field","name":{"kind":"Name","value":"draft"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"subtitle"}},{"kind":"Field","name":{"kind":"Name","value":"lead"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"media"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"artist"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"genre"}},{"kind":"Field","name":{"kind":"Name","value":"lyrics"}}]}},{"kind":"Field","name":{"kind":"Name","value":"topics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}}]}},{"kind":"Field","name":{"kind":"Name","value":"authors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}}]}},{"kind":"Field","name":{"kind":"Name","value":"layout"}},{"kind":"Field","name":{"kind":"Name","value":"shout"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"published_at"}}]}},{"kind":"Field","name":{"kind":"Name","value":"cover"}},{"kind":"Field","name":{"kind":"Name","value":"cover_caption"}},{"kind":"Field","name":{"kind":"Name","value":"seo"}},{"kind":"Field","name":{"kind":"Name","value":"lang"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}}]}}]}}]} as unknown as DocumentNode<CreateDraftFromShoutMutationMutation, CreateDraftFromShoutMutationMutationVariables>;
export const CreateDraftMutationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateDraftMutation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"draft_input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"DraftInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"create_draft"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"draft_input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"draft_input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"}},{"kind":"Field","name":{"kind":"Name","value":"draft"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"layout"}}]}}]}}]}}]} as unknown as DocumentNode<CreateDraftMutationMutation, CreateDraftMutationMutationVariables>;
export const DeleteDraftMutationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteDraftMutation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"draft_id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"delete_draft"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"draft_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"draft_id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"}}]}}]}}]} as unknown as DocumentNode<DeleteDraftMutationMutation, DeleteDraftMutationMutationVariables>;
export const PublishDraftMutationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"PublishDraftMutation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"draft_id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"publish_draft"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"draft_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"draft_id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"}},{"kind":"Field","name":{"kind":"Name","value":"draft"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"subtitle"}},{"kind":"Field","name":{"kind":"Name","value":"lead"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"media"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"artist"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"genre"}},{"kind":"Field","name":{"kind":"Name","value":"lyrics"}}]}},{"kind":"Field","name":{"kind":"Name","value":"topics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}}]}},{"kind":"Field","name":{"kind":"Name","value":"authors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}}]}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"updated_at"}}]}}]}}]}}]} as unknown as DocumentNode<PublishDraftMutationMutation, PublishDraftMutationMutationVariables>;
export const UpdateDraftMutationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateDraftMutation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"draft_id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"draft_input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"DraftInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"update_draft"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"draft_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"draft_id"}}},{"kind":"Argument","name":{"kind":"Name","value":"draft_input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"draft_input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"}},{"kind":"Field","name":{"kind":"Name","value":"draft"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"subtitle"}},{"kind":"Field","name":{"kind":"Name","value":"lead"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"media"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"artist"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"genre"}},{"kind":"Field","name":{"kind":"Name","value":"lyrics"}}]}},{"kind":"Field","name":{"kind":"Name","value":"topics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}}]}},{"kind":"Field","name":{"kind":"Name","value":"authors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}}]}}]}}]}}]}}]} as unknown as DocumentNode<UpdateDraftMutationMutation, UpdateDraftMutationMutationVariables>;
export const FollowMutationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"FollowMutation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"what"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"FollowingEntity"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"follow"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"what"},"value":{"kind":"Variable","name":{"kind":"Name","value":"what"}}},{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"}},{"kind":"Field","name":{"kind":"Name","value":"authors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"bio"}},{"kind":"Field","name":{"kind":"Name","value":"stat"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"followers"}},{"kind":"Field","name":{"kind":"Name","value":"shouts"}},{"kind":"Field","name":{"kind":"Name","value":"comments"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"topics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"stat"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"shouts"}},{"kind":"Field","name":{"kind":"Name","value":"authors"}},{"kind":"Field","name":{"kind":"Name","value":"followers"}}]}}]}}]}}]}}]} as unknown as DocumentNode<FollowMutationMutation, FollowMutationMutationVariables>;
export const CreateReactionMutationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateReactionMutation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"reaction"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ReactionInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"create_reaction"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"reaction"},"value":{"kind":"Variable","name":{"kind":"Name","value":"reaction"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"}},{"kind":"Field","name":{"kind":"Name","value":"reaction"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"reply_to"}},{"kind":"Field","name":{"kind":"Name","value":"stat"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rating"}}]}},{"kind":"Field","name":{"kind":"Name","value":"shout"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}}]}},{"kind":"Field","name":{"kind":"Name","value":"created_by"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}}]}}]}}]}}]}}]} as unknown as DocumentNode<CreateReactionMutationMutation, CreateReactionMutationMutationVariables>;
export const DeleteReactionMutationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteReactionMutation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"reaction_id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"delete_reaction"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"reaction_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"reaction_id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"}},{"kind":"Field","name":{"kind":"Name","value":"reaction"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]} as unknown as DocumentNode<DeleteReactionMutationMutation, DeleteReactionMutationMutationVariables>;
export const UpdateReactionMutationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateReactionMutation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"reaction"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ReactionInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"update_reaction"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"reaction"},"value":{"kind":"Variable","name":{"kind":"Name","value":"reaction"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"}},{"kind":"Field","name":{"kind":"Name","value":"reaction"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"updated_at"}}]}}]}}]}}]} as unknown as DocumentNode<UpdateReactionMutationMutation, UpdateReactionMutationMutationVariables>;
export const UnfollowMutationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UnfollowMutation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"what"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"FollowingEntity"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"unfollow"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"what"},"value":{"kind":"Variable","name":{"kind":"Name","value":"what"}}},{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"}},{"kind":"Field","name":{"kind":"Name","value":"authors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"bio"}},{"kind":"Field","name":{"kind":"Name","value":"stat"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"followers"}},{"kind":"Field","name":{"kind":"Name","value":"shouts"}},{"kind":"Field","name":{"kind":"Name","value":"comments"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"topics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"stat"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"shouts"}},{"kind":"Field","name":{"kind":"Name","value":"authors"}},{"kind":"Field","name":{"kind":"Name","value":"followers"}}]}}]}}]}}]}}]} as unknown as DocumentNode<UnfollowMutationMutation, UnfollowMutationMutationVariables>;
export const LoadShoutQueryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"LoadShoutQuery"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"shout_id"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"get_shout"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}},{"kind":"Argument","name":{"kind":"Name","value":"shout_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"shout_id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"lead"}},{"kind":"Field","name":{"kind":"Name","value":"subtitle"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"layout"}},{"kind":"Field","name":{"kind":"Name","value":"cover"}},{"kind":"Field","name":{"kind":"Name","value":"cover_caption"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"media"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"artist"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"genre"}},{"kind":"Field","name":{"kind":"Name","value":"lyrics"}}]}},{"kind":"Field","name":{"kind":"Name","value":"updated_by"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}},{"kind":"Field","name":{"kind":"Name","value":"topics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"stat"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"shouts"}},{"kind":"Field","name":{"kind":"Name","value":"authors"}},{"kind":"Field","name":{"kind":"Name","value":"followers"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"authors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"updated_at"}},{"kind":"Field","name":{"kind":"Name","value":"published_at"}},{"kind":"Field","name":{"kind":"Name","value":"featured_at"}},{"kind":"Field","name":{"kind":"Name","value":"stat"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"views_count"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"comments_count"}}]}}]}}]}}]} as unknown as DocumentNode<LoadShoutQueryQuery, LoadShoutQueryQueryVariables>;
export const GetMyShoutDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetMyShout"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"shout_id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"get_my_shout"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"shout_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"shout_id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"}},{"kind":"Field","name":{"kind":"Name","value":"shout"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"lead"}},{"kind":"Field","name":{"kind":"Name","value":"subtitle"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"layout"}},{"kind":"Field","name":{"kind":"Name","value":"cover"}},{"kind":"Field","name":{"kind":"Name","value":"cover_caption"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"media"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"artist"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"genre"}},{"kind":"Field","name":{"kind":"Name","value":"lyrics"}}]}},{"kind":"Field","name":{"kind":"Name","value":"updated_by"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}},{"kind":"Field","name":{"kind":"Name","value":"topics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"stat"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"shouts"}},{"kind":"Field","name":{"kind":"Name","value":"authors"}},{"kind":"Field","name":{"kind":"Name","value":"followers"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"authors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"updated_at"}},{"kind":"Field","name":{"kind":"Name","value":"published_at"}},{"kind":"Field","name":{"kind":"Name","value":"featured_at"}}]}}]}}]}}]} as unknown as DocumentNode<GetMyShoutQuery, GetMyShoutQueryVariables>;
export const LoadBookmarkedShoutsQueryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"LoadBookmarkedShoutsQuery"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"options"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"LoadShoutsOptions"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"load_shouts_bookmarked"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"options"},"value":{"kind":"Variable","name":{"kind":"Name","value":"options"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"lead"}},{"kind":"Field","name":{"kind":"Name","value":"subtitle"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"layout"}},{"kind":"Field","name":{"kind":"Name","value":"cover"}},{"kind":"Field","name":{"kind":"Name","value":"cover_caption"}},{"kind":"Field","name":{"kind":"Name","value":"main_topic"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}},{"kind":"Field","name":{"kind":"Name","value":"created_by"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"published_at"}},{"kind":"Field","name":{"kind":"Name","value":"featured_at"}},{"kind":"Field","name":{"kind":"Name","value":"stat"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"views_count"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"comments_count"}}]}}]}}]}}]} as unknown as DocumentNode<LoadBookmarkedShoutsQueryQuery, LoadBookmarkedShoutsQueryQueryVariables>;
export const LoadShoutsQueryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"LoadShoutsQuery"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"options"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"LoadShoutsOptions"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"load_shouts_by"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"options"},"value":{"kind":"Variable","name":{"kind":"Name","value":"options"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"lead"}},{"kind":"Field","name":{"kind":"Name","value":"subtitle"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"layout"}},{"kind":"Field","name":{"kind":"Name","value":"cover"}},{"kind":"Field","name":{"kind":"Name","value":"lead"}},{"kind":"Field","name":{"kind":"Name","value":"main_topic"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}},{"kind":"Field","name":{"kind":"Name","value":"authors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"published_at"}},{"kind":"Field","name":{"kind":"Name","value":"featured_at"}},{"kind":"Field","name":{"kind":"Name","value":"stat"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"views_count"}},{"kind":"Field","name":{"kind":"Name","value":"last_commented_at"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"comments_count"}}]}}]}}]}}]} as unknown as DocumentNode<LoadShoutsQueryQuery, LoadShoutsQueryQueryVariables>;
export const LoadCoauthoredShoutsQueryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"LoadCoauthoredShoutsQuery"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"options"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"LoadShoutsOptions"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"load_shouts_coauthored"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"options"},"value":{"kind":"Variable","name":{"kind":"Name","value":"options"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"lead"}},{"kind":"Field","name":{"kind":"Name","value":"subtitle"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"layout"}},{"kind":"Field","name":{"kind":"Name","value":"cover"}},{"kind":"Field","name":{"kind":"Name","value":"cover_caption"}},{"kind":"Field","name":{"kind":"Name","value":"main_topic"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}},{"kind":"Field","name":{"kind":"Name","value":"authors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"bio"}}]}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"published_at"}},{"kind":"Field","name":{"kind":"Name","value":"featured_at"}},{"kind":"Field","name":{"kind":"Name","value":"stat"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"views_count"}},{"kind":"Field","name":{"kind":"Name","value":"last_commented_at"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"comments_count"}}]}}]}}]}}]} as unknown as DocumentNode<LoadCoauthoredShoutsQueryQuery, LoadCoauthoredShoutsQueryQueryVariables>;
export const LoadDiscussedShoutsQueryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"LoadDiscussedShoutsQuery"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"options"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"LoadShoutsOptions"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"load_shouts_discussed"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"options"},"value":{"kind":"Variable","name":{"kind":"Name","value":"options"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"lead"}},{"kind":"Field","name":{"kind":"Name","value":"subtitle"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"layout"}},{"kind":"Field","name":{"kind":"Name","value":"cover"}},{"kind":"Field","name":{"kind":"Name","value":"cover_caption"}},{"kind":"Field","name":{"kind":"Name","value":"main_topic"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}},{"kind":"Field","name":{"kind":"Name","value":"authors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"bio"}}]}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"published_at"}},{"kind":"Field","name":{"kind":"Name","value":"featured_at"}},{"kind":"Field","name":{"kind":"Name","value":"stat"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"views_count"}},{"kind":"Field","name":{"kind":"Name","value":"last_commented_at"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"comments_count"}}]}}]}}]}}]} as unknown as DocumentNode<LoadDiscussedShoutsQueryQuery, LoadDiscussedShoutsQueryQueryVariables>;
export const MyFeedQueryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MyFeedQuery"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"options"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"LoadShoutsOptions"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"load_shouts_feed"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"options"},"value":{"kind":"Variable","name":{"kind":"Name","value":"options"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"subtitle"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"layout"}},{"kind":"Field","name":{"kind":"Name","value":"cover"}},{"kind":"Field","name":{"kind":"Name","value":"main_topic"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}},{"kind":"Field","name":{"kind":"Name","value":"authors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"published_at"}},{"kind":"Field","name":{"kind":"Name","value":"featured_at"}},{"kind":"Field","name":{"kind":"Name","value":"stat"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"views_count"}},{"kind":"Field","name":{"kind":"Name","value":"last_commented_at"}},{"kind":"Field","name":{"kind":"Name","value":"comments_count"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}}]}}]}}]}}]} as unknown as DocumentNode<MyFeedQueryQuery, MyFeedQueryQueryVariables>;
export const ShoutsFollowedByUserQueryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ShoutsFollowedByUserQuery"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"options"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"LoadShoutsOptions"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"load_shouts_followed_by"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}},{"kind":"Argument","name":{"kind":"Name","value":"options"},"value":{"kind":"Variable","name":{"kind":"Name","value":"options"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"subtitle"}},{"kind":"Field","name":{"kind":"Name","value":"layout"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"cover"}},{"kind":"Field","name":{"kind":"Name","value":"main_topic"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}},{"kind":"Field","name":{"kind":"Name","value":"authors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}}]}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"published_at"}},{"kind":"Field","name":{"kind":"Name","value":"featured_at"}},{"kind":"Field","name":{"kind":"Name","value":"stat"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"views_count"}},{"kind":"Field","name":{"kind":"Name","value":"last_commented_at"}},{"kind":"Field","name":{"kind":"Name","value":"comments_count"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}}]}}]}}]}}]} as unknown as DocumentNode<ShoutsFollowedByUserQueryQuery, ShoutsFollowedByUserQueryQueryVariables>;
export const LoadRandomTopShoutsQueryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"LoadRandomTopShoutsQuery"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"options"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"LoadShoutsOptions"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"load_shouts_random_top"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"options"},"value":{"kind":"Variable","name":{"kind":"Name","value":"options"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"lead"}},{"kind":"Field","name":{"kind":"Name","value":"subtitle"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"layout"}},{"kind":"Field","name":{"kind":"Name","value":"cover"}},{"kind":"Field","name":{"kind":"Name","value":"cover_caption"}},{"kind":"Field","name":{"kind":"Name","value":"main_topic"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}},{"kind":"Field","name":{"kind":"Name","value":"created_by"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"published_at"}},{"kind":"Field","name":{"kind":"Name","value":"featured_at"}},{"kind":"Field","name":{"kind":"Name","value":"stat"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"views_count"}},{"kind":"Field","name":{"kind":"Name","value":"last_commented_at"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"comments_count"}}]}}]}}]}}]} as unknown as DocumentNode<LoadRandomTopShoutsQueryQuery, LoadRandomTopShoutsQueryQueryVariables>;
export const LoadShoutsSearchQueryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"LoadShoutsSearchQuery"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"text"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"options"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"LoadShoutsOptions"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"load_shouts_search"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"text"},"value":{"kind":"Variable","name":{"kind":"Name","value":"text"}}},{"kind":"Argument","name":{"kind":"Name","value":"options"},"value":{"kind":"Variable","name":{"kind":"Name","value":"options"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"cover"}},{"kind":"Field","name":{"kind":"Name","value":"main_topic"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}},{"kind":"Field","name":{"kind":"Name","value":"authors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"last_seen"}}]}}]}}]}}]} as unknown as DocumentNode<LoadShoutsSearchQueryQuery, LoadShoutsSearchQueryQueryVariables>;
export const LoadUnratedShoutsQueryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"LoadUnratedShoutsQuery"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"options"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"LoadShoutsOptions"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"load_shouts_unrated"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"options"},"value":{"kind":"Variable","name":{"kind":"Name","value":"options"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"subtitle"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"layout"}},{"kind":"Field","name":{"kind":"Name","value":"cover"}},{"kind":"Field","name":{"kind":"Name","value":"main_topic"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}},{"kind":"Field","name":{"kind":"Name","value":"created_by"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}}]}}]}}]} as unknown as DocumentNode<LoadUnratedShoutsQueryQuery, LoadUnratedShoutsQueryQueryVariables>;
export const ArticlesMyRatesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ArticlesMyRates"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"shouts"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"get_my_rates_shouts"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"shouts"},"value":{"kind":"Variable","name":{"kind":"Name","value":"shouts"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"shout_id"}},{"kind":"Field","name":{"kind":"Name","value":"my_rate"}}]}}]}}]} as unknown as DocumentNode<ArticlesMyRatesQuery, ArticlesMyRatesQueryVariables>;
export const IsEmailUsedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"IsEmailUsed"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"email"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"isEmailUsed"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"email"},"value":{"kind":"Variable","name":{"kind":"Name","value":"email"}}}]}]}}]} as unknown as DocumentNode<IsEmailUsedQuery, IsEmailUsedQueryVariables>;
export const GetAuthorByDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetAuthorBy"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"author_id"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"get_author"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}},{"kind":"Argument","name":{"kind":"Name","value":"author_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"author_id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"bio"}},{"kind":"Field","name":{"kind":"Name","value":"about"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"links"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"last_seen"}},{"kind":"Field","name":{"kind":"Name","value":"stat"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"shouts"}},{"kind":"Field","name":{"kind":"Name","value":"coauthors"}},{"kind":"Field","name":{"kind":"Name","value":"followers"}},{"kind":"Field","name":{"kind":"Name","value":"rating_shouts"}},{"kind":"Field","name":{"kind":"Name","value":"rating_comments"}},{"kind":"Field","name":{"kind":"Name","value":"comments"}},{"kind":"Field","name":{"kind":"Name","value":"replies_count"}},{"kind":"Field","name":{"kind":"Name","value":"viewed_shouts"}},{"kind":"Field","name":{"kind":"Name","value":"topics"}}]}}]}}]}}]} as unknown as DocumentNode<GetAuthorByQuery, GetAuthorByQueryVariables>;
export const UserFollowingCountersQueryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"UserFollowingCountersQuery"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"author_id"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"get_author_followers"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}},{"kind":"Argument","name":{"kind":"Name","value":"author_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"author_id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"bio"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"stat"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"shouts"}},{"kind":"Field","name":{"kind":"Name","value":"topics"}}]}}]}}]}}]} as unknown as DocumentNode<UserFollowingCountersQueryQuery, UserFollowingCountersQueryQueryVariables>;
export const GetAuthorFollowsAuthorsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetAuthorFollowsAuthors"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"user"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"author_id"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"get_author_follows_authors"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}},{"kind":"Argument","name":{"kind":"Name","value":"user"},"value":{"kind":"Variable","name":{"kind":"Name","value":"user"}}},{"kind":"Argument","name":{"kind":"Name","value":"author_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"author_id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"bio"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"stat"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"shouts"}},{"kind":"Field","name":{"kind":"Name","value":"coauthors"}},{"kind":"Field","name":{"kind":"Name","value":"followers"}},{"kind":"Field","name":{"kind":"Name","value":"topics"}}]}}]}}]}}]} as unknown as DocumentNode<GetAuthorFollowsAuthorsQuery, GetAuthorFollowsAuthorsQueryVariables>;
export const GetAuthorFollowsTopicsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetAuthorFollowsTopics"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"user"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"author_id"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"get_author_follows_topics"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}},{"kind":"Argument","name":{"kind":"Name","value":"user"},"value":{"kind":"Variable","name":{"kind":"Name","value":"user"}}},{"kind":"Argument","name":{"kind":"Name","value":"author_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"author_id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"stat"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"shouts"}},{"kind":"Field","name":{"kind":"Name","value":"authors"}},{"kind":"Field","name":{"kind":"Name","value":"followers"}}]}}]}}]}}]} as unknown as DocumentNode<GetAuthorFollowsTopicsQuery, GetAuthorFollowsTopicsQueryVariables>;
export const GetAuthorFollowsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetAuthorFollows"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"user"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"author_id"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"get_author_follows"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}},{"kind":"Argument","name":{"kind":"Name","value":"user"},"value":{"kind":"Variable","name":{"kind":"Name","value":"user"}}},{"kind":"Argument","name":{"kind":"Name","value":"author_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"author_id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"}},{"kind":"Field","name":{"kind":"Name","value":"authors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"bio"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"stat"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"shouts"}},{"kind":"Field","name":{"kind":"Name","value":"coauthors"}},{"kind":"Field","name":{"kind":"Name","value":"followers"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"topics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"stat"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"shouts"}},{"kind":"Field","name":{"kind":"Name","value":"authors"}},{"kind":"Field","name":{"kind":"Name","value":"followers"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"shouts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}}]}}]}}]} as unknown as DocumentNode<GetAuthorFollowsQuery, GetAuthorFollowsQueryVariables>;
export const GetAuthorsAllQueryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetAuthorsAllQuery"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"get_authors_all"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"bio"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}}]}}]} as unknown as DocumentNode<GetAuthorsAllQueryQuery, GetAuthorsAllQueryQueryVariables>;
export const LoadAuthorsByDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"LoadAuthorsBy"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"by"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AuthorsBy"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"offset"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"load_authors_by"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"by"},"value":{"kind":"Variable","name":{"kind":"Name","value":"by"}}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}},{"kind":"Argument","name":{"kind":"Name","value":"offset"},"value":{"kind":"Variable","name":{"kind":"Name","value":"offset"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"bio"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"stat"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"shouts"}},{"kind":"Field","name":{"kind":"Name","value":"coauthors"}},{"kind":"Field","name":{"kind":"Name","value":"followers"}},{"kind":"Field","name":{"kind":"Name","value":"replies_count"}},{"kind":"Field","name":{"kind":"Name","value":"viewed_shouts"}},{"kind":"Field","name":{"kind":"Name","value":"comments"}},{"kind":"Field","name":{"kind":"Name","value":"rating_shouts"}},{"kind":"Field","name":{"kind":"Name","value":"rating_comments"}},{"kind":"Field","name":{"kind":"Name","value":"topics"}}]}}]}}]}}]} as unknown as DocumentNode<LoadAuthorsByQuery, LoadAuthorsByQueryVariables>;
export const LoadAuthorsSearchDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"LoadAuthorsSearch"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"text"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"offset"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"load_authors_search"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"text"},"value":{"kind":"Variable","name":{"kind":"Name","value":"text"}}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}},{"kind":"Argument","name":{"kind":"Name","value":"offset"},"value":{"kind":"Variable","name":{"kind":"Name","value":"offset"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"bio"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"stat"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"shouts"}},{"kind":"Field","name":{"kind":"Name","value":"coauthors"}},{"kind":"Field","name":{"kind":"Name","value":"followers"}},{"kind":"Field","name":{"kind":"Name","value":"rating_shouts"}},{"kind":"Field","name":{"kind":"Name","value":"rating_comments"}},{"kind":"Field","name":{"kind":"Name","value":"comments"}},{"kind":"Field","name":{"kind":"Name","value":"replies_count"}},{"kind":"Field","name":{"kind":"Name","value":"viewed_shouts"}},{"kind":"Field","name":{"kind":"Name","value":"topics"}}]}}]}}]}}]} as unknown as DocumentNode<LoadAuthorsSearchQuery, LoadAuthorsSearchQueryVariables>;
export const LoadCommentsBranchDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"LoadCommentsBranch"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"shout"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"parentId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"offset"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sort"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ReactionSort"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"childrenLimit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"childrenOffset"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"load_comments_branch"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"shout"},"value":{"kind":"Variable","name":{"kind":"Name","value":"shout"}}},{"kind":"Argument","name":{"kind":"Name","value":"parent_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"parentId"}}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}},{"kind":"Argument","name":{"kind":"Name","value":"offset"},"value":{"kind":"Variable","name":{"kind":"Name","value":"offset"}}},{"kind":"Argument","name":{"kind":"Name","value":"sort"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sort"}}},{"kind":"Argument","name":{"kind":"Name","value":"children_limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"childrenLimit"}}},{"kind":"Argument","name":{"kind":"Name","value":"children_offset"},"value":{"kind":"Variable","name":{"kind":"Name","value":"childrenOffset"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"created_by"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}}]}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"reply_to"}},{"kind":"Field","name":{"kind":"Name","value":"stat"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"comments_count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"shout"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}}]}},{"kind":"Field","name":{"kind":"Name","value":"first_replies"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"created_by"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}}]}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"reply_to"}},{"kind":"Field","name":{"kind":"Name","value":"stat"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"comments_count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"shout"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}}]}}]}}]}}]}}]} as unknown as DocumentNode<LoadCommentsBranchQuery, LoadCommentsBranchQueryVariables>;
export const CommentsMyRatesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"CommentsMyRates"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"comments"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"get_my_rates_comments"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"comments"},"value":{"kind":"Variable","name":{"kind":"Name","value":"comments"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"comment_id"}},{"kind":"Field","name":{"kind":"Name","value":"my_rate"}}]}}]}}]} as unknown as DocumentNode<CommentsMyRatesQuery, CommentsMyRatesQueryVariables>;
export const LoadCommunitiesFollowedByDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"LoadCommunitiesFollowedBy"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"author_id"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"get_communities_by_author"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}},{"kind":"Argument","name":{"kind":"Name","value":"author_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"author_id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"stat"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"shouts"}},{"kind":"Field","name":{"kind":"Name","value":"followers"}},{"kind":"Field","name":{"kind":"Name","value":"authors"}}]}}]}}]}}]} as unknown as DocumentNode<LoadCommunitiesFollowedByQuery, LoadCommunitiesFollowedByQueryVariables>;
export const LoadDraftsQueryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"LoadDraftsQuery"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"load_drafts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"drafts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"lead"}},{"kind":"Field","name":{"kind":"Name","value":"subtitle"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"layout"}},{"kind":"Field","name":{"kind":"Name","value":"cover"}},{"kind":"Field","name":{"kind":"Name","value":"cover_caption"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"media"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"artist"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"genre"}},{"kind":"Field","name":{"kind":"Name","value":"lyrics"}}]}},{"kind":"Field","name":{"kind":"Name","value":"topics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}}]}},{"kind":"Field","name":{"kind":"Name","value":"authors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}}]}},{"kind":"Field","name":{"kind":"Name","value":"shout"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"published_at"}}]}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"updated_at"}}]}}]}}]}}]} as unknown as DocumentNode<LoadDraftsQueryQuery, LoadDraftsQueryQueryVariables>;
export const LoadReactionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"LoadReactions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"by"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ReactionBy"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"offset"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"load_reactions_by"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"by"},"value":{"kind":"Variable","name":{"kind":"Name","value":"by"}}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}},{"kind":"Argument","name":{"kind":"Name","value":"offset"},"value":{"kind":"Variable","name":{"kind":"Name","value":"offset"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"reply_to"}},{"kind":"Field","name":{"kind":"Name","value":"shout"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}},{"kind":"Field","name":{"kind":"Name","value":"created_by"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"deleted_at"}},{"kind":"Field","name":{"kind":"Name","value":"updated_at"}},{"kind":"Field","name":{"kind":"Name","value":"stat"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rating"}}]}}]}}]}}]} as unknown as DocumentNode<LoadReactionsQuery, LoadReactionsQueryVariables>;
export const TopicAuthorsQueryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"TopicAuthorsQuery"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"get_topic_authors"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"bio"}},{"kind":"Field","name":{"kind":"Name","value":"about"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"links"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"last_seen"}},{"kind":"Field","name":{"kind":"Name","value":"stat"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"shouts"}},{"kind":"Field","name":{"kind":"Name","value":"coauthors"}},{"kind":"Field","name":{"kind":"Name","value":"followers"}},{"kind":"Field","name":{"kind":"Name","value":"rating_shouts"}},{"kind":"Field","name":{"kind":"Name","value":"rating_comments"}},{"kind":"Field","name":{"kind":"Name","value":"comments"}}]}}]}}]}}]} as unknown as DocumentNode<TopicAuthorsQueryQuery, TopicAuthorsQueryQueryVariables>;
export const TopicBySlugQueryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"TopicBySlugQuery"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"get_topic"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"stat"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"shouts"}},{"kind":"Field","name":{"kind":"Name","value":"authors"}},{"kind":"Field","name":{"kind":"Name","value":"followers"}}]}}]}}]}}]} as unknown as DocumentNode<TopicBySlugQueryQuery, TopicBySlugQueryQueryVariables>;
export const TopicFollowersQueryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"TopicFollowersQuery"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"get_topic_followers"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"bio"}},{"kind":"Field","name":{"kind":"Name","value":"about"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"links"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"last_seen"}},{"kind":"Field","name":{"kind":"Name","value":"stat"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"shouts"}},{"kind":"Field","name":{"kind":"Name","value":"coauthors"}},{"kind":"Field","name":{"kind":"Name","value":"followers"}},{"kind":"Field","name":{"kind":"Name","value":"rating_shouts"}},{"kind":"Field","name":{"kind":"Name","value":"rating_comments"}},{"kind":"Field","name":{"kind":"Name","value":"comments"}}]}}]}}]}}]} as unknown as DocumentNode<TopicFollowersQueryQuery, TopicFollowersQueryQueryVariables>;
export const TopicsAllQueryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"TopicsAllQuery"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"get_topics_all"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"stat"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"shouts"}},{"kind":"Field","name":{"kind":"Name","value":"authors"}},{"kind":"Field","name":{"kind":"Name","value":"followers"}},{"kind":"Field","name":{"kind":"Name","value":"comments"}}]}}]}}]}}]} as unknown as DocumentNode<TopicsAllQueryQuery, TopicsAllQueryQueryVariables>;
export const TopicsByCommunityQueryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"TopicsByCommunityQuery"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"community_id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"offset"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"get_topics_by_community"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"community_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"community_id"}}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}},{"kind":"Argument","name":{"kind":"Name","value":"offset"},"value":{"kind":"Variable","name":{"kind":"Name","value":"offset"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"stat"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"shouts"}},{"kind":"Field","name":{"kind":"Name","value":"authors"}},{"kind":"Field","name":{"kind":"Name","value":"followers"}},{"kind":"Field","name":{"kind":"Name","value":"comments"}}]}}]}}]}}]} as unknown as DocumentNode<TopicsByCommunityQueryQuery, TopicsByCommunityQueryQueryVariables>;
export const LoadTopicsFollowedByDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"LoadTopicsFollowedBy"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"user"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"author_id"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"get_topics_by_author"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}},{"kind":"Argument","name":{"kind":"Name","value":"user"},"value":{"kind":"Variable","name":{"kind":"Name","value":"user"}}},{"kind":"Argument","name":{"kind":"Name","value":"author_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"author_id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}},{"kind":"Field","name":{"kind":"Name","value":"stat"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"shouts"}},{"kind":"Field","name":{"kind":"Name","value":"followers"}},{"kind":"Field","name":{"kind":"Name","value":"authors"}}]}}]}}]}}]} as unknown as DocumentNode<LoadTopicsFollowedByQuery, LoadTopicsFollowedByQueryVariables>;