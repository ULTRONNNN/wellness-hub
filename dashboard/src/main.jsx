
import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity, CalendarDays, Users, Stethoscope, LogOut,
  HeartPulse, RefreshCcw, ShieldCheck, Search,
  CheckCircle2, XCircle, Plus, Pencil, UserRound,
  KeyRound, Save, ArrowLeft
} from 'lucide-react';
import './style.css';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const TIMEZONE = 'Asia/Kolkata';

const inputStyle = {
  width: '100%',
  padding: '11px 12px',
  borderRadius: 9,
  border: '1px solid #cbd5e1',
  boxSizing: 'border-box',
  background: '#fff',
  color: '#0f172a'
};

const buttonStyle = {
  padding: '10px 16px',
  borderRadius: 9,
  border: '1px solid #cbd5e1',
  background: '#fff',
  color: '#0f172a',
  cursor: 'pointer',
  fontWeight: 600
};

const primaryStyle = {
  ...buttonStyle,
  background: '#0f766e',
  color: '#fff',
  borderColor: '#0f766e'
};

const emptyDoctor = {
  name: '',
  specialty: '',
  qualification: '',
  experience: 0,
  hospital: '',
  address: '',
  city: '',
  latitude: '',
  longitude: '',
  contact: '',
  email: '',
  bio: '',
  registrationNumber: '',
  consultationFee: 0,
  slots: [],
  isActive: true
};

async function request(path, token, options = {}) {
  const response = await fetch(BASE + path, {
    ...options,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error || data.message || `HTTP ${response.status}`
    );
  }

  return data;
}


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

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);

  const get = type => parts.find(p => p.type === type)?.value;

  return `${get('year')}-${get('month')}-${get('day')}`;
}

function statusLabel(status) {
  const labels = {
    booked: 'Booked',
    pending: 'Pending',
    confirmed: 'Confirmed',
    cancelled: 'Cancelled',
    completed: 'Completed'
  };

  return labels[status] || status || 'Unknown';
}

function Field({ label, children }) {
  return (
    <label style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 7,
      fontSize: 13,
      fontWeight: 600,
      color: '#334155'
    }}>
      {label}
      {children}
    </label>
  );
}

// ======================================================
// DOCTOR PROFILE FORM
// ======================================================

function DoctorForm({ initial, onSave, onCancel, busy }) {
  const [form, setForm] = useState(() => ({
    ...emptyDoctor,
    ...initial
  }));

  const [slotsText, setSlotsText] = useState(
    (initial?.slots || []).join(', ')
  );

  function update(field, value) {
    setForm(previous => ({
      ...previous,
      [field]: value
    }));
  }

  function submit(event) {
    event.preventDefault();

    const slots = [...new Set(
      slotsText
        .split(/[,\n]+/)
        .map(s => s.trim())
        .filter(Boolean)
    )].sort();

    if (slots.some(s => !/^([01]\d|2[0-3]):[0-5]\d$/.test(s))) {
      window.alert('Enter slots in HH:mm format, for example 09:00.');
      return;
    }

    const lat = String(form.latitude ?? '').trim();
const lng = String(form.longitude ?? '').trim();

if (
  (lat || lng) &&
  (
    !lat || !lng ||
    !Number.isFinite(Number(lat)) ||
    !Number.isFinite(Number(lng)) ||
    Math.abs(Number(lat)) > 90 ||
    Math.abs(Number(lng)) > 180
  )
) {
  window.alert('Enter valid latitude and longitude.');
  return;
}

onSave({
  name: form.name.trim(),
  specialty: form.specialty.trim(),
  qualification: form.qualification || '',
  experience: Number(form.experience || 0),
  hospital: form.hospital || '',
  address: (form.address || '').trim(),
  city: (form.city || '').trim(),
  ...(lat && lng ? {
    latitude: Number(lat),
    longitude: Number(lng)
  } : {}),
  contact: form.contact || '',
  email: form.email || '',
  bio: form.bio || '',
  registrationNumber: form.registrationNumber || '',
  consultationFee: Number(form.consultationFee || 0),
  slots,
  isActive: form.isActive
});
  }

  function textField(label, field, type = 'text', required = false) {
    return (
      <Field label={label}>
        <input
          style={inputStyle}
          type={type}
          value={form[field] ?? ''}
          required={required}
          min={type === 'number' ? 0 : undefined}
          onChange={e => update(field, e.target.value)}
        />
      </Field>
    );
  }

  return (
    <section className="panel" style={{ padding: 24 }}>
      <h2 style={{ marginTop: 0 }}>
        {initial?._id ? 'Edit Doctor Details' : 'Add New Doctor'}
      </h2>

      <p className="muted">
        Manage doctor information, fees and availability.
        Active doctors are visible to patients.
      </p>

      <form onSubmit={submit}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: 18,
          marginTop: 22
        }}>
          {textField('Doctor Full Name *', 'name', 'text', true)}
          {textField('Specialty *', 'specialty', 'text', true)}
          {textField('Qualification', 'qualification')}
          {textField('Experience (years)', 'experience', 'number')}
          {textField('Hospital / Clinic', 'hospital')}
          {textField('Hospital Address', 'address')}
{textField('City', 'city')}

