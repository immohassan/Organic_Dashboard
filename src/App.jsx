import React, { useEffect, useMemo, useState } from 'react';

const formatRelativeTime = (isoString) => {
  if (!isoString) return 'Never';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatViews = (num) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

const formatNumber = (num) => num.toLocaleString();

const detectPlatform = (url) => {
  if (!url) return 'Unknown';
  if (url.includes('instagram.com')) return 'Instagram';
  if (url.includes('tiktok.com')) return 'TikTok';
  return 'Unknown';
};

const API_BASE = '';

const parseAccountUrl = (url) => {
  const urlLower = url.toLowerCase().trim();
  if (urlLower.includes('instagram.com')) {
    const match = url.match(/instagram\.com\/([a-zA-Z0-9._]+)/i);
    if (match?.[1]) {
      return { platform: 'Instagram', handle: match[1] };
    }
  }
  if (urlLower.includes('tiktok.com')) {
    const match = url.match(/tiktok\.com\/@([a-zA-Z0-9._]+)/i);
    if (match?.[1]) {
      return { platform: 'TikTok', handle: match[1] };
    }
  }
  return null;
};

const detectVideoPlatform = (url) => {
  if (!url) return 'Unknown';
  if (url.includes('instagram.com')) return 'Instagram';
  if (url.includes('tiktok.com')) return 'TikTok';
  return 'Unknown';
};

const extractInstagramStats = (items) => {
  if (!Array.isArray(items) || items.length === 0) return { views: null, postedDate: '' };
  const item = items[0];
  const viewsRaw = item.video_view_count ?? item.video_play_count ?? item.playCount ?? null;
  const views = viewsRaw !== null ? parseInt(`${viewsRaw}`.replace(/,/g, ''), 10) : null;
  const postedDateRaw = item.date_posted ?? item.timestamp ?? '';
  const postedDate = postedDateRaw ? new Date(postedDateRaw).toISOString().split('T')[0] : '';
  return { views: Number.isNaN(views) ? null : views, postedDate };
};

const extractTikTokStats = (items) => {
  if (!Array.isArray(items) || items.length === 0) return { views: null, postedDate: '' };
  const item = items[0];
  const viewsRaw = item.playCount ?? item.viewCount ?? null;
  const views = viewsRaw !== null ? parseInt(`${viewsRaw}`.replace(/,/g, ''), 10) : null;
  const postedDateRaw = item.createTime ?? '';
  const postedDate = postedDateRaw ? new Date(postedDateRaw).toISOString().split('T')[0] : '';
  return { views: Number.isNaN(views) ? null : views, postedDate };
};

const normalizeInstagramVideoUrl = (url) => {
  if (!url) return url;
  if (url.includes('/reel/')) return url;
  const match = url.match(/instagram\.com\/p\/([a-zA-Z0-9_-]+)/i);
  if (match?.[1]) {
    return `https://www.instagram.com/p/${match[1]}/`;
  }
  return url;
};

const fetchVideoStats = async ({ token, url, platform }) => {
  const headers = new Headers();
  headers.append('Content-Type', 'application/json');
  headers.append('Accept', 'application/json');

  let runResponse;
  if (platform === 'Instagram') {
    runResponse = await fetch(
      `https://api.apify.com/v2/acts/wj7yXss2honyonHJ8/run-sync-get-dataset-items?token=${token}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: normalizeInstagramVideoUrl(url) })
      }
    );
  } else {
    runResponse = await fetch(
      `https://api.apify.com/v2/acts/rFfyNgnvUxD1bm8hh/run-sync-get-dataset-items?token=${token}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          shouldDownloadCovers: false,
          shouldDownloadVideos: false,
          shouldGetTranscript: false,
          videos: [url]
        })
      }
    );
  }

  if (!runResponse.ok) {
    throw new Error('Apify run failed');
  }

  const items = await runResponse.json();
  const stats = platform === 'Instagram' ? extractInstagramStats(items) : extractTikTokStats(items);
  return stats;
};

const fetchAccountVideoUrls = async ({ token, platform, handle, profileUrl }) => {
  const headers = new Headers();
  headers.append('Content-Type', 'application/json');
  headers.append('Accept', 'application/json');

  let response;
  if (platform === 'Instagram') {
    response = await fetch(
      `https://api.apify.com/v2/acts/xMc5Ga1oCONPmWJIa/run-sync-get-dataset-items?token=${token}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          includeDownloadedVideo: false,
          includeSharesCount: false,
          includeTranscript: false,
          resultsLimit: 50,
          skipPinnedPosts: false,
          username: [handle]
        })
      }
    );
  } else {
    response = await fetch(
      `https://api.apify.com/v2/acts/0FXVyOXXEmdGcV88a/run-sync-get-dataset-items?token=${token}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          excludePinnedPosts: false,
          profileScrapeSections: ['videos'],
          profiles: [profileUrl],
          resultsPerPage: 50,
          shouldDownloadAvatars: false,
          shouldDownloadCovers: false,
          shouldDownloadSlideshowImages: false,
          shouldDownloadSubtitles: false,
          shouldDownloadVideos: false
        })
      }
    );
  }

  if (!response.ok) {
    throw new Error('Apify list failed');
  }
  const items = await response.json();
  if (!Array.isArray(items)) return [];
  if (platform === 'Instagram') {
    return items.map((item) => normalizeInstagramVideoUrl(item.url)).filter(Boolean);
  }
  return items.map((item) => item.webVideoUrl).filter(Boolean);
};

const icons = {
  refresh: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
    </svg>
  ),
  calendar: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  chevronDown: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  plus: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  trash: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  x: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  eye: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  video: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  ),
  users: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  lock: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  unlock: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
  ),
  edit: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  check: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  sortAsc: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  ),
  sortDesc: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  sortNone: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
      <polyline points="6 9 12 5 18 9" />
      <polyline points="6 15 12 19 18 15" />
    </svg>
  )
};

