import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:intl/intl.dart';

const apiBase = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:4000',
);

const teal = Color(0xFF08A999);
const ink = Color(0xFF183B4C);
const background = Color(0xFFF5F9FB);

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const WellnessHub());
}

class Api {
  static String? token;

  static Future<dynamic> call(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
  }) async {
    final uri = Uri.parse('$apiBase/api$path');

    final headers = <String, String>{
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };

    late http.Response response;

    try {
      if (method == 'POST') {
        response = await http
            .post(uri, headers: headers, body: jsonEncode(body))
            .timeout(const Duration(seconds: 60));
      } else if (method == 'PATCH') {
  response = await http
      .patch(
        uri,
        headers: headers,
        body: jsonEncode(body ?? <String, dynamic>{}),
      )
      .timeout(const Duration(seconds: 60));
      } else {
        response = await http
            .get(uri, headers: headers)
            .timeout(const Duration(seconds: 60));
      }
    } catch (e) {
      throw Exception(
        'Cannot connect to backend at $apiBase.\n'
        'Details: $e',
      );
    }

    dynamic result;

    try {
      result = jsonDecode(response.body);
    } catch (_) {
      throw Exception(
        'Invalid server response (HTTP ${response.statusCode}).',
      );
    }

    if (response.statusCode >= 400) {
      throw Exception(
        result is Map
            ? '${result['error'] ?? 'Request failed'}'
            : 'Request failed',
      );
    }

    return result;
  }
}

class WellnessHub extends StatelessWidget {
  const WellnessHub({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Wellness Hub',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: teal,
          primary: teal,
          surface: Colors.white,
        ),
        scaffoldBackgroundColor: background,
        appBarTheme: const AppBarTheme(
          backgroundColor: background,
          foregroundColor: ink,
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
      ),
      home: const Gateway(),
    );
  }
}

class Gateway extends StatefulWidget {
  const Gateway({super.key});

  @override
  State<Gateway> createState() => _GatewayState();
}

class _GatewayState extends State<Gateway> {
  bool loading = true;
  Map<String, dynamic>? user;

  @override
  void initState() {
    super.initState();
    restore();
  }

  Future<void> restore() async {
    final prefs = await SharedPreferences.getInstance();
    Api.token = prefs.getString('token');

    if (Api.token != null) {
      try {
        final result = await Api.call('/auth/me');
        final profile = Map<String, dynamic>.from(result['user']);

        if (profile['role'] == 'patient') {
          user = profile;
        } else {
          Api.token = null;
          await prefs.remove('token');
        }
      } catch (_) {
        Api.token = null;
        await prefs.remove('token');
      }
    }

    if (!mounted) return;
    setState(() => loading = false);
  }

  Future<void> onLogin(
    String token,
    Map<String, dynamic> profile,
  ) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('token', token);

    Api.token = token;

    if (!mounted) return;
    setState(() => user = profile);
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');

    Api.token = null;

    if (!mounted) return;
    setState(() => user = null);
  }

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return user == null
        ? AuthPage(onLogin: onLogin)
        : HomePage(user: user!, onLogout: logout);
  }
}

class AuthPage extends StatefulWidget {
  final Future<void> Function(
    String,
    Map<String, dynamic>,
  ) onLogin;

  const AuthPage({super.key, required this.onLogin});

  @override
  State<AuthPage> createState() => _AuthPageState();
}

class _AuthPageState extends State<AuthPage> {
  final name = TextEditingController();
  final email = TextEditingController();
  final password = TextEditingController();

  bool register = false;
  bool busy = false;
  String? error;

