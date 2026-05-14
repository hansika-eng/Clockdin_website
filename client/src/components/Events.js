import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import EventCard from './EventCard';
import EventModal from './EventModal';
import '../Events.css';
import axios from 'axios';
import { getBookmarkStorageKeys } from '../utils/bookmarkStorage';

const Events = () => {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [tab, setTab] = useState('featured');
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [quickPreset, setQuickPreset] = useState('');
  const [modeFilters, setModeFilters] = useState([]); // online | offline | hybrid
  const [levelFilters, setLevelFilters] = useState([]); // beginner | intermediate | advanced
  const [selectedTags, setSelectedTags] = useState([]);
  const [sortBy, setSortBy] = useState('soonest');
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const [archivedOnly, setArchivedOnly] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  const CARDS_PER_PAGE = 12; // 4 rows × 3 cards

// FETCH EVENTS FROM DATABASE
useEffect(() => {

  axios
    .get('https://clockdin-backend-re7k.onrender.com/api/events')
    .then((res) => {

      console.log("Fetched DB Events:", res.data);

      // normalize DB data for existing UI
      const normalizedEvents = res.data.map(event => ({

        ...event,

        featured: event.featured || false,
        image: event.image || '',
        mode: event.mode || 'Mode TBD',
        duration: event.duration || 'Duration TBD',
        difficulty: event.difficulty || 'Intermediate',

        tags: Array.isArray(event.tags)
          ? event.tags
          : [],

        applyLink:
          event.applyLink ||
          event.link ||
          '#',

        location:
          event.location ||
          'Location TBD',

        description:
          event.description ||
          'No description available.'

      }));

      setEvents(normalizedEvents);

    })
    .catch((err) => {
      console.log("EVENT FETCH ERROR:", err);
    });

}, []);

  // Set category from navigation state
  useEffect(() => {
    if (location.state && location.state.category) {
      setActiveCategory(location.state.category);
      setTab('upcoming');
    }
  }, [location.state]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const eventId = params.get('eventId');
    if (!eventId) return;
    const normalizedId = eventId.toString();
    const matchingEvent = events.find(ev => {
      const identifiers = [ev._id, ev.id, ev.title]
        .filter(Boolean)
        .map(id => id.toString());
      return identifiers.includes(normalizedId);
    });
    if (matchingEvent) {
      setSelectedEvent(matchingEvent);
      setIsModalOpen(true);
    }
  }, [location.search, events]);

  // Bookmark logic (needed early for filter computations)
  const [bookmarkedIds, setBookmarkedIds] = useState(() => {
    const saved = localStorage.getItem('bookmarkedEvents');
    return saved ? JSON.parse(saved) : [];
  });

  const popularTags = useMemo(() => {
    const tagSet = new Set();
    events.forEach(ev => {
      (ev.tags || []).forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).slice(0, 12);
  }, [events]);

  const toggleValue = (list, value) => (
    list.includes(value) ? list.filter(v => v !== value) : [...list, value]
  );

  const formatInputDate = (date) => date.toISOString().split('T')[0];
  const addDays = (date, days) => new Date(date.getTime() + days * 86400000);

  const handlePresetSelect = (preset) => {
    const today = new Date();
    setQuickPreset(preset);

    if (preset === '7d') {
      setStartDate(formatInputDate(today));
      setEndDate(formatInputDate(addDays(today, 7)));
    } else if (preset === '30d') {
      setStartDate(formatInputDate(today));
      setEndDate(formatInputDate(addDays(today, 30)));
    } else if (preset === 'weekend') {
      const day = today.getDay();
      const daysUntilSaturday = (6 - day + 7) % 7;
      const saturday = addDays(today, daysUntilSaturday);
      const sunday = addDays(saturday, 1);
      setStartDate(formatInputDate(saturday));
      setEndDate(formatInputDate(sunday));
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  const clearAllFilters = () => {
    setGlobalSearch('');
    setActiveCategory('all');
    setStartDate('');
    setEndDate('');
    setQuickPreset('');
    setModeFilters([]);
    setLevelFilters([]);
    setSelectedTags([]);
    setSortBy('soonest');
    setBookmarkedOnly(false);
    setArchivedOnly(false);
  };

  const saveFilters = () => {
    const payload = {
      globalSearch,
      activeCategory,
      startDate,
      endDate,
      quickPreset,
      modeFilters,
      levelFilters,
      selectedTags,
      sortBy,
      bookmarkedOnly,
      archivedOnly,
    };
    localStorage.setItem('clockdin_event_filters', JSON.stringify(payload));
  };

  const applyFilters = () => {
    setIsSidebarOpen(false);
  };

  // Filtering logic with global search and sidebar filters
  const now = new Date();
  let filteredEvents = events.filter(event => {
    const eventDate = event.eventDate ? new Date(event.eventDate) : null;

    // Tab filter - only show upcoming events
    if (tab === 'featured') {
      // Show all events
    } else if (tab === 'upcoming') {
      if (!eventDate || isNaN(eventDate.getTime()) || eventDate < now) return false;
    }

    // Category filter
    if (activeCategory !== 'all') {
      const typeMap = {
        Hackathon: 'hackathon',
        Internship: 'internship',
        Workshop: 'workshop',
        'Student Competition': 'competition',
        Seminar: 'seminar',
      };
      const eventType = (event.type || '').toLowerCase();
      if (activeCategory in typeMap) {
        if (eventType !== typeMap[activeCategory]) return false;
      }
    }

    // Date range filters
    if (startDate && eventDate) {
      const start = new Date(startDate);
      if (eventDate < start) return false;
    }
    if (endDate && eventDate) {
      const end = new Date(endDate);
      if (eventDate > end) return false;
    }

    // Mode filter
    if (modeFilters.length) {
      const modeLower = (event.mode || '').toLowerCase();
      if (!modeFilters.some(m => modeLower.includes(m))) return false;
    }

    // Skill level filter
    if (levelFilters.length) {
      const difficulty = (event.difficulty || '').toLowerCase();
      if (!levelFilters.includes(difficulty)) return false;
    }

    // Tags filter
    if (selectedTags.length) {
      const tags = (event.tags || []).map(t => t.toLowerCase());
      if (!selectedTags.some(tag => tags.includes(tag.toLowerCase()))) return false;
    }

    // Bookmarked only filter
    if (bookmarkedOnly && !bookmarkedIds.includes(event._id)) return false;

    // Archived only filter (fallback to event.archived / isArchived flags)
    if (archivedOnly && !(event.archived || event.isArchived)) return false;
    if (!archivedOnly && (event.archived || event.isArchived)) return false;

    // Global search filter
    if (globalSearch.trim()) {
      const searchLower = globalSearch.toLowerCase();
      const searchableText = [
        event.title,
        event.description,
        event.detailedDescription,
        event.organizerReputation,
        event.location,
        event.tags ? event.tags.join(' ') : '',
      ].join(' ').toLowerCase();

      if (!searchableText.includes(searchLower)) return false;
    }

    return true;
  });

  // Sorting
  filteredEvents = [...filteredEvents].sort((a, b) => {
    const dateA = a.eventDate ? new Date(a.eventDate).getTime() : 0;
    const dateB = b.eventDate ? new Date(b.eventDate).getTime() : 0;
    const deadlineA = a.deadline ? new Date(a.deadline).getTime() : 0;
    const deadlineB = b.deadline ? new Date(b.deadline).getTime() : 0;

    switch (sortBy) {
      case 'latest':
        return dateB - dateA;
      case 'deadline':
        return deadlineA - deadlineB;
      case 'alpha':
        return (a.title || '').localeCompare(b.title || '');
      case 'featured':
        return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
      case 'soonest':
      default:
        return dateA - dateB;
    }
  });

  // Pagination
  const totalPages = Math.ceil(filteredEvents.length / CARDS_PER_PAGE);
  const startIndex = (currentPage - 1) * CARDS_PER_PAGE;
  const endIndex = startIndex + CARDS_PER_PAGE;
  const paginatedEvents = filteredEvents.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    globalSearch,
    activeCategory,
    tab,
    startDate,
    endDate,
    quickPreset,
    modeFilters,
    levelFilters,
    selectedTags,
    bookmarkedOnly,
    archivedOnly,
    sortBy,
  ]);

  const stats = [
  {
    label: 'Upcoming Events',
    value: events.length,
    color: '#3b5bfd'
  },
  {
    label: 'Hackathons',
    value: events.filter(
      e => (e.type || '').toLowerCase() === 'hackathon'
    ).length,
    color: '#16a34a'
  },
  {
    label: 'Internships',
    value: events.filter(
      e => (e.type || '').toLowerCase() === 'internship'
    ).length,
    color: '#f59e1b'
  },
  {
    label: 'Students',
    value: '25K+',
    color: '#334155'
  },
];

  const categoryCounts = useMemo(() => ({
    all: events.length,
    Hackathon: events.filter(e => (e.type || '').toLowerCase() === 'hackathon').length,
    Internship: events.filter(e => (e.type || '').toLowerCase() === 'internship').length,
    Workshop: events.filter(e => (e.type || '').toLowerCase() === 'workshop').length,
    'Student Competition': events.filter(e => (e.type || '').toLowerCase() === 'competition').length,
    Seminar: events.filter(e => (e.type || '').toLowerCase() === 'seminar').length,
  }), [events]);

  const categories = [
    { label: 'All', icon: 'bi-calendar', count: categoryCounts.all, key: 'all' },
    { label: 'Hackathons', icon: 'bi-trophy', count: categoryCounts.Hackathon, key: 'Hackathon' },
    { label: 'Internships', icon: 'bi-briefcase', count: categoryCounts.Internship, key: 'Internship' },
    { label: 'Workshops', icon: 'bi-mortarboard', count: categoryCounts.Workshop, key: 'Workshop' },
    { label: 'Competitions', icon: 'bi-award', count: categoryCounts['Student Competition'], key: 'Student Competition' },
    { label: 'Seminars', icon: 'bi-people', count: categoryCounts.Seminar, key: 'Seminar' },
  ];

  const handleBookmark = (eventObj) => {
    const { dataKey, idsKey } = getBookmarkStorageKeys();
    const ids = JSON.parse(localStorage.getItem(idsKey) || '[]');
    const data = JSON.parse(localStorage.getItem(dataKey) || '[]');

    const id = eventObj._id || eventObj.id || eventObj.title;
    if (!ids.includes(id)) {
      // add
      ids.push(id);
      data.push(eventObj);
      localStorage.setItem(idsKey, JSON.stringify(ids));
      localStorage.setItem(dataKey, JSON.stringify(data));
      setBookmarkedIds(ids);
      if (window?.toast) window.toast('Added to bookmarks', { type: 'success' });
    } else {
      // remove (toggle)
      const updatedIds = ids.filter(i => i !== id);
      const updatedData = data.filter(ev => (ev._id || ev.id || ev.title) !== id);
      localStorage.setItem(idsKey, JSON.stringify(updatedIds));
      localStorage.setItem(dataKey, JSON.stringify(updatedData));
      setBookmarkedIds(updatedIds);
      if (window?.toast) window.toast('Removed from bookmarks', { type: 'success' });
    }

    // notify other parts of the app (same-tab and cross-tab)
    window.dispatchEvent(new Event('bookmarks-changed'));
  };

  const handleEventClick = (event) => {
    setSelectedEvent(event);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedEvent(null);
  };

  // Notify me -> backend registers notification + schedules email


  return (
    <div className="container-fluid mt-4">
      <div className="events-layout">
        <aside className={`premium-sidebar ${isSidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-scroll">
            <div className="sidebar-heading-row">
              <div>
                <div className="sidebar-eyebrow">Filters</div>
                <h5 className="sidebar-title">Refine Events</h5>
              </div>
              <button className="btn btn-light btn-sm d-lg-none" onClick={() => setIsSidebarOpen(false)}>Close</button>
            </div>

            {/* Search */}
            <div className="sidebar-section">
              <label className="sidebar-label">Search</label>
              <div className="sidebar-search">
                <i className="bi bi-search"></i>
                <input
                  type="text"
                  placeholder="Search titles, orgs, skills"
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                />
                {globalSearch && (
                  <button className="icon-btn" onClick={() => setGlobalSearch('')}>
                    <i className="bi bi-x-lg"></i>
                  </button>
                )}
              </div>
            </div>

            {/* Categories */}
            <div className="sidebar-section">
              <label className="sidebar-label">Categories</label>
              <div className="chip-grid">
                {categories.map(cat => (
                  <button
                    key={cat.key}
                    className={activeCategory === cat.key ? 'filter-chip selected' : 'filter-chip'}
                    onClick={() => setActiveCategory(cat.key)}
                  >
                    <span><i className={`bi ${cat.icon} me-1`}></i>{cat.label}</span>
                    <span className="pill">{cat.count}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Dates */}
            <div className="sidebar-section">
              <label className="sidebar-label">Date Range</label>
              <div className="date-grid">
                <div>
                  <small className="text-muted">Start</small>
                  <input type="date" className="form-control" value={startDate} onChange={(e)=>{setStartDate(e.target.value); setQuickPreset('');}} />
                </div>
                <div>
                  <small className="text-muted">End</small>
                  <input type="date" className="form-control" value={endDate} onChange={(e)=>{setEndDate(e.target.value); setQuickPreset('');}} />
                </div>
              </div>
              <div className="preset-row">
                <button className={quickPreset==='7d' ? 'preset-btn active' : 'preset-btn'} onClick={()=>handlePresetSelect('7d')}>Next 7 days</button>
                <button className={quickPreset==='30d' ? 'preset-btn active' : 'preset-btn'} onClick={()=>handlePresetSelect('30d')}>Next 30 days</button>
                <button className={quickPreset==='weekend' ? 'preset-btn active' : 'preset-btn'} onClick={()=>handlePresetSelect('weekend')}>This weekend</button>
                <button className={!quickPreset ? 'preset-btn active' : 'preset-btn'} onClick={()=>handlePresetSelect('')}>Anytime</button>
              </div>
            </div>

            {/* Modes */}
            <div className="sidebar-section">
              <label className="sidebar-label">Mode</label>
              <div className="chip-grid">
                {['online','offline','hybrid'].map(mode => (
                  <button
                    key={mode}
                    className={modeFilters.includes(mode) ? 'filter-chip selected' : 'filter-chip'}
                    onClick={() => setModeFilters(prev => toggleValue(prev, mode))}
                  >
                    <i className="bi bi-wifi"></i> {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Skill Levels */}
            <div className="sidebar-section">
              <label className="sidebar-label">Skill Level</label>
              <div className="chip-grid">
                {['beginner','intermediate','advanced'].map(level => (
                  <button
                    key={level}
                    className={levelFilters.includes(level) ? 'filter-chip selected' : 'filter-chip'}
                    onClick={() => setLevelFilters(prev => toggleValue(prev, level))}
                  >
                    <i className="bi bi-stars"></i> {level.charAt(0).toUpperCase() + level.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Popular Tags */}
            <div className="sidebar-section">
              <label className="sidebar-label">Popular Tags</label>
              <div className="chip-grid">
                {popularTags.map(tag => (
                  <button
                    key={tag}
                    className={selectedTags.includes(tag) ? 'filter-chip selected' : 'filter-chip'}
                    onClick={() => setSelectedTags(prev => toggleValue(prev, tag))}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Sorting */}
            <div className="sidebar-section">
              <label className="sidebar-label">Sort by</label>
              <select className="form-select" value={sortBy} onChange={(e)=>setSortBy(e.target.value)}>
                <option value="soonest">Soonest</option>
                <option value="latest">Latest</option>
                <option value="deadline">Deadline</option>
                <option value="alpha">A - Z</option>
                <option value="featured">Featured First</option>
              </select>
            </div>

            {/* Toggles */}
            <div className="sidebar-section toggle-stack">
              <div className="form-check form-switch">
                <input className="form-check-input" type="checkbox" id="bookmarkedOnly" checked={bookmarkedOnly} onChange={(e)=>setBookmarkedOnly(e.target.checked)} />
                <label className="form-check-label" htmlFor="bookmarkedOnly">Bookmarked only</label>
              </div>
              <div className="form-check form-switch">
                <input className="form-check-input" type="checkbox" id="archivedOnly" checked={archivedOnly} onChange={(e)=>setArchivedOnly(e.target.checked)} />
                <label className="form-check-label" htmlFor="archivedOnly">Archived only</label>
              </div>
            </div>

            {/* Actions */}
            <div className="sidebar-actions">
              <button className="btn btn-primary w-100" onClick={applyFilters}>Apply Filters</button>
              <button className="btn btn-outline-secondary w-100" onClick={clearAllFilters}>Clear All</button>
              <button className="btn btn-light w-100" onClick={saveFilters}>Save Filter</button>
            </div>
          </div>
        </aside>

        {isSidebarOpen && <div className="sidebar-backdrop d-lg-none" onClick={()=>setIsSidebarOpen(false)}></div>}

        <div className="events-main flex-grow-1">
          <div className="d-lg-none mb-3">
            <button className="btn btn-outline-primary" onClick={()=>setIsSidebarOpen(true)}>
              <i className="bi bi-sliders me-2"></i>Filters
            </button>
          </div>

          {/* Hero Section */}
          <div className="events-hero">
            <h1 style={{fontWeight:800, fontSize:'3rem', color:'#22223b', marginBottom:'0.5rem'}}>
              Discover Amazing <span style={{color:'#3b5bfd'}}>Student Events</span>
            </h1>
            <p style={{fontSize:'1.25rem', color:'#475569', marginBottom:'2.5rem'}}>
              Find hackathons, internships, workshops, and competitions tailored for students. Never miss an opportunity to grow your skills and network.
            </p>

            {/* Stats */}
            <div className="events-stats-row">
              {stats.map((stat) => (
                <div className="events-stat-card" key={stat.label}>
                  <div className="events-stat-value" style={{ color: stat.color }}>{stat.value}</div>
                  <div className="events-stat-label">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="d-flex mb-4" style={{gap:'1rem'}}>
            <button className={tab==='featured' ? 'btn btn-dark' : 'btn btn-light border'} style={{fontWeight:600, minWidth:160}} onClick={()=>setTab('featured')}>
              <i className="bi bi-graph-up-arrow me-2"></i>Featured Events
            </button>
            <button className={tab==='upcoming' ? 'btn btn-dark' : 'btn btn-light border'} style={{fontWeight:600, minWidth:160}} onClick={()=>setTab('upcoming')}>
              <i className="bi bi-calendar-event me-2"></i>Upcoming
            </button>
          </div>

          {/* Results Summary */}
          {globalSearch && (
            <div style={{
              background:'linear-gradient(135deg, #f0f4ff 0%, #fff5f7 100%)',
              borderRadius:'1rem',
              padding:'1rem',
              marginBottom:'2rem',
              border:'1px solid #e0e7ff'
            }}>
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <h6 style={{color:'#22223b', fontWeight:700, marginBottom:'0.25rem'}}>
                    <i className="bi bi-lightning-fill me-2" style={{color:'#3b5bfd'}}></i>
                    {filteredEvents.length} Event{filteredEvents.length !== 1 ? 's' : ''} Found
                  </h6>
                  <p style={{color:'#64748b', fontSize:'0.9rem', marginBottom:'0'}}>
                    Matching "{globalSearch}"
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Events Grid */}
          {filteredEvents.length === 0 ? (
            <div className="d-flex flex-column align-items-center justify-content-center" style={{
              background:'#fff',
              borderRadius:'1.2rem',
              minHeight:'400px',
              border:'1.5px solid #e5e7eb',
              padding:'2rem'
            }}>
              <i className="bi bi-search" style={{fontSize:'4rem', color:'#cbd5e1', marginBottom:'1rem'}}></i>
              <h4 style={{color:'#22223b', fontWeight:700}}>No Events Found</h4>
              <p style={{color:'#64748b', textAlign:'center', maxWidth:'400px'}}>
                Try adjusting your search or filters to find more events.
              </p>
            </div>
          ) : (
            <>
              <div className="row g-4" style={{marginBottom:'3rem'}}>
                {paginatedEvents.map((event) => (
                  <div className="col-md-6 col-lg-4" key={event._id}>
                    <div style={{position:'relative'}}>
                      <EventCard
                        event={event}
                        onBookmark={handleBookmark}
                        isBookmarked={bookmarkedIds.includes(event._id)}
                        showBookmark={true}
                        onClick={() => handleEventClick(event)}
                      />
                    </div>
                  </div>
                ))}
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
                Showing {startIndex + 1} - {Math.min(endIndex, filteredEvents.length)} of {filteredEvents.length} events
              </div>
            </>
          )}
        </div>
      </div>

      {/* Event Modal */}
      <EventModal
        event={selectedEvent}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
};

export default Events;