<Field label="Latitude">
  <input
    style={inputStyle}
    type="number"
    step="any"
    min="-90"
    max="90"
    value={form.latitude ?? ''}
    placeholder="Enter latitude"
    onChange={e => update('latitude', e.target.value)}
  />
</Field>

<Field label="Longitude">
  <input
    style={inputStyle}
    type="number"
    step="any"
    min="-180"
    max="180"
    value={form.longitude ?? ''}
    placeholder="Enter longitude"
    onChange={e => update('longitude', e.target.value)}
  />
</Field>

<a
  href="https://www.google.com/maps"
  target="_blank"
  rel="noopener noreferrer"
  style={{ color: '#0f766e', fontWeight: 600 }}
>
  Find hospital coordinates on Google Maps
</a>
          {textField('Contact Number', 'contact')}
          {textField('Email', 'email', 'email')}
          {textField('Medical Registration Number', 'registrationNumber')}
          {textField('Consultation Fee (₹)', 'consultationFee', 'number')}
        </div>

        <div style={{ marginTop: 18 }}>
          <Field label="Doctor Biography">
            <textarea
              style={{ ...inputStyle, minHeight: 90 }}
              value={form.bio}
              onChange={e => update('bio', e.target.value)}
              placeholder="Professional experience and expertise"
            />
          </Field>
        </div>

        <div style={{ marginTop: 18 }}>
          <Field label="Daily Available Slots (24-hour IST)">
            <textarea
              style={{ ...inputStyle, minHeight: 75 }}
              value={slotsText}
              onChange={e => setSlotsText(e.target.value)}
              placeholder="09:00, 09:30, 10:00, 14:00"
            />
          </Field>
          <small className="muted">
            Separate slots with commas.
          </small>
        </div>

        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginTop: 20,
          fontWeight: 600
        }}>
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={e => update('isActive', e.target.checked)}
          />
          Active doctor (visible to patients)
        </label>

        <div style={{
          display: 'flex',
          gap: 12,
          marginTop: 25,
          flexWrap: 'wrap'
        }}>
          <button type="submit" style={primaryStyle} disabled={busy}>
            <Save size={16} style={{ verticalAlign: 'middle' }} />
            {' '}
            {busy ? 'Saving...' : 'Save Doctor'}
          </button>

          <button
            type="button"
            style={buttonStyle}
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

// ======================================================
// MAIN ADMIN DASHBOARD
// ======================================================