  Future<void> submit() async {
    if (email.text.trim().isEmpty ||
        password.text.length < 8 ||
        (register && name.text.trim().length < 2)) {
      setState(() {
        error =
            'Enter valid details. Password must have at least 8 characters.';
      });
      return;
    }

    setState(() {
      busy = true;
      error = null;
    });

    try {
      final result = await Api.call(
        register ? '/auth/register' : '/auth/login',
        method: 'POST',
        body: {
          'email': email.text.trim(),
          'password': password.text,
          if (register) 'name': name.text.trim(),
        },
      );

      if (result['user']['role'] != 'patient') {
        throw Exception('Use the dashboard for doctor/admin accounts.');
      }

      await widget.onLogin(
        result['token'],
        Map<String, dynamic>.from(result['user']),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  void dispose() {
    name.dispose();
    email.dispose();
    password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(28),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 430),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE2F7F2),
                      borderRadius: BorderRadius.circular(22),
                    ),
                    child: const Icon(
                      Icons.favorite_rounded,
                      size: 40,
                      color: teal,
                    ),
                  ),
                  const SizedBox(height: 25),
                  const Text(
                    'Wellness Hub',
                    style: TextStyle(
                      fontSize: 34,
                      fontWeight: FontWeight.w800,
                      color: ink,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    register
                        ? 'Create your health companion account.'
                        : 'Your health journey, made simpler.',
                    style: const TextStyle(color: Colors.blueGrey),
                  ),
                  const SizedBox(height: 34),
                  if (register) ...[
                    TextField(
                      controller: name,
                      decoration: const InputDecoration(
                        labelText: 'Full name',
                        prefixIcon: Icon(Icons.person_outline),
                      ),
                    ),
                    const SizedBox(height: 14),
                  ],
                  TextField(
                    controller: email,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(
                      labelText: 'Email address',
                      prefixIcon: Icon(Icons.email_outlined),
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: password,
                    obscureText: true,
                    decoration: const InputDecoration(
                      labelText: 'Password',
                      prefixIcon: Icon(Icons.lock_outline),
                    ),
                  ),
                  if (error != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: Text(
                        error!,
                        style: const TextStyle(color: Colors.red),
                      ),
                    ),
                  const SizedBox(height: 22),
                  SizedBox(
                    width: double.infinity,
                    height: 54,
                    child: FilledButton(
                      onPressed: busy ? null : submit,
                      child: Text(
                        busy
                            ? 'Please wait...'
                            : register
                                ? 'Create account'
                                : 'Sign in',
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  Center(
                    child: TextButton(
                      onPressed: () {
                        setState(() {
                          register = !register;
                          error = null;
                        });
                      },
                      child: Text(
                        register
                            ? 'Already have an account? Sign in'
                            : 'New here? Create an account',
                      ),
                    ),
                  ),
                  const SizedBox(height: 26),
                  const Text(
                    'For education only. Not a substitute for professional medical advice.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.blueGrey,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class HomePage extends StatefulWidget {
  final Map<String, dynamic> user;
  final Future<void> Function() onLogout;

  const HomePage({
    super.key,
    required this.user,
    required this.onLogout,
  });

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  int tab = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Row(
          children: [
            Icon(Icons.favorite, color: teal),
            SizedBox(width: 8),
            Text(
              'Wellness Hub',
              style: TextStyle(fontWeight: FontWeight.w800),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Sign out',
            onPressed: widget.onLogout,
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: IndexedStack(
        index: tab,
        children: [
          Overview(
            name: '${widget.user['name']}',
            onChat: () => setState(() => tab = 1),
            onDoctors: () => setState(() => tab = 2),
          ),
          const ChatPage(),
          const DoctorsPage(),
          const AppointmentsPage(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: tab,
        onDestinationSelected: (value) {
          setState(() => tab = value);
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Icon(Icons.chat_bubble_outline),
            label: 'AI Chat',
          ),
          NavigationDestination(
            icon: Icon(Icons.medical_services_outlined),
            label: 'Doctors',
          ),
          NavigationDestination(
            icon: Icon(Icons.calendar_month_outlined),
            label: 'Bookings',
          ),
        ],
      ),
    );
  }
}

class Overview extends StatelessWidget {
  final String name;
  final VoidCallback onChat;
  final VoidCallback onDoctors;

  const Overview({
    super.key,
    required this.name,
    required this.onChat,
    required this.onDoctors,
  });

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(22),
      children: [
        Text(
          'Hello, ${name.split(' ').first} 👋',
          style: const TextStyle(
            fontSize: 27,
            fontWeight: FontWeight.w800,
            color: ink,
          ),
        ),
        const SizedBox(height: 7),
        const Text(
          'How can we help you feel better today?',
          style: TextStyle(color: Colors.blueGrey),
        ),
        const SizedBox(height: 25),
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [
                Color(0xFF08A999),
                Color(0xFF087E8D),
              ],
            ),
            borderRadius: BorderRadius.circular(24),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(
                Icons.smart_toy_outlined,
                color: Colors.white,
                size: 36,
              ),
              const SizedBox(height: 14),
              const Text(
                'Your AI health companion',
                style: TextStyle(
                  fontSize: 23,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 9),
              const Text(
                'Ask health questions and prepare for your next doctor visit.',
                style: TextStyle(color: Colors.white),
              ),
              const SizedBox(height: 19),
              FilledButton.icon(
                onPressed: onChat,
                style: FilledButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: teal,
                ),
                icon: const Icon(Icons.chat_outlined),
                label: const Text('Start chatting'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        const Text(
          'Explore care',
          style: TextStyle(
            fontSize: 21,
            fontWeight: FontWeight.w800,
            color: ink,
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: ListTile(
            contentPadding: const EdgeInsets.all(18),
            leading: const CircleAvatar(
              backgroundColor: Color(0xFFE2F7F2),
              child: Icon(
                Icons.medical_services,
                color: teal,
              ),
            ),
            title: const Text(
              'Find a specialist',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
            subtitle: const Text(
              'Browse doctors and book available slots',
            ),
            trailing: const Icon(
              Icons.arrow_forward_ios,
              size: 16,
            ),
            onTap: onDoctors,
          ),
        ),
        const SizedBox(height: 16),
        const Card(
          child: Padding(
            padding: EdgeInsets.all(18),
            child: Row(
              children: [
                Icon(Icons.info_outline, color: Colors.orange),
                SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Emergency? Call your local emergency number. Do not rely on this app for urgent care.',
                    style: TextStyle(fontSize: 13),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class ChatPage extends StatefulWidget {
  const ChatPage({super.key});

  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  final input = TextEditingController();
  final scroll = ScrollController();

  List<dynamic> messages = [];
  List<dynamic> conversations = [];

  String? conversationId;
  String? error;

  bool busy = false;

  @override
  void initState() {
    super.initState();
    loadConversations();
  }

  Future<void> loadConversations() async {
    try {
      final data = await Api.call('/chat/conversations');

      if (!mounted) return;

      setState(() {
        conversations = List<dynamic>.from(data);
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        error = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  void newChat() {
    if (busy) return;

    setState(() {
      conversationId = null;
      messages = [];
      error = null;
    });
  }

  void openChat(dynamic conversation) {
    if (busy) return;

    setState(() {
      conversationId = conversation['_id'];
      messages = List<dynamic>.from(
        conversation['messages'] ?? [],
      );
      error = null;
    });

    Navigator.of(context).pop();
  }

  void scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !scroll.hasClients) return;

      scroll.animateTo(
        scroll.position.maxScrollExtent,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    });
  }

  Future<void> send() async {
    final message = input.text.trim();

    if (message.isEmpty || busy) return;

    input.clear();

    setState(() {
      messages.add({
        'role': 'user',
        'content': message,
      });
      busy = true;
      error = null;
    });

    scrollToBottom();

    try {
      final result = await Api.call(
        '/chat',
        method: 'POST',
        body: {
          'message': message,
          if (conversationId != null) 'conversationId': conversationId,
        },
      );

      if (!mounted) return;

      setState(() {
        conversationId = result['conversationId'];
        messages = List<dynamic>.from(result['messages']);
      });

      await loadConversations();
      scrollToBottom();
    } catch (e) {
      if (!mounted) return;

      setState(() {
        if (messages.isNotEmpty &&
            messages.last['role'] == 'user' &&
            messages.last['content'] == message) {
          messages.removeLast();
        }

        input.text = message;
        error = e.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() => busy = false);
      }
    }
  }

  Future<void> showHistory() async {
    await loadConversations();

    if (!mounted) return;

    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) {
        return SafeArea(
          child: ListView(
            children: [
              const ListTile(
                title: Text(
                  'Your conversations',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
              ),
              if (conversations.isEmpty)
                const ListTile(
                  title: Text('No conversations yet'),
                ),
              ...conversations.map(
                (conversation) => ListTile(
                  leading: const Icon(Icons.chat_outlined),
                  title: Text('${conversation['title']}'),
                  onTap: () {
                    if (busy) return;

                    Navigator.of(sheetContext).pop();

                    setState(() {
                      conversationId = conversation['_id'];
                      messages = List<dynamic>.from(
                        conversation['messages'] ?? [],
                      );
                      error = null;
                    });

                    scrollToBottom();
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  void dispose() {
    input.dispose();
    scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 8,
          ),
          child: Row(
            children: [
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'CareBot AI',
                      style: TextStyle(
                        fontSize: 21,
                        fontWeight: FontWeight.w800,
                        color: ink,
                      ),
                    ),
                    Text(
                      'Health information • Not a diagnosis',
                      style: TextStyle(
                        color: Colors.blueGrey,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                tooltip: 'Chat history',
                onPressed: busy ? null : showHistory,
                icon: const Icon(Icons.history),
              ),
              IconButton(
                tooltip: 'New chat',
                onPressed: busy ? null : newChat,
                icon: const Icon(
                  Icons.add_circle_outline,
                  color: teal,
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: messages.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(30),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const CircleAvatar(
                          radius: 35,
                          backgroundColor: Color(0xFFE0F7F2),
                          child: Icon(
                            Icons.smart_toy_outlined,
                            color: teal,
                            size: 38,
                          ),
                        ),
                        const SizedBox(height: 20),
                        const Text(
                          'What is on your mind?',
                          style: TextStyle(
                            fontSize: 23,
                            fontWeight: FontWeight.w800,
                            color: ink,
                          ),
                        ),
                        const SizedBox(height: 10),
                        const Text(
                          'Tell me about a health question or symptom. I can share general information and help you prepare for a consultation.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: Colors.blueGrey),
                        ),
                        const SizedBox(height: 20),
                        ActionChip(
                          label: const Text('I have a headache'),
                          onPressed: () {
                            input.text = 'I have a headache';
                            send();
                          },
                        ),
                        ActionChip(
                          label: const Text('How can I manage stress?'),
                          onPressed: () {
                            input.text = 'How can I manage stress?';
                            send();
                          },
                        ),
                      ],
                    ),
                  ),
                )
              : ListView.builder(
                  controller: scroll,
                  padding: const EdgeInsets.all(15),
                  itemCount: messages.length + (busy ? 1 : 0),
                  itemBuilder: (context, index) {
                    if (index == messages.length) {
                      return const Padding(
                        padding: EdgeInsets.all(12),
                        child: Text(
                          'CareBot is thinking...',
                          style: TextStyle(color: Colors.blueGrey),
                        ),
                      );
                    }

                    final message = messages[index];
                    final mine = message['role'] == 'user';

                    return Align(
                      alignment:
                          mine ? Alignment.centerRight : Alignment.centerLeft,
                      child: Container(
                        constraints: BoxConstraints(
                          maxWidth: MediaQuery.of(context).size.width * 0.82,
                        ),
                        margin: const EdgeInsets.symmetric(vertical: 7),
                        padding: const EdgeInsets.all(15),
                        decoration: BoxDecoration(
                          color: mine ? teal : Colors.white,
                          borderRadius: BorderRadius.circular(18),
                        ),
                        child: Text(
                          '${message['content']}',
                          style: TextStyle(
                            color: mine ? Colors.white : ink,
                            height: 1.45,
                          ),
                        ),
                      ),
                    );
                  },
                ),
        ),
        if (error != null)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(
              error!,
              style: const TextStyle(color: Colors.red),
            ),
          ),
        Container(
          color: Colors.white,
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 18),
          child: SafeArea(
            top: false,
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: input,
                    minLines: 1,
maxLines: 1,
keyboardType: TextInputType.text,
textInputAction: TextInputAction.send,
textCapitalization: TextCapitalization.sentences,
decoration: const InputDecoration(
  hintText: 'Ask about your health...',
  border: InputBorder.none,
  filled: false,
),
onSubmitted: (_) {
  if (!busy) send();
},
                  ),
                ),
                IconButton.filled(
                  onPressed: busy ? null : send,
                  icon: const Icon(Icons.arrow_upward),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class DoctorsPage extends StatefulWidget {
  const DoctorsPage({super.key});

  @override
  State<DoctorsPage> createState() => _DoctorsPageState();
}

class _DoctorsPageState extends State<DoctorsPage> {
  final query = TextEditingController();

  List<dynamic> doctors = [];

  String? matched;
  String? error;

  bool loading = true;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load({bool match = false}) async {
    setState(() {
      loading = true;
      error = null;
    });

    try {
      final result = await Api.call(
        match
            ? '/doctors/match?query=${Uri.encodeQueryComponent(query.text)}'
            : '/doctors',
      );

      if (!mounted) return;

      setState(() {
        doctors = List<dynamic>.from(
          match ? result['doctors'] : result,
        );
        matched = match ? result['specialty'] : null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  void dispose() {
    query.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Find your doctor',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  color: ink,
                ),
              ),
              const SizedBox(height: 7),
              const Text(
                'Search by symptoms to suggest a specialty.',
                style: TextStyle(color: Colors.blueGrey),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: query,
                      decoration: const InputDecoration(
                        hintText: 'e.g. skin rash, headache',
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    onPressed: () => load(
                      match: query.text.trim().isNotEmpty,
                    ),
                    icon: const Icon(Icons.search),
                  ),
                  IconButton(
                    onPressed: () {
                      query.clear();
                      load();
                    },
                    icon: const Icon(Icons.refresh),
                  ),
                ],
              ),
              if (matched != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    'Suggested specialty: $matched',
                    style: const TextStyle(
                      color: teal,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
            ],
          ),
        ),
        Expanded(
          child: loading
              ? const Center(child: CircularProgressIndicator())
              : error != null
                  ? Center(child: Text(error!))
                  : doctors.isEmpty
                      ? const Center(
                          child: Text(
                            'No doctors found for this specialty.',
                          ),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16,
                          ),
                          itemCount: doctors.length,
                          itemBuilder: (context, index) {
                            final doctor = doctors[index];

                            return Card(
                              margin: const EdgeInsets.only(bottom: 12),
                              child: Padding(
                                padding: const EdgeInsets.all(15),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        const CircleAvatar(
                                          backgroundColor: Color(0xFFE2F7F2),
                                          child: Icon(
                                            Icons.person_outline,
                                            color: teal,
                                          ),
                                        ),
                                        const SizedBox(width: 12),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                '${doctor['name']}',
                                                style: const TextStyle(
                                                  fontWeight: FontWeight.w800,
                                                  fontSize: 16,
                                                ),
                                              ),
                                              Text(
                                                '${doctor['specialty']}',
                                                style: const TextStyle(
                                                  color: teal,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 10),
                                    Text(
                                      '${doctor['qualification'] ?? ''} • '
                                      '${doctor['experience'] ?? 0} years experience',
                                    ),
                                    Text(
                                      '${doctor['hospital'] ?? ''}',
                                    ),
                                    const SizedBox(height: 10),
                                    Align(
                                      alignment: Alignment.centerRight,
                                      child: FilledButton(
                                        onPressed: () {
                                          Navigator.push(
                                            context,
                                            MaterialPageRoute(
                                              builder: (_) => BookingPage(
                                                doctor: doctor,
                                              ),
                                            ),
                                          );
                                        },
                                        child: const Text(
                                          'View slots & book',
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
        ),
      ],
    );
  }
}

class BookingPage extends StatefulWidget {
  final dynamic doctor;

  const BookingPage({
    super.key,
    required this.doctor,
  });

  @override
  State<BookingPage> createState() => _BookingPageState();
}

class _BookingPageState extends State<BookingPage> {
  DateTime date = DateTime.now().add(const Duration(days: 1));

  List<dynamic> slots = [];

  bool busy = false;
  String? error;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    setState(() {
      busy = true;
      error = null;
    });

    try {
      final day = DateFormat('yyyy-MM-dd').format(date);

      final data = await Api.call(
        '/doctors/${widget.doctor['_id']}/slots?date=$day',
      );

      if (!mounted) return;

      setState(() {
        slots = List<dynamic>.from(data['slots']);
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> book(String slot) async {
    final localTime = DateTime.parse(slot).toLocal();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('Confirm appointment'),
          content: Text(
            'Book an appointment with '
            '${widget.doctor['name']} on '
            '${DateFormat('dd MMM yyyy, hh:mm a').format(localTime)}?',
          ),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.pop(dialogContext, false);
              },
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () {
                Navigator.pop(dialogContext, true);
              },
              child: const Text('Confirm booking'),
            ),
          ],
        );
      },
    );

    if (!mounted || confirmed != true) return;

    setState(() {
      busy = true;
      error = null;
    });

    try {
      await Api.call(
        '/appointments',
        method: 'POST',
        body: {
          'doctorId': widget.doctor['_id'],
          'slot': slot,
        },
      );

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Appointment booked successfully!'),
        ),
      );

      Navigator.pop(context);
    } catch (e) {
      if (!mounted) return;
      setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Book an appointment'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            '${widget.doctor['name']}',
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: ink,
            ),
          ),
          Text(
            '${widget.doctor['specialty']} • '
            '${widget.doctor['hospital']}',
          ),
          const SizedBox(height: 22),
          const Text(
            'Select a date',
            style: TextStyle(fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 9),
          OutlinedButton.icon(
            onPressed: () async {
              final now = DateTime.now();
              final today = DateTime(
                now.year,
                now.month,
                now.day,
              );

              final selected = await showDatePicker(
                context: context,
                initialDate: date,
                firstDate: today,
                lastDate: today.add(
                  const Duration(days: 90),
                ),
              );

              if (!mounted || selected == null) return;

              setState(() => date = selected);
              await load();
            },
            icon: const Icon(Icons.calendar_today),
            label: Text(
              DateFormat('EEE, dd MMM yyyy').format(date),
            ),
          ),
          const SizedBox(height: 18),
          const Text(
            'Available appointment slots',
            style: TextStyle(fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 10),
          if (error != null)
            Text(
              error!,
              style: const TextStyle(color: Colors.red),
            ),
          if (busy)
            const Center(child: CircularProgressIndicator())
          else if (slots.isEmpty)
            const Text('No available slots for this date.')
          else
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: slots.map((slot) {
                final localTime = DateTime.parse(slot.toString()).toLocal();

                return ActionChip(
                  label: Text(
                    DateFormat('hh:mm a').format(localTime),
                  ),
                  onPressed: () => book(slot.toString()),
                );
              }).toList(),
            ),
          const SizedBox(height: 20),
          const Text(
            'Appointment times are displayed in your device timezone. '
            'Demo doctor details are for educational purposes.',
            style: TextStyle(
              color: Colors.blueGrey,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}

class AppointmentsPage extends StatefulWidget {
  const AppointmentsPage({super.key});

  @override
  State<AppointmentsPage> createState() => _AppointmentsPageState();
}

class _AppointmentsPageState extends State<AppointmentsPage> {
  List<dynamic> items = [];

  bool busy = true;
  String? error;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    setState(() {
      busy = true;
      error = null;
    });

    try {
      final data = await Api.call('/appointments');

      if (!mounted) return;

      setState(() {
        items = List<dynamic>.from(data);
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }


Future<void> cancel(String id) async {
  if (busy) return;

  final confirmed = await showDialog<bool>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: const Text('Cancel Appointment'),
      content: const Text(
        'Are you sure you want to cancel this booking?',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(dialogContext, false),
          child: const Text('No'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(dialogContext, true),
          child: const Text('Yes, Cancel'),
        ),
      ],
    ),
  );

  if (!mounted || confirmed != true) return;

  setState(() {
    busy = true;
    error = null;
  });

  try {
    final result = await Api.call(
      '/appointments/$id/cancel',
      method: 'PATCH',
    );

    final status = result is Map
    ? (result['status'] ??
        (result['appointment'] is Map
            ? result['appointment']['status']
            : null))
    : null;

if (status != 'cancelled') {
  throw Exception(
    'Server did not confirm cancellation. Response: $result',
  );
}
    if (!mounted) return;

    setState(() {
      items = items.map((item) {
        if (item['_id'].toString() == id) {
          return {
            ...Map<String, dynamic>.from(item),
            'status': 'cancelled',
          };
        }
        return item;
      }).toList();
      busy = false;
    });

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Appointment cancelled successfully!'),
        backgroundColor: Colors.green,
      ),
    );

    await load();
  } catch (e) {
    if (!mounted) return;

    final message = e.toString().replaceFirst('Exception: ', '');

    setState(() {
      busy = false;
      error = 'Cancellation failed: $message';
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Cancellation failed: $message'),
        backgroundColor: Colors.red,
      ),
    );
  }
}



  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: load,
      child: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  'My appointments',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    color: ink,
                  ),
                ),
              ),
              IconButton(
                onPressed: load,
                icon: const Icon(Icons.refresh),
              ),
            ],
          ),
          if (error != null)
            Text(
              error!,
              style: const TextStyle(color: Colors.red),
            ),
          if (busy)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(30),
                child: CircularProgressIndicator(),
              ),
            )
          else if (items.isEmpty)
            const Padding(
              padding: EdgeInsets.all(40),
              child: Center(
                child: Text(
                  'No appointments yet. Visit Doctors to book one.',
                ),
              ),
            )
          else
            ...items.map((appointment) {
              final localTime = DateTime.parse(appointment['slot']).toLocal();

              return Card(
                margin: const EdgeInsets.only(top: 12),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${appointment['doctorId']?['name'] ?? 'Doctor'}',
                        style: const TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        '${appointment['doctorId']?['specialty'] ?? ''}',
                        style: const TextStyle(color: teal),
                      ),
                      const SizedBox(height: 9),
                      Text(
                        DateFormat(
                          'dd MMM yyyy, hh:mm a',
                        ).format(localTime),
                      ),
                      Text(
                        'Status: ${appointment['status']}',
                        style: TextStyle(
                          color: appointment['status'] == 'booked'
                              ? teal
                              : Colors.red,
                        ),
                      ),
                      if (appointment['status'] == 'booked')
                        Align(
                          alignment: Alignment.centerRight,
                          child: TextButton(
                            onPressed: () => cancel(
                              appointment['_id'].toString(),
                            ),
                            child: const Text('Cancel booking'),
                          ),
                        ),
                    ],
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }
}
