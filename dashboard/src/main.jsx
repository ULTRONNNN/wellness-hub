
import React, { useEffect, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

import {
  Activity,
  CalendarDays,
  Users,
  Stethoscope,
  LogOut,
  HeartPulse,
  RefreshCcw,
  ShieldCheck,
  Search,
  CheckCircle2,
  XCircle
} from 'lucide-react';

import './style.css';

const BASE =
  import.meta.env.VITE_API_URL || 'http://localhost:4000';

const TIMEZONE = 'Asia/Kolkata';

// ---------- API ----------

async function request(path, token, options = {}) {
  const response = await fetch(BASE + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? {
        Authorization: `Bearer ${token}`
      } : {}),
      ...options.headers
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data;
}

// ---------- DATE HELPERS ----------

function formatDate(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'Invalid date';

  return date.toLocaleDateString('en-IN', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function formatTime(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'Invalid time';

  return date.toLocaleTimeString('en-IN', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function indiaDateKey(value) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);

  const get = type =>
    parts.find(part => part.type === type)?.value;

  return `${get('year')}-${get('month')}-${get('day')}`;
}

// ---------- MAIN APP ----------

function App() {
  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem('wh-session') || 'null'
      );
    } catch {
      return null;
    }
  });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [tab, setTab] = useState('overview');

  const [summary, setSummary] = useState(null);
  const [appointments, setAppointments] = useState([]);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const [search, setSearch] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  // ---------- LOAD REAL DATABASE RECORDS ----------

  const load = useCallback(async (silent = false) => {
    if (!session?.token || session.user?.role !== 'admin') {
      return;
    }

    if (!silent) setRefreshing(true);

    try {
      const [summaryData, appointmentData] = await Promise.all([
        request('/api/dashboard/summary', session.token),
        request('/api/admin/appointments', session.token)
      ]);

      setSummary(summaryData);
      setAppointments(
  [...appointmentData].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  )
);
      setLastUpdated(new Date());
      setError('');
    } catch (err) {
      setError(`Dashboard refresh failed: ${err.message}`);
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, [session]);

  // Refresh immediately and every 10 seconds.
  useEffect(() => {
    if (!session) return;

    if (session.user?.role !== 'admin') {
      localStorage.removeItem('wh-session');
      setSession(null);
      return;
    }

    load();

    const timer = setInterval(() => {
      load(true);
    }, 10000);

    return () => clearInterval(timer);
  }, [session, load]);

  // ---------- LOGIN ----------

  async function login(event) {
    event.preventDefault();

    setError('');
    setLoading(true);

    try {
      const result = await request(
        '/api/auth/login',
        null,
        {
          method: 'POST',
          body: JSON.stringify({ email, password })
        }
      );

      if (result.user.role !== 'admin') {
        throw new Error(
          'This dashboard requires an administrator account.'
        );
      }

      localStorage.setItem(
        'wh-session',
        JSON.stringify(result)
      );

      setSession(result);
      setTab('overview');
      setPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ---------- LOGOUT ----------

  function logout() {
    localStorage.removeItem('wh-session');

    setSession(null);
    setSummary(null);
    setAppointments([]);
    setError('');
    setLastUpdated(null);
  }

  // ---------- CANCEL APPOINTMENT ----------

  async function cancelAppointment(appointment) {
    const doctor = appointment.doctorId?.name || 'Doctor';
    const patient = appointment.patientId?.name || 'Patient';

    const message =
      `Cancel this appointment?\n\n` +
      `Patient: ${patient}\n` +
      `Doctor: ${doctor}\n` +
      `Date: ${formatDate(appointment.slot)}\n` +
      `Time: ${formatTime(appointment.slot)} IST`;

    if (!window.confirm(message)) return;

    setRefreshing(true);

    try {
      await request(
        `/api/appointments/${appointment._id}/cancel`,
        session.token,
        { method: 'PATCH' }
      );

      await load(true);
      window.alert('Appointment cancelled successfully.');
    } catch (err) {
      setError(`Cancellation failed: ${err.message}`);
    } finally {
      setRefreshing(false);
    }
  }

async function deleteAppointment(appointment) {
  setDeleteTarget(appointment);
}

async function confirmDelete() {
  if (!deleteTarget) return;

  const appointmentId = deleteTarget._id;
  setRefreshing(true);

  try {
    await request(
      `/api/admin/appointments/${appointmentId}`,
      session.token,
      { method: 'DELETE' }
    );

    setAppointments(previous =>
      previous.filter(a => a._id !== appointmentId)
    );

    setDeleteTarget(null);
    await load(true);
  } catch (err) {
    setError(`Delete failed: ${err.message}`);
    setDeleteTarget(null);
  } finally {
    setRefreshing(false);
  }
}


  // ---------- FILTER DATA ----------

  const doctors = [...new Map(
    appointments
      .filter(a => a.doctorId?._id)
      .map(a => [
        a.doctorId._id,
        {
          id: a.doctorId._id,
          name: a.doctorId.name
        }
      ])
  ).values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const filteredAppointments = appointments.filter(a => {
    const patientName = a.patientId?.name || '';
    const patientEmail = a.patientId?.email || '';
    const doctorName = a.doctorId?.name || '';
    const specialty = a.doctorId?.specialty || '';

    const searchable = [
      patientName,
      patientEmail,
      doctorName,
      specialty
    ].join(' ').toLowerCase();

    const matchesSearch = searchable.includes(
      search.trim().toLowerCase()
    );

    const matchesDoctor =
      doctorFilter === 'all' ||
      a.doctorId?._id === doctorFilter;

    const matchesStatus =
      statusFilter === 'all' ||
      a.status === statusFilter;

    const matchesDate =
      !dateFilter ||
      indiaDateKey(a.slot) === dateFilter;

    return matchesSearch &&
      matchesDoctor &&
      matchesStatus &&
      matchesDate;
  });

  // ---------- LOGIN SCREEN ----------

  if (!session) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="brand">
            <HeartPulse size={32} />
            Wellness<span>Hub</span>
          </div>

          <p className="eyebrow">ADMINISTRATION PORTAL</p>

          <h1>Welcome back.</h1>

          <p className="muted">
            Sign in to manage all doctors and appointments
            across Wellness Hub.
          </p>

          <form onSubmit={login}>
            <label>
              Admin email
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Enter admin email"
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                required
              />
            </label>

            {error && <p className="error">{error}</p>}

            <button disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in as Admin'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ---------- ADMIN DASHBOARD ----------

  return (
    <div className="shell">
      <aside>
        <div className="brand">
          <HeartPulse size={27} />
          Wellness<span>Hub</span>
        </div>

        <div className="side-caption">
          CENTRAL ADMINISTRATION
        </div>

        <nav>
          <button
            className={tab === 'overview' ? 'active' : ''}
            onClick={() => setTab('overview')}
          >
            <Activity size={19} />
            Overview
          </button>

          <button
            className={tab === 'appointments' ? 'active' : ''}
            onClick={() => setTab('appointments')}
          >
            <CalendarDays size={19} />
            All Appointments
          </button>
        </nav>

        <div className="side-bottom">
          <div className="identity">
            <div className="avatar">
              {session.user.name?.charAt(0) || 'A'}
            </div>

            <div>
              <b>{session.user.name}</b>
              <small>ADMINISTRATOR</small>
            </div>
          </div>

          <button onClick={logout}>
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>

      <main>
        <header>
          <div>
            <p className="eyebrow">
              WELLNESS HUB · CENTRAL ADMIN
            </p>

            <h1>
              {tab === 'overview'
                ? 'Dashboard Overview'
                : 'All Doctor Appointments'}
            </h1>

            <p className="muted">
              Manage real patient bookings across all doctors.
            </p>

            <p className="muted" style={{ fontSize: 12 }}>
              Auto-refresh every 10 seconds
              {lastUpdated &&
                ` · Last updated ${lastUpdated.toLocaleTimeString(
                  'en-IN',
                  { timeZone: TIMEZONE }
                )} IST`}
            </p>
          </div>

          <button
            className="refresh"
            onClick={() => load()}
            disabled={refreshing}
          >
            <RefreshCcw size={17} />
            {refreshing ? 'Refreshing...' : 'Refresh Now'}
          </button>
        </header>

        {error && (
          <div className="error-banner">
            {error}
          </div>
        )}

        {tab === 'overview' && (
          <>
            <div className="metrics">
              <div className="metric">
                <div className="metric-icon teal">
                  <CalendarDays />
                </div>
                <p>Total Appointments</p>
                <strong>
                  {summary?.appointments ?? '—'}
                </strong>
                <small>Across all doctors</small>
              </div>

              <div className="metric">
                <div className="metric-icon blue">
                  <CheckCircle2 />
                </div>
                <p>Active Bookings</p>
                <strong>
                  {summary?.booked ?? '—'}
                </strong>
                <small>Currently booked</small>
              </div>

              <div className="metric">
                <div className="metric-icon purple">
                  <Stethoscope />
                </div>
                <p>Registered Doctors</p>
                <strong>
                  {summary?.doctors ?? '—'}
                </strong>
                <small>All specialties</small>
              </div>

              <div className="metric">
                <div className="metric-icon blue">
                  <Users />
                </div>
                <p>Registered Patients</p>
                <strong>
                  {summary?.patients ?? '—'}
                </strong>
                <small>Patient accounts</small>
              </div>

              <div className="metric">
                <div className="metric-icon teal">
                  <XCircle />
                </div>
                <p>Cancelled Bookings</p>
                <strong>
                  {summary?.cancelled ?? '—'}
                </strong>
                <small>Cancellation records</small>
              </div>
            </div>

            <div className="notice">
              <ShieldCheck size={23} />
              <div>
                <b>Connected appointment management</b>
                <p>
                  Records are retrieved from MongoDB.
                  Dates and times are displayed in Indian
                  Standard Time (IST). This is a demonstration
                  system, not a clinical deployment.
                </p>
              </div>
            </div>
          </>
        )}

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>
                {tab === 'overview'
                  ? 'Appointment Records'
                  : 'All Doctor Appointments'}
              </h2>

              <p className="muted">
                Search, filter and manage real bookings.
              </p>
            </div>

            <span className="count">
              {filteredAppointments.length} records
            </span>
          </div>

          {/* FILTERS */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              padding: '16px 20px'
            }}
          >
            <div style={{ position: 'relative', flex: '1 1 200px' }}>
              <Search
                size={17}
                style={{
                  position: 'absolute',
                  top: 13,
                  left: 12,
                  color: '#64748b'
                }}
              />

              <input
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '11px 12px 11px 38px',
                  borderRadius: 9,
                  border: '1px solid #cbd5e1'
                }}
                placeholder="Search patient or doctor"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <select
              value={doctorFilter}
              onChange={e => setDoctorFilter(e.target.value)}
              style={{
                padding: 11,
                borderRadius: 9,
                border: '1px solid #cbd5e1'
              }}
            >
              <option value="all">All Doctors</option>
              {doctors.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{
                padding: 11,
                borderRadius: 9,
                border: '1px solid #cbd5e1'
              }}
            >
              <option value="all">All Statuses</option>
              <option value="booked">Booked</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <input
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              style={{
                padding: 10,
                borderRadius: 9,
                border: '1px solid #cbd5e1'
              }}
            />

            <button
              className="refresh"
              onClick={() => {
                setSearch('');
                setDoctorFilter('all');
                setStatusFilter('all');
                setDateFilter('');
              }}
            >
              Clear Filters
            </button>
          </div>

          {/* REAL APPOINTMENT TABLE */}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Specialty</th>
                  <th>Date (IST)</th>
                  <th>Time (IST)</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredAppointments.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="empty">
                      {refreshing
                        ? 'Loading appointments...'
                        : 'No matching appointments found.'}
                    </td>
                  </tr>
                ) : (
                  filteredAppointments.map(a => (
                    <tr key={a._id}>
                      <td>
                        <b>
                          {a.patientId?.name || 'Unknown Patient'}
                        </b>
                        <small>
                          {a.patientId?.email || ''}
                        </small>
                      </td>

                      <td>
                        <b>
                          {a.doctorId?.name || 'Unknown Doctor'}
                        </b>
                        <small>
                          {a.doctorId?.hospital || ''}
                        </small>
                      </td>

                      <td>
                        {a.doctorId?.specialty || '—'}
                      </td>

                      <td>
                        <b>{formatDate(a.slot)}</b>
                      </td>

                      <td>
                        <b>{formatTime(a.slot)}</b>
                      </td>

                      <td>
                        <span className={`status ${a.status}`}>
                          {a.status === 'booked'
                            ? 'Booked'
                            : 'Cancelled'}
                        </span>
                      </td>

                      <td>
  <div style={{ display: 'flex', gap: '8px' }}>
    {a.status === 'booked' && (
      <button
        className="link-button"
        onClick={() => cancelAppointment(a)}
        disabled={refreshing}
      >
        Cancel
      </button>
    )}

    <button
      type="button"
      onClick={() => deleteAppointment(a)}
      disabled={refreshing}
      style={{
        background: '#fee2e2',
        color: '#b91c1c',
        border: '1px solid #fecaca',
        padding: '8px 12px',
        borderRadius: '8px',
        cursor: 'pointer'
      }}
    >
      Delete
    </button>
  </div>
</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

{deleteTarget && (
  <div
    className="delete-modal-overlay"
    onClick={() => {
      if (!refreshing) setDeleteTarget(null);
    }}
  >
    <div
      className="delete-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="delete-modal-icon">🗑️</div>

      <h2 id="delete-modal-title">Delete Appointment?</h2>

      <p className="delete-modal-description">
        Are you sure you want to permanently delete this
        appointment? This action cannot be undone.
      </p>

      <div className="delete-modal-details">
        <div>
          <span>Patient</span>
          <strong>
            {deleteTarget.patientId?.name || 'Patient'}
          </strong>
        </div>

        <div>
          <span>Doctor</span>
          <strong>
            {deleteTarget.doctorId?.name || 'Doctor'}
          </strong>
        </div>

        <div>
          <span>Date</span>
          <strong>{formatDate(deleteTarget.slot)}</strong>
        </div>

        <div>
          <span>Time</span>
          <strong>{formatTime(deleteTarget.slot)} IST</strong>
        </div>
      </div>

      <div className="delete-modal-actions">
        <button
          type="button"
          className="delete-modal-cancel"
          disabled={refreshing}
          onClick={() => setDeleteTarget(null)}
        >
          Keep Booking
        </button>

        <button
          type="button"
          className="delete-modal-confirm"
          disabled={refreshing}
          onClick={confirmDelete}
        >
          {refreshing ? 'Deleting...' : 'Delete Appointment'}
        </button>
      </div>
    </div>
  </div>
)}

      </main>
    </div>
  );
}

createRoot(
  document.getElementById('root')
).render(<App />);
