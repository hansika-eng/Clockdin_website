import React, { useEffect, useMemo, useRef, useState } from 'react';
import EventCard from './EventCard';
import EventModal from './EventModal';
import '../Events.css';
import { getBookmarkStorageKeys } from '../utils/bookmarkStorage';

const normalize = (val) => (val || '').toString().trim();
const normalizeLower = (val) => normalize(val).toLowerCase();
const prettyLabel = (val) => normalize(val)
  .split(/[_\-\s]+/)
  .map(part => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

const normalizeCategorySelection = (val) => {
  const base = normalize(val).toLowerCase();
  return base.endsWith('s') ? base.slice(0, -1) : base;
};

const getCategory = (ev) => normalize(ev.eventType || ev.category || ev.type);
const getLevel = (ev) => normalize(ev.difficulty || ev.level || ev.skillLevel);
const getMode = (ev) => normalize(ev.mode);
const getCollege = (ev) => normalize(ev.college || ev.collegeName || ev.organizer || ev.organizerName || ev.location);

const Bookmarks = () => {
  const [bookmarks, setBookmarks] = useState(() => {
    const { dataKey } = getBookmarkStorageKeys();
    const data = localStorage.getItem(dataKey);
    return data ? JSON.parse(data) : [];
  });
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All Categories');
  const [level, setLevel] = useState('All Levels');
  const [mode, setMode] = useState('All Modes');
  const [college, setCollege] = useState('All Colleges');
  const [sortBy, setSortBy] = useState('deadline-asc');
  const [deadlineFilter, setDeadlineFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all'); // 🔹 NEW: all | liked
  const [expandedCards, setExpandedCards] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const contentRefs = useRef({});

  const CARDS_PER_PAGE = 12; // 4 rows × 3 cards

  function daysUntilDeadline(deadline) {
    if (!deadline) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadlineDate = new Date(deadline);
    deadlineDate.setHours(0, 0, 0, 0);
    const diff = deadlineDate - today;
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  }

  const categoryOptions = useMemo(() => (
    ['All Categories', 'Hackathons', 'Internships', 'Workshops', 'Competitions', 'Seminars']
  ), []);

  const levelOptions = useMemo(() => (
    ['All Levels', 'Beginner', 'Intermediate', 'Advanced']
  ), []);

  const modeOptions = useMemo(() => {
    const vals = new Set();
    bookmarks.forEach(ev => {
      const val = getMode(ev);
      if (val) vals.add(prettyLabel(val));
    });
    return ['All Modes', ...Array.from(vals).sort()];
  }, [bookmarks]);

  const collegeOptions = useMemo(() => {
    const vals = new Set();
    bookmarks.forEach(ev => {
      const val = getCollege(ev);
      if (val) vals.add(prettyLabel(val));
    });
    return ['All Colleges', ...Array.from(vals).sort()];
  }, [bookmarks]);

  const stats = useMemo(() => {
    const total = bookmarks.length;
    let upcoming = 0;
    let close = 0;
    let completed = 0;
    let archived = 0;

    bookmarks.forEach(ev => {
      if (ev.isArchived) {
        archived += 1;
        return;
      }
      const days = daysUntilDeadline(ev.deadline);
      if (days === null) return;
      if (days < 0) {
        completed += 1;
        return;
      }
      upcoming += 1;
      if (days <= 3) close += 1;
    });

    return { total, upcoming, close, completed, archived };
  }, [bookmarks]);

  // Filter bookmarks by search and attributes
  let filteredBookmarks = bookmarks.filter(ev => {
    const matchesSearch =
      (ev.title && ev.title.toLowerCase().includes(search.toLowerCase())) ||
      (ev.description && ev.description.toLowerCase().includes(search.toLowerCase()));

    const catLabel = prettyLabel(getCategory(ev));
    const matchesCat = category === 'All Categories' ||
      normalizeCategorySelection(catLabel) === normalizeCategorySelection(category);

    const levelLabel = prettyLabel(getLevel(ev));
    const matchesLevel = level === 'All Levels' || levelLabel === level;

    const modeLabel = prettyLabel(getMode(ev));
    const matchesMode = mode === 'All Modes' || modeLabel === mode;

    const collegeLabel = prettyLabel(getCollege(ev));
    const matchesCollege = college === 'All Colleges' || collegeLabel === college;

    // Archived filter logic
    if (deadlineFilter === 'archived') {
      return ev.isArchived && matchesSearch && matchesCat && matchesLevel && matchesMode && matchesCollege;
    }

    if (ev.isArchived) return false;

    return matchesSearch && matchesCat && matchesLevel && matchesMode && matchesCollege;
  });

  // 🔹 Filter by type (All / Liked Only)
  if (typeFilter === 'liked') {
    filteredBookmarks = filteredBookmarks.filter(ev => ev.isLiked); 
    // If your field is different, e.g. ev.liked, change here.
  }

  // Categorize deadlines
  const categorizeDeadline = (deadline) => {
    if (!deadline) return 'upcoming';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadlineDate = new Date(deadline);
    deadlineDate.setHours(0, 0, 0, 0);
    const diff = deadlineDate - today;
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    
    if (days < 0) return 'completed';
    if (days === 0) return 'immediate';
    if (days <= 3) return 'urgent';
    return 'upcoming';
  };

  // Filter by deadline category (non-archived only)
  if (deadlineFilter !== 'all' && deadlineFilter !== 'archived') {
    filteredBookmarks = filteredBookmarks.filter(ev => 
      categorizeDeadline(ev.deadline) === deadlineFilter
    );
  }

  // Sort options
  filteredBookmarks = filteredBookmarks.sort((a, b) => {
    const deadlineA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
    const deadlineB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
    const eventDateA = a.eventDate ? new Date(a.eventDate).getTime() : Infinity;
    const eventDateB = b.eventDate ? new Date(b.eventDate).getTime() : Infinity;
    const titleA = normalizeLower(a.title);
    const titleB = normalizeLower(b.title);

    switch (sortBy) {
      case 'deadline-desc':
        return deadlineB - deadlineA;
      case 'event-asc':
        return eventDateA - eventDateB;
      case 'event-desc':
        return eventDateB - eventDateA;
      case 'title-asc':
        return titleA.localeCompare(titleB);
      default: // deadline-asc
        return deadlineA - deadlineB || eventDateA - eventDateB;
    }
  });

  // Pagination
  const totalPages = Math.ceil(filteredBookmarks.length / CARDS_PER_PAGE);
  const startIndex = (currentPage - 1) * CARDS_PER_PAGE;
  const endIndex = startIndex + CARDS_PER_PAGE;
  const paginatedBookmarks = filteredBookmarks.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, category, level, mode, college, deadlineFilter, typeFilter, sortBy]);

  // 🔹 NEW: Sync bookmarks with localStorage on changes
  useEffect(() => {
    const refresh = () => {
      const { dataKey } = getBookmarkStorageKeys();
      const data = localStorage.getItem(dataKey);
      setBookmarks(data ? JSON.parse(data) : []);
    };

    const onStorage = (e) => {
      // storage event fires for cross-window changes; we refresh when bookmark keys change
      if (!e.key || e.key.includes('bookmark')) refresh();
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('bookmarks-changed', refresh);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('bookmarks-changed', refresh);
    };
  }, []);

  const handleUnbookmarkFromObj = (eventObj) => {
    const id = eventObj._id || eventObj.id || eventObj.title;
    const updated = bookmarks.filter(ev => (ev._id || ev.id || ev.title) !== id);
    setBookmarks(updated);
    const { dataKey, idsKey } = getBookmarkStorageKeys();
    localStorage.setItem(dataKey, JSON.stringify(updated));
    const ids = JSON.parse(localStorage.getItem(idsKey) || '[]').filter(i => i !== id);
    localStorage.setItem(idsKey, JSON.stringify(ids));
  };

  const handleClearAll = () => {
    if (!bookmarks.length) return;
    if (!window.confirm('Clear all bookmarks? This cannot be undone.')) return;
    setBookmarks([]);
    const { dataKey, idsKey } = getBookmarkStorageKeys();
    localStorage.removeItem(dataKey);
    localStorage.removeItem(idsKey);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    try {
      return new Date(date).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    } catch {
      return 'N/A';
    }
  };

  const getDeadlineStyles = (deadline) => {
    const days = daysUntilDeadline(deadline);
    if (days === null) return { bg: '#f3f4f6', border: '#e5e7eb', text: '#6b7280', icon: '#9ca3af' };
    // 🔹 CHANGED: expired events now use neutral grey instead of red
    if (days < 0) return { bg: '#f3f4f6', border: '#e5e7eb', text: '#6b7280', icon: '#9ca3af' };
    if (days === 0) return { bg: '#fed7aa', border: '#fdba74', text: '#d97706', icon: '#f59e0b' };
    if (days <= 3) return { bg: '#fecaca', border: '#fca5a5', text: '#dc2626', icon: '#ef4444' };
    if (days <= 7) return { bg: '#fef3c7', border: '#fde68a', text: '#d97706', icon: '#f59e0b' };
    return { bg: '#dbeafe', border: '#bfdbfe', text: '#0284c7', icon: '#0ea5e9' };
  };

  const getDeadlineBadgeText = (deadline) => {
    const days = daysUntilDeadline(deadline);
    if (days === null) return 'No Deadline';
    if (days < 0) return 'Expired';
    if (days === 0) return 'Today!';
    if (days <= 3) return 'Urgent';
    if (days <= 7) return 'Soon';
    return 'Upcoming';
  };

  const deadlineFilterOptions = [
    { value: 'all', label: 'All Events', icon: 'bi-calendar' },
    { value: 'immediate', label: 'Immediate', icon: 'bi-exclamation-circle-fill', color: '#d97706' },
    { value: 'urgent', label: 'Urgent', icon: 'bi-exclamation-triangle-fill', color: '#dc2626' },
    { value: 'upcoming', label: 'Upcoming', icon: 'bi-calendar-check', color: '#0284c7' },
    { value: 'completed', label: 'Completed', icon: 'bi-check-circle-fill', color: '#6b7280' },
    { value: 'archived', label: 'Archived', icon: 'bi-archive', color: '#0f172a' },
  ];

  const checkIfNeedsExpand = (eventId) => {
    const ref = contentRefs.current[eventId];
    if (ref && ref.scrollHeight > 420) {
      return true;
    }
    return false;
  };

  const needsExpand = (eventId) => {
    return checkIfNeedsExpand(eventId);
  };

  const toggleExpanded = (eventId) => {
    setExpandedCards(prev => ({
      ...prev,
      [eventId]: !prev[eventId]
    }));
  };

  const handleEventClick = (event) => {
    setSelectedEvent(event);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedEvent(null);
  };

  const handleUnarchive = (eventObj) => {
    const updated = bookmarks.map(ev => {
      if ((ev._id || ev.id || ev.title) === (eventObj._id || eventObj.id || eventObj.title)) {
        const clone = { ...ev };
        delete clone.isArchived;
        return clone;
      }
      return ev;
    });
    setBookmarks(updated);
    const { dataKey } = getBookmarkStorageKeys();
    localStorage.setItem(dataKey, JSON.stringify(updated));
    if (window?.toast) {
      window.toast('Event restored from archive.', { type: 'success' });
    }
  };

  const archiveCompleted = () => {
    const updated = bookmarks.map(ev => {
      const days = daysUntilDeadline(ev.deadline);
      const shouldArchive = days !== null && days <= 0;
      if (shouldArchive) {
        return { ...ev, isArchived: true };
      }
      return ev;
    });
    setBookmarks(updated);
    const { dataKey } = getBookmarkStorageKeys();
    localStorage.setItem(dataKey, JSON.stringify(updated));
    // Optional toast
    if (window?.toast) {
      window.toast('Completed events archived.', { type: 'success' });
    } else {
      console.log('Completed events archived.');
    }
  };

  const exportUpcomingPdf = () => {
    const upcoming = bookmarks.filter(ev => {
      if (ev.isArchived) return false;
      const days = daysUntilDeadline(ev.deadline);
      return days !== null && days > 0;
    });

    const html = `<!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Upcoming Bookmarked Events</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
          h1 { margin-bottom: 12px; }
          .event { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
          .title { font-weight: 700; font-size: 16px; margin-bottom: 6px; }
          .meta { color: #4b5563; font-size: 13px; margin-bottom: 4px; }
          .desc { color: #1f2937; font-size: 13px; }
        </style>
      </head>
      <body>
        <h1>Upcoming Bookmarked Events</h1>
        ${upcoming.map(ev => `
          <div class="event">
            <div class="title">${ev.title || 'Untitled Event'}</div>
            <div class="meta">Deadline: ${ev.deadline ? new Date(ev.deadline).toLocaleDateString() : 'N/A'}</div>
            <div class="meta">Event Date: ${ev.eventDate ? new Date(ev.eventDate).toLocaleDateString() : 'N/A'}</div>
            <div class="meta">Location: ${ev.location || 'TBD'}</div>
            <div class="desc">${ev.description || 'No description provided.'}</div>
          </div>
        `).join('') || '<p>No upcoming bookmarked events.</p>'}
        <script>window.print(); window.onafterprint = () => window.close();</script>
      </body>
      </html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
    }
  };

  return (
    <div className="container mt-4" style={{maxWidth: '1400px'}}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h1 style={{fontWeight:800, fontSize:'2.3rem', color:'#22223b'}}>Bookmarked Events</h1>
          <div style={{color:'#64748b', fontSize:'1.1rem'}}>All your saved events in one place</div>
        </div>
        <button
          className="btn btn-danger d-flex align-items-center gap-2"
          style={{borderRadius:'1.2rem', fontWeight:700, padding:'0.55rem 0.9rem'}}
          onClick={handleClearAll}
          disabled={bookmarks.length === 0}
          title="Clear all bookmarks"
        >
          <i className="bi bi-trash"></i> Clear All
        </button>
      </div>

      {/* Summary Stats */}
      <div className="row g-3 mb-3">
        {[
          { label: 'Total Bookmarked', value: stats.total, icon: 'bi-bookmark-fill', accent: '#0ea5e9' },
          { label: 'Upcoming', value: stats.upcoming, icon: 'bi-calendar2-event', accent: '#16a34a' },
          { label: 'Close Deadlines', value: stats.close, icon: 'bi-alarm-fill', accent: '#f59e0b' },
          { label: 'Completed', value: stats.completed, icon: 'bi-check-circle-fill', accent: '#6b7280' }
        ].map(card => (
              <div className="col-12 col-md-6 col-xl-3" key={card.label}>
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e5e7eb',
              borderRadius: '1rem',
              padding: '1rem 1.2rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.9rem'
            }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '0.9rem',
                background: `${card.accent}1a`,
                color: card.accent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.1rem'
              }}>
                <i className={`bi ${card.icon}`}></i>
              </div>
              <div>
                <div style={{fontWeight: 800, fontSize: '1.4rem', color: '#0f172a'}}>{card.value}</div>
                <div style={{color: '#64748b', fontWeight: 600}}>{card.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Row */}
      <div
        className="d-flex align-items-center gap-3 mb-3"
        style={{flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: '0.25rem'}}
      >
        <input
          className="form-control"
          style={{maxWidth: '320px'}}
          placeholder="Search bookmarks..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <select
          className="form-select"
          style={{minWidth: '170px'}}
          value={category}
          onChange={e => setCategory(e.target.value)}
        >
          {categoryOptions.map(opt => <option key={opt}>{opt}</option>)}
        </select>

        <select
          className="form-select"
          style={{minWidth: '150px'}}
          value={level}
          onChange={e => setLevel(e.target.value)}
        >
          {levelOptions.map(opt => <option key={opt}>{opt}</option>)}
        </select>

        <select
          className="form-select"
          style={{minWidth: '150px'}}
          value={mode}
          onChange={e => setMode(e.target.value)}
        >
          {modeOptions.map(opt => <option key={opt}>{opt}</option>)}
        </select>

        <select
          className="form-select"
          style={{minWidth: '170px'}}
          value={college}
          onChange={e => setCollege(e.target.value)}
        >
          {collegeOptions.map(opt => <option key={opt}>{opt}</option>)}
        </select>

        <select
          className="form-select"
          style={{minWidth: '170px'}}
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
        >
          <option value="deadline-asc">Default</option>
          <option value="deadline-desc">Deadline: Latest</option>
          <option value="event-asc">Event Date: Soonest</option>
          <option value="event-desc">Event Date: Latest</option>
          <option value="title-asc">Title: A → Z</option>
        </select>

        <div className="ms-auto d-flex align-items-center gap-2" style={{minWidth: '150px'}}>
          <span style={{color:'#64748b', fontSize:'0.9rem'}}>Show:</span>
          <select
            className="form-select"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
          >
            <option value="all">All Saved</option>
            <option value="liked">Liked Only</option>
          </select>
        </div>
      </div>

      {/* Deadline Filter Buttons */}
      <div className="d-flex gap-2 mb-4 flex-wrap">
        {deadlineFilterOptions.map(option => (
          <button
            key={option.value}
            className={`btn ${deadlineFilter === option.value ? 'btn-primary' : 'btn-outline-secondary'}`}
            style={{
              fontWeight: 600,
              borderRadius: '0.8rem',
              padding: '0.5rem 1rem',
              transition: 'all 0.2s ease'
            }}
            onClick={() => setDeadlineFilter(option.value)}
          >
            <i className={`bi ${option.icon} me-2`}></i>
            {option.label}
          </button>
        ))}
      </div>

      {filteredBookmarks.length === 0 ? (
        <div className="d-flex flex-column align-items-center justify-content-center" style={{background:'#fff', borderRadius:'1.2rem', minHeight:'340px', border:'1.5px solid #e5e7eb'}}>
          <i className="bi bi-bookmark" style={{fontSize:'3.5rem', color:'#cbd5e1', marginBottom:'1rem'}}></i>
          <div style={{fontWeight:700, fontSize:'1.3rem', color:'#22223b'}}>No bookmarks found</div>
          <div style={{color:'#64748b', fontSize:'1.08rem', marginBottom:'1.5rem'}}>Try adjusting your filters or bookmark new events.</div>
        </div>
      ) : (
        <>
          <div className="row g-4" style={{marginBottom:'3rem'}}>
            {paginatedBookmarks.map((ev, idx) => {
              const key = ev._id || ev.id || idx;
              const days = daysUntilDeadline(ev.deadline);
              const isExpanded = expandedCards[key];
              const showsMoreButton = needsExpand(key);
              const deadlineStyles = getDeadlineStyles(ev.deadline);

              return (
                <div className="col-md-6 col-lg-4" key={key}>
                  <div 
                    onClick={() => handleEventClick(ev)}
                    style={{
                      position:'relative', 
                      border: days !== null && days <= 3 ? `2px solid ${deadlineStyles.border}` : '1px solid #e5e7eb',
                      borderRadius: '1rem', 
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      height: '100%',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                      transition: 'all 0.2s ease',
                      background: '#fff',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.12)'}
                    onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'}
                  >
                    {/* Event Card with Fixed Height */}
                    <div 
                      ref={el => contentRefs.current[key] = el}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        maxHeight: isExpanded ? 'none' : '420px',
                        overflow: isExpanded ? 'visible' : 'hidden',
                        transition: 'max-height 0.3s ease-in-out',
                        display: 'flex',
                        flexDirection: 'column',
                        flex: 1
                      }}>
                      <EventCard event={ev} showBookmark={false} showActions={false} />
                    </div>

                    {/* Enhanced Deadline Info */}
                    {ev.deadline && (
                      <div 
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          padding:'1rem',
                          background: deadlineStyles.bg,
                          borderTop: `2px solid ${deadlineStyles.border}`,
                          borderBottom: showsMoreButton ? `1px solid #e5e7eb` : 'none'
                        }}>
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div className="d-flex align-items-center gap-2 flex-grow-1">
                            <i className={`bi bi-calendar2-check`} style={{color: deadlineStyles.icon, fontSize: '1.2rem'}}></i>
                            <div>
                              <div style={{fontWeight:700, fontSize:'0.9rem', color: deadlineStyles.text}}>
                                {formatDate(ev.deadline)}
                              </div>
                              <div style={{fontWeight:600, fontSize:'0.75rem', color: deadlineStyles.text, opacity: 0.8, marginTop: '0.2rem'}}>
                                {days < 0 
                                  ? `Expired ${Math.abs(days)} days ago` 
                                  : days === 0 
                                  ? 'Deadline is today!' 
                                  : `${days} day${days !== 1 ? 's' : ''} remaining`}
                              </div>
                            </div>
                          </div>
                          <span className="badge" style={{
                            background: deadlineStyles.text,
                            color: '#fff',
                            fontWeight: 700,
                            padding: '0.35rem 0.7rem',
                            fontSize: '0.75rem',
                            borderRadius: '0.5rem'
                          }}>
                            {getDeadlineBadgeText(ev.deadline)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div 
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        display:'flex', 
                        justifyContent:'space-between', 
                        gap:'0.75rem', 
                        padding:'0.75rem 1rem',
                        background:'#fff',
                        borderTop:'1px solid #e5e7eb',
                        flexWrap: 'wrap'
                      }}>
                      {showsMoreButton && (
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          style={{fontWeight:700, borderRadius:'0.6rem', flex: 1, minWidth: '120px'}}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpanded(key);
                          }}
                        >
                          <i className={`bi bi-chevron-${isExpanded ? 'up' : 'down'} me-1`}></i>
                          {isExpanded ? 'Show Less' : 'Show More'}
                        </button>
                      )}
                      {deadlineFilter === 'archived' && (
                        <button
                          className="btn btn-sm btn-outline-primary"
                          style={{fontWeight:700, borderRadius:'0.6rem', flex: 1, minWidth: '120px'}}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUnarchive(ev);
                          }}
                        >
                          <i className="bi bi-arrow-counterclockwise me-1"></i>Unarchive
                        </button>
                      )}
                      <button
                        className="btn btn-sm btn-outline-danger"
                        style={{fontWeight:700, borderRadius:'0.6rem', flex: 1, minWidth: '120px'}}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm('Remove this event from bookmarks?')) {
                            handleUnbookmarkFromObj(ev);
                          }
                        }}
                      >
                        <i className="bi bi-trash me-1"></i>Unbookmark
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{
              display:'flex',
              justifyContent:'center',
              alignItems:'center',
              gap:'1rem',
              marginBottom:'3rem'
            }}>
              <button
                className="btn btn-outline-secondary"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                style={{fontWeight:600, borderRadius:'0.6rem'}}
              >
                <i className="bi bi-chevron-left me-1"></i>Previous
              </button>

              <div style={{display:'flex', gap:'0.5rem', flexWrap:'wrap', justifyContent:'center'}}>
                {Array.from({length: totalPages}, (_, i) => (
                  <button
                    key={i + 1}
                    className={currentPage === i + 1 ? 'btn btn-primary' : 'btn btn-outline-secondary'}
                    onClick={() => setCurrentPage(i + 1)}
                    style={{fontWeight:600, borderRadius:'0.6rem', minWidth:'40px'}}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              <button
                className="btn btn-outline-secondary"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                style={{fontWeight:600, borderRadius:'0.6rem'}}
              >
                Next<i className="bi bi-chevron-right ms-1"></i>
              </button>
            </div>
          )}

          {/* Page Info */}
          <div style={{textAlign:'center', color:'#64748b', marginBottom:'2rem', fontSize:'0.95rem'}}>
            Showing {startIndex + 1} - {Math.min(endIndex, filteredBookmarks.length)} of {filteredBookmarks.length} bookmarked event{filteredBookmarks.length !== 1 ? 's' : ''}
          </div>

          {/* Bottom actions */}
          <div className="d-flex gap-2 justify-content-center mb-4">
            <button
              className="btn btn-danger"
              style={{fontWeight:700, borderRadius:'0.8rem', padding:'0.65rem 1.1rem'}}
              onClick={archiveCompleted}
            >
              <i className="bi bi-archive me-2"></i>Archive Completed
            </button>
            <button
              className="btn btn-outline-secondary"
              style={{fontWeight:700, borderRadius:'0.8rem', padding:'0.65rem 1.1rem'}}
              onClick={exportUpcomingPdf}
            >
              <i className="bi bi-file-earmark-pdf me-2"></i>Export as PDF
            </button>
          </div>
        </>
      )}

      {/* Event Modal */}
      <EventModal
        event={selectedEvent}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
};

export default Bookmarks;