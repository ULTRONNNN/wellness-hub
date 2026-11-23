
import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  Clock3,
  HeartPulse,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  UserRound,
  Users,
  XCircle
} from 'lucide-react';
import './App.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const STORAGE_KEY = 'wellness_hub_doctor_session';

const ACTIVE_STATUSES = ['pending', 'booked', 'confirmed'];

function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}

async function api(path, token, options = {}) {
  let response;

  try {
    response = await fetch(`${API}${path}`, {
      ...options,
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers
      }
    });
  } catch {
    throw new Error(`Cannot connect to backend at ${API}`);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error || data.message || `Request failed (${response.status})`
    );
  }

  return data;
}

function indiaDate(value) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function indiaTime(value) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function Status({ value }) {
  return (
    <span className={`status status-${value || 'unknown'}`}>
      {value || 'Unknown'}
    </span>
  );
}

function AppointmentTable({ items, updateStatus, saving }) {
  if (!items.length) {
    return (
      <div className="empty">
        <CalendarDays size={35} />
        <h3>No appointments found</h3>
        <p>Appointments will appear here when patients book with you.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Patient</th>
            <th>Date</th>
            <th>Time (IST)</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {items.map(a => {
            const canConfirm = ['pending', 'booked'].includes(a.status);
            const canComplete =
              a.status === 'confirmed' &&
              new Date(a.slot) <= new Date();

            const canCancel = ACTIVE_STATUSES.includes(a.status);

            return (
              <tr key={a._id}>
                <td>
                  <strong>{a.patientId?.name || 'Patient unavailable'}</strong>
                  <small>{a.patientId?.email || '—'}</small>
                </td>

                <td>{indiaDate(a.slot)}</td>
                <td>{indiaTime(a.slot)}</td>

                <td>
                  <Status value={a.status} />
                </td>

                <td>
                  <div className="appointment-actions">
                    {canConfirm && (
                      <button
                        type="button"
                        className="primary"
                        disabled={saving}
                        onClick={() => updateStatus(a, 'confirmed')}
                      >
                        Confirm
                      </button>
                    )}

                    {a.status === 'confirmed' && (
                      <button
                        type="button"
                        className="primary"
                        disabled={saving || !canComplete}
                        title={
                          canComplete
                            ? 'Mark consultation as completed'
                            : 'You can complete this appointment after its scheduled time'
                        }
                        onClick={() => updateStatus(a, 'completed')}
                      >
                        Complete
                      </button>
                    )}

                    {canCancel && (
                      <button
                        type="button"
                        className="danger-text"
                        disabled={saving}
                        onClick={() => updateStatus(a, 'cancelled')}
                      >
                        {canConfirm ? 'Reject' : 'Cancel'}
                      </button>
                    )}

                    {!canCancel && (
                      <span className="muted">—</span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function App() {
  const [session, setSession] = useState(getSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [doctor, setDoctor] = useState(null);
  const [appointments, setAppointments] = useState([]);

  const [page, setPage] = useState('overview');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [slotsText, setSlotsText] = useState('');

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const logout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setDoctor(null);
    setAppointments([]);
    setPassword('');
    setPage('overview');
    setError('');
    setNotice('');
  }, []);

  const loadData = useCallback(async (token, quiet = false) => {
    if (!quiet) setRefreshing(true);

    try {
      const [profile, records] = await Promise.all([
        api('/api/doctor/me', token),
        api('/api/appointments', token)
      ]);

      setDoctor(profile);
      setAppointments(Array.isArray(records) ? records : []);
      setSlotsText((profile.slots || []).join(', '));
      setError('');
    } catch (err) {
      if (/Authentication required|Forbidden/i.test(err.message)) {
        logout();
        setError('Your session expired. Please sign in again.');
      } else {
        setError(err.message);
      }
    } finally {
      setRefreshing(false);
    }
  }, [logout]);

  useEffect(() => {
    if (!session?.token) return;

    loadData(session.token);
  }, [session?.token, loadData]);

  async function login(event) {
    event.preventDefault();

    setLoading(true);
    setError('');
    setNotice('');

    try {
      const data = await api('/api/auth/login', null, {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password
        })
      });

      if (data.user?.role !== 'doctor') {
        throw new Error('Only doctor accounts can access this portal.');
      }

      const saved = {
        token: data.token,
        user: data.user
      };

      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
      setSession(saved);
      setPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function updateAppointmentStatus(appointment, status) {
    if (saving) return;

    const action =
      status === 'confirmed'
        ? 'confirm'
        : status === 'completed'
          ? 'complete'
          : ['pending', 'booked'].includes(appointment.status)
            ? 'reject'
            : 'cancel';

    if (!window.confirm(
      `Are you sure you want to ${action} this appointment for ${
        appointment.patientId?.name || 'this patient'
      }?`
    )) {
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');

    try {
      await api(
        `/api/doctor/appointments/${appointment._id}/status`,
        session.token,
        {
          method: 'PATCH',
          body: JSON.stringify({ status })
        }
      );

      await loadData(session.token, true);

      setNotice(
        `Appointment ${
          status === 'cancelled' && action === 'reject'
            ? 'rejected'
            : status
        } successfully.`
      );
    } catch (err) {
      setError(err.message);
      await loadData(session.token, true);
    } finally {
      setSaving(false);
    }
  }

  async function saveAvailability(event) {
    event.preventDefault();

    if (saving) return;

    const slots = [
      ...new Set(
        slotsText
          .split(/[,\n]+/)
          .map(s => s.trim())
          .filter(Boolean)
      )
    ].sort();

    if (
      slots.length > 48 ||
      slots.some(s => !/^([01]\d|2[0-3]):[0-5]\d$/.test(s))
    ) {
      setError('Enter up to 48 valid times in 24-hour HH:mm format.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');

    try {
      await api('/api/doctor/availability', session.token, {
        method: 'PATCH',
        body: JSON.stringify({ slots })
      });

      await loadData(session.token, true);
      setNotice('Availability updated successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const total = appointments.length;

  const pending = appointments.filter(
    a => ['pending', 'booked'].includes(a.status)
  ).length;

  const confirmed = appointments.filter(
    a => a.status === 'confirmed'
  ).length;

  const completed = appointments.filter(
    a => a.status === 'completed'
  ).length;

  const cancelled = appointments.filter(
    a => a.status === 'cancelled'
  ).length;

  const upcoming = appointments.filter(
    a =>
      ACTIVE_STATUSES.includes(a.status) &&
      new Date(a.slot) >= new Date()
  ).length;

  const visible = appointments
    .filter(a => {
      const matchStatus = filter === 'all' || a.status === filter;

      const text = [
        a.patientId?.name,
        a.patientId?.email,
        a.status,
        a._id
      ].join(' ').toLowerCase();

      return (
        matchStatus &&
        text.includes(search.trim().toLowerCase())
      );
    })
    .sort((a, b) => new Date(b.slot) - new Date(a.slot));

  const stats = [
    {
      label: 'Total Appointments',
      value: total,
      icon: CalendarDays
    },
    {
      label: 'Pending',
      value: pending,
      icon: Clock3
    },
    {
      label: 'Confirmed',
      value: confirmed,
      icon: CheckCircle2
    },
    {
      label: 'Completed',
      value: completed,
      icon: ShieldCheck
    },
    {
      label: 'Cancelled',
      value: cancelled,
      icon: XCircle
    }
  ];

  if (!session) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="brand">
            <HeartPulse size={34} />
            <span>
              Wellness<strong>Hub</strong>
            </span>
          </div>

          <div className="portal-tag">
            <ShieldCheck size={15} />
            DOCTOR PORTAL
          </div>

          <h1>Welcome back, Doctor.</h1>

          <p className="muted">
            Sign in with the credentials created by your administrator.
          </p>

          <form onSubmit={login}>
            <label>
              Doctor email
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="doctor@gmail.com"
                autoComplete="username"
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />
            </label>

            {error && (
              <div className="alert error">{error}</div>
            )}

            <button
              className="primary full"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign in as Doctor'}
            </button>
          </form>

          <p className="login-foot">
            Doctor accounts are managed by Wellness Hub administrators.
          </p>
        </div>
      </div>
    );
  }

  const nav = [
    {
      id: 'overview',
      label: 'Overview',
      icon: Activity
    },
    {
      id: 'appointments',
      label: 'Appointments',
      icon: CalendarDays
    },
    {
      id: 'availability',
      label: 'Availability',
      icon: Clock3
    },
    {
      id: 'profile',
      label: 'My Profile',
      icon: UserRound
    }
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand sidebar-brand">
          <HeartPulse size={30} />
          <span>
            Wellness<strong>Hub</strong>
          </span>
        </div>

        <p className="sidebar-caption">DOCTOR WORKSPACE</p>

        <nav>
          {nav.map(item => {
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                className={`nav-item ${
                  page === item.id ? 'active' : ''
                }`}
                onClick={() => {
                  setPage(item.id);
                  setError('');
                  setNotice('');
                }}
              >
                <Icon size={19} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="doctor-mini">
            <div className="avatar">
              <Stethoscope size={20} />
            </div>

            <div>
              <strong>
                {doctor?.name || session.user?.name}
              </strong>
              <small>
                {doctor?.specialty || 'Doctor'}
              </small>
            </div>
          </div>

          <button
            className="nav-item logout"
            onClick={logout}
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <span className="eyebrow">
              WELLNESS HUB / DOCTOR
            </span>
            <h2>
              {nav.find(n => n.id === page)?.label}
            </h2>
          </div>

          <button
            type="button"
            className="secondary refresh"
            disabled={refreshing || saving}
            onClick={() => loadData(session.token)}
          >
            <RefreshCw size={17} />
            {refreshing ? 'Loading...' : 'Refresh'}
          </button>
        </header>

        <div className="content">
          {error && (
            <div className="alert error">{error}</div>
          )}

          {notice && (
            <div className="alert success">{notice}</div>
          )}

          {page === 'overview' && (
            <>
              <div className="welcome">
                <div>
                  <span className="eyebrow">
                    YOUR PRACTICE AT A GLANCE
                  </span>

                  <h1>
                    Hello, {
                      doctor?.name ||
                      session.user?.name ||
                      'Doctor'
                    } 👋
                  </h1>

                  <p>
                    Manage your consultations and patient appointments.
                  </p>
                </div>

                <Stethoscope
                  size={60}
                  className="welcome-icon"
                />
              </div>

              <div className="stats">
                {stats.map(s => {
                  const Icon = s.icon;

                  return (
                    <div
                      className="stat-card"
                      key={s.label}
                    >
                      <div className="stat-icon">
                        <Icon size={22} />
                      </div>

                      <span>{s.label}</span>
                      <strong>{s.value}</strong>
                    </div>
                  );
                })}
              </div>

              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h3>Upcoming Appointments</h3>
                    <p>Your next scheduled consultations</p>
                  </div>

                  <button
                    className="secondary"
                    onClick={() => setPage('appointments')}
                  >
                    View All
                  </button>
                </div>

                <AppointmentTable
                  items={appointments
                    .filter(
                      a =>
                        ACTIVE_STATUSES.includes(a.status) &&
                        new Date(a.slot) >= new Date()
                    )
                    .sort(
                      (a, b) =>
                        new Date(a.slot) - new Date(b.slot)
                    )
                    .slice(0, 5)}
                  updateStatus={updateAppointmentStatus}
                  saving={saving}
                />
              </section>

              <div className="info-box">
                <strong>Upcoming appointments: {upcoming}</strong>
                <p>
                  Confirm pending bookings and complete consultations
                  after their scheduled time.
                </p>
              </div>
            </>
          )}

          {page === 'appointments' && (
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h3>Patient Appointments</h3>
                  <p>
                    Appointments assigned to your doctor account
                  </p>
                </div>

                <span className="count">
                  {visible.length} records
                </span>
              </div>

              <div className="filters">
                <input
                  placeholder="Search patient name or email..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />

                <select
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                >
                  <option value="all">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="booked">Booked</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <AppointmentTable
                items={visible}
                updateStatus={updateAppointmentStatus}
                saving={saving}
              />
            </section>
          )}

          {page === 'availability' && (
            <section className="panel narrow">
              <div className="panel-head">
                <div>
                  <h3>Consultation Availability</h3>
                  <p>
                    Set the daily consultation times patients can choose.
                  </p>
                </div>

                <Clock3 size={25} />
              </div>

              <form onSubmit={saveAvailability}>
                <label>
                  Available time slots (24-hour format)

                  <textarea
                    rows={5}
                    value={slotsText}
                    onChange={e => setSlotsText(e.target.value)}
                    placeholder="09:00, 10:00, 11:30, 15:00"
                  />
                </label>

                <p className="hint">
                  Separate times using commas or new lines.
                  Example: 09:00, 10:30, 14:00.
                  Leave empty to remove all offered times.
                </p>

                <button
                  className="primary"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Availability'}
                </button>
              </form>

              <div className="info-box">
                <strong>Important</strong>
                <p>
                  These are recurring daily time slots.
                  Existing appointments are not automatically
                  cancelled when availability changes.
                </p>
              </div>
            </section>
          )}

          {page === 'profile' && (
            <section className="panel narrow">
              <div className="profile-head">
                <div className="profile-avatar">
                  <Stethoscope size={32} />
                </div>

                <div>
                  <h2>{doctor?.name || 'Doctor'}</h2>
                  <p>
                    {doctor?.specialty || 'Medical Professional'}
                  </p>
                </div>
              </div>

              <div className="profile-grid">
                {[
                  ['Specialty', doctor?.specialty],
                  ['Qualification', doctor?.qualification],
                  [
                    'Experience',
                    doctor?.experience != null
                      ? `${doctor.experience} years`
                      : '—'
                  ],
                  ['Hospital', doctor?.hospital],
                  ['Contact', doctor?.contact],
                  ['Profile Email', doctor?.email],
                  ['Login Email', session.user?.email],
                  [
                    'Registration Number',
                    doctor?.registrationNumber
                  ],
                  [
                    'Consultation Fee',
                    doctor?.consultationFee != null
                      ? `₹${doctor.consultationFee}`
                      : '—'
                  ],
                  [
                    'Account Status',
                    doctor?.isActive === false
                      ? 'Inactive'
                      : 'Active'
                  ]
                ].map(([label, value]) => (
                  <div
                    className="profile-field"
                    key={label}
                  >
                    <span>{label}</span>
                    <strong>{value || '—'}</strong>
                  </div>
                ))}
              </div>

              {doctor?.bio && (
                <div className="bio">
                  <h3>About</h3>
                  <p>{doctor.bio}</p>
                </div>
              )}

              <div className="info-box">
                Contact your administrator to update your profile
                details or reset your login password.
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