function App() {
  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('wh-session') || 'null');
    } catch {
      return null;
    }
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tab, setTab] = useState('overview');

  const [summary, setSummary] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [doctorRecords, setDoctorRecords] = useState([]);
  const [patients, setPatients] = useState([]);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const [search, setSearch] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  const [doctorSearch, setDoctorSearch] = useState('');
  const [patientSearch, setPatientSearch] = useState('');

  const [editingDoctor, setEditingDoctor] = useState(null);
  const [showDoctorForm, setShowDoctorForm] = useState(false);

  // Doctor login management state
  const [accountDoctor, setAccountDoctor] = useState(null);
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [credentialMode, setCredentialMode] = useState('create');
  const [accountLoading, setAccountLoading] = useState(false);
  const [originalAccountEmail, setOriginalAccountEmail] = useState('');

  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientAppointments, setPatientAppointments] = useState([]);
  const [patientLoading, setPatientLoading] = useState(false);

  // ======================================================
  // LOAD DASHBOARD DATA
  // ======================================================

  const load = useCallback(async (silent = false) => {
    if (!session?.token || session.user?.role !== 'admin') return;

    if (!silent) setRefreshing(true);

    try {
      const [
        summaryData,
        appointmentData,
        doctorData,
        patientData
      ] = await Promise.all([
        request('/api/dashboard/summary', session.token),
        request('/api/admin/appointments', session.token),
        request('/api/admin/doctors', session.token),
        request('/api/admin/patients', session.token)
      ]);

      setSummary(summaryData);

      setAppointments(
        [...appointmentData].sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        )
      );

      setDoctorRecords(doctorData);
      setPatients(patientData);
      setLastUpdated(new Date());
      setError('');
    } catch (err) {
      setError(`Dashboard refresh failed: ${err.message}`);
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, [session]);

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
    }, 60000);

    return () => clearInterval(timer);
  }, [session, load]);

  // ======================================================
  // ADMIN LOGIN / LOGOUT
  // ======================================================

  async function login(event) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await request('/api/auth/login', null, {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      if (result.user.role !== 'admin') {
        throw new Error('This dashboard requires an administrator account.');
      }

      localStorage.setItem('wh-session', JSON.stringify(result));
      setSession(result);
      setTab('overview');
      setPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem('wh-session');
    setSession(null);
    setSummary(null);
    setAppointments([]);
    setDoctorRecords([]);
    setPatients([]);
    setError('');
    setNotice('');
    setLastUpdated(null);
    setAccountDoctor(null);
    setAccountPassword('');
    setAccountEmail('');
    setOriginalAccountEmail('');
    setSelectedPatient(null);
    setPatientAppointments([]);
    setShowDoctorForm(false);
    setEditingDoctor(null);
  }

  // ======================================================
  // APPOINTMENT MANAGEMENT
  // ======================================================

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
    setError('');

    try {
      await request(
        `/api/appointments/${appointment._id}/cancel`,
        session.token,
        { method: 'PATCH' }
      );

      await load(true);
      setNotice('Appointment cancelled. Its history is preserved.');
    } catch (err) {
      setError(`Cancellation failed: ${err.message}`);
    } finally {
      setRefreshing(false);
    }
  }

  // ======================================================
  // DOCTOR PROFILE MANAGEMENT
  // ======================================================

  async function saveDoctor(data) {
    setSaving(true);
    setError('');
    setNotice('');

    try {
      const isEdit = Boolean(editingDoctor?._id);

      await request(
        isEdit
          ? `/api/admin/doctors/${editingDoctor._id}`
          : '/api/admin/doctors',
        session.token,
        {
          method: isEdit ? 'PATCH' : 'POST',
          body: JSON.stringify(data)
        }
      );

      setShowDoctorForm(false);
      setEditingDoctor(null);

      await load(true);

      setNotice(
        isEdit
          ? 'Doctor updated successfully.'
          : 'Doctor added successfully. You can now create their login.'
      );
    } catch (err) {
      setError(`Unable to save doctor: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function toggleDoctor(doctor) {
    const next = doctor.isActive === false;

    if (!window.confirm(
      `${next ? 'Activate' : 'Deactivate'} ${doctor.name}?`
    )) return;

    setSaving(true);
    setError('');

    try {
      await request(
        `/api/admin/doctors/${doctor._id}`,
        session.token,
        {
          method: 'PATCH',
          body: JSON.stringify({ isActive: next })
        }
      );

      await load(true);

      setNotice(
        `${doctor.name} ${next ? 'activated' : 'deactivated'}.`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // ======================================================
  // CREATE DOCTOR LOGIN
  // ======================================================

  function openCreateLogin(doctor) {
    setAccountDoctor(doctor);
    setCredentialMode('create');
    setAccountEmail(doctor.email || '');
    setOriginalAccountEmail('');
    setAccountPassword('');
    setError('');
    setNotice('');
  }

  async function createDoctorAccount(event) {
    event.preventDefault();

    if (!accountDoctor) return;

    setSaving(true);
    setError('');
    setNotice('');

    try {
      await request(
        `/api/admin/doctors/${accountDoctor._id}/account`,
        session.token,
        {
          method: 'POST',
          body: JSON.stringify({
            email: accountEmail.trim().toLowerCase(),
            password: accountPassword
          })
        }
      );

      setAccountDoctor(null);
      setAccountPassword('');
      setAccountEmail('');

      await load(true);

      setNotice('Doctor login account created successfully.');
    } catch (err) {
      setError(`Doctor account failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  // ======================================================
  // MANAGE EXISTING DOCTOR LOGIN
  // ======================================================

  async function openManageLogin(doctor) {
    setAccountDoctor(doctor);
    setCredentialMode('manage');
    setAccountEmail('');
    setOriginalAccountEmail('');
    setAccountPassword('');
    setError('');
    setNotice('');
    setAccountLoading(true);

    try {
      const result = await request(
        `/api/admin/doctors/${doctor._id}/account`,
        session.token
      );

      const loginEmail = result.user?.email || '';

      setAccountEmail(loginEmail);
      setOriginalAccountEmail(loginEmail);
    } catch (err) {
      setError(`Could not load doctor login: ${err.message}`);
    } finally {
      setAccountLoading(false);
    }
  }

  async function updateDoctorEmail(event) {
    event.preventDefault();

    if (!accountDoctor || !accountEmail.trim()) return;

    const normalizedEmail = accountEmail.trim().toLowerCase();

    if (normalizedEmail === originalAccountEmail.toLowerCase()) {
      setNotice('The login email is already up to date.');
      return;
    }

    if (!window.confirm(
      `Change ${accountDoctor.name}'s login email to ${normalizedEmail}?`
    )) return;

    setSaving(true);
    setError('');
    setNotice('');

    try {
      const result = await request(
        `/api/admin/doctors/${accountDoctor._id}/account/email`,
        session.token,
        {
          method: 'PATCH',
          body: JSON.stringify({
            email: normalizedEmail
          })
        }
      );

      const savedEmail = result.user?.email || normalizedEmail;

      setAccountEmail(savedEmail);
      setOriginalAccountEmail(savedEmail);

      setAccountDoctor(previous => ({
        ...previous,
        email: savedEmail
      }));

      await load(true);

      setNotice('Doctor login email updated successfully.');
    } catch (err) {
      setError(`Email update failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function resetDoctorPassword(event) {
    event.preventDefault();

    if (!accountDoctor || accountPassword.length < 8) {
      setError('Password must contain at least 8 characters.');
      return;
    }

    if (!window.confirm(
      `Reset the login password for ${accountDoctor.name}?`
    )) return;

    setSaving(true);
    setError('');
    setNotice('');

    try {
      await request(
        `/api/admin/doctors/${accountDoctor._id}/account/password`,
        session.token,
        {
          method: 'PATCH',
          body: JSON.stringify({
            password: accountPassword
          })
        }
      );

      setAccountPassword('');
      setNotice('Doctor password reset successfully.');
    } catch (err) {
      setError(`Password reset failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  function closeAccountPage() {
    setAccountDoctor(null);
    setAccountEmail('');
    setOriginalAccountEmail('');
    setAccountPassword('');
    setCredentialMode('create');
    setError('');
  }

  // ======================================================
  // PATIENT RECORDS
  // ======================================================

  async function viewPatient(patient) {
    setSelectedPatient(patient);
    setPatientAppointments([]);
    setPatientLoading(true);
    setError('');

    try {
      const records = await request(
        `/api/admin/patients/${patient._id}/appointments`,
        session.token
      );

      setPatientAppointments(records);
    } catch (err) {
      setError(`Patient records failed: ${err.message}`);
    } finally {
      setPatientLoading(false);
    }
  }

  // ======================================================
  // SEARCH AND FILTERS
  // ======================================================

  const doctors = doctorRecords
    .map(d => ({
      id: d._id,
      name: d.name
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const filteredAppointments = appointments.filter(a => {
    const searchable = [
      a.patientId?.name || '',
      a.patientId?.email || '',
      a.doctorId?.name || '',
      a.doctorId?.specialty || ''
    ].join(' ').toLowerCase();

    return (
      searchable.includes(search.trim().toLowerCase()) &&
      (doctorFilter === 'all' ||
        a.doctorId?._id === doctorFilter) &&
      (statusFilter === 'all' ||
        a.status === statusFilter) &&
      (!dateFilter ||
        indiaDateKey(a.slot) === dateFilter)
    );
  });

  const filteredDoctors = doctorRecords.filter(d =>
    [
      d.name,
      d.specialty,
      d.hospital,
      d.email,
      d.registrationNumber
    ].join(' ').toLowerCase()
      .includes(doctorSearch.trim().toLowerCase())
  );

  const filteredPatients = patients.filter(p =>
    [p.name, p.email].join(' ').toLowerCase()
      .includes(patientSearch.trim().toLowerCase())
  );

  // ======================================================
  // LOGIN SCREEN
  // ======================================================

  if (!session) {
    return (
      <div className="login-page">
        <div className="login-intro"><HeartPulse size={48}/><p className="eyebrow">WELLNESS HUB</p><h2>Better care starts with better management.</h2><p>One workspace for doctors, appointments and patient records.</p><div className="login-trust"><ShieldCheck size={20}/> Administrator access</div></div><div className="login-card">
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

  const titles = {
    overview: 'Dashboard Overview',
    appointments: 'All Doctor Appointments',
    doctors: 'Doctor Management',
    patients: 'Patient Records'
  };

  // ======================================================
  // DASHBOARD LAYOUT
  // ======================================================

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

          <button
            className={tab === 'doctors' ? 'active' : ''}
            onClick={() => setTab('doctors')}
          >
            <Stethoscope size={19} />
            Manage Doctors
          </button>

          <button
            className={tab === 'patients' ? 'active' : ''}
            onClick={() => setTab('patients')}
          >
            <Users size={19} />
            Patient Records
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

            <h1>{titles[tab]}</h1>

            <p className="muted">
              Manage doctors, patients and appointment records.
            </p>

            <p className="muted" style={{ fontSize: 12 }}>
              Auto-refresh every 60 seconds
              {lastUpdated &&
                ` · Last updated ${lastUpdated.toLocaleTimeString(
                  'en-IN',
                  { timeZone: TIMEZONE }
                )} IST`}
            </p>
          </div>

          <button
  type="button"
  className="refresh"
  onClick={async () => {
    setNotice('');
    await load(false);
  }}
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

        {notice && (
          <div style={{
            padding: 14,
            background: '#ecfdf5',
            color: '#065f46',
            borderRadius: 10,
            marginBottom: 20,
            border: '1px solid #a7f3d0'
          }}>
            <CheckCircle2
              size={17}
              style={{ verticalAlign: 'middle' }}
            />
            {' '}{notice}
          </div>
        )}

        {/* ==========================================
            OVERVIEW
        ========================================== */}

        {tab === 'overview' && (
          <>
            <div className="admin-welcome"><div><p className="eyebrow">ADMIN WORKSPACE</p><h2>Welcome back, {session.user.name || 'Administrator'}.</h2><p>Manage your healthcare network from one central workspace.</p><button onClick={() => setTab('doctors')}><Stethoscope size={18}/> Manage doctors</button></div><HeartPulse className="welcome-art" size={120}/></div>
            <div className="metrics">
              <div className="metric">
                <div className="metric-icon teal">
                  <CalendarDays />
                </div>
                <p>Total Appointments</p>
                <strong>{summary?.appointments ?? '—'}</strong>
                <small>Across all doctors</small>
              </div>

              <div className="metric">
                <div className="metric-icon blue">
                  <CheckCircle2 />
                </div>
                <p>Active Bookings</p>
                <strong>{summary?.booked ?? '—'}</strong>
                <small>Booked, pending and confirmed</small>
              </div>

              <div className="metric">
                <div className="metric-icon purple">
                  <Stethoscope />
                </div>
                <p>Registered Doctors</p>
                <strong>{summary?.doctors ?? '—'}</strong>
                <small>All specialties</small>
              </div>

              <div className="metric">
                <div className="metric-icon blue">
                  <Users />
                </div>
                <p>Registered Patients</p>
                <strong>{summary?.patients ?? '—'}</strong>
                <small>Patient accounts</small>
              </div>

              <div className="metric">
                <div className="metric-icon teal">
                  <XCircle />
                </div>
                <p>Cancelled Bookings</p>
                <strong>{summary?.cancelled ?? '—'}</strong>
                <small>Cancellation records</small>
              </div>
            </div>

            <section className="panel analytics"><div className="panel-head"><div><h2>Appointment distribution</h2><p className="muted">Status breakdown of loaded appointment records</p></div><span className="count">{appointments.length} records</span></div><div className="analytics-bars">{['booked','pending','confirmed','completed','cancelled'].map(status => { const count = appointments.filter(a => a.status === status).length; return <div className="analytics-row" key={status}><span>{statusLabel(status)}</span><div className="bar-track"><div className={'bar-fill '+status} style={{width: `${appointments.length ? count / appointments.length * 100 : 0}%`}}/></div><b>{count}</b></div>; })}</div></section>
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

        {/* ==========================================
            APPOINTMENTS
        ========================================== */}

        {(tab === 'overview' || tab === 'appointments') && (
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

            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              padding: '16px 20px'
            }} className="appointment-filters">
              <div style={{
                position: 'relative',
                flex: '1 1 200px'
              }}>
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
                  style={{ ...inputStyle, paddingLeft: 38 }}
                  placeholder="Search patient or doctor"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>

              <select
                style={inputStyle}
                value={doctorFilter}
                onChange={e => setDoctorFilter(e.target.value)}
              >
                <option value="all">All Doctors</option>
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>

              <select
                style={inputStyle}
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="booked">Booked</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="cancelled">Cancelled</option>
                <option value="completed">Completed</option>
              </select>

              <input
                type="date"
                style={inputStyle}
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
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
                          <small>{a.patientId?.email || ''}</small>
                        </td>

                        <td>
                          <b>
                            {a.doctorId?.name || 'Unknown Doctor'}
                          </b>
                          <small>{a.doctorId?.hospital || ''}</small>
                        </td>

                        <td>{a.doctorId?.specialty || '—'}</td>

                        <td><b>{formatDate(a.slot)}</b></td>
                        <td><b>{formatTime(a.slot)}</b></td>

                        <td>
                          <span className={`status ${a.status}`}>
                            {statusLabel(a.status)}
                          </span>
                        </td>

                        <td>
                          {['booked', 'pending', 'confirmed']
                            .includes(a.status) ? (
                            <button
                              className="link-button"
                              onClick={() => cancelAppointment(a)}
                              disabled={refreshing}
                            >
                              Cancel
                            </button>
                          ) : (
                            <span className="muted">
                              Record retained
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ==========================================
            DOCTOR MANAGEMENT
        ========================================== */}

        {tab === 'doctors' && (
          <>
            {showDoctorForm ? (
              <DoctorForm
                key={editingDoctor?._id || 'new'}
                initial={editingDoctor}
                busy={saving}
                onSave={saveDoctor}
                onCancel={() => {
                  setShowDoctorForm(false);
                  setEditingDoctor(null);
                }}
              />
            ) : accountDoctor ? (
              <section className="panel" style={{ padding: 24 }}>
                <button
                  type="button"
                  style={buttonStyle}
                  onClick={closeAccountPage}
                >
                  <ArrowLeft size={16} />
                  {' '}Back to Doctors
                </button>

                <h2 style={{ marginTop: 24 }}>
                  {credentialMode === 'manage'
                    ? 'Manage Doctor Login'
                    : 'Create Doctor Login'}
                </h2>

                <p className="muted">
                  Doctor: <b>{accountDoctor.name}</b>
                </p>

                {credentialMode === 'manage' ? (
                  <div style={{
                    maxWidth: 480,
                    display: 'grid',
                    gap: 22,
                    marginTop: 24
                  }}>
                    {accountLoading ? (
                      <p className="muted">
                        Loading doctor login information...
                      </p>
                    ) : (
                      <>
                        <form
                          onSubmit={updateDoctorEmail}
                          style={{
                            display: 'grid',
                            gap: 16
                          }}
                        >
                          <h3 style={{ margin: 0 }}>
                            Change Login Email
                          </h3>

                          <Field label="Current / New Login Email">
                            <input
                              style={inputStyle}
                              type="email"
                              required
                              value={accountEmail}
                              onChange={e =>
                                setAccountEmail(e.target.value)
                              }
                              placeholder="doctor@example.com"
                            />
                          </Field>

                          <button
                            type="submit"
                            style={primaryStyle}
                            disabled={saving || !accountEmail.trim()}
                          >
                            <Save size={16} />
                            {' '}
                            {saving
                              ? 'Saving...'
                              : 'Update Login Email'}
                          </button>
                        </form>

                        <hr style={{
                          width: '100%',
                          border: 0,
                          borderTop: '1px solid #e2e8f0'
                        }} />

                        <form
                          onSubmit={resetDoctorPassword}
                          style={{
                            display: 'grid',
                            gap: 16
                          }}
                        >
                          <h3 style={{ margin: 0 }}>
                            Reset Doctor Password
                          </h3>

                          <p className="muted">
                            Set a new password for this doctor's
                            existing login account.
                          </p>

                          <Field label="New Password">
                            <input
                              style={inputStyle}
                              type="password"
                              minLength={8}
                              maxLength={128}
                              required
                              value={accountPassword}
                              onChange={e =>
                                setAccountPassword(e.target.value)
                              }
                              placeholder="Minimum 8 characters"
                            />
                          </Field>

                          <button
                            type="submit"
                            style={primaryStyle}
                            disabled={
                              saving || accountPassword.length < 8
                            }
                          >
                            <KeyRound size={16} />
                            {' '}
                            {saving
                              ? 'Saving...'
                              : 'Reset Doctor Password'}
                          </button>
                        </form>

                        <div className="notice">
                          <ShieldCheck size={22} />
                          <div>
                            <b>Patient records are protected</b>
                            <p>
                              Changing doctor login credentials
                              does not delete doctor profiles,
                              patient accounts or appointment history.
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <form
                    onSubmit={createDoctorAccount}
                    style={{
                      maxWidth: 440,
                      display: 'grid',
                      gap: 18,
                      marginTop: 20
                    }}
                  >
                    <Field label="Doctor Login Email">
                      <input
                        style={inputStyle}
                        type="email"
                        required
                        value={accountEmail}
                        onChange={e =>
                          setAccountEmail(e.target.value)
                        }
                      />
                    </Field>

                    <Field label="Temporary Password">
                      <input
                        style={inputStyle}
                        type="password"
                        minLength={8}
                        required
                        value={accountPassword}
                        onChange={e =>
                          setAccountPassword(e.target.value)
                        }
                        placeholder="Minimum 8 characters"
                      />
                    </Field>

                    <button
                      type="submit"
                      style={primaryStyle}
                      disabled={saving}
                    >
                      <KeyRound size={16} />
                      {' '}
                      {saving
                        ? 'Creating...'
                        : 'Create Doctor Account'}
                    </button>
                  </form>
                )}
              </section>
            ) : (
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>All Registered Doctors</h2>
                    <p className="muted">
                      Add and maintain every doctor, including
                      doctors without appointments.
                    </p>
                  </div>

                  <button
                    style={primaryStyle}
                    onClick={() => {
                      setEditingDoctor(null);
                      setShowDoctorForm(true);
                      setNotice('');
                    }}
                  >
                    <Plus size={17} />
                    {' '}Add Doctor
                  </button>
                </div>

                <div style={{ padding: '16px 20px' }}>
                  <input
                    style={inputStyle}
                    placeholder="Search doctors by name, specialty or hospital"
                    value={doctorSearch}
                    onChange={e => setDoctorSearch(e.target.value)}
                  />
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Doctor</th>
                        <th>Specialty</th>
                        <th>Hospital</th>
                        <th>Fee</th>
                        <th>Availability</th>
                        <th>Status</th>
                        <th>Login</th>
                        <th>Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredDoctors.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="empty">
                            No doctors found.
                          </td>
                        </tr>
                      ) : (
                        filteredDoctors.map(d => (
                          <tr key={d._id}>
                            <td>
                              <b>{d.name}</b>
                              <small>
                                {d.email || 'No email'}
                              </small>
                              <small>
                                {d.qualification || ''}
                              </small>
                            </td>

                            <td>{d.specialty}</td>

                            <td>{d.hospital || '—'}</td>

                            <td>
                              ₹{Number(
                                d.consultationFee || 0
                              ).toLocaleString('en-IN')}
                            </td>

                            <td>
                              <b>
                                {d.slots?.length || 0} slots
                              </b>
                              <small>
                                {(d.slots || []).join(', ') || 'Not set'}
                              </small>
                            </td>

                            <td>
                              <span className={
                                d.isActive === false
                                  ? 'status cancelled'
                                  : 'status confirmed'
                              }>
                                {d.isActive === false
                                  ? 'Inactive'
                                  : 'Active'}
                              </span>
                            </td>

                            <td>
                              {d.userId ? (
                                <button
                                  type="button"
                                  style={buttonStyle}
                                  onClick={() => openManageLogin(d)}
                                >
                                  <KeyRound size={15} />
                                  {' '}Manage Login
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  style={buttonStyle}
                                  onClick={() => openCreateLogin(d)}
                                >
                                  <KeyRound size={15} />
                                  {' '}Create Login
                                </button>
                              )}
                            </td>

                            <td>
                              <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: 8
                              }}>
                                <button
                                  style={buttonStyle}
                                  onClick={() => {
                                    setEditingDoctor(d);
                                    setShowDoctorForm(true);
                                  }}
                                >
                                  <Pencil size={15} />
                                  {' '}Edit
                                </button>

                                <button
                                  style={{
                                    ...buttonStyle,
                                    color: d.isActive === false
                                      ? '#047857'
                                      : '#b91c1c'
                                  }}
                                  disabled={saving}
                                  onClick={() => toggleDoctor(d)}
                                >
                                  {d.isActive === false
                                    ? 'Activate'
                                    : 'Deactivate'}
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
            )}
          </>
        )}

        {/* ==========================================
            PATIENT RECORDS
        ========================================== */}

        {tab === 'patients' && (
          <>
            {selectedPatient ? (
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>{selectedPatient.name}</h2>
                    <p className="muted">
                      {selectedPatient.email}
                    </p>
                  </div>

                  <button
                    style={buttonStyle}
                    onClick={() => {
                      setSelectedPatient(null);
                      setPatientAppointments([]);
                    }}
                  >
                    <ArrowLeft size={16} />
                    {' '}All Patients
                  </button>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Doctor</th>
                        <th>Specialty</th>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {patientLoading ? (
                        <tr>
                          <td colSpan="5" className="empty">
                            Loading patient records...
                          </td>
                        </tr>
                      ) : patientAppointments.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="empty">
                            No appointment records found.
                          </td>
                        </tr>
                      ) : (
                        patientAppointments.map(a => (
                          <tr key={a._id}>
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

                            <td>{formatDate(a.slot)}</td>
                            <td>{formatTime(a.slot)}</td>

                            <td>
                              <span className={`status ${a.status}`}>
                                {statusLabel(a.status)}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : (
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>All Registered Patients</h2>
                    <p className="muted">
                      View patient accounts and appointment history.
                    </p>
                  </div>

                  <span className="count">
                    {filteredPatients.length} patients
                  </span>
                </div>

                <div style={{ padding: '16px 20px' }}>
                  <input
                    style={inputStyle}
                    placeholder="Search patients by name or email"
                    value={patientSearch}
                    onChange={e => setPatientSearch(e.target.value)}
                  />
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Patient</th>
                        <th>Email</th>
                        <th>Registered</th>
                        <th>Records</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredPatients.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="empty">
                            No patients found.
                          </td>
                        </tr>
                      ) : (
                        filteredPatients.map(p => (
                          <tr key={p._id}>
                            <td>
                              <b>
                                <UserRound
                                  size={16}
                                  style={{
                                    verticalAlign: 'middle',
                                    marginRight: 8
                                  }}
                                />
                                {p.name}
                              </b>
                            </td>

                            <td>{p.email}</td>
                            <td>{formatDate(p.createdAt)}</td>

                            <td>
                              <button
                                className="link-button"
                                onClick={() => viewPatient(p)}
                              >
                                View Records
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

createRoot(
  document.getElementById('root')
).render(<App />);
