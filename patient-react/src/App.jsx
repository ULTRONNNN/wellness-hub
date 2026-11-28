import ReportAttachment from "./ReportAttachment";
import ReportsPage from "./ReportsPage";
import { FileText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  Heart, LogOut, Home, MessageCircle, Stethoscope,
  CalendarDays, Bot, Search, RefreshCw, History,
  PlusCircle, Send, ArrowRight, UserRound, Mail,
  LockKeyhole, Info, CalendarCheck, ChevronLeft,
  X, CheckCircle, AlertCircle
} from "lucide-react";
import { apiCall, getToken, setToken } from "./api";
import "./App.css";

const dateKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const tomorrow = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return dateKey(date);
};

const dateTime = (value) =>
  new Date(value).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

const timeOnly = (value) =>
  new Date(value).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

const readableDate = (value) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("en-IN", {
    weekday: "short", day: "2-digit",
    month: "short", year: "numeric",
  });

function ErrorText({ message }) {
  return message ? <p className="error-text">{message}</p> : null;
}

function Modal({ title, children, onClose, onConfirm, confirmText, busy }) {
  return (
    <div className="modal-overlay">
      <div className="modal-card" role="dialog" aria-modal="true">
        <h2>{title}</h2>
        <p>{children}</p>
        <div className="modal-actions">
          <button className="outline-btn" disabled={busy} onClick={onClose}>
            {title === "Cancel Appointment" ? "No" : "Cancel"}
          </button>
          <button className="primary-btn" disabled={busy} onClick={onConfirm}>
            {busy ? "Please wait..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

function AuthPage({ onLogin }) {
  const [register, setRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();

    if (!email.trim() || password.length < 8 ||
        (register && name.trim().length < 2)) {
      setError("Enter valid details. Password must have at least 8 characters.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const result = await apiCall(
        register ? "/auth/register" : "/auth/login",
        {
          method: "POST",
          body: {
            email: email.trim(),
            password,
            ...(register ? { name: name.trim() } : {}),
          },
        }
      );

      if (result.user.role !== "patient") {
        throw new Error("Use the dashboard for doctor/admin accounts.");
      }

      onLogin(result.token, result.user);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-box" onSubmit={submit}>
        <div className="auth-logo"><Heart size={40} fill="currentColor" /></div>
        <h1>Wellness Hub</h1>
        <p className="muted">
          {register
            ? "Create your health companion account."
            : "Your health journey, made simpler."}
        </p>

        <div className="auth-fields">
          {register && (
            <label className="field">
              <UserRound size={20} />
              <input placeholder="Full name" value={name}
                onChange={(e) => setName(e.target.value)} />
            </label>
          )}

          <label className="field">
            <Mail size={20} />
            <input type="email" placeholder="Email address"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>

          <label className="field">
            <LockKeyhole size={20} />
            <input type="password" placeholder="Password"
              value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
        </div>

        <ErrorText message={error} />

        <button className="primary-btn auth-submit" disabled={busy}>
          {busy ? "Please wait..." : register ? "Create account" : "Sign in"}
        </button>

        <button type="button" className="text-btn auth-switch"
          onClick={() => { setRegister(!register); setError(""); }}>
          {register
            ? "Already have an account? Sign in"
            : "New here? Create an account"}
        </button>

        <p className="disclaimer">
          For education only. Not a substitute for professional medical advice.
        </p>
      </form>
    </div>
  );
}

function Overview({ name, onChat, onDoctors, onBookings, onReports }) {
  const actions = [
    { icon: MessageCircle, title: "Talk to CareBot", detail: "Ask questions about your health", action: onChat },
    { icon: Stethoscope, title: "Find a specialist", detail: "Discover doctors and available slots", action: onDoctors },
    { icon: CalendarDays, title: "My appointments", detail: "View and manage your bookings", action: onBookings },
    { icon: FileText, title: "Medical reports", detail: "Review your stored reports", action: onReports },
  ];
  return <div className="page-content overview-page">
    <div className="welcome-heading"><span className="eyebrow">YOUR PERSONAL HEALTH SPACE</span><h1>Hello, {String(name || "there").split(" ")[0]}!</h1><p className="muted">A little care today makes a difference tomorrow.</p></div>
    <div className="hero-card"><div className="hero-copy"><span className="hero-label">AI HEALTH COMPANION</span><h2>Better care starts<br/>with a conversation.</h2><p>Explore health questions, understand symptoms and prepare for your next consultation with CareBot.</p><button className="hero-button" onClick={onChat}>Start a conversation <ArrowRight size={19}/></button></div><div className="hero-art" aria-hidden="true"><div className="hero-orbit"><Bot size={100} strokeWidth={1.3}/></div></div></div>
    <h2 className="section-title">Explore your care</h2><div className="quick-grid">{actions.map(({icon: Icon,title,detail,action}) => <button key={title} className="quick-card" onClick={action}><span className="round-icon"><Icon size={25}/></span><strong>{title}</strong><small>{detail}</small><ArrowRight className="quick-arrow" size={19}/></button>)}</div>
    <div className="notice-card"><Info size={24}/><span><strong>Care when it matters</strong><br/>For emergencies, call your local emergency number. Wellness Hub is an educational assistant, not a substitute for medical care.</span></div>
  </div>;
}

function ChatPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const chatRef = useRef(null);
  const busyRef = useRef(false);

  async function loadConversations() {
    try {
      const data = await apiCall("/chat/conversations");
      setConversations(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    loadConversations();
  }, []);

 useEffect(() => {
  const chatContainer = chatRef.current;

  if (chatContainer) {
    chatContainer.scrollTo({
      top: chatContainer.scrollHeight,
      behavior: "smooth",
    });
  }
}, [messages, busy]);
  function newChat() {
    if (busyRef.current) return;
    setConversationId(null);
    setInput("");
    setHistoryOpen(false);
    setMessages([]);
    setError("");
  }

  function openChat(conversation) {
    if (busyRef.current) return;
    setConversationId(conversation._id);
    setMessages(Array.isArray(conversation.messages) ? conversation.messages : []);
    setInput("");
    setError("");
    setHistoryOpen(false);
  }

  async function send(override) {
    const message = String(override ?? input).trim();
    if (!message || busyRef.current) return;
    if (message.length > 2000) { setError("Please limit your message to 2000 characters."); return; }

    busyRef.current = true;
    setInput("");
    setMessages((previous) => [
      ...previous, { role: "user", content: message }
    ]);
    setBusy(true);
    setError("");

    try {
      const result = await apiCall("/chat", {
        method: "POST",
        body: {
          message,
          ...(conversationId ? { conversationId } : {}),
        },
      });

      if (!result?.conversationId || !Array.isArray(result.messages)) {
        throw new Error("Unexpected chat response from the server.");
      }
      setConversationId(result.conversationId);
      setMessages(result.messages);
      await loadConversations();
    } catch (e) {
      setMessages((previous) => {
        const last = previous[previous.length - 1];
        return last?.role === "user" && last?.content === message
          ? previous.slice(0, -1)
          : previous;
      });
      setInput(message);
      setError(e.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="chat-page">
      <div className="chat-header">
        <div>
          <h2>CareBot AI</h2>
          <small>Health information • Not a diagnosis</small>
        </div>
        <div className="header-buttons">
          <button title="Chat history" disabled={busy}
            onClick={async () => {
              await loadConversations();
              setHistoryOpen(true);
            }}>
            <History size={22} />
          </button>
          <button title="New chat" disabled={busy} onClick={newChat}>
            <PlusCircle size={23} color="#08a999" />
          </button>
        </div>
      </div>

      <div className="chat-messages" ref={chatRef}>
        {messages.length === 0 ? (
          <div className="chat-welcome">
            <div className="bot-avatar"><Bot size={38} /></div>
            <h2>What is on your mind?</h2>
            <p className="muted">
              Ask about health, education, technology or everyday topics.
              I can also help you find a specialist and prepare for a consultation.
            </p>
            <button className="suggestion"
              disabled={busy}
              onClick={() => send("I have a headache")}>
              I have a headache
            </button>
            <button className="suggestion"
              disabled={busy}
              onClick={() => send("How can I manage stress?")}>
              How can I manage stress?
            </button>
          </div>
        ) : (
          <div className="message-list">
            {messages.map((message, index) => (
              <div key={index}
                className={`message ${message.role === "user" ? "mine" : "theirs"}`}
                style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {message.content}
              </div>
            ))}
            {busy && <p className="thinking">CareBot is thinking...</p>}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <ErrorText message={error} />

   <form className="chat-input-bar" onSubmit={(e) => {
  e.preventDefault();
  if (e.target !== e.currentTarget) return;
  send();
}}>

  <ReportAttachment />

  <input
    placeholder="Ask CareBot anything..."
    aria-label="Chat message"
    maxLength={2000}
    disabled={busy}
    value={input}
    onChange={(e) => setInput(e.target.value)}
  />

  <button className="send-button" aria-label="Send message" disabled={busy || !input.trim()} type="submit">
    <Send size={21} />
  </button>

</form>

      {historyOpen && (
        <div className="modal-overlay" onClick={() => setHistoryOpen(false)}>
          <div className="history-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="history-heading">
              <h3>Your conversations</h3>
              <button onClick={() => setHistoryOpen(false)}><X /></button>
            </div>
            {conversations.length === 0
              ? <p className="muted">No conversations yet</p>
              : conversations.map((conversation) => (
                <button className="history-item" key={conversation._id}
                  onClick={() => openChat(conversation)}>
                  <MessageCircle size={19} />
                  {conversation.title}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DoctorsPage() {
  const [query, setQuery] = useState("");
  const [doctors, setDoctors] = useState([]);
  const [matched, setMatched] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState(null);

  async function load(match = false, search = query) {
    setLoading(true);
    setError("");

    try {
      const result = await apiCall(
        match
          ? `/doctors/match?query=${encodeURIComponent(search)}`
          : "/doctors"
      );

      setDoctors(match ? result.doctors : result);
      setMatched(match ? result.specialty : null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(false, "");
  }, []);

  if (selectedDoctor) {
    return (
      <BookingPage
        doctor={selectedDoctor}
        onBack={() => setSelectedDoctor(null)}
      />
    );
  }

  return (
    <div className="page-content doctors-page">
      <h1>Find your doctor</h1>
      <p className="muted">Search by symptoms to suggest a specialty.</p>

      <form className="doctor-search" onSubmit={(e) => {
        e.preventDefault();
        load(query.trim().length > 0);
      }}>
        <input placeholder="e.g. skin rash, headache"
          value={query} onChange={(e) => setQuery(e.target.value)} />
        <button type="submit" className="primary-btn" title="Search">
          <Search size={21} />
        </button>
        <button type="button" className="icon-btn" title="Refresh"
          onClick={() => { setQuery(""); load(false, ""); }}>
          <RefreshCw size={21} />
        </button>
      </form>

      {matched && (
        <p className="matched-text">Suggested specialty: {matched}</p>
      )}

      {loading ? (
        <p className="loading-text">Loading doctors...</p>
      ) : error ? (
        <ErrorText message={error} />
      ) : doctors.length === 0 ? (
        <p className="empty-text">No doctors found for this specialty.</p>
      ) : (
        <div className="doctor-list">
          {doctors.map((doctor) => (
            <div className="doctor-card" key={doctor._id}>
              <div className="doctor-heading">
                <span className="round-icon"><UserRound size={24} /></span>
                <div>
                  <strong>{doctor.name}</strong>
                  <span className="teal-text">{doctor.specialty}</span>
                </div>
              </div>
              <p>
                {doctor.qualification || ""} • {doctor.experience || 0} years experience
              </p>
              <p>{doctor.hospital || ""}</p>
              {doctor.address && (
  <p>
    📍 {doctor.address}, {doctor.city}
  </p>
)}

{doctor.hospital && (
  <a
    href={
      "https://www.google.com/maps/dir/?api=1&destination=" +
      encodeURIComponent(
        [
          doctor.hospital,
          doctor.address,
          doctor.city,
          "India"
        ].filter(Boolean).join(", ")
      )
    }
    target="_blank"
    rel="noopener noreferrer"
    style={{
      display: "block",
      textAlign: "center",
      border: "1px solid #0d9488",
      borderRadius: 10,
      padding: 12,
      color: "#0d9488",
      fontWeight: 600,
      textDecoration: "none",
      margin: "12px 0"
    }}
  >
    📍 Get Directions
  </a>
)}
              <div className="card-actions">
                <button className="primary-btn"
                  onClick={() => setSelectedDoctor(doctor)}>
                  View slots &amp; book
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BookingPage({ doctor, onBack }) {
  const [date, setDate] = useState(tomorrow);
  const [slots, setSlots] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [success, setSuccess] = useState("");

  const maxDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 90);
    return dateKey(d);
  })();

  async function load(day) {
    setBusy(true);
    setError("");
    setSlots([]);

    try {
      const result = await apiCall(
        `/doctors/${doctor._id}/slots?date=${day}`
      );
      setSlots(result.slots || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load(date);
  }, [date, doctor._id]);

  async function confirmBooking() {
    if (!selectedSlot) return;

    setBusy(true);
    setError("");

    try {
      await apiCall("/appointments", {
        method: "POST",
        body: {
          doctorId: doctor._id,
          slot: selectedSlot,
        },
      });

      setSelectedSlot(null);
      setSuccess("Appointment booked successfully!");
      setTimeout(onBack, 900);
    } catch (e) {
      setError(e.message);
      setSelectedSlot(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-content booking-page">
      <button className="back-btn" onClick={onBack}>
        <ChevronLeft size={20} /> Book an appointment
      </button>

      <h1>{doctor.name}</h1>
      <p className="muted">{doctor.specialty} • {doctor.hospital}</p>

      <div className="booking-section">
        <strong>Select a date</strong>
        <label className="date-picker">
          <CalendarDays size={20} />
          <input type="date" value={date} min={dateKey(new Date())}
            max={maxDate} onChange={(e) => setDate(e.target.value)} />
        </label>
        <p className="muted">{readableDate(date)}</p>
      </div>

      <div className="booking-section">
        <strong>Available appointment slots</strong>
        <ErrorText message={error} />

        {busy ? (
          <p className="loading-text">Loading...</p>
        ) : slots.length === 0 ? (
          <p className="muted">No available slots for this date.</p>
        ) : (
          <div className="slots-grid">
            {slots.map((slot) => (
              <button className="slot-chip" key={slot}
                onClick={() => setSelectedSlot(slot)}>
                {timeOnly(slot)}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="disclaimer">
        Appointment times are displayed in your device timezone.
        Demo doctor details are for educational purposes.
      </p>

      {success && <p className="success-text"><CheckCircle size={18} /> {success}</p>}

      {selectedSlot && (
        <Modal
          title="Confirm appointment"
          onClose={() => setSelectedSlot(null)}
          onConfirm={confirmBooking}
          confirmText="Confirm booking"
          busy={busy}
        >
          Book an appointment with {doctor.name} on {dateTime(selectedSlot)}?
        </Modal>
      )}
    </div>
  );
}

function AppointmentsPage() {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [cancelTarget, setCancelTarget] = useState(null);
  const [notice, setNotice] = useState("");

  async function load() {
    setBusy(true);
    setError("");

    try {
      const data = await apiCall("/appointments");
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function cancel() {
    if (!cancelTarget || busy) return;

    const id = cancelTarget._id;
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const result = await apiCall(`/appointments/${id}/cancel`, {
        method: "PATCH",
        body: {},
      });

      const status = result?.status ?? result?.appointment?.status;

      if (status !== "cancelled") {
        throw new Error(
          `Server did not confirm cancellation. Response: ${JSON.stringify(result)}`
        );
      }

      setItems((previous) =>
        previous.map((item) =>
          String(item._id) === String(id)
            ? { ...item, status: "cancelled" }
            : item
        )
      );

      setCancelTarget(null);
      setNotice("Appointment cancelled successfully!");
      await load();
    } catch (e) {
      setError(`Cancellation failed: ${e.message}`);
      setBusy(false);
      setCancelTarget(null);
    }
  }

  return (
    <div className="page-content appointments-page">
      <div className="page-heading-row">
        <h1>My appointments</h1>
        <button className="icon-btn" onClick={load} disabled={busy}>
          <RefreshCw size={21} />
        </button>
      </div>

      <ErrorText message={error} />
      {notice && <p className="success-text"><CheckCircle size={18} /> {notice}</p>}

      {busy ? (
        <p className="loading-text">Loading appointments...</p>
      ) : items.length === 0 ? (
        <p className="empty-text">
          No appointments yet. Visit Doctors to book one.
        </p>
      ) : (
        <div className="appointment-list">
          {items.map((appointment) => (
            <div className="appointment-card" key={appointment._id}>
              <h3>{appointment.doctorId?.name || "Doctor"}</h3>
              <p className="teal-text">{appointment.doctorId?.specialty || ""}</p>
              <p className="appointment-date">
                <CalendarDays size={17} /> {dateTime(appointment.slot)}
              </p>
              <p className={
                ["booked", "pending", "confirmed"].includes(appointment.status)
                  ? "status-booked" : appointment.status === "cancelled" ? "status-cancelled" : "muted"
              }>
                Status: {appointment.status}
              </p>
              {["booked", "pending", "confirmed"].includes(appointment.status) && (
                <div className="card-actions">
                  <button className="text-btn"
                    onClick={() => setCancelTarget(appointment)}>
                    Cancel booking
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {cancelTarget && (
        <Modal
          title="Cancel Appointment"
          onClose={() => setCancelTarget(null)}
          onConfirm={cancel}
          confirmText="Yes, Cancel"
          busy={busy}
        >
          Are you sure you want to cancel this booking?
        </Modal>
      )}
    </div>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    async function restore() {
      if (getToken()) {
        try {
          const result = await apiCall("/auth/me");
          if (result.user?.role === "patient") {
            setUser(result.user);
          } else {
            setToken(null);
          }
        } catch {
          setToken(null);
        }
      }
      setLoading(false);
    }

    restore();
  }, []);

  function onLogin(token, profile) {
    setToken(token);
    setUser(profile);
    setTab(0);
  }

  function logout() {
    setToken(null);
    setUser(null);
    setTab(0);
  }

  if (loading) {
    return <div className="loading-screen">Loading Wellness Hub...</div>;
  }

  if (!user) {
    return <AuthPage onLogin={onLogin} />;
  }

 const tabs = [
  { label: "Home", icon: Home },
  { label: "AI Chat", icon: MessageCircle },
  { label: "Doctors", icon: Stethoscope },
  { label: "Bookings", icon: CalendarDays },
  { label: "Reports", icon: FileText },
];

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <Heart size={25} fill="currentColor" />
          <div><strong>Wellness Hub</strong><small>Patient workspace</small></div>
        </div>
        <div className="profile-group"><span className="profile-avatar"><UserRound size={20}/></span><span className="profile-name">{user.name}</span><button className="logout-btn" title="Sign out" onClick={logout}>
          <LogOut size={22} />
        </button></div>
      </header>

   <main
  className="main-area"
  style={{
    flex: "1 1 0",
    minHeight: 0,
    position: "relative",
    overflow: "hidden"
  }}
>
  <div hidden={tab !== 0}>
    <Overview
      name={user.name}
      onChat={() => setTab(1)}
      onDoctors={() => setTab(2)}
      onBookings={() => setTab(3)}
      onReports={() => setTab(4)}
    />
  </div>

  <div className="tab-panel" hidden={tab !== 1}>
    <ChatPage />
  </div>

  <div className="tab-panel" hidden={tab !== 2}>
    <DoctorsPage />
  </div>

  <div className="tab-panel" hidden={tab !== 3}>
    <AppointmentsPage />
  </div>

  {tab === 4 && (
    <div
      id="reports-scroll-container"
      style={{
        position: "absolute",
        inset: 0,
        overflowY: "auto",
        overflowX: "hidden",
        overscrollBehavior: "contain"
      }}
    >
      <ReportsPage />
    </div>
  )}
</main>

      <nav className="bottom-nav" aria-label="Patient navigation"><div className="nav-brand"><Heart size={28} fill="currentColor"/><div><strong>Wellness Hub</strong><small>HEALTHCARE ASSISTANT</small></div></div><div className="nav-caption">WORKSPACE</div>
        {tabs.map(({ label, icon: Icon }, index) => (
          <button key={label}
            className={tab === index ? "nav-item active" : "nav-item"}
            aria-current={tab === index ? "page" : undefined}
            onClick={() => setTab(index)}>
            <Icon size={23} />
            <span>{label}</span>
          </button>
        ))}
        <div className="nav-footer"><Heart size={18}/> Your care, connected.</div>
      </nav>
    </div>
  );
}