import React, { useEffect, useRef, useState } from 'react';
import { apiAxios } from '../utils/api';
import '../Events.css';

const glassCard = {
  background: 'rgba(255,255,255,0.75)',
  borderRadius: '1.5rem',
  border: '1.5px solid #e5e7eb',
  boxShadow: '0 8px 32px rgba(80,80,120,0.10)',
  backdropFilter: 'blur(8px)',
};

const defaultProfile = {
  name: 'Student User',
  email: '',
  phone: '',
  location: '',
  bio: '',
  avatar: 'https://ui-avatars.com/api/?name=Student+User&background=3b5bfd&color=fff&size=128',
  college: '',
  major: '',
  gradYear: '',
  website: '',
  github: '',
  linkedin: '',
  twitter: '',
  interests: '',
  skills: '',
  joined: '',
};

const Profile = () => {
  const [tab, setTab] = useState('profile');
  const [edit, setEdit] = useState(false);
  const [profile, setProfile] = useState(defaultProfile);
  const [form, setForm] = useState(defaultProfile);
  const [bookmarkedCount, setBookmarkedCount] = useState(0);
  const [personalCount, setPersonalCount] = useState(0);
  const [memberSinceDays, setMemberSinceDays] = useState('N/A');
  const [darkMode, setDarkMode] = useState(
  localStorage.getItem('clockdin_darkmode') === 'true'
);
  const [settings, setSettings] = useState({
    email: true,
    reminders: true,
    digest: false,
    privacy: false,
    language: 'English',
  });
  const avatarInputRef = useRef(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await apiAxios.get('/api/users/me');
        const profilePayload = res.data?.profile || {};
        const mergedProfile = {
          ...defaultProfile,
          ...profilePayload,
          avatar: res.data?.avatar || defaultProfile.avatar,
          name: res.data?.name || defaultProfile.name,
          email: res.data?.email || defaultProfile.email,
        };

        setProfile(mergedProfile);
        setForm({ ...mergedProfile });

        const serverBookmarks = Array.isArray(res.data?.bookmarks) ? res.data.bookmarks.length : 0;
        const localBookmarkedIds = JSON.parse(localStorage.getItem('bookmarkedEvents') || '[]');
        const localBookmarkedData = JSON.parse(localStorage.getItem('bookmarkedEventsData') || '[]');
        setBookmarkedCount(serverBookmarks || Math.max(localBookmarkedIds.length || 0, localBookmarkedData.length || 0));

        const myEventsCount = Array.isArray(res.data?.myEvents) ? res.data.myEvents.length : 0;
        setPersonalCount(myEventsCount);

        let createdAt = null;
        if (res.data?.joined) createdAt = new Date(res.data.joined);
        else if (res.data?.createdAt) createdAt = new Date(res.data.createdAt);
        else if (res.data?._id) {
          const ts = parseInt(res.data._id.substring(0, 8), 16) * 1000;
          createdAt = new Date(ts);
        }

        if (createdAt && !isNaN(createdAt.getTime())) {
          setMemberSinceDays(Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)));
        } else {
          setMemberSinceDays('N/A');
        }
      } catch (err) {
        console.error('Failed to fetch profile:', err);
        setProfile(defaultProfile);
        setForm(defaultProfile);
        const localBookmarkedIds = JSON.parse(localStorage.getItem('bookmarkedEvents') || '[]');
        const localBookmarkedData = JSON.parse(localStorage.getItem('bookmarkedEventsData') || '[]');
        setBookmarkedCount(Math.max(localBookmarkedIds.length, localBookmarkedData.length));
      }
    };

    fetchProfile();
  }, []);
  useEffect(() => {
  if (darkMode) {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }

  localStorage.setItem('clockdin_darkmode', darkMode);
}, [darkMode]);

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleAvatarUpload = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file.');
      return;
    }
    if (file.size > 200 * 1024) {
      alert('Image size must be less than 200KB. Please use a smaller image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setForm(prev => ({ ...prev, avatar: reader.result || prev.avatar }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const startEdit = () => {
    setForm({ ...profile });
    setEdit(true);
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('clockdin_token');
      if (!token) {
        alert('Session expired. Please log in again.');
        window.location.href = '/login';
        return;
      }

      const response = await apiAxios.put('/api/users/profile', { ...form });
      if (response.status === 200) {
        setProfile({ ...form });
        setForm({ ...form });
        setEdit(false);
        alert('Profile updated successfully!');
      }
    } catch (err) {
      console.error('Profile update error:', err.response?.data || err.message);
      if (err.response?.status === 401) {
        const shouldRelogin = window.confirm('Your session has expired. Please log in again to continue.\n\nClick OK to go to login page.');
        if (shouldRelogin) {
          localStorage.removeItem('clockdin_token');
          localStorage.removeItem('clockdin_signedin');
          window.location.href = '/login';
        }
        return;
      }
      alert(err.response?.data?.msg || err.response?.data?.error || err.message || 'Failed to update profile');
    }
  };

  const handleSettings = (key, value) => setSettings(s => ({ ...s, [key]: value ?? !s[key] }));

  const stats = [
    { icon: 'bi-bookmark-check', label: 'Bookmarked Events', value: bookmarkedCount },
    { icon: 'bi-calendar', label: 'Personal Events', value: personalCount },
    { icon: 'bi-clock-history', label: 'Member Since', value: typeof memberSinceDays === 'number' ? `${memberSinceDays} days` : 'N/A' },
  ];

  return (
    <div className="container-fluid py-4" style={{ minHeight: '100vh', background: 'linear-gradient(120deg,#f8fafc 60%,#e0e7ff 100%)' }}>
      <div className="text-center mb-4">
        <h1 style={{ fontWeight: 900, fontSize: '2.7rem', color: '#22223b', letterSpacing: '-1px' }}>Profile</h1>
        <div style={{ color: '#64748b', fontSize: '1.18rem' }}>Manage your personal information and preferences</div>
      </div>

      <div className="d-flex justify-content-center gap-3 mb-4">
        <button className={`btn ${tab === 'profile' ? 'btn-glass-active' : 'btn-glass'}`} style={{ minWidth: 160 }} onClick={() => setTab('profile')}><i className="bi bi-person-circle me-1"></i> Profile</button>
        <button className={`btn ${tab === 'stats' ? 'btn-glass-active' : 'btn-glass'}`} style={{ minWidth: 160 }} onClick={() => setTab('stats')}><i className="bi bi-bar-chart-line me-1"></i> Statistics</button>
        <button className={`btn ${tab === 'settings' ? 'btn-glass-active' : 'btn-glass'}`} style={{ minWidth: 160 }} onClick={() => setTab('settings')}><i className="bi bi-gear-wide-connected me-1"></i> Settings</button>
      </div>

      {tab === 'profile' && (
        <div className="p-4 mb-4" style={{ ...glassCard, position: 'relative' }}>
          <div className="d-flex justify-content-end mb-3">
            {!edit ? (
              <button className="btn btn-outline-primary" style={{ borderRadius: '1.2rem', fontWeight: 600 }} onClick={startEdit}>
                <i className="bi bi-pencil-square me-2"></i>Edit Profile
              </button>
            ) : (
              <div style={{ color: '#2563eb', fontWeight: 600, fontSize: '0.95rem' }}>You are editing your details</div>
            )}
          </div>

          <div className="d-flex justify-content-center align-items-center mb-4 gap-4 flex-wrap">
            <div style={{ position: 'relative', width: 120, height: 120, minWidth: 120 }}>
              <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
              <img
                src={edit ? form.avatar : profile.avatar}
                alt="avatar"
                style={{ width: 120, height: 120, borderRadius: '50%', border: '4px solid #6366f1', boxShadow: '0 2px 16px #6366f133', objectFit: 'cover' }}
              />
              <span
                style={{ position: 'absolute', bottom: 8, right: 8, background: '#fff', borderRadius: '50%', padding: 6, boxShadow: '0 2px 8px #6366f133', border: '1.5px solid #e5e7eb', cursor: edit ? 'pointer' : 'not-allowed' }}
                title={edit ? 'Change Avatar' : 'Enter edit mode to change avatar'}
                onClick={() => edit && avatarInputRef.current?.click()}
              >
                <i className="bi bi-camera" style={{ color: '#6366f1', fontSize: '1.2rem' }}></i>
              </span>
            </div>

            <div>
              <h2 style={{ fontWeight: 800, fontSize: '2rem', color: '#22223b', marginBottom: 4, letterSpacing: '-0.5px' }}><i className="bi bi-person-badge me-2 text-primary"></i>{profile.name || 'Student User'}</h2>
              <div style={{ color: '#6366f1', fontWeight: 600, fontSize: '1.1rem' }}><i className="bi bi-envelope-at me-2"></i>{profile.email || 'email@example.com'}</div>
              <div style={{ color: '#64748b', fontSize: '1.01rem', marginTop: 2 }}><i className="bi bi-geo-alt me-2"></i>{profile.location || 'City, Country'}</div>
            </div>
          </div>

          <hr style={{ margin: '2rem 0', borderTop: '1.5px solid #e5e7eb' }} />

          <h3 className="mb-4" style={{ fontWeight: 800, fontSize: '1.4rem', color: '#22223b' }}><i className="bi bi-person-lines-fill me-2 text-primary"></i>Personal Information</h3>
          <div className="row g-4 mb-4">
            <div className="col-md-6">
              <label className="form-label"><i className="bi bi-person me-1"></i>Full Name</label>
              <input className="form-control" name="name" value={edit ? form.name : profile.name} onChange={handleChange} disabled={!edit} placeholder="Student User" />
            </div>
            <div className="col-md-6">
              <label className="form-label"><i className="bi bi-envelope-at me-1"></i>Email</label>
              <input className="form-control" name="email" value={edit ? form.email : profile.email} onChange={handleChange} disabled={!edit} placeholder="email@example.com" />
            </div>
            <div className="col-md-6">
              <label className="form-label"><i className="bi bi-telephone me-1"></i>Phone</label>
              <input className="form-control" name="phone" value={edit ? form.phone : profile.phone} onChange={handleChange} disabled={!edit} placeholder="+1 (555) 123-4567" />
            </div>
            <div className="col-md-6">
              <label className="form-label"><i className="bi bi-geo-alt me-1"></i>Location</label>
              <input className="form-control" name="location" value={edit ? form.location : profile.location} onChange={handleChange} disabled={!edit} placeholder="City, Country" />
            </div>
            <div className="col-12">
              <label className="form-label"><i className="bi bi-chat-left-text me-1"></i>Bio</label>
              <textarea className="form-control" name="bio" value={edit ? form.bio : profile.bio} onChange={handleChange} disabled={!edit} placeholder="Tell us about yourself..." rows={2} />
            </div>
          </div>

          <h3 className="mb-3 mt-4" style={{ fontWeight: 800, fontSize: '1.3rem', color: '#22223b' }}><i className="bi bi-mortarboard-fill me-2 text-success"></i>Education</h3>
          <div className="row g-4 mb-4">
            <div className="col-md-6">
              <label className="form-label"><i className="bi bi-building me-1"></i>College/University</label>
              <input className="form-control" name="college" value={edit ? form.college : profile.college} onChange={handleChange} disabled={!edit} placeholder="e.g., MIT, Stanford University" />
            </div>
            <div className="col-md-6">
              <label className="form-label"><i className="bi bi-journal-code me-1"></i>Major/Field of Study</label>
              <input className="form-control" name="major" value={edit ? form.major : profile.major} onChange={handleChange} disabled={!edit} placeholder="e.g., Computer Science" />
            </div>
            <div className="col-md-6">
              <label className="form-label"><i className="bi bi-calendar2-event me-1"></i>Graduation Year</label>
              <input className="form-control" name="gradYear" value={edit ? form.gradYear : profile.gradYear} onChange={handleChange} disabled={!edit} placeholder="e.g., 2025" />
            </div>
          </div>

          <h3 className="mb-3 mt-4" style={{ fontWeight: 800, fontSize: '1.3rem', color: '#22223b' }}><i className="bi bi-globe2 me-2 text-info"></i>Social Links</h3>
          <div className="row g-4 mb-4">
            <div className="col-md-6">
              <label className="form-label"><i className="bi bi-globe me-1"></i>Website</label>
              <input className="form-control" name="website" value={edit ? form.website : profile.website} onChange={handleChange} disabled={!edit} placeholder="https://yourwebsite.com" />
            </div>
            <div className="col-md-6">
              <label className="form-label"><i className="bi bi-github me-1"></i>GitHub</label>
              <input className="form-control" name="github" value={edit ? form.github : profile.github} onChange={handleChange} disabled={!edit} placeholder="https://github.com/username" />
            </div>
            <div className="col-md-6">
              <label className="form-label"><i className="bi bi-linkedin me-1"></i>LinkedIn</label>
              <input className="form-control" name="linkedin" value={edit ? form.linkedin : profile.linkedin} onChange={handleChange} disabled={!edit} placeholder="https://linkedin.com/in/username" />
            </div>
            <div className="col-md-6">
              <label className="form-label"><i className="bi bi-twitter me-1"></i>Twitter</label>
              <input className="form-control" name="twitter" value={edit ? form.twitter : profile.twitter} onChange={handleChange} disabled={!edit} placeholder="https://twitter.com/username" />
            </div>
          </div>

          <div className="row g-4 mb-4">
            <div className="col-md-6">
              <h4 className="mb-2" style={{ fontWeight: 700, fontSize: '1.15rem', color: '#22223b' }}><i className="bi bi-bullseye me-2 text-danger"></i>Interests</h4>
              <input className="form-control" name="interests" value={edit ? form.interests : profile.interests} onChange={handleChange} disabled={!edit} placeholder="e.g., AI, Web Development, Sports" />
            </div>
            <div className="col-md-6">
              <h4 className="mb-2" style={{ fontWeight: 700, fontSize: '1.15rem', color: '#22223b' }}><i className="bi bi-award me-2 text-warning"></i>Skills</h4>
              <input className="form-control" name="skills" value={edit ? form.skills : profile.skills} onChange={handleChange} disabled={!edit} placeholder="e.g., React, Python, Leadership" />
            </div>
          </div>

          {edit && (
            <div className="d-flex gap-2 mt-3">
              <button className="btn btn-gradient px-4 py-2" style={{ background: 'linear-gradient(90deg,#6366f1,#3b82f6)', color: '#fff', fontWeight: 600, borderRadius: '1.2rem', border: 'none' }} onClick={handleSave}>Save</button>
              <button className="btn btn-outline-secondary px-4 py-2" style={{ borderRadius: '1.2rem' }} onClick={() => { setForm({ ...profile }); setEdit(false); }}>
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'stats' && (
        <div>
          <div className="row g-4 mb-4">
            {stats.map((s, idx) => (
              <div className="col-md-4" key={s.label}>
                <div className="p-4 text-center" style={{ ...glassCard, transition: 'box-shadow 0.2s', cursor: 'pointer', borderColor: '#e0e7ff' }}>
                  <i className={`bi ${s.icon}`} style={{ fontSize: '2.2rem', color: idx === 0 ? '#6366f1' : idx === 1 ? '#22c55e' : '#0ea5e9' }}></i>
                  <div style={{ fontWeight: 700, fontSize: '1.3rem', color: '#22223b', marginTop: '0.5rem' }}>{s.value}</div>
                  <div className="text-muted">{s.label}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4" style={{ ...glassCard }}>
            <h4 style={{ fontWeight: 800, fontSize: '1.2rem', color: '#22223b' }}><i className="bi bi-activity me-2 text-primary"></i>Activity Summary</h4>
            <div style={{ color: '#495057', fontSize: '1.08rem', marginTop: '0.5rem' }}>
              You've been actively using Clockdin to manage your events and stay organized. Keep exploring new opportunities and building your skills!
            </div>
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <div>
            <div className="col-md-6 d-flex align-items-center justify-content-between">
  <div>
    <div style={{ fontWeight: 700 }}>
      🌙 Dark Mode
    </div>

    <div
      className="text-muted"
      style={{ fontSize: '0.98rem' }}
    >
      Switch between dark and light theme
    </div>
  </div>

  <div className="form-check form-switch">
    <input
      className="form-check-input"
      type="checkbox"
      checked={darkMode}
      onChange={() => setDarkMode(!darkMode)}
    />
  </div>
</div>
          <div className="p-4 mb-4" style={{ ...glassCard }}>
            <h3 className="mb-4" style={{ fontWeight: 800, fontSize: '1.4rem', color: '#22223b' }}><i className="bi bi-bell-fill me-2 text-warning"></i>Notifications</h3>
            <div className="row g-4 mb-4">
              <div className="col-md-6 d-flex align-items-center justify-content-between">
                <div>
                  <div style={{ fontWeight: 700 }}><i className="bi bi-envelope-paper me-1 text-primary"></i>Email Notifications</div>
                  <div className="text-muted" style={{ fontSize: '0.98rem' }}>Receive event reminders and updates via email</div>
                </div>
                <div className="form-check form-switch">
                  <input className="form-check-input" type="checkbox" checked={settings.email} onChange={() => handleSettings('email')} />
                </div>
              </div>
              <div className="col-md-6 d-flex align-items-center justify-content-between">
                <div>
                  <div style={{ fontWeight: 700 }}><i className="bi bi-calendar2-week me-1 text-success"></i>Event Reminders</div>
                  <div className="text-muted" style={{ fontSize: '0.98rem' }}>Get reminded about upcoming events and deadlines</div>
                </div>
                <div className="form-check form-switch">
                  <input className="form-check-input" type="checkbox" checked={settings.reminders} onChange={() => handleSettings('reminders')} />
                </div>
              </div>
              <div className="col-md-6 d-flex align-items-center justify-content-between">
                <div>
                  <div style={{ fontWeight: 700 }}><i className="bi bi-newspaper me-1 text-info"></i>Weekly Digest</div>
                  <div className="text-muted" style={{ fontSize: '0.98rem' }}>Weekly summary of new events and opportunities</div>
                </div>
                <div className="form-check form-switch">
                  <input className="form-check-input" type="checkbox" checked={settings.digest} onChange={() => handleSettings('digest')} />
                </div>
              </div>
            </div>
          </div>
          <div className="p-4" style={{ ...glassCard }}>
            <h3 className="mb-4" style={{ fontWeight: 800, fontSize: '1.4rem', color: '#22223b' }}><i className="bi bi-shield-lock-fill me-2 text-danger"></i>Privacy & Preferences</h3>
            <div className="row g-4 mb-4">
              <div className="col-md-6 d-flex align-items-center justify-content-between">
                <div>
                  <div style={{ fontWeight: 700 }}><i className="bi bi-eye-slash me-1 text-secondary"></i>Privacy Mode</div>
                  <div className="text-muted" style={{ fontSize: '0.98rem' }}>Make your profile and activity private</div>
                </div>
                <div className="form-check form-switch">
                  <input className="form-check-input" type="checkbox" checked={settings.privacy} onChange={() => handleSettings('privacy')} />
                </div>
              </div>
              <div className="col-md-6">
                <label className="form-label"><i className="bi bi-translate me-1 text-info"></i>Language</label>
                <select className="form-select" value={settings.language} onChange={e => handleSettings('language', e.target.value)}>
                  <option>English</option>
                  <option>Hindi</option>
                  <option>Telugu</option>
                  <option>Tamil</option>
                  <option>Kannada</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .btn-glass {
          background: rgba(255,255,255,0.6);
          border: 1.5px solid #e5e7eb;
          border-radius: 1.2rem;
          color: #6366f1;
          font-weight: 600;
          box-shadow: 0 2px 8px #6366f122;
          transition: all 0.15s;
        }
        .btn-glass:hover, .btn-glass:focus {
          background: #e0e7ff;
          color: #22223b;
          border-color: #6366f1;
        }
        .btn-glass-active {
          background: linear-gradient(90deg,#6366f1,#3b82f6);
          color: #fff;
          border: none;
          font-weight: 700;
          box-shadow: 0 2px 12px #6366f144;
        }
      `}</style>
    </div>
  );
};

export default Profile;
