import React, { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../utils/api';

const initialRegisterState = { name: '', email: '', password: '', college: '', confirm: '', agree: false };
const initialLoginState = { email: '', password: '' };

const Landing = ({ onSignIn }) => {
  const [view, setView] = useState('home'); // home | login | register
  const [login, setLogin] = useState(initialLoginState);
  const [register, setRegister] = useState(initialRegisterState);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);
  const [stats, setStats] = useState({
  activeEvents: 0,
  thisWeek: 0,
  students: 12000,
  companies: 0
});

  const resetRegister = useCallback(() => {
    setRegister(initialRegisterState);
    setShowRegPassword(false);
    setShowRegConfirm(false);
    setError('');
  }, []);

  const resetLoginState = useCallback(() => {
    setLogin({ ...initialLoginState });
    setRememberMe(false);
    setShowPassword(false);
  }, []);

  useEffect(() => {
    if (view !== 'register') {
      resetRegister();
    }
  }, [view, resetRegister]);

  useEffect(() => {
    if (view === 'login') {
      resetLoginState();
    }
  }, [view, resetLoginState]);

  useEffect(() => {
    const handlePopState = () => {
      resetLoginState();
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [resetLoginState]);

  useEffect(() => {
    return () => {
      resetLoginState();
    };
  }, [resetLoginState]);
  useEffect(() => {

  const fetchStats = async () => {

    try {

      const res = await fetch('https://clockdin-backend-re7k.onrender.com/api/events');

      const events = await res.json();

      const now = new Date();

      const nextWeek = new Date();
      nextWeek.setDate(now.getDate() + 7);

      const thisWeekEvents = events.filter(event => {

        const eventDate = new Date(
          event.eventDate || event.date
        );

        return eventDate >= now && eventDate <= nextWeek;

      });

      const uniqueCompanies = new Set(
        events.map(
          e => e.organizerName || e.organizer || 'Unknown'
        )
      );

      setStats({
        activeEvents: events.length,
        thisWeek: thisWeekEvents.length,
        students: 12000,
        companies: uniqueCompanies.size
      });

    } catch (err) {

      console.error('Stats fetch failed:', err);

    }

  };

  fetchStats();

}, []);
  const handleLogin = async e => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await apiFetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(login),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || 'Login failed');
      localStorage.setItem('clockdin_token', data.token);
      localStorage.setItem('clockdin_signedin', 'true');
      localStorage.setItem('clockdin_user', JSON.stringify(data.user));
      onSignIn();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async e => {
    e.preventDefault();
    setError('');
    if (register.password !== register.confirm) {
      setError('Passwords do not match');
      return;
    }
    if (!register.agree) {
      setError('You must agree to the Terms of Service');
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: register.name, email: register.email, password: register.password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || 'Registration failed');
      localStorage.setItem('clockdin_token', data.token);
      localStorage.setItem('clockdin_signedin', 'true');
      localStorage.setItem('clockdin_user', JSON.stringify(data.user));
      onSignIn();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  const handleChange = (e) => {
    const { name, type, checked, value } = e.target;
    setRegister(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  // Home view: hero, features, two cards, stats
  if (view === 'home') {
    return (
      <div style={{minHeight:'100vh',background:'linear-gradient(120deg,#eef2ff 60%,#dbeafe 100%)',padding:'0'}}>
        <div className="container py-4">
          {/* Hero Section */}
          <div className="d-flex flex-column align-items-center mb-4">
            <div className="d-flex align-items-center gap-2 mb-2">
              <div style={{background:'#3b5bfd',borderRadius:'50%',padding:10}}>
                <i className="bi bi-clock-history" style={{color:'#fff',fontSize:'1.5rem'}}></i>
              </div>
              <span style={{fontWeight:800,fontSize:'2rem',color:'#22223b',letterSpacing:'-1px'}}>Clockdin</span>
            </div>
            <h1 style={{fontWeight:900,fontSize:'3.2rem',color:'#22223b',textAlign:'center',letterSpacing:'-2px'}}>
              Never Miss a <span style={{color:'#2563eb'}}>Student Event</span>
            </h1>
            <div style={{color:'#475569',fontSize:'1.25rem',marginTop:10,textAlign:'center',maxWidth:700}}>
              Discover hackathons, internships, workshops, and competitions. Bookmark your favorites, set reminders, and build your career with Clockdin.
            </div>
          </div>
          {/* Feature Cards */}
          <div className="row g-4 mb-4 justify-content-center">
            <div className="col-md-4">
              <div className="p-4 text-center" style={{background:'#fff',borderRadius:'1.2rem',boxShadow:'0 2px 16px #6366f122'}}>
                <div style={{background:'#eef2ff',borderRadius:'1rem',width:56,height:56,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 1rem'}}>
                  <i className="bi bi-calendar" style={{color:'#6366f1',fontSize:'2rem'}}></i>
                </div>
                <div style={{fontWeight:700,fontSize:'1.15rem'}}>Discover Events</div>
                <div style={{color:'#64748b',fontSize:'1.01rem',marginTop:6}}>Find hackathons, internships, and workshops from top companies and universities</div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="p-4 text-center" style={{background:'#fff',borderRadius:'1.2rem',boxShadow:'0 2px 16px #6366f122'}}>
                <div style={{background:'#eef2ff',borderRadius:'1rem',width:56,height:56,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 1rem'}}>
                  <i className="bi bi-bookmark" style={{color:'#6366f1',fontSize:'2rem'}}></i>
                </div>
                <div style={{fontWeight:700,fontSize:'1.15rem'}}>Save & Organize</div>
                <div style={{color:'#64748b',fontSize:'1.01rem',marginTop:6}}>Bookmark events you're interested in and organize your applications</div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="p-4 text-center" style={{background:'#fff',borderRadius:'1.2rem',boxShadow:'0 2px 16px #6366f122'}}>
                <div style={{background:'#eef2ff',borderRadius:'1rem',width:56,height:56,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 1rem'}}>
                  <i className="bi bi-trophy" style={{color:'#6366f1',fontSize:'2rem'}}></i>
                </div>
                <div style={{fontWeight:700,fontSize:'1.15rem'}}>Personal Events</div>
                <div style={{color:'#64748b',fontSize:'1.01rem',marginTop:6}}>Add your own events and deadlines with custom reminders</div>
              </div>
            </div>
          </div>
          {/* Main Cards */}
          <div className="row g-4 mb-4 justify-content-center">
            <div className="col-md-5">
              <div className="p-4" style={{background:'#fff',borderRadius:'1.2rem',boxShadow:'0 4px 32px #6366f122'}}>
                <div style={{fontWeight:800,fontSize:'2rem',marginBottom:4}}>Welcome Back</div>
                <div style={{color:'#64748b',fontSize:'1.15rem',marginBottom:18}}>Sign in to continue discovering amazing events</div>
                <div className="d-flex align-items-center gap-2 mb-3 p-3" style={{background:'#f1f5ff',borderRadius:'0.8rem'}}>
                  <i className="bi bi-people" style={{color:'#6366f1',fontSize:'1.3rem'}}></i>
                  <span style={{fontWeight:700}}>Join 12,000+ Students</span>
                </div>
                <div style={{color:'#64748b',fontSize:'1.01rem',marginBottom:18}}>Access your bookmarked events, personal calendar, and get notifications for deadlines.</div>
                <button className="btn w-100 py-2" style={{background:'#6366f1',color:'#fff',fontWeight:700,borderRadius:'0.8rem',fontSize:'1.1rem'}} onClick={()=>{setView('login');setError('')}}>Sign In <i className="bi bi-arrow-right ms-1"></i></button>
              </div>
            </div>
            <div className="col-md-5">
              <div className="p-4" style={{background:'#fff',borderRadius:'1.2rem',boxShadow:'0 4px 32px #6366f122'}}>
                <div style={{fontWeight:800,fontSize:'2rem',marginBottom:4}}>Get Started</div>
                <div style={{color:'#64748b',fontSize:'1.15rem',marginBottom:18}}>Create your account and unlock all features</div>
                <div className="d-flex align-items-center gap-2 mb-3 p-3" style={{background:'#f1f5ff',borderRadius:'0.8rem'}}>
                  <i className="bi bi-clock-history" style={{color:'#6366f1',fontSize:'1.3rem'}}></i>
                  <span style={{fontWeight:700}}>Free Forever</span>
                </div>
                <div style={{color:'#64748b',fontSize:'1.01rem',marginBottom:18}}>Get started with full access to all events, bookmarks, and personal event management.</div>
                <button className="btn btn-outline-primary w-100 py-2" style={{fontWeight:700,borderRadius:'0.8rem',fontSize:'1.1rem'}} onClick={()=>{setView('register');setError('')}}>Create Account <i className="bi bi-arrow-right ms-1"></i></button>
              </div>
            </div>
          </div>
          {/* Stats Row */}
          <div className="d-flex justify-content-center gap-5 mt-5 mb-2 flex-wrap">
            <div className="text-center">
              <div style={{fontWeight:800,fontSize:'1.5rem',color:'#6366f1'}}>{stats.activeEvents}</div>
              <div style={{color:'#64748b',fontSize:'1.01rem'}}>Active Events</div>
            </div>
            <div className="text-center">
              <div style={{fontWeight:800,fontSize:'1.5rem',color:'#6366f1'}}>{stats.thisWeek}</div>
              <div style={{color:'#64748b',fontSize:'1.01rem'}}>This Week</div>
            </div>
            <div className="text-center">
              <div style={{fontWeight:800,fontSize:'1.5rem',color:'#6366f1'}}>12K+</div>
              <div style={{color:'#64748b',fontSize:'1.01rem'}}>Students</div>
            </div>
            <div className="text-center">
              <div style={{fontWeight:800,fontSize:'1.5rem',color:'#6366f1'}}>500+</div>
              <div style={{color:'#64748b',fontSize:'1.01rem'}}>Companies</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Login view
  if (view === 'login') {
    return (
      <div style={{minHeight:'100vh',background:'linear-gradient(120deg,#eef2ff 60%,#dbeafe 100%)',padding:'0'}}>
        <div className="container d-flex flex-column align-items-center justify-content-center" style={{minHeight:'100vh'}}>
          <div className="mb-4 text-center">
            <div style={{background:'#3b5bfd',borderRadius:'50%',padding:10,display:'inline-block'}}>
              <i className="bi bi-clock-history" style={{color:'#fff',fontSize:'2rem'}}></i>
            </div>
            <div style={{fontWeight:800,fontSize:'2rem',color:'#22223b',letterSpacing:'-1px',marginTop:8}}>Clockdin</div>
          </div>
          <div className="auth-card p-4" style={{background:'#fff',borderRadius:'1.2rem',boxShadow:'0 4px 32px #6366f122',maxWidth:420,width:'100%'}}>
            <div className="mb-2 text-center" style={{fontWeight:800,fontSize:'2rem'}}>Welcome Back</div>
            <div className="mb-4 text-center" style={{color:'#64748b',fontSize:'1.1rem'}}>Sign in to your account to continue exploring events</div>
            <form onSubmit={handleLogin}>
              <div className="mb-3">
                <label className="form-label">Email</label>
                <div className="input-group">
                  <span className="input-group-text"><i className="bi bi-envelope"></i></span>
                  <input
                    type="email"
                    className="form-control"
                    value={login.email}
                    onChange={e=>setLogin(l=>({...l,email:e.target.value}))}
                    required
                    placeholder="Enter your email"
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label">Password</label>
                <div className="input-group">
                  <span className="input-group-text"><i className="bi bi-lock"></i></span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-control"
                    value={login.password}
                    onChange={e=>setLogin(l=>({...l,password:e.target.value}))}
                    required
                    placeholder="Enter your password"
                    autoComplete="new-password"
                  />
                  <span className="input-group-text" style={{cursor:'pointer'}} onClick={()=>setShowPassword(v=>!v)}><i className={`bi ${showPassword?'bi-eye-slash':'bi-eye'}`}></i></span>
                </div>
              </div>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="rememberMe"
                    checked={rememberMe}
                    onChange={e=>setRememberMe(e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="rememberMe">Remember me</label>
                </div>
                <button type="button" className="btn btn-link p-0" style={{color:'#6366f1',fontWeight:500,fontSize:'0.98rem'}}>
                  Forgot password?
                </button>
              </div>
              {error && <div className="alert alert-danger py-1">{error}</div>}
              <button className="btn w-100 py-2" style={{background:'#6366f1',color:'#fff',fontWeight:700,borderRadius:'0.8rem',fontSize:'1.1rem'}} disabled={loading} type="submit">{loading?'Signing In...':'Sign In'}</button>
            </form>
            <div className="d-flex align-items-center my-3">
              <div className="flex-grow-1" style={{height:1,background:'#e5e7eb'}}></div>
              <div className="mx-2" style={{color:'#64748b',fontSize:'0.98rem'}}>Don't have an account?</div>
              <div className="flex-grow-1" style={{height:1,background:'#e5e7eb'}}></div>
            </div>
            <button className="btn btn-outline-primary w-100 py-2 mb-2" style={{fontWeight:700,borderRadius:'0.8rem',fontSize:'1.1rem'}} onClick={()=>{setView('register');setError('')}}>Create Account</button>
            <div className="text-center mt-2">
              <button type="button" className="btn btn-link p-0" style={{color:'#64748b',fontSize:'0.98rem'}} onClick={()=>{setView('home');setError('')}}>
                &larr; Back to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Register view
  if (view === 'register') {
    return (
      <div style={{minHeight:'100vh',background:'linear-gradient(120deg,#eef2ff 60%,#dbeafe 100%)',padding:'0'}}>
        <div className="container d-flex flex-column align-items-center justify-content-center" style={{minHeight:'100vh'}}>
          <div className="mb-4 text-center">
            <div style={{background:'#3b5bfd',borderRadius:'50%',padding:10,display:'inline-block'}}>
              <i className="bi bi-clock-history" style={{color:'#fff',fontSize:'2rem'}}></i>
            </div>
            <div style={{fontWeight:800,fontSize:'2rem',color:'#22223b',letterSpacing:'-1px',marginTop:8}}>Clockdin</div>
          </div>
          <div className="auth-card p-4" style={{background:'#fff',borderRadius:'1.2rem',boxShadow:'0 4px 32px #6366f122',maxWidth:420,width:'100%'}}>
            <div className="mb-2 text-center" style={{fontWeight:800,fontSize:'2rem'}}>Create Account</div>
            <div className="mb-4 text-center" style={{color:'#64748b',fontSize:'1.1rem'}}>Join thousands of students discovering amazing opportunities</div>
            <form onSubmit={handleRegister}>
              <div className="mb-3">
                <label className="form-label">Full Name</label>
                <div className="input-group">
                  <span className="input-group-text"><i className="bi bi-person"></i></span>
                  <input type="text" className="form-control" value={register.name} name="name" onChange={handleChange} required placeholder="Enter your full name"  autoComplete='off'/>
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label">Email</label>
                <div className="input-group">
                  <span className="input-group-text"><i className="bi bi-envelope"></i></span>
                  <input type="email" className="form-control" value={register.email} name='email' onChange={handleChange} required placeholder="Enter your email" autoComplete='off' />
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label">University/College</label>
                <div className="input-group">
                  <span className="input-group-text"><i className="bi bi-mortarboard"></i></span>
                  <input type="text" className="form-control" value={register.college} name='college' onChange={handleChange} placeholder="Enter your university" autoComplete='off' />
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label">Password</label>
                <div className="input-group">
                  <span className="input-group-text"><i className="bi bi-lock"></i></span>
                  <input type={showRegPassword ? 'text' : 'password'} className="form-control" value={register.password} name="password" onChange={handleChange} required placeholder="Create a strong password" autoComplete='off'/>
                  <span className="input-group-text" style={{cursor:'pointer'}}  onClick={()=>setShowRegPassword(v=>!v)}><i className={`bi ${showRegPassword?'bi-eye-slash':'bi-eye'}`}></i></span>
                </div>
                <div style={{fontSize:'0.95rem',color:'#64748b',marginTop:2}}>Must be 8+ characters with uppercase, lowercase, and number</div>
              </div>
              <div className="mb-3">
                <label className="form-label">Confirm Password</label>
                <div className="input-group">
                  <span className="input-group-text"><i className="bi bi-lock"></i></span>
                  <input type={showRegConfirm ? 'text' : 'password'} className="form-control" value={register.confirm} name="confirm" onChange={handleChange} required placeholder="Confirm your password" autoComplete='off'/>
                  <span className="input-group-text" style={{cursor:'pointer'}} name onClick={()=>setShowRegConfirm(v=>!v)}><i className={`bi ${showRegConfirm?'bi-eye-slash':'bi-eye'}`}></i></span>
                </div>
              </div>
              <div className="form-check mb-3">
                <input className="form-check-input" type="checkbox" id="agree" name="agree" checked={register.agree} onChange={handleChange} />
                <label className="form-check-label" htmlFor="agree">
                  I agree to the <a href="/terms-of-service" style={{color:'#6366f1'}}>Terms of Service</a> and <a href="/privacy-policy" style={{color:'#6366f1'}}>Privacy Policy</a>
                </label>
              </div>
              {error && <div className="alert alert-danger py-1">{error}</div>}
              <button className="btn w-100 py-2" style={{background:'#6366f1',color:'#fff',fontWeight:700,borderRadius:'0.8rem',fontSize:'1.1rem'}} disabled={loading} type="submit">{loading?'Creating...':'Create Account'}</button>
            </form>
            <div className="d-flex align-items-center my-3">
              <div className="flex-grow-1" style={{height:1,background:'#e5e7eb'}}></div>
              <div className="mx-2" style={{color:'#64748b',fontSize:'0.98rem'}}>Already have an account?</div>
              <div className="flex-grow-1" style={{height:1,background:'#e5e7eb'}}></div>
            </div>
            <button className="btn btn-outline-primary w-100 py-2 mb-2" style={{fontWeight:700,borderRadius:'0.8rem',fontSize:'1.1rem'}} onClick={()=>{setView('login');setError('')}}>Sign In</button>
            <div className="text-center mt-2">
              <button type="button" className="btn btn-link p-0" style={{color:'#64748b',fontSize:'0.98rem'}} onClick={()=>{setView('home');setError('')}}>
                &larr; Back to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default Landing;
