import React, { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../utils/api';
import { getNotificationStorageKeys } from '../utils/notificationStorage';

const EventCard = ({ event, onBookmark, isBookmarked, showBookmark = false, onClick, showActions = true }) => {
  const [subscribed, setSubscribed] = useState(false);
  const [loadingNotify, setLoadingNotify] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');
  const shareWrapperRef = useRef(null);
  const copyTimerRef = useRef(null);
  const { idsKey, itemsKey } = getNotificationStorageKeys();

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem(idsKey) || '[]');
    setSubscribed(stored.includes(event._id));
  }, [event._id, idsKey]);

  useEffect(() => {
    const refresh = () => {
      const stored = JSON.parse(localStorage.getItem(idsKey) || '[]');
      setSubscribed(stored.includes(event._id));
    };
    window.addEventListener('storage', refresh);
    window.addEventListener('notify-events-changed', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('notify-events-changed', refresh);
    };
  }, [event._id, idsKey]);

  const locationLabel = event.location || 'Location TBD';
  const eventDateLabel = event.eventDate
    ? new Date(event.eventDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : 'Date TBD';
  const deadlineLabel = event.deadline
    ? new Date(event.deadline).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : 'Deadline TBD';
  const durationLabel = event.duration || 'Duration TBD';
  const modeLabel = event.mode || 'Mode TBD';
  const tags = Array.isArray(event.tags) && event.tags.length ? event.tags : ['Opportunities'];
  const displayTags = tags.slice(0, 2);
  const extraTagsCount = tags.length > 2 ? tags.length - 2 : 0;

  const updateLocal = (next) => {
    const ids = JSON.parse(localStorage.getItem(idsKey) || '[]');
    const items = JSON.parse(localStorage.getItem(itemsKey) || '[]');

    const ensureEventShape = () => ({
      _id: event._id,
      id: event._id,
      title: event.title,
      description: event.description,
      deadline: event.deadline,
      eventDate: event.eventDate,
      location: event.location,
      type: event.type,
      category: event.category,
      mode: event.mode,
      difficulty: event.difficulty,
      organizerName: event.organizerName,
      tags: event.tags,
      applyLink: event.applyLink,
      link: event.link
    });

    let updatedIds;
    let updatedItems;

    if (next) {
      updatedIds = Array.from(new Set([...ids, event._id]));
      const exists = items.some(it => (it._id || it.id) === event._id);
      updatedItems = exists ? items : [...items, ensureEventShape()];
    } else {
      updatedIds = ids.filter(id => id !== event._id);
      updatedItems = items.filter(it => (it._id || it.id) !== event._id);
    }

    localStorage.setItem(idsKey, JSON.stringify(updatedIds));
    localStorage.setItem(itemsKey, JSON.stringify(updatedItems));
    window.dispatchEvent(new Event('notify-events-changed'));
  };
  const user = JSON.parse(localStorage.getItem('user')) || {};

  const toggleNotify = async (e) => {
  e.stopPropagation();

  if (loadingNotify) return;

  setLoadingNotify(true);

  const token = localStorage.getItem('clockdin_token');
  const targetState = !subscribed;

  try {

    if (token) {

      // SUBSCRIBE
      if (targetState) {

        updateLocal(true);
        setSubscribed(true);

        alert('Event added to Notifications.');

      }

      // UNSUBSCRIBE
      else {

        updateLocal(false);
        setSubscribed(false);

        alert('Event removed from Notifications.');

      }

    } else {

      alert('Sign in to use Notifications.');
      window.location.href = '/login';

      setLoadingNotify(false);
      return;

    }

  } catch (err) {

    console.error('Notify toggle failed', err);

  } finally {

    setLoadingNotify(false);

  }
};

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const rawEventIdentifier = event._id || event.id || event.title || 'event';
  const encodedEventIdentifier = encodeURIComponent(rawEventIdentifier);
  const shareLink = `${baseUrl}/events?eventId=${encodedEventIdentifier}`;
  const encodedShareLink = encodeURIComponent(shareLink);
  const encodedShareText = encodeURIComponent(`${event.title} - ${shareLink}`);

  const copyTextToClipboard = async (text) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  };

  const handleCopyLink = async (e) => {
    e.stopPropagation();
    try {
      await copyTextToClipboard(shareLink);
      setCopyMessage('Link copied');
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopyMessage(''), 2000);
    } catch (err) {
      console.error('Copy failed', err);
      setCopyMessage('Copy failed');
    }
  };

  const openShareUrl = (e, url) => {
    e.stopPropagation();
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
    setIsShareOpen(false);
  };

  useEffect(() => {
    const handleGlobalClick = (event) => {
      if (isShareOpen && shareWrapperRef.current && !shareWrapperRef.current.contains(event.target)) {
        setIsShareOpen(false);
      }
    };
    document.addEventListener('mousedown', handleGlobalClick);
    return () => document.removeEventListener('mousedown', handleGlobalClick);
  }, [isShareOpen]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="event-card card h-100 p-0 border-0" style={{cursor: 'pointer'}} onClick={onClick}>
      <div className="card-body d-flex flex-column justify-content-between">
        <div>
          <div className="d-flex align-items-center mb-2 justify-content-between">
            <div className="d-flex align-items-center">
              <span className="event-badge me-2">{event.type}</span>
              {event.difficulty && (
                <span className={`difficulty-badge ${event.difficulty.toLowerCase()}`}>
                  {event.difficulty}
                </span>
              )}
            </div>
            <div className="d-flex align-items-center gap-2">
              <div className="event-share-wrapper" ref={shareWrapperRef}>
                <button
                  type="button"
                  className="btn btn-link p-0 border-0 event-share-button"
                  title="Share Event"
                  aria-label="Share this event"
                  aria-haspopup="menu"
                  aria-expanded={isShareOpen}
                  onClick={e => {
                    e.stopPropagation();
                    setIsShareOpen(prev => !prev);
                  }}
                >
                  <i className="bi bi-share" style={{fontSize:'1.4rem'}}></i>
                </button>
                {isShareOpen && (
                  <div className="event-share-menu" role="menu">
                    <button type="button" className="event-share-option" role="menuitem" onClick={handleCopyLink}>
                      <i className="bi bi-clipboard me-2"></i>
                      Copy Event Link
                    </button>
                    <button
                      type="button"
                      className="event-share-option"
                      role="menuitem"
                      onClick={e => openShareUrl(e, `https://api.whatsapp.com/send?text=${encodedShareText}`)}
                    >
                      <i className="bi bi-whatsapp me-2"></i>
                      Share via WhatsApp
                    </button>
                    <button
                      type="button"
                      className="event-share-option"
                      role="menuitem"
                      onClick={e => openShareUrl(e, `https://www.linkedin.com/sharing/share-offsite/?url=${encodedShareLink}`)}
                    >
                      <i className="bi bi-linkedin me-2"></i>
                      Share via LinkedIn
                    </button>
                    <button
                      type="button"
                      className="event-share-option"
                      role="menuitem"
                      onClick={e => openShareUrl(e, `https://twitter.com/intent/tweet?url=${encodedShareLink}&text=${encodedShareText}`)}
                    >
                      <i className="bi bi-twitter me-2"></i>
                      Share via Twitter
                    </button>
                    {copyMessage && <div className="event-share-confirmation">{copyMessage}</div>}
                  </div>
                )}
              </div>
              {showBookmark && (
                <button
                  className="btn btn-link p-0 border-0"
                  style={{boxShadow:'none'}}
                  title={isBookmarked ? 'Remove Bookmark' : 'Bookmark'}
                  onClick={e => { e.stopPropagation(); onBookmark(event); }}
                >
                  <i className={isBookmarked ? 'bi bi-bookmark-fill text-primary' : 'bi bi-bookmark'} style={{fontSize:'1.4em'}}></i>
                </button>
              )}
            </div>
          </div>
          <h5 className="card-title fw-bold mb-1" style={{color:'#3b5bfd'}}>{event.title}</h5>
          <p className="card-text mb-2" style={{minHeight:'60px'}}>{event.description}</p>
          
          <div className="event-meta-list mb-2">
            <div className="event-meta d-flex align-items-center mb-1">
              <i className="bi bi-geo-alt me-2"></i>
              <span>{locationLabel}</span>
            </div>
            <div className="event-meta d-flex align-items-center mb-1">
              <i className="bi bi-calendar-event me-2"></i>
              <span><strong>Event:</strong> {eventDateLabel}</span>
            </div>
            <div className="event-meta d-flex align-items-center mb-1">
              <i className="bi bi-clock me-2"></i>
              <span><strong>Deadline:</strong> {deadlineLabel}</span>
            </div>
            <div className="event-meta d-flex align-items-center mb-1">
              <i className="bi bi-hourglass-split me-2"></i>
              <span><strong>Duration:</strong> {durationLabel}</span>
            </div>
            <div className="event-meta d-flex align-items-center mb-1">
              <i className="bi bi-laptop me-2"></i>
              <span><strong>Mode:</strong> {modeLabel}</span>
            </div>
          </div>

          <div className="event-tags mb-2">
            {displayTags.map((tag, idx) => (
              <span key={idx} className="event-tag">{tag}</span>
            ))}
            {extraTagsCount > 0 && (
              <span className="event-tag">+{extraTagsCount}</span>
            )}
          </div>
        </div>
        
        {showActions && (
          <div className="d-flex gap-2">
            <button
              className={subscribed ? 'btn btn-success flex-fill' : 'btn btn-outline-primary flex-fill'}
              onClick={toggleNotify}
              disabled={loadingNotify}
              style={{fontWeight:700, fontSize:'0.95rem', borderRadius:'0.8rem'}}
            >
              {subscribed ? <><i className="bi bi-check-lg me-1"></i>Notification Set</> : 'Notify Me'}
            </button>
            <a
              href={event.applyLink || event.link || '#'}
              className="btn btn-primary flex-fill"
              target="_blank"
              rel="noopener noreferrer"
              style={{fontWeight:600, fontSize:'0.9rem'}}
              onClick={e => e.stopPropagation()}
            >
              Apply Now <i className="bi bi-box-arrow-up-right ms-1"></i>
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventCard;