export default function App() {
  const [state, setState] = useState({
    accounts: [],
    videos: [],
    settings: { lastUpdated: '' },
    dateFilter: 'all',
    customDateStart: '',
    customDays: '',
    showCustomLast: false,
    showCustomSince: false,
    editorFilter: 'all',
    platformFilter: 'all',
    sortColumn: 'views',
    sortDirection: 'desc',
    showDatePicker: false,
    showPlatformPicker: false,
    showEditorPicker: false,
    showAccountPicker: false,
    activeTab: 'home',
    selectedAccountId: null,
    isManager: false,
    showAddAccount: false,
    showLoginModal: false,
    loginCode: '',
    newVideoUrl: '',
    newVideoEditor: '',
    newAccountUrl: '',
    newAccountEditor: '',
    editingVideoId: null,
    editingViews: '',
    editingVideoEditor: null,
    editingVideoEditorName: '',
    editingAccountId: null,
    editingAccountEditor: '',
    toast: null
  });

  const updateState = (updates) => {
    if (typeof updates === 'function') {
      setState(updates);
    } else {
      setState((prev) => ({ ...prev, ...updates }));
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [settingsRes, accountsRes, videosRes] = await Promise.all([
          fetch(`${API_BASE}/api/settings`),
          fetch(`${API_BASE}/api/accounts`),
          fetch(`${API_BASE}/api/videos`)
        ]);
        const settingsData = await settingsRes.json();
        const accountsData = await accountsRes.json();
        const videosData = await videosRes.json();
        const settings = settingsData && typeof settingsData === 'object' ? settingsData : { lastUpdated: '' };
        const accounts = Array.isArray(accountsData) ? accountsData : [];
        const videos = Array.isArray(videosData) ? videosData : [];
        updateState({
          settings,
          accounts,
          videos
        });
      } catch (e) {
        alert('Failed to load data from API.');
      }
    };
    load();
  }, []);

  const dateFilteredVideos = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - today.getDay());
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastWeekEnd = new Date(thisWeekStart);
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
    const lastWeekStart = new Date(lastWeekEnd);
    lastWeekStart.setDate(lastWeekStart.getDate() - 6);
    const lastMonthEnd = new Date(thisMonthStart);
    lastMonthEnd.setDate(lastMonthEnd.getDate() - 1);
    const lastMonthStart = new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1);

    const videos = Array.isArray(state.videos) ? state.videos : [];
    return videos.filter((video) => {
      const postedDate = new Date(video.postedDate);
      const postedDay = new Date(postedDate.getFullYear(), postedDate.getMonth(), postedDate.getDate());

      switch (state.dateFilter) {
        case 'all':
          return true;
        case 'today':
          return postedDay.getTime() === today.getTime();
        case 'yesterday':
          return postedDay.getTime() === yesterday.getTime();
        case 'thisWeek':
          return postedDay >= thisWeekStart && postedDay <= today;
        case 'thisMonth':
          return postedDay >= thisMonthStart && postedDay <= today;
        case 'lastWeek':
          return postedDay >= lastWeekStart && postedDay <= lastWeekEnd;
        case 'lastMonth':
          return postedDay >= lastMonthStart && postedDay <= lastMonthEnd;
        case 'last7': {
          const start = new Date(today);
          start.setDate(start.getDate() - 6);
          return postedDay >= start && postedDay <= today;
        }
        case 'last14': {
          const start = new Date(today);
          start.setDate(start.getDate() - 13);
          return postedDay >= start && postedDay <= today;
        }
        case 'last30': {
          const start = new Date(today);
          start.setDate(start.getDate() - 29);
          return postedDay >= start && postedDay <= today;
        }
        case 'last365': {
          const start = new Date(today);
          start.setDate(start.getDate() - 364);
          return postedDay >= start && postedDay <= today;
        }
        case 'lastX': {
          if (!state.customDays) return true;
          const start = new Date(today);
          start.setDate(start.getDate() - (parseInt(state.customDays, 10) - 1));
          return postedDay >= start && postedDay <= today;
        }
        case 'since': {
          if (!state.customDateStart) return true;
          return postedDay >= new Date(state.customDateStart);
        }
        default:
          return true;
      }
    });
  }, [state.videos, state.dateFilter, state.customDays, state.customDateStart]);

  const aggregate = useMemo(() => {
    let filtered = dateFilteredVideos;
    if (state.platformFilter !== 'all') {
      filtered = filtered.filter((v) => v.platform === state.platformFilter);
    }
    const editorTotals = {};
    filtered.forEach((video) => {
      if (!video.editor) return;
      if (!editorTotals[video.editor]) {
        editorTotals[video.editor] = {
          editor: video.editor,
          instagramViews: 0,
          tiktokViews: 0,
          totalViews: 0,
          videoCount: 0
        };
      }
      if (video.platform === 'Instagram') {
        editorTotals[video.editor].instagramViews += video.views || 0;
      } else if (video.platform === 'TikTok') {
        editorTotals[video.editor].tiktokViews += video.views || 0;
      }
      editorTotals[video.editor].totalViews += video.views || 0;
      editorTotals[video.editor].videoCount += 1;
    });
    return Object.values(editorTotals).sort((a, b) => b.totalViews - a.totalViews);
  }, [dateFilteredVideos, state.platformFilter]);

  const selectedAccount = useMemo(() => {
    return state.accounts.find((account) => account.id === state.selectedAccountId) || null;
  }, [state.accounts, state.selectedAccountId]);

  const accountVideos = useMemo(() => {
    if (!state.selectedAccountId) return [];
    return state.videos.filter((video) => video.accountId === state.selectedAccountId);
  }, [state.videos, state.selectedAccountId]);

  const accountAggregate = useMemo(() => {
    if (!accountVideos.length) return [];
    const editorTotals = {};
    accountVideos.forEach((video) => {
      if (!video.editor) return;
      if (!editorTotals[video.editor]) {
        editorTotals[video.editor] = {
          editor: video.editor,
          instagramViews: 0,
          tiktokViews: 0,
          totalViews: 0,
          videoCount: 0
        };
      }
      if (video.platform === 'Instagram') {
        editorTotals[video.editor].instagramViews += video.views || 0;
      } else if (video.platform === 'TikTok') {
        editorTotals[video.editor].tiktokViews += video.views || 0;
      }
      editorTotals[video.editor].totalViews += video.views || 0;
      editorTotals[video.editor].videoCount += 1;
    });
    return Object.values(editorTotals).sort((a, b) => b.totalViews - a.totalViews);
  }, [accountVideos]);

  const filteredVideos = useMemo(() => {
    let result = dateFilteredVideos;
    if (state.editorFilter !== 'all') {
      result = result.filter((v) => v.editor === state.editorFilter);
    }
    if (state.platformFilter !== 'all') {
      result = result.filter((v) => v.platform === state.platformFilter);
    }
    return [...result].sort((a, b) => {
      let comparison = 0;
      if (state.sortColumn === 'views') {
        comparison = (b.views || 0) - (a.views || 0);
      } else if (state.sortColumn === 'postedDate') {
        comparison = new Date(b.postedDate) - new Date(a.postedDate);
      }
      return state.sortDirection === 'asc' ? -comparison : comparison;
    });
  }, [dateFilteredVideos, state.editorFilter, state.platformFilter, state.sortColumn, state.sortDirection]);

  const filteredAccounts = useMemo(() => {
    if (state.platformFilter === 'all') return state.accounts;
    return state.accounts.filter((a) => a.platform === state.platformFilter);
  }, [state.accounts, state.platformFilter]);

  const editors = useMemo(() => {
    return [...new Set(state.videos.map((v) => v.editor).filter(Boolean))];
  }, [state.videos]);

  const totalViews = filteredVideos.reduce((sum, v) => sum + (v.views || 0), 0);
  const totalVideos = filteredVideos.length;
  const maxViews = Math.max(1, ...aggregate.flatMap((e) => [e.instagramViews, e.tiktokViews]));

  const getDateFilterLabel = () => {
    const labels = {
      all: 'All Time',
      today: 'Today',
      yesterday: 'Yesterday',
      thisWeek: 'This week',
      thisMonth: 'This month',
      lastWeek: 'Last week',
      lastMonth: 'Last month',
      last7: 'Last 7 days',
      last14: 'Last 14 days',
      last30: 'Last 30 days',
      last365: 'Last 365 days'
    };
    if (labels[state.dateFilter]) return labels[state.dateFilter];
    if (state.dateFilter === 'lastX' && state.customDays) return `Last ${state.customDays} days`;
    if (state.dateFilter === 'since' && state.customDateStart) return `Since ${state.customDateStart}`;
    return 'Select Date';
  };

  const getPlatformFilterLabel = () => {
    if (state.platformFilter === 'Instagram') return 'Instagram';
    if (state.platformFilter === 'TikTok') return 'TikTok';
    return 'All Platforms';
  };

  const getEditorFilterLabel = () => {
    if (state.editorFilter === 'all') return 'All Editors';
    return state.editorFilter || 'All Editors';
  };

  const handleSort = (column) => {
    if (state.sortColumn === column) {
      updateState({ sortDirection: state.sortDirection === 'desc' ? 'asc' : 'desc' });
    } else {
      updateState({ sortColumn: column, sortDirection: 'desc' });
    }
  };


  const handleAddVideo = async () => {
    const url = state.newVideoUrl.trim();
    if (!url) {
      alert('Please enter a video URL');
      return;
    }
    const platform = detectVideoPlatform(url);
    if (platform === 'Unknown') {
      alert('Please enter a valid Instagram or TikTok URL');
      return;
    }

    let editor = state.newVideoEditor.trim();
    let accountId = '';
    if (!editor) {
      const urlLower = url.toLowerCase();
      const matched = state.accounts.find((account) => urlLower.includes(account.handle.toLowerCase()));
      if (matched) {
        editor = matched.defaultEditor;
        accountId = matched.id;
      }
    } else {
      const urlLower = url.toLowerCase();
      const matched = state.accounts.find((account) => urlLower.includes(account.handle.toLowerCase()));
      if (matched) accountId = matched.id;
    }

    if (!editor) {
      alert('Please enter an editor name or add the account first');
      return;
    }

    const token = process.env.NEXT_PUBLIC_APIFY_TOKEN;
    if (!token) {
      alert('Missing Apify token. Add NEXT_PUBLIC_APIFY_TOKEN in .env');
      return;
    }

    updateState({ toast: { type: 'loading', message: `Fetching ${platform} stats...` } });

    const today = new Date().toISOString().split('T')[0];
    try {
      const stats = await fetchVideoStats({ token, url, platform });
      if (stats.views === null) {
        throw new Error('Views not found in Apify response');
      }

      await fetch(`${API_BASE}/api/videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          url,
          platform,
          views: stats.views,
          postedDate: stats.postedDate || today,
          dateAdded: today,
          editor,
          editorOverride: !!state.newVideoEditor.trim(),
          isFetching: false
        })
      });

      const videosRes = await fetch(`${API_BASE}/api/videos`);
      const videos = await videosRes.json();
      updateState({ videos });

      updateState({
        newVideoUrl: '',
        newVideoEditor: '',
        toast: { type: 'success', message: 'Video added successfully.' }
      });
      setTimeout(() => updateState({ toast: null }), 2000);
    } catch (e) {
      console.error('Apify fetch failed', e);
      updateState({ toast: { type: 'error', message: 'Failed to fetch video stats.' } });
      setTimeout(() => updateState({ toast: null }), 2500);
    }
  };

  const handleRemoveVideo = async (id) => {
    try {
      await fetch(`${API_BASE}/api/videos/${id}`, { method: 'DELETE' });
      const videosRes = await fetch(`${API_BASE}/api/videos`);
      const videos = await videosRes.json();
      updateState({ videos });
    } catch (e) {
      alert('Delete video failed. Check API connection.');
    }
  };

  const handleEditViews = (videoId) => {
    const video = state.videos.find((v) => v.id === videoId);
    if (!video) return;
    updateState({ editingVideoId: videoId, editingViews: (video.views || 0).toString() });
  };

  const handleSaveViews = async (videoId) => {
    const views = parseInt(state.editingViews, 10) || 0;
    try {
      await fetch(`${API_BASE}/api/videos/${videoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ views })
      });
      const videosRes = await fetch(`${API_BASE}/api/videos`);
      const videos = await videosRes.json();
      updateState({ videos });
      updateState({ editingVideoId: null, editingViews: '' });
    } catch (e) {
      alert('Save views failed. Check API connection.');
    }
  };

  const handleEditVideoEditor = (videoId) => {
    const video = state.videos.find((v) => v.id === videoId);
    if (!video) return;
    updateState({ editingVideoEditor: videoId, editingVideoEditorName: video.editor || '' });
  };

  const handleSaveVideoEditor = async (videoId) => {
    try {
      await fetch(`${API_BASE}/api/videos/${videoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          editor: state.editingVideoEditorName.trim(),
          editorOverride: true
        })
      });
      const videosRes = await fetch(`${API_BASE}/api/videos`);
      const videos = await videosRes.json();
      updateState({ videos });
      updateState({ editingVideoEditor: null, editingVideoEditorName: '' });
    } catch (e) {
      alert('Save editor failed. Check API connection.');
    }
  };

  const handleAddAccount = async () => {
    const urlInput = state.newAccountUrl.trim();
    const editorInput = state.newAccountEditor.trim();
    if (!urlInput || !editorInput) {
      alert('Please enter account URL and default editor');
      return;
    }
    const parsed = parseAccountUrl(urlInput);
    if (!parsed) {
      alert('Please enter a valid Instagram or TikTok profile URL');
      return;
    }
    const exists = state.accounts.some(
      (account) => account.platform === parsed.platform && account.handle.toLowerCase() === parsed.handle.toLowerCase()
    );
    if (exists) {
      alert('This account is already being tracked');
      return;
    }
    let accountId = null;
    try {
      const created = await fetch(`${API_BASE}/api/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: parsed.platform,
          handle: parsed.handle,
          url: urlInput,
          defaultEditor: editorInput
        })
      });
      if (!created.ok) {
        throw new Error('Create account failed');
      }
      const createdData = await created.json();
      accountId = createdData?.id || null;
      const accountsRes = await fetch(`${API_BASE}/api/accounts`);
      const accounts = await accountsRes.json();
      updateState({ accounts });
    } catch (e) {
      alert('Add account failed. Check API connection.');
      return;
    }

    if (!accountId) {
      alert('Account created but could not get ID.');
      return;
    }

    const token = process.env.NEXT_PUBLIC_APIFY_TOKEN;
    if (!token) {
      alert('Missing Apify token. Add NEXT_PUBLIC_APIFY_TOKEN in .env');
      return;
    }

    updateState({ toast: { type: 'loading', message: `Fetching videos from @${parsed.handle}...` } });
    updateState({ selectedAccountId: accountId, activeTab: 'accountVideos' });

    try {
      const urls = await fetchAccountVideoUrls({
        token,
        platform: parsed.platform,
        handle: parsed.handle,
        profileUrl: urlInput
      });
      if (!urls.length) {
        updateState({ toast: { type: 'error', message: 'No videos found for this account.' } });
        setTimeout(() => updateState({ toast: null }), 2500);
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      updateState({ toast: { type: 'loading', message: `Adding ${urls.length} videos...` } });
      
      // Step 1: Create all placeholder videos immediately so they show in the table
      const placeholders = [];
      const newVideos = [];
      
      for (const videoUrl of urls) {
        const created = await fetch(`${API_BASE}/api/videos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId,
            url: videoUrl,
            platform: parsed.platform,
            views: 0,
            postedDate: null,
            dateAdded: today,
            editor: editorInput,
            editorOverride: false,
            isFetching: true
          })
        });
        if (!created.ok) {
          continue;
        }
        const createdData = await created.json();
        const videoPlaceholder = {
          id: createdData?.id,
          accountId,
          url: videoUrl,
          platform: parsed.platform,
          views: 0,
          postedDate: '',
          dateAdded: today,
          editor: editorInput,
          editorOverride: false,
          isFetching: true
        };
        placeholders.push({ id: createdData?.id, url: videoUrl });
        newVideos.push(videoPlaceholder);
      }
      
      // Add all new videos to state at once so they appear immediately
      if (newVideos.length > 0) {
        updateState((prev) => ({
          ...prev,
          videos: [...newVideos, ...prev.videos]
        }));
      }

      // Step 2: Process videos one at a time, retry if result is empty
      let processed = 0;
      const totalVideos = placeholders.length;

      // Helper function to fetch stats for a single video with retry logic
      const fetchVideoStatsAndUpdate = async (placeholder, retryCount = 0) => {
        try {
          const stats = await fetchVideoStats({ token, url: placeholder.url, platform: parsed.platform });
          
          if (stats.views === null) {
            // If result is empty and we haven't retried yet, wait 3s and retry
            if (retryCount === 0) {
              updateState({ toast: { type: 'loading', message: `Empty result for video ${processed + 1}/${totalVideos}, retrying in 3s...` } });
              await new Promise(resolve => setTimeout(resolve, 3000));
              return fetchVideoStatsAndUpdate(placeholder, 1);
            }
            
            // After retry, if still empty, mark as done
            await fetch(`${API_BASE}/api/videos/${placeholder.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ isFetching: false })
            });
            updateState((prev) => ({
              ...prev,
              videos: prev.videos.map((video) =>
                video.id === placeholder.id
                  ? { ...video, isFetching: false }
                  : video
              )
            }));
          } else {
            // Success - update with stats
            await fetch(`${API_BASE}/api/videos/${placeholder.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                views: stats.views,
                postedDate: stats.postedDate || today,
                isFetching: false
              })
            });
            updateState((prev) => ({
              ...prev,
              videos: prev.videos.map((video) =>
                video.id === placeholder.id
                  ? { ...video, views: stats.views, postedDate: stats.postedDate || today, isFetching: false }
                  : video
              )
            }));
          }
          return true;
        } catch (error) {
          console.error(`Error fetching stats for video ${placeholder.id}:`, error);
          // Mark as not fetching on error
          await fetch(`${API_BASE}/api/videos/${placeholder.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isFetching: false })
          });
          updateState((prev) => ({
            ...prev,
            videos: prev.videos.map((video) =>
              video.id === placeholder.id
                ? { ...video, isFetching: false }
                : video
            )
          }));
          return false;
        }
      };

      // Process videos one at a time sequentially
      if (placeholders.length > 0) {
        updateState({ toast: { type: 'loading', message: `Fetching views for ${totalVideos} videos...` } });
        
        for (const placeholder of placeholders) {
          await fetchVideoStatsAndUpdate(placeholder);
          processed += 1;
          updateState({ toast: { type: 'loading', message: `Fetching views... ${processed}/${totalVideos} complete` } });
        }
      }

      updateState({ toast: { type: 'success', message: `Fetched ${urls.length} videos.` } });
      setTimeout(() => updateState({ toast: null }), 2000);
    } catch (e) {
      console.error('Account fetch failed', e);
      updateState({ toast: { type: 'error', message: 'Failed to fetch account videos.' } });
      setTimeout(() => updateState({ toast: null }), 2500);
    }
    updateState({
      newAccountUrl: '',
      newAccountEditor: '',
      showAddAccount: false
    });
  };

  const handleRemoveAccount = async (accountId) => {
    const account = state.accounts.find((a) => a.id === accountId);
    const accountHandle = account ? `@${account.handle}` : 'account';
    
    updateState({ toast: { type: 'loading', message: `Deleting ${accountHandle}...` } });
    
    try {
      await fetch(`${API_BASE}/api/accounts/${accountId}`, { method: 'DELETE' });
      
      // Update accounts list
      const accountsRes = await fetch(`${API_BASE}/api/accounts`);
      const accounts = await accountsRes.json();
      
      // Remove videos associated with this account from state immediately
      updateState((prev) => ({
        ...prev,
        accounts,
        videos: prev.videos.filter((video) => video.accountId !== accountId),
        // If the deleted account was selected, clear the selection
        selectedAccountId: prev.selectedAccountId === accountId ? null : prev.selectedAccountId,
        toast: { type: 'success', message: `${accountHandle} deleted successfully.` }
      }));
      
      setTimeout(() => updateState({ toast: null }), 2000);
    } catch (e) {
      updateState({ toast: { type: 'error', message: 'Failed to delete account. Check API connection.' } });
      setTimeout(() => updateState({ toast: null }), 2500);
    }
  };

  const handleEditAccountEditor = (accountId) => {
    const account = state.accounts.find((a) => a.id === accountId);
    if (!account) return;
    updateState({ editingAccountId: accountId, editingAccountEditor: account.defaultEditor });
  };

  const handleSaveAccountEditor = async (accountId) => {
    try {
      await fetch(`${API_BASE}/api/accounts/${accountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultEditor: state.editingAccountEditor.trim() })
      });
      const accountsRes = await fetch(`${API_BASE}/api/accounts`);
      const accounts = await accountsRes.json();
      updateState({ accounts });
      updateState({ editingAccountId: null, editingAccountEditor: '' });
    } catch (e) {
      alert('Save account editor failed. Check API connection.');
    }
  };

  const handleCancelEdit = () => {
    updateState({
      editingVideoId: null,
      editingViews: '',
      editingVideoEditor: null,
      editingVideoEditorName: '',
      editingAccountId: null,
      editingAccountEditor: ''
    });
  };

  const handleLogin = async () => {
    const code = state.loginCode.trim();
    if (!code) {
      updateState({ toast: { type: 'error', message: 'Please enter a code.' } });
      setTimeout(() => updateState({ toast: null }), 2000);
      return;
    }

    // Get the manager code from environment variable or use a default
    const managerCode = process.env.NEXT_PUBLIC_MANAGER_CODE || 'admin123';
    
    if (code === managerCode) {
      updateState({
        isManager: true,
        showLoginModal: false,
        loginCode: '',
        toast: { type: 'success', message: 'Logged in successfully.' }
      });
      setTimeout(() => updateState({ toast: null }), 2000);
    } else {
      updateState({
        loginCode: '',
        toast: { type: 'error', message: 'Invalid code. Please try again.' }
      });
      setTimeout(() => updateState({ toast: null }), 2500);
    }
  };

  const handleCancelLogin = () => {
    updateState({ showLoginModal: false, loginCode: '' });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {state.toast ? (
        <div className="fixed top-4 right-4 z-50">
          <div
            className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg border ${
              state.toast.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-700'
                : state.toast.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-white border-gray-200 text-gray-700'
            }`}
          >
            {state.toast.type === 'loading' ? (
              <span className="animate-spin">{icons.refresh}</span>
            ) : null}
            <span className="text-sm font-medium">{state.toast.message}</span>
          </div>
        </div>
      ) : null}

      {state.showLoginModal ? (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Manager Login</h3>
              <button
                onClick={handleCancelLogin}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {icons.x}
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">Enter the manager code to access editing features.</p>
            <input
              type="password"
              placeholder="Enter code"
              value={state.loginCode}
              onChange={(event) => updateState({ loginCode: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleLogin();
                if (event.key === 'Escape') handleCancelLogin();
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm mb-4"
              autoFocus
            />
            <div className="flex items-center gap-3">
              <button
                onClick={handleLogin}
                className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors text-sm font-medium"
              >
                Login
              </button>
              <button
                onClick={handleCancelLogin}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="header-content flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏆</span>
            <div>
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900">Organic Video Performance</h1>
              <p className="text-xs sm:text-sm text-gray-500">Track video views by editor</p>
            </div>
          </div>

          <div className="header-controls flex items-center gap-2 sm:gap-3">
            <div className="date-filter-wrapper relative">
              <button
                onClick={() => updateState({ showPlatformPicker: !state.showPlatformPicker })}
                className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <span className="text-xs sm:text-sm text-gray-700">{getPlatformFilterLabel()}</span>
                {icons.chevronDown}
              </button>

              {state.showPlatformPicker ? (
                <div className="date-dropdown absolute right-0 mt-2 w-44 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-2">
                  {[
                    { value: 'all', label: 'All Platforms' },
                    { value: 'Instagram', label: 'Instagram' },
                    { value: 'TikTok', label: 'TikTok' }
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() =>
                        updateState({
                          platformFilter: option.value,
                          showPlatformPicker: false
                        })
                      }
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                        state.platformFilter === option.value ? 'text-violet-600 font-medium' : 'text-gray-700'
                      }`}
                    >
                      {option.label} {state.platformFilter === option.value ? '✓' : ''}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="date-filter-wrapper relative">
              <button
                onClick={() => updateState({ showDatePicker: !state.showDatePicker })}
                className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {icons.calendar}
                <span className="text-xs sm:text-sm text-gray-700">{getDateFilterLabel()}</span>
                {icons.chevronDown}
              </button>

              {state.showDatePicker ? (
                <div className="date-dropdown absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-2 max-h-[70vh] overflow-y-auto">
                  <p className="px-4 py-1 text-xs text-gray-400 font-medium">Presets</p>
                  {[
                    'all',
                    'today',
                    'yesterday',
                    'thisWeek',
                    'thisMonth',
                    'lastWeek',
                    'lastMonth',
                    'last7',
                    'last14',
                    'last30',
                    'last365'
                  ].map((key) => {
                    const labels = {
                      all: 'All Time',
                      today: 'Today',
                      yesterday: 'Yesterday',
                      thisWeek: 'This week',
                      thisMonth: 'This month',
                      lastWeek: 'Last week',
                      lastMonth: 'Last month',
                      last7: 'Last 7 days',
                      last14: 'Last 14 days',
                      last30: 'Last 30 days',
                      last365: 'Last 365 days'
                    };
                    return (
                      <button
                        key={key}
                        onClick={() =>
                          updateState({
                            dateFilter: key,
                            showDatePicker: false,
                            showCustomLast: false,
                            showCustomSince: false
                          })
                        }
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                          state.dateFilter === key ? 'text-violet-600 font-medium' : 'text-gray-700'
                        }`}
                      >
                        {labels[key]} {state.dateFilter === key ? '✓' : ''}
                      </button>
                    );
                  })}

                  <p className="px-4 py-1 mt-2 text-xs text-gray-400 font-medium border-t border-gray-100 pt-2">Custom</p>

                  <button
                    onClick={() =>
                      updateState({ showCustomLast: !state.showCustomLast, showCustomSince: false })
                    }
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                      state.dateFilter === 'lastX' ? 'text-violet-600 font-medium' : 'text-gray-700'
                    }`}
                  >
                    Last... {state.dateFilter === 'lastX' ? '✓' : ''}
                  </button>
                  {state.showCustomLast ? (
                    <div className="px-4 py-2 flex items-center gap-2">
                      <span className="text-sm text-gray-600">Last</span>
                      <input
                        type="number"
                        min="1"
                        value={state.customDays}
                        placeholder="X"
                        onChange={(event) => updateState({ customDays: event.target.value })}
                        className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                      <span className="text-sm text-gray-600">days</span>
                      <button
                        onClick={() => {
                          if (state.customDays) {
                            updateState({
                              dateFilter: 'lastX',
                              showDatePicker: false,
                              showCustomLast: false
                            });
                          }
                        }}
                        className="px-2 py-1 bg-violet-600 text-white text-xs rounded hover:bg-violet-700"
                      >
                        Go
                      </button>
                    </div>
                  ) : null}

                  <button
                    onClick={() =>
                      updateState({ showCustomSince: !state.showCustomSince, showCustomLast: false })
                    }
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                      state.dateFilter === 'since' ? 'text-violet-600 font-medium' : 'text-gray-700'
                    }`}
                  >
                    Since... {state.dateFilter === 'since' ? '✓' : ''}
                  </button>
                  {state.showCustomSince ? (
                    <div className="px-4 py-2 flex items-center gap-2">
                      <span className="text-sm text-gray-600">Since</span>
                      <input
                        type="date"
                        value={state.customDateStart}
                        onChange={(event) => updateState({ customDateStart: event.target.value })}
                        className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                      <button
                        onClick={() => {
                          if (state.customDateStart) {
                            updateState({
                              dateFilter: 'since',
                              showDatePicker: false,
                              showCustomSince: false
                            });
                          }
                        }}
                        className="px-2 py-1 bg-violet-600 text-white text-xs rounded hover:bg-violet-700"
                      >
                        Go
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>


            {state.isManager ? (
              <button
                onClick={() => {
                  updateState({ isManager: false, toast: { type: 'success', message: 'Logged out successfully.' } });
                  setTimeout(() => updateState({ toast: null }), 2000);
                }}
                className="flex items-center gap-1 sm:gap-2 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors border border-green-300"
              >
                {icons.unlock}
                <span className="text-sm font-medium hidden sm:inline">Manager</span>
              </button>
            ) : (
              <button
                onClick={() => updateState({ showLoginModal: true })}
                className="flex items-center gap-1 sm:gap-2 px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {icons.lock}
                <span className="text-sm font-medium hidden sm:inline">Login</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { key: 'home', label: 'Home' },
            { key: 'accounts', label: 'Tracked Accounts' },
            { key: 'videos', label: 'Individual Videos' },
            ...(state.selectedAccountId ? [{ key: 'accountVideos', label: 'Account Videos' }] : [])
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => updateState({ activeTab: tab.key })}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                state.activeTab === tab.key
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-6">
        {state.activeTab === 'home' ? (
        <>
        <div className="stats-grid grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="bg-white rounded-xl p-3 sm:p-4 border border-gray-200">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 bg-violet-100 rounded-lg text-violet-600 shrink-0">{icons.eye}</div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-500 truncate">Total Views</p>
                <p className="text-lg sm:text-xl font-semibold text-gray-900">{formatNumber(totalViews)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-3 sm:p-4 border border-gray-200">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 bg-pink-100 rounded-lg text-pink-600 shrink-0">{icons.video}</div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-500 truncate">Total Videos</p>
                <p className="text-lg sm:text-xl font-semibold text-gray-900">{totalVideos}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-3 sm:p-4 border border-gray-200">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 bg-blue-100 rounded-lg text-blue-600 shrink-0">{icons.users}</div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-500 truncate">Editors</p>
                <p className="text-lg sm:text-xl font-semibold text-gray-900">{editors.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-3 sm:p-4 border border-gray-200">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 bg-green-100 rounded-lg text-green-600 shrink-0">{icons.eye}</div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-500 truncate">Avg Views/Video</p>
                <p className="text-lg sm:text-xl font-semibold text-gray-900">
                  {totalVideos > 0 ? formatNumber(Math.round(totalViews / totalVideos)) : 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Views by Editor</h2>
            <div className="flex items-center gap-4 text-xs sm:text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 bg-pink-500 rounded" />
                <span>Instagram</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 bg-gray-900 rounded" />
                <span>TikTok</span>
              </div>
            </div>
          </div>

          <div className="bar-chart">
            {aggregate.length > 0 ? (
              aggregate.map((e) => (
                <div className="bar-container" key={e.editor}>
                  <div className="flex items-end gap-1 justify-center">
                    <div className="relative" style={{ width: 'clamp(18px, 4vw, 32px)' }}>
                      <div
                        className="bg-pink-500 rounded-t transition-all hover:bg-pink-600"
                        style={{ height: `${Math.max((e.instagramViews / maxViews) * 160, e.instagramViews > 0 ? 20 : 4)}px`, width: '100%' }}
                      />
                      {e.instagramViews > 0 ? (
                        <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-gray-600 whitespace-nowrap">
                          {formatViews(e.instagramViews)}
                        </span>
                      ) : null}
                    </div>
                    <div className="relative" style={{ width: 'clamp(18px, 4vw, 32px)' }}>
                      <div
                        className="bg-gray-900 rounded-t transition-all hover:bg-gray-700"
                        style={{ height: `${Math.max((e.tiktokViews / maxViews) * 160, e.tiktokViews > 0 ? 20 : 4)}px`, width: '100%' }}
                      />
                      {e.tiktokViews > 0 ? (
                        <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-gray-600 whitespace-nowrap">
                          {formatViews(e.tiktokViews)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="editor-avatar bg-gradient-to-br from-violet-100 to-violet-200 rounded-lg border-2 border-violet-400 flex items-center justify-center overflow-hidden">
                    <span className="font-bold text-violet-600">{e.editor.charAt(0)}</span>
                  </div>
                  <span className="bar-name">{e.editor}</span>
                </div>
              ))
            ) : (
              <p className="text-gray-400 text-center w-full py-8">No data to display</p>
            )}
          </div>
        </div>
        </>
        ) : null}

        {state.activeTab === 'home' || state.activeTab === 'videos' ? (
        <div className="bg-white rounded-xl border border-gray-200 mb-6">
          <div className="p-3 sm:p-4 border-b border-gray-200">
            <div className="table-header flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900">Individual Videos</h2>
                <div className="date-filter-wrapper relative">
                  <button
                    onClick={() => updateState({ showEditorPicker: !state.showEditorPicker })}
                    className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-xs sm:text-sm text-gray-700">{getEditorFilterLabel()}</span>
                    {icons.chevronDown}
                  </button>

                  {state.showEditorPicker ? (
                    <div className="date-dropdown absolute right-0 mt-2 w-44 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-2 max-h-60 overflow-y-auto">
                      <button
                        onClick={() => updateState({ editorFilter: 'all', showEditorPicker: false })}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                          state.editorFilter === 'all' ? 'text-violet-600 font-medium' : 'text-gray-700'
                        }`}
                      >
                        All Editors {state.editorFilter === 'all' ? '✓' : ''}
                      </button>
                      {editors.map((editor) => (
                        <button
                          key={editor}
                          onClick={() => updateState({ editorFilter: editor, showEditorPicker: false })}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                            state.editorFilter === editor ? 'text-violet-600 font-medium' : 'text-gray-700'
                          }`}
                        >
                          {editor} {state.editorFilter === editor ? '✓' : ''}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {state.isManager ? (
            <div className="p-3 sm:p-4 bg-gray-50 border-b border-gray-200">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="url"
                  placeholder="Video URL (Instagram or TikTok)"
                  value={state.newVideoUrl}
                  onChange={(event) => updateState({ newVideoUrl: event.target.value })}
                  className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
                />
                <input
                  type="text"
                  placeholder="Editor (optional - uses account default)"
                  value={state.newVideoEditor}
                  onChange={(event) => updateState({ newVideoEditor: event.target.value })}
                  className="w-40 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
                />
                <button
                  onClick={handleAddVideo}
                  className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors text-sm flex items-center gap-2"
                >
                  {icons.plus} Add Video
                </button>
              </div>
            </div>
          ) : null}

          {state.videos.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-4xl mb-3">📹</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No videos yet</h3>
              <p className="text-sm text-gray-500">Add a video URL above to get started.</p>
            </div>
          ) : filteredVideos.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-4xl mb-3">🔍</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No videos match filters</h3>
              <p className="text-sm text-gray-500 mb-4">
                You have {state.videos.length} video{state.videos.length !== 1 ? 's' : ''} total.
              </p>
              <button
                onClick={() => updateState({ dateFilter: 'all', editorFilter: 'all' })}
                className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm"
              >
                Show All Videos
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto overflow-y-auto max-h-[400px]">
                <table className="w-full min-w-[700px]">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="text-left px-3 sm:px-4 py-3 text-xs font-medium text-gray-500 uppercase bg-gray-50">Editor</th>
                      <th className="text-left px-3 sm:px-4 py-3 text-xs font-medium text-gray-500 uppercase bg-gray-50">Platform</th>
                      <th className="text-left px-3 sm:px-4 py-3 text-xs font-medium text-gray-500 uppercase bg-gray-50">Video URL</th>
                      <th
                        onClick={() => handleSort('postedDate')}
                        className="text-left px-3 sm:px-4 py-3 text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none bg-gray-50"
                      >
                        <div className="flex items-center gap-1">
                          Posted
                          {state.sortColumn === 'postedDate'
                            ? state.sortDirection === 'desc'
                              ? icons.sortDesc
                              : icons.sortAsc
                            : icons.sortNone}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('views')}
                        className="text-right px-3 sm:px-4 py-3 text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none bg-gray-50"
                      >
                        <div className="flex items-center justify-end gap-1">
                          Views
                          {state.sortColumn === 'views'
                            ? state.sortDirection === 'desc'
                              ? icons.sortDesc
                              : icons.sortAsc
                            : icons.sortNone}
                        </div>
                      </th>
                      {state.isManager ? <th className="text-center px-3 sm:px-4 py-3 text-xs font-medium text-gray-500 uppercase w-12 bg-gray-50" /> : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredVideos.map((video, index) => (
                      <tr className="hover:bg-gray-50" key={video.id}>
                        <td className="px-3 sm:px-4 py-3">
                          {state.editingVideoEditor === video.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={state.editingVideoEditorName}
                                onChange={(event) => updateState({ editingVideoEditorName: event.target.value })}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') handleSaveVideoEditor(video.id);
                                  if (event.key === 'Escape') handleCancelEdit();
                                }}
                                className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-violet-500"
                              />
                              <button onClick={() => handleSaveVideoEditor(video.id)} className="p-1 text-green-600 hover:text-green-700">
                                {icons.check}
                              </button>
                              <button onClick={handleCancelEdit} className="p-1 text-gray-400 hover:text-gray-600">
                                {icons.x}
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 bg-violet-100 rounded-full flex items-center justify-center shrink-0">
                                <span className="text-xs font-medium text-violet-600">{(video.editor || '?').charAt(0)}</span>
                              </div>
                              <span className="font-medium text-gray-900 text-sm">{video.editor || 'Unknown'}</span>
                              {state.isManager ? (
                                <button onClick={() => handleEditVideoEditor(video.id)} className="p-1 text-gray-400 hover:text-violet-600" title="Edit editor">
                                  {icons.edit}
                                </button>
                              ) : null}
                            </div>
                          )}
                        </td>
                        <td className="px-3 sm:px-4 py-3">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              video.platform === 'Instagram' ? 'bg-pink-100 text-pink-700' : 'bg-gray-900 text-white'
                            }`}
                          >
                            {video.platform}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 py-3">
                          <a
                            href={video.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-violet-600 hover:text-violet-800 text-xs sm:text-sm truncate block max-w-[200px]"
                          >
                            {video.url}
                          </a>
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm text-gray-600 whitespace-nowrap">
                          {new Date(video.postedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-right">
                          {state.editingVideoId === video.id ? (
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="number"
                                value={state.editingViews}
                                onChange={(event) => updateState({ editingViews: event.target.value })}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') handleSaveViews(video.id);
                                  if (event.key === 'Escape') handleCancelEdit();
                                }}
                                className="w-24 px-2 py-1 text-sm border border-gray-300 rounded text-right focus:outline-none focus:ring-2 focus:ring-violet-500"
                              />
                              <button onClick={() => handleSaveViews(video.id)} className="p-1 text-green-600 hover:text-green-700">
                                {icons.check}
                              </button>
                              <button onClick={handleCancelEdit} className="p-1 text-gray-400 hover:text-gray-600">
                                {icons.x}
                              </button>
                            </div>
                          ) : video.isFetching ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className="animate-spin">{icons.refresh}</span>
                              {/* <span className="text-xs text-gray-500">Fetching...</span> */}
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <span className={`font-semibold text-sm ${index === 0 ? 'text-green-600' : 'text-gray-900'}`}>
                                {formatNumber(video.views || 0)}
                              </span>
                              {state.isManager ? (
                                <button onClick={() => handleEditViews(video.id)} className="p-1 text-gray-400 hover:text-violet-600" title="Edit views">
                                  {icons.edit}
                                </button>
                              ) : null}
                            </div>
                          )}
                        </td>
                        {state.isManager ? (
                          <td className="px-3 sm:px-4 py-3 text-center">
                            <button onClick={() => handleRemoveVideo(video.id)} className="p-1 text-gray-400 hover:text-red-500">
                              {icons.trash}
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-gray-50 px-3 sm:px-4 py-3 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 text-sm">Net Results</span>
                  <div className="flex items-center gap-4 sm:gap-8">
                    <span className="text-xs sm:text-sm text-gray-600">
                      Total: <span className="font-semibold text-gray-900">{formatNumber(filteredVideos.reduce((sum, v) => sum + (v.views || 0), 0))}</span>
                    </span>
                    <span className="text-xs sm:text-sm text-gray-600">
                      Avg: <span className="font-semibold text-gray-900">{filteredVideos.length > 0 ? formatNumber(Math.round(filteredVideos.reduce((sum, v) => sum + (v.views || 0), 0) / filteredVideos.length)) : 0}</span>
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        ) : null}

        {state.activeTab === 'accountVideos' ? (
          <div className="bg-white rounded-xl border border-gray-200 mb-6">
            <div className="p-3 sm:p-4 border-b border-gray-200">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900">
                    {selectedAccount ? `@${selectedAccount.handle} Videos` : 'Account Videos'}
                  </h2>
                  <p className="text-xs text-gray-500">
                    {selectedAccount ? selectedAccount.platform : ''} • {accountVideos.length} videos
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="date-filter-wrapper relative">
                    <button
                      onClick={() => updateState({ showAccountPicker: !state.showAccountPicker })}
                      className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-xs sm:text-sm text-gray-700">
                        {selectedAccount ? `@${selectedAccount.handle}` : 'Select Account'}
                      </span>
                      {icons.chevronDown}
                    </button>

                    {state.showAccountPicker ? (
                      <div className="date-dropdown absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-2 max-h-60 overflow-y-auto">
                        {state.accounts.map((account) => (
                          <button
                            key={account.id}
                            onClick={() =>
                              updateState({
                                selectedAccountId: account.id,
                                showAccountPicker: false
                              })
                            }
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                              state.selectedAccountId === account.id ? 'text-violet-600 font-medium' : 'text-gray-700'
                            }`}
                          >
                            @{account.handle} {state.selectedAccountId === account.id ? '✓' : ''}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <button
                    onClick={() => updateState({ activeTab: 'accounts' })}
                    className="px-3 py-2 text-sm rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                  >
                    Back to Accounts
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">Views by Editor</h3>
                <div className="flex items-center gap-4 text-xs sm:text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-pink-500 rounded"></span>
                    <span>Instagram</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-gray-900 rounded"></span>
                    <span>TikTok</span>
                  </div>
                </div>
              </div>

              <div className="bar-chart">
                {accountAggregate.length > 0 ? (
                  accountAggregate.map((e) => (
                    <div className="bar-container" key={e.editor}>
                      <div className="flex items-end gap-1 justify-center">
                        <div className="relative" style={{ width: 'clamp(18px, 4vw, 32px)' }}>
                          <div
                            className="bg-pink-500 rounded-t transition-all hover:bg-pink-600"
                            style={{ height: `${Math.max((e.instagramViews / Math.max(1, ...accountAggregate.flatMap((a) => [a.instagramViews, a.tiktokViews]))) * 160, e.instagramViews > 0 ? 20 : 4)}px`, width: '100%' }}
                          />
                          {e.instagramViews > 0 ? (
                            <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-gray-600 whitespace-nowrap">
                              {formatViews(e.instagramViews)}
                            </span>
                          ) : null}
                        </div>
                        <div className="relative" style={{ width: 'clamp(18px, 4vw, 32px)' }}>
                          <div
                            className="bg-gray-900 rounded-t transition-all hover:bg-gray-700"
                            style={{ height: `${Math.max((e.tiktokViews / Math.max(1, ...accountAggregate.flatMap((a) => [a.instagramViews, a.tiktokViews]))) * 160, e.tiktokViews > 0 ? 20 : 4)}px`, width: '100%' }}
                          />
                          {e.tiktokViews > 0 ? (
                            <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-gray-600 whitespace-nowrap">
                              {formatViews(e.tiktokViews)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="editor-avatar bg-gradient-to-br from-violet-100 to-violet-200 rounded-lg border-2 border-violet-400 flex items-center justify-center overflow-hidden">
                        <span className="font-bold text-violet-600">{e.editor.charAt(0)}</span>
                      </div>
                      <span className="bar-name">{e.editor}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400 text-center w-full py-8">No data to display</p>
                )}
              </div>
            </div>

            <div className="overflow-x-auto overflow-y-auto max-h-[400px]">
              <table className="w-full min-w-[700px]">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-3 sm:px-4 py-3 text-xs font-medium text-gray-500 uppercase bg-gray-50">Platform</th>
                    <th className="text-left px-3 sm:px-4 py-3 text-xs font-medium text-gray-500 uppercase bg-gray-50">Video URL</th>
                    <th className="text-left px-3 sm:px-4 py-3 text-xs font-medium text-gray-500 uppercase bg-gray-50">Published</th>
                    <th className="text-right px-3 sm:px-4 py-3 text-xs font-medium text-gray-500 uppercase bg-gray-50">Views</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {accountVideos.map((video) => (
                    <tr className="hover:bg-gray-50" key={video.id}>
                      <td className="px-3 sm:px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${video.platform === 'Instagram' ? 'bg-pink-100 text-pink-700' : 'bg-gray-900 text-white'}`}>
                          {video.platform}
                        </span>
                      </td>
                      <td className="px-3 sm:px-4 py-3">
                        <a href={video.url} target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:text-violet-800 text-xs sm:text-sm truncate block max-w-[260px]">
                          {video.url}
                        </a>
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm text-gray-600 whitespace-nowrap">
                        {video.isFetching ? (
                          <span className="inline-flex items-center gap-2 text-gray-500">
                            <span className="animate-spin">{icons.refresh}</span>
                            {/* Fetching... */}
                          </span>
                        ) : video.postedDate ? (
                          new Date(video.postedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        ) : video.dateAdded ? (
                          new Date(video.dateAdded).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-right">
                        {video.isFetching ? (
                          <span className="inline-flex items-center gap-2 text-gray-500">
                            <span className="animate-spin">{icons.refresh}</span>
                            {/* Fetching... */}
                          </span>
                        ) : (
                          <span className="font-semibold text-sm text-gray-900">{formatNumber(video.views || 0)}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {(state.activeTab === 'home' || state.activeTab === 'accounts') ? (
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-3 sm:p-4 border-b border-gray-200">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900">Tracked Accounts</h2>
                  <p className="text-xs text-gray-500">
                    {state.isManager 
                      ? 'Add social media accounts to track. Videos from these accounts will use the default editor.'
                      : 'View tracked social media accounts and their videos.'}
                  </p>
                </div>
                {state.isManager ? (
                  <button
                    onClick={() => updateState({ showAddAccount: !state.showAddAccount })}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm"
                  >
                    {icons.plus} Add Account
                  </button>
                ) : null}
              </div>
            </div>

            {state.isManager && state.showAddAccount ? (
              <div className="p-3 sm:p-4 bg-gray-50 border-b border-gray-200">
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="url"
                    placeholder="Account URL (e.g. https://www.tiktok.com/@username)"
                  value={state.newAccountUrl}
                  onChange={(event) => updateState({ newAccountUrl: event.target.value })}
                    className="flex-1 min-w-[250px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Default Editor Name"
                  value={state.newAccountEditor}
                  onChange={(event) => updateState({ newAccountEditor: event.target.value })}
                    className="w-40 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
                  />
                  <button
                  onClick={handleAddAccount}
                    className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors text-sm"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => updateState({ showAddAccount: false })}
                    className="p-2 text-gray-500 hover:text-gray-700"
                  >
                    {icons.x}
                  </button>
                </div>
              </div>
            ) : null}

            {state.accounts.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-4xl mb-3">📱</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No accounts tracked</h3>
                <p className="text-sm text-gray-500">
                  Add Instagram or TikTok accounts to associate videos with editors automatically.
                </p>
              </div>
            ) : filteredAccounts.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-4xl mb-3">🔍</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No {state.platformFilter} accounts</h3>
                <p className="text-sm text-gray-500">
                  You have {state.accounts.length} account{state.accounts.length !== 1 ? 's' : ''} total on other platforms.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 sm:px-4 py-3 text-xs font-medium text-gray-500 uppercase">Platform</th>
                      <th className="text-left px-3 sm:px-4 py-3 text-xs font-medium text-gray-500 uppercase">Account</th>
                      <th className="text-left px-3 sm:px-4 py-3 text-xs font-medium text-gray-500 uppercase">Default Editor</th>
                      <th className="text-left px-3 sm:px-4 py-3 text-xs font-medium text-gray-500 uppercase">Last Refreshed</th>
                      <th className="text-center px-3 sm:px-4 py-3 text-xs font-medium text-gray-500 uppercase">Videos</th>
                      {state.isManager ? <th className="text-center px-3 sm:px-4 py-3 text-xs font-medium text-gray-500 uppercase w-12" /> : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredAccounts.map((account) => {
                      return (
                        <tr className="hover:bg-gray-50" key={account.id}>
                          <td className="px-3 sm:px-4 py-3">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                account.platform === 'Instagram' ? 'bg-pink-100 text-pink-700' : 'bg-gray-900 text-white'
                              }`}
                            >
                              {account.platform}
                            </span>
                          </td>
                          <td className="px-3 sm:px-4 py-3">
                            <a href={account.url} target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:text-violet-800 text-sm font-medium">
                              @{account.handle}
                            </a>
                          </td>
                          <td className="px-3 sm:px-4 py-3">
                            {state.isManager && state.editingAccountId === account.id ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={state.editingAccountEditor}
                                  onChange={(event) => updateState({ editingAccountEditor: event.target.value })}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter') handleSaveAccountEditor(account.id);
                                    if (event.key === 'Escape') handleCancelEdit();
                                  }}
                                  className="w-32 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-violet-500"
                                />
                                <button onClick={() => handleSaveAccountEditor(account.id)} className="p-1 text-green-600 hover:text-green-700">
                                  {icons.check}
                                </button>
                                <button onClick={handleCancelEdit} className="p-1 text-gray-400 hover:text-gray-600">
                                  {icons.x}
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-900">{account.defaultEditor}</span>
                                {state.isManager ? (
                                  <button onClick={() => handleEditAccountEditor(account.id)} className="p-1 text-gray-400 hover:text-violet-600" title="Edit default editor">
                                    {icons.edit}
                                  </button>
                                ) : null}
                              </div>
                            )}
                          </td>
                          <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm text-gray-600">
                            {account.lastRefreshed ? formatRelativeTime(account.lastRefreshed) : 'Never'}
                          </td>
                          <td className="px-3 sm:px-4 py-3 text-center">
                            <button
                              onClick={() => updateState({ selectedAccountId: account.id, activeTab: 'accountVideos' })}
                              className="px-3 py-1 text-xs font-medium rounded-full bg-violet-100 text-violet-700 hover:bg-violet-200"
                            >
                              View Videos
                            </button>
                          </td>
                          {state.isManager ? (
                            <td className="px-3 sm:px-4 py-3 text-center">
                              <button onClick={() => handleRemoveAccount(account.id)} className="p-1 text-gray-400 hover:text-red-500">
                                {icons.trash}
                              </button>
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
